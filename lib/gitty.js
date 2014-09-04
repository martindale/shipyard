var git = require('gitty');

//Helpers
function arrayFromNewlines(data) {
  return data.split('\n').filter(function(x) {
    return x.length > 0;
  });
}

function arrayFromSpaces(data) {
  return data.split(/\s/).filter(function(x) {
    return x.length > 0;
  });
}

function parseJSON(data) {
  return data.map(function(x) {
    var row = JSON.parse(x);
    row.message = row.message.replace(/-/g, ' ');
    return row;
  });
}

//Pretty git log used to get commits for branches 
git.Repository.prototype.logBranchPretty = function(branchName, callback) {
  var repo = this;
  var cmd = new git.Command(repo.path, 'log', ['--pretty=format:\'{"commit": "%H","author": "%an <%ae>","date": "%ad","message": "%f"}\'', branchName], '');
  
  cmd.exec(function(error, stdout, stderr) {
    var err = error || stderr;
    callback.call(repo, err, parseJSON(arrayFromNewlines(stdout)));
  });
};

//Pretty git log used to get commits for files by name
git.Repository.prototype.logFilePretty = function(fileName, limit, callback) {
  var repo = this;
  var flags = ['--pretty=format:\'{"commit": "%H","author": "%an <%ae>","date": "%ad","message": "%f"}\'', '--', fileName];
  if (limit) {
    flags.unshift('-n ' + limit);
  }
  
  var cmd = new git.Command(repo.path, 'log', flags, '');

  cmd.exec(function(error, stdout, stderr) {
    var err = error || stderr;
    callback.call(repo, err, parseJSON(arrayFromNewlines(stdout)));
  });
};

git.Repository.prototype.shortBranches = function(callback) {
  var repo = this;
  var cmd = new git.Command(repo.path, 'for-each-ref', ['--format=\'%(refname:short)\'', 'refs/heads/'], '');
  
  cmd.exec(function(error, stdout, stderr) {
    var err = error || stderr;
    callback.call(repo, err, arrayFromNewlines(stdout));
  });
};

git.Repository.prototype.show = function(branchName, fileName, callback) {
  var repo = this;
  var cmd = new git.Command(repo.path, 'show', [branchName + ":" + fileName], '');

  cmd.exec(function(error, stdout, stderr) {
    var err = error || stderr;
    callback.call(repo, err, stdout);
  });
};

git.Repository.prototype.lsTree = function(branchName, callback) {
  var repo = this;
  var cmd = new git.Command(repo.path, 'ls-tree', [branchName], '');

  cmd.exec(function(error, stdout, stderr) {
    var err = error || stderr;
    callback.call(repo, err, arrayFromNewlines(stdout).map(arrayFromSpaces).map(function(x) {
      return {
        attributes: x[0]
        , type:     x[1]
        , id:       x[2]
        , name:     x[3]
      };
    }));
  });
};

git.Repository.prototype.diff = function(commitA, commitB, callback) {
  var repo = this;
  var cmd = new git.Command(repo.path, 'diff', [commitA + '^', commitB], '');

  cmd.exec(function(error, stdout, stderr) {
    var err = error || stderr;
    callback.call(repo, err, stdout);
  });
};

module.exports = git;
