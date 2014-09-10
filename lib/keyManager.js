var fs = require('fs');
var path = require('path');
var lockFile = require('lockfile');
var atob = require("atob");
var config = require('../config.js')

var keypath = config.git.ssh.keyPath;
var keypathlock = keypath + ".lock";
var default_data = "#Automatically managed by ShipRight - do not edit manually";
var command = 'command="' + path.normalize(__dirname.replace(/\s/g, "\\ ") + '/gitshell.js'); //missing trailing " is intentional
var access_block = ",no-port-forwarding,no-X11-forwarding,no-agent-forwarding,no-pty";

//This handles writing to the git user authorized_keys file

module.exports = {
  "init": function(callback) {
    fs.exists(keypath, function(exists) {
      if (exists) {
        return callback(new Error("Key file already exists"));
      }
      fs.writeFile(keypath, default_data, function(err, written, buffer) {
        callback(err, written, buffer);
      });
    });
  },
  "addKey": function(key, callback) {
    fs.exists(keypath, function(exists) {
      if (!exists) {
        return callback(new Error("Key file doesnt exist"));
      }
      lockFile.lock(keypathlock, function(err) {
        //TODO sanitize keys of newlines, etc
        var data = command + " " + key._id.toString() + '"' + access_block + " " + key.key;
        fs.appendFile(keypath, data, function (err) {
          if (err) {
            console.log(err);
          }
          lockFile.unlock(keypathlock, function(err) {
            callback(err);
          });
        });
      });
    });
  },
  "removeKey": function(keyId, callback) {
    fs.exists(keypath, function(exists) {
      if (!exists) {
        return callback(new Error("Key file doesnt exist"));
      }
      lockFile.lock(keypathlock, function(err) {

        fs.readFile(keypath, function(err, oldData) {
          var oldData = oldData.toString().split("\n");
          var newData = "";

          //Copy all data except key we want to remove
          var keyIndex = 0;
          oldData.forEach(function (key) {
            if (key.indexOf("gitshell " + keyId) === -1) {
              if (keyIndex > 0) {
                newData += "\n";
              }
              keyIndex++;
              return newData += key;
            }
            keyIndex++;
          });

          fs.writeFile(keypath, newData, function (err, written, buffer) {
            lockFile.unlock(keypathlock, function (err) {
              callback(err, written, buffer);
            });
          });
        });
      });
    });
  },
  "checkKey": function(rawKey) {
    var getBytesAndSplit = function(bytes) {
      var sizeLen = 4;
      if (bytes.length < sizeLen + 1) {
        return false;
      }
      var sizeBytes = bytes.slice(0, sizeLen);
      var bytesAndTail = bytes.slice(sizeLen);
      var size = ((sizeBytes.charCodeAt(0) << (8 * 3)) + (sizeBytes.charCodeAt(1) << (8 * 2)))
        + (sizeBytes.charCodeAt(2) << (8 * 1)) + (sizeBytes.charCodeAt(3) << (8 * 0));
      
      if (bytesAndTail.length < size) {
        return false;
      }
      var integerBytes = bytesAndTail.slice(0, size);
      var tail = bytesAndTail.slice(size);
      return [integerBytes, tail];
    };
    var checkIntegers = function(num, bytes) {
      var result;
      for (var i = 0; 0 <= num ? i < num : i > num; 0 <= num ? i++ : i--) {
        result = getBytesAndSplit(bytes);
        if (result === false) {
          return false;
        }
        bytes = result[1];
      }
      return bytes.length === 0;
    };
    
    var keyTokens = rawKey.trim().split(" ");
    
    if (keyTokens.length < 2) {
      return false;
    }
    
    var humanType = keyTokens[0];
    var keyBase64 = keyTokens[1];
    
    if (humanType !== "ssh-rsa" && humanType !== "ssh-dss") {
      return false;
    }
    try {
      var keyBytes = atob(keyBase64);
    } catch (error) {
      return false;
    }
    var typeSizeParse = getBytesAndSplit(keyBytes);
    if (!typeSizeParse) {
      return false;
    }
    var keyBody = typeSizeParse[1];
    switch (humanType) {
      case "ssh-rsa":
        return checkIntegers(2, keyBody);
      case "ssh-dss":
        return checkIntegers(4, keyBody);
      default:
        return false;
    }
  }
};