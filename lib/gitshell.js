#!/usr/local/bin/node
var fs = require('fs');
var path = require('path');
var spawn = require('child_process').spawn;
var shellwords = require('shellwords');
var kexec = require('kexec');
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

//Command whitelist
var allowedCommands = ["git-upload-pack", "git-recieve-pack", "git-upload-archive"];

//Look up the key from the id passed by ssh
PublicKey.findOne({_id: args[2]}).exec(function(err, key) {
  if (err) {
    return process.stderr.write(err + "\n");
  }
  if (!key) {
    blocked();
  }
  if (key) {
    if (key.disabled) {
      blocked();
    }
    else {
      //Find the account associated with this key
      Account.findOne({_id: key._owner}).exec(function (err, account) {
        if (err) {
          return process.stderr.write(err + "\n");
        }
        if (!account) {
          //TODO: log this as error in logs
          return process.stderr.write("Unknown error occurred determining authenticating user\n");
        }
        else {
          if (!process.env.SSH_ORIGINAL_COMMAND) {
            console.log("Hello " + account.username + "! You have successfully authenticated with shipright.");
          }
          else {
            
            //Parse the command sent to get the repo information
            parseCommand(process.env.SSH_ORIGINAL_COMMAND, function (err, cmd, repoPath) {
              if (err) {
                return process.stderr.write(err+"\n");
              }

              //Look up the repo from the command
              Project.lookup({uniqueSlug: repoPath}, function (err, project) {
                if (err || !project) {
                  return process.stderr.write("Invalid repository\n");
                }

                //TODO: verify account can run this command on this project
                
                //TODO: Probably should make the config repo path absolute
                var fullPath = path.normalize(__dirname + "/../" + project.path);
                
                //Mutate our process from node into the original git command at the correct repo path
                kexec(cmd, [fullPath]);
              });
            });
          }
        }
      });
    }
  }
});

function parseCommand(command, callback) {
  var args = shellwords.split(command);
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

function blocked() {
  return console.log("Permission denied (publickey).");
}