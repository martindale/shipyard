var git = require('gitty');

//Pretty git log used to get commits
git.Repository.prototype.logPretty = function(branchName, callback) {
  var repo = this;
  var cmd = new git.Command(repo.path, 'log', [branchName, '--pretty=oneline'], '');

  cmd.exec(function(error, stdout, stderr) {
    var err = error || stderr;
    callback.call(repo, err, stdout);
  });
};

git.Repository.prototype.shortBranches = function(callback) {
  var repo = this;
  var cmd = new git.Command(repo.path, 'for-each-ref', ['--format=\'%(refname:short)\'', 'refs/heads/'], '');

  cmd.exec(function(error, stdout, stderr) {
    var err = error || stderr;
    callback.call(repo, err, stdout);
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
    callback.call(repo, err, stdout);
  });
};

git.Repository.prototype.logFilePretty = function(fileName, callback) {
  var repo = this;
  var cmd = new git.Command(repo.path, 'log', ['-n 1', '--pretty=format:"%H %ae %at %s"', '--'], fileName);

  cmd.exec(function(error, stdout, stderr) {
    var err = error || stderr;
    callback.call(repo, err, stdout);
  });
};

module.exports = git;