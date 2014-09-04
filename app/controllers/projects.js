var fs = require('fs');
var exec = require('child_process').exec;
var mime = require('mime');
var git = require('../../lib/gitty');

function cleanGitLog(x) {
  var parts = x.split(/\s/);

  return {
      id: parts.shift()
    , message: parts.join(' ')
  }
}

module.exports = {
  index: function(req, res, next) {

  },
  list: function(req, res, next) {
    Project.find().populate('_owner').exec(function(err, projects) {
      res.provide( err , { projects: projects } , {
        template: 'projects'
      });
    });
  },
  git: {
    refs: function(req, res, next) {
      Project.lookup({ uniqueSlug: req.param('uniqueSlug') }, function(err, project) {
        if (err) { return next(); }
        exec('git receive-pack ' + project.path , function(err, stdout, stderr) {
          res.send( stdout );
        });
      });
    }
  },
  viewCommit: function(req, res, next) {
    Project.lookup({ uniqueSlug: req.param('uniqueSlug') }, function(err, project) {
      if (!project) { return next(); }

      //var diff = require('../lib/pretty-diff');

      exec( 'cd ' + project.path + ' && git diff '+req.param('commitID')+'^ '+req.param('commitID') , function(err, stdout, stderr) {
        if (err) { console.log(err); }
        if (stderr) { return next(); }

        var rawDiff = stdout;

        var diff = require('pretty-diff');
        
        var html = diff( rawDiff );
      
        res.provide(err , {
          commit: {
              id: req.param('commitID')
            , diff: html
          }
        }, {
          template: 'commit'
        });
      } );
    });
  },
  viewBlob: function(req, res, next) {
    Project.lookup({ uniqueSlug: req.param('uniqueSlug') }, function(err, project) {
      if (!project) { return next(); }

      var command = 'cd ' + project.path + ' && git show ' + req.param('branchName') + ':' + req.param('filePath');
      exec( command , function(err, stdout, stderr) {

        var raw = stdout;
        var contents = raw;
        var type = mime.lookup( req.param('filePath') );

        // TODO: build a better handler
        switch (type) {
          case 'text/x-markdown':
            contents = req.app.locals.marked(contents);
          break;
          case 'application/javascript':
            contents = req.app.locals.marked('```js\n' + contents + '```');
          break;
        }

        exec('cd  ' + project.path + ' && git log --pretty=oneline  '+ req.param('filePath'), function(err, stdout, stderr) {
          if (err) { console.log(err); }

          var commits = stdout.split('\n');
          commits = commits.map( cleanGitLog );

          return res.render('file', {
            project: project,
            file: {
                name: req.param('filePath')
              , type: type
              , contents: contents
              , raw: raw
              , commits: commits
            }
          });

          res.provide( err , {
            project: project,
            file: {
                name: req.param('filePath')
              , type: type
              , contents: contents
              , raw: raw
              , commits: commits
            }
          } , {
            template: 'file'
          });
        });
      });
    });
  },
  view: function(req, res, next) {
    Project.lookup({ uniqueSlug: req.param('uniqueSlug') }, function(err, project) {
      
      if (err) return next( err );
      if (!project) { return next(); }

      var repo = git( project.path );

      async.parallel([
        function(done) {
          Issue.find({ _project: project._id, type: 'issue' }).populate('_creator').exec( done );
        },
        function(done) {
          Issue.find({ _project: project._id, type: 'dock' }).populate('_creator').exec( done );
        },
        function(done) {
          Project.getForks( project , done );
        },
        function(done) {
          // TODO: implement releases
          done( null , [] );
        },
        function(done) {
          // TODO: implement contributor listings
          done( null , [] );
        }
      ], function(err, results) {

        var issues       = results[0];
        var docks        = results[1];
        var forks        = results[2];
        var releases     = results[3];
        var contributors = results[4];

        // temporary hack until we get Organizations
        var context = Account;

        switch (project._owner.type) {
          case 'Account':      var context = Account;      break;
          case 'Organization': var context = Organization; break;
        }

        context.findOne({ _id: project._owner.target }, function(err, owner) {
          if (err) { console.log(err); }

          project._owner = owner;
          project.path = config.git.data.path + '/' + project._id; // remove with lean()

          var branch = req.param('branchName') || 'master';
          
          // get a clean list of all available branches
          repo.shortBranches(function(err, branchData) {
            var gitBranches = branchData.split('\n').filter(function(x) {
              return x.length > 0;
            });
            
            // get a clean list of all commits on the current branch
            // these will be added to the branch checker, which is used to
            // validate requests to view trees at specific commits
            // NOTE: this is different from the call used to collect commits
            // for display in the "commits" tab in the UI
            repo.logPretty(branch, function(err, commits) {
              if (err) console.log(err);
              
              var commits = commits.split('\n').map( cleanGitLog ).map(function(x) {
                return x.id;
              }).filter(function(x) {
                return x.length > 0;
              });

              var branches = _.union( gitBranches , commits );

              debug.git('BRANCH: ' + branch );
              debug.git('BRANCHES: ' + branches);

              // by checking our list of branches, we prevent remote code execs
              if (branches.indexOf( branch ) === -1) return next();
              
              // browse the tree at the specific "branch" (can be a real branch,
              // OR it can be a commit sha )
              repo.lsTree(branch, function(err, treeData) {
                if (err) { console.log(err); }

                // TODO: expose this in gitty
                var tree = treeData.split('\n').map(function(x) {
                  var parts = x.split(/\s/);
                  return {
                      attributes: parts[0]
                    , type:       parts[1]
                    , id:         parts[2]
                    , name:       parts[3]
                  };
                });

                // remove erroneous blank entry
                tree = _.filter( tree , function(x) {
                  return x.name;
                });
                
                // asynchronously collect the latest commit for each known file
                // in the current view
                async.map( tree , function( blob , cb ) {
                  
                  // get the latest commit (and its author, timestamp, and
                  // message) from the git log
                  repo.logFilePretty(blob.name, function(err, commit) {
                    var parts = commit.split(' ');
                    
                    blob.commit = {
                      sha: parts[0],
                      author: parts[1],
                      date: (new Date( parts[2] * 1000 )),
                      message: parts.slice( 3 ).join(' ')
                    };
                    
                    cb(err , blob);
                  });
                }, function(err, completedTree) {
                  
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
                  completedTree.sort(function(a, b) {
                    if (a.type === b.type) return compareByName(a, b);
                    return compareByType(a, b);
                  });

                  // collect the README file if it exists
                  repo.show(branch, "README.md", function(err, readme){
                    if (readme) {
                      project.readme = req.app.locals.marked(readme);
                    }

                    // collect a clean list of branches
                    // TODO: this is a duplicate of an existing call above?
                    repo.shortBranches(function(err, branchData) {
                      var branches = branchData.split('\n').map(function(x) {
                        return x.trim();
                      }).sort(function(a, b) {
                        if (a === 'master') return -1;
                        return a - b;
                      });
                      
                      // TODO: eliminate double calls
                      // get the log of commits on this current branch / commit
                      repo.branchLog(branch, function(err, commits) {
                        
                        // find a corresponding User based on the commit email
                        async.map( commits , function( commit , done ) {
                          Account.lookup( commit.author , function(err, author) {
                            commit._author = author;
                            done( err , commit );
                          });
                        }, function(err, commits) {

                          return res.render('project', {
                              project: project
                            //, repo: repo
                            , branch: branch
                            , branches: branches
                            , commits: commits
                            , files: completedTree
                            , issues: issues
                            , docks: docks
                            , forks: forks
                            , releases: releases
                            , contributors: contributors
                          });

                          res.provide( err , {
                              project: project
                            //, repo: repo
                            , branch: branch
                            , branches: branches
                            , commits: commits
                            , files: completedTree
                            , issues: issues
                            , docks: docks
                            , forks: forks
                            , releases: releases
                            , contributors: contributors
                          } , {
                            template: 'project'
                          });
                        });
                      });
                    });
                  });
                });
              });
              
            });
          });
        });
      });
    });
  },
  listIssues: function(req, res, next) {

  },
  createForm: function(req, res, next) {
    res.render('project-new');
  },
  create: function(req, res, next) {

    var project = new Project();

    project.name        = req.param('name');
    project.description = req.param('description');
    project._creator    = req.user._actor;
    project._owner      = req.user._actor;

    //var path = config.git.data.path + '/' + project._id ;
    var path = config.git.data.path + '/' + req.param('uniqueSlug') ;
    var command = '';

    if (req.param('fromProjectID')) {
      Project.findOne({ _id: req.param('fromProjectID') }).exec(function(err, upstream) {
        command = 'cp -r ' + config.git.data.path + '/' + upstream._id + ' ' + path;

        project._upstream = upstream._id;

        createProject();
      });
    } else {
      command = 'mkdir ' + path + ' && cd ' + path + ' && git init && echo "# '+project._id+'" > README.md && git add README.md && git commit -m "Initial commit."';
      createProject();
    }

    function createProject() {
      // TODO: use job scheduler
      
      return req.app.repos.create( project._id.toString() , function( err ) {
        if (err) return next( err );
        
        project.save(function(err) {
          if (err) { console.log(err); }
          Actor.populate( project , {
            path: '_owner'
          } , function(err, project) {
            if (err) { console.log(err); }

            res.redirect('/' + project._owner.slug + '/' + project.slug )
          });
        });
        
      });
      
      exec( command , function(err, stdout, stderr) {
        if (err) { console.log(err); }

        project.save(function(err) {
          if (err) { console.log(err); }
          Actor.populate( project , {
            path: '_owner'
          } , function(err, project) {
            if (err) { console.log(err); }

            res.redirect('/' + project._owner.slug + '/' + project.slug )
          });
        });
      });
    }

  }
}
