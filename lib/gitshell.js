#!/usr/local/bin/node

/**
 * This script is executed automatically by ssh after a successful login
 * since it is specified via 'command="' in the authorized_keys file 
 * whenever we add a key. The command also passes one argument, a mongo ID 
 * in string form which is unique per-key resolving to a document in the
 * PublicKey collection. This allows us to determine which user the key
 * belongs to and therefore the permissions for executing commands.
 * 
 * This file must be executable by the ssh user (default: git)
 */

var fs = require('fs');
var path = require('path');
var spawn = require('child_process').spawn;
var shellWords = require('shellwords');
var rootPath = path.normalize(__dirname.replace(/\s/g, "\\ ") + "/../");

require('../db');
config = require('../config');

Account = require('../app/models/Account').Account;
Actor = require('../app/models/Actor').Actor;
Project = require('../app/models/Project').Project;
PublicKey = require('../app/models/PublicKey').PublicKey;

var args = process.argv.slice(0);

if (args.length < 3) {
  return console.log("Unknown execution type. Must be executed from SSH shell");
}

//Command white-list
var allowedCommands = ["git-upload-pack", "git-recieve-pack", "git-upload-archive"];

//This variable is set by SSH
var sshCommand = process.env.SSH_ORIGINAL_COMMAND;

//Parses the command into unix style
function parseCommand(command, callback) {
  var args = shellWords.split(command);
  if (args.length !== 2) {
    //TODO: log this command w/ user in security logs
    return callback("Invalid command or unauthorized access\n");
  }

  var cmd = args[0];
  var repoPath = args[1]; //TODO: SECURITY VALIDATE REPO URL
  
  if (allowedCommands.indexOf(cmd) === 1) {
    return callback("Invalid command or unauthorized access\n");
  }
  callback(null, cmd, repoPath);
}

//Simply returns an authentication error
function blocked() {
  return console.log("Permission denied (publickey).");
}

//Sends an error back to the client and exits
function sendError(message) {
  process.stderr.write(message + "\n");
  process.exit();
}

//Look up the key from the id passed by ssh
PublicKey.findOne({_id: args[2]}).exec(function(err, key) {
  if (err) {
    //TODO: Send back a different error and log this interally?
    return sendError(err);
  }
  if (!key) {
    //No key was passed to this function (should never happen)
    //TODO: Log an error here if this ever happens
    blocked();
  }
  if (key) {
    //Check to see if the user has deactivated this public key
    if (key.disabled) {
      return blocked();
    }
    
    //Find the account associated with this key
    Account.findOne({_id: key._owner}).exec(function (err, account) {
      if (err) {
        //TODO: Send back a different error and log this interally?
        return sendError(err);
      }
      
      //No account found matching mongo id (should never happen)
      if (!account) {
        //TODO: log this as error in logs
        return sendError("Unknown error occurred determining authenticating user");
      }

      //No command means they just attempted to ssh with this key, just tell them it works
      if (!sshCommand) {
        console.log("Hello " + account.username + "! You have successfully authenticated with shipright.");
        return process.exit();
      }
          
      //Parse the command sent to get the repo information
      parseCommand(sshCommand, function (err, cmd, repoPath) {
        if (err) {
          return sendError(err);
        }

        //Look up the repo from the command
        Project.lookup({uniqueSlug: repoPath}, function (err, project) {
          if (err || !project) {
            return sendError("Invalid repository");
          }

          //TODO: verify account can run this command on this project
          
          //TODO: Probably should make the config repo path absolute
          var fullPath = rootPath + project.path;
          
          var fullCMD = cmd + " " + fullPath;
          var child = spawn('sh', ["-c", fullCMD], {stdio: 'inherit'});
          
          child.on('exit', function(code) {
            //TODO: Check exit code for logging purposes
            process.exit();
          });
        });
      });
    });
  }
});
