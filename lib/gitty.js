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

git.Repository.prototype.fetch = function( remote , complete ) {
  var repo = this;
  var flags = [ remote ];
  
  var cmd = new git.Command(repo.path, 'fetch' , flags , '' );
  cmd.exec(function(error, stdout, stderr) {
    var err = error || stderr;
    complete.call( repo , err );
  });
}

git.Repository.prototype.merge = function(branch, flags, callback) {
  if (typeof(flags) === 'function') {
    var callback = flags;
    var flags = [];
  }
  
  var gitMerge = new Command(this.path, 'merge', flags, branch)
    , repo = this;
  gitMerge.exec(function(error, stdout, stderr) {
    var err = error || stderr;
    if (callback && typeof callback === 'function') callback.call(repo, err);
  });
};

git.Repository.prototype.diffBranches = function( from , to , complete ) {
  var repo = this;
  var flags = [ '--pretty=format:\'{"commit": "%H","author": "%an <%ae>","date": "%ad","message": "%f"}\'', to +'...'+from  ];

  var cmd = new git.Command(repo.path, 'log', flags, '');
  console.log( cmd );
  cmd.exec(function(error, stdout, stderr) {
    var err = error || stderr;
    complete.call(repo, err, parseJSON(arrayFromNewlines(stdout)));
  });
}

git.Repository.prototype.prepareTreeView = function( tree , branch , complete ) {
  var repo = this;
  
  // asynchronously collect the latest commit for each known file
  // in the current view
  async.map( tree , function( blob , cb ) {
    // get the latest commit (and its author, timestamp, and
    // message) from the git log
    repo.logFilePretty( blob.name , branch , 1 , function(err, commit) {
      blob.commit = commit[0];
      blob.commit.message = (commit[0].message.length > 50) ? commit[0].message.slice(0, 50) + '…' : commit[0].message;
      cb(err , blob);
    });
  }, function(err, completedTree) {
    if (err) return complete(err);

    function compareByName(a, b) {
      if (a.name < b.name) return -1;
      if (a.name > b.name) return 1;
      return 0;
    }

    function compareByType(a, b) {
      if (a.type === 'tree') return -1;
      if (a.type === 'blob') return 1;
      return 0;
    }

    // sort by name first
    completedTree.sort(function (a, b) {
      if (a.type === b.type) return compareByName(a, b);
      return compareByType(a, b);
    });
    
    complete( err , completedTree );
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
git.Repository.prototype.logFilePretty = function(fileName, branchName, limit, callback) {
  var repo = this;
  var flags = [ branchName , '--pretty=format:\'{"commit": "%H","author": "%an <%ae>","date": "%ad","message": "%f"}\'', '--', fileName ];
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

git.Repository.prototype.lsTree = function( branchName , pathName , callback) {
  var repo = this;

  if (typeof(pathName) === 'function') {
    var callback = pathName;
    var pathName = '.';
  }
  
  var cmd = new git.Command(repo.path, 'ls-tree', [ branchName , pathName ], '');
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
