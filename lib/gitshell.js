#!/usr/local/bin/node
var fs = require('fs');
require('../db');
var config = require('../config');
var PublicKey = require('../app/models/PublicKey').PublicKey;
var Account = require('../app/models/Account').Account;

var args = process.argv.slice(0);

if (args.length < 3) {
  return console.log("Unknown execution type. Must be executed from SSH shell");
}

//This is for debug
var data = {
    args: args
  , env: process.env
};

//Look up the key from the id passed by ssh
PublicKey.findOne({_id: args[2]}).exec(function(err, key) {
  if (err) {
    return console.log(err);
  }
  if (!key) {
    data.key = "not found";
    blocked();
  }
  if (key) {
    data.key = key;
    if (key.disabled) {
      blocked();
    }
    else {
      Account.findOne({_id: key._owner}).exec(function(err, account) {
        if (err) {
          return console.log(err);
        }
        if (!account) {
          return console.log("Unknown error occurred determining authenticating user");
        }
        else {
          data.account = account;
          if (!process.env.SSH_ORIGINAL_COMMAND) {
            console.log("Hello " + account.username + "! You have successfully authenticated with shipright.");
          }
          else {
            //TODO: validate and execute process.env.SSH_ORIGINAL_COMMAND
            
          }
          //Log some data to a file for testing purposes :D
          writeFile(JSON.stringify(data, null, 4), function(err, written, buffer) {
            //return console.log(err, written, buffer);
            process.exit();
          });
        }
      });
    }
  }
});

function blocked() {
  data.blocked = true;å
  return console.log("Permission denied (publickey).");
}

function writeFile(data, callback) {
  fs.writeFile("/Users/" + config.git.ssh.user + "/gitshell-data", data, function (err, written, buffer) {
      callback(err, written, buffer);
  });
}
