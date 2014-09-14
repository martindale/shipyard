var fs = require('fs');
var exec = require('child_process').exec;
var mime = require('mime');

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

      var repo = git(project.path);

      repo.diff(req.param('commitID'), req.param('commitID'), function(err, rawDiff) {
        if (err) { console.log(err); }
        
        var diff = require('pretty-diff');
        var html = diff( rawDiff );
        
        repo.branchLog( req.param('commitID') , function(err, commits) {
          
          var commit = commits[0];
          commit.diff = html;
          
          Account.lookup( commit.author , function(err, author) {
            commit._author = author;
            return res.render('commit', {
              commit: commit,
              project: project
            })
            
            res.provide(err , {
              commit: commit
            }, {
              template: 'commit'
            });
          });
        });
      } );
    });
  },
  viewBlob: function(req, res, next) {
    Project.lookup({ uniqueSlug: req.param('uniqueSlug') }, function(err, project) {
      if (!project) return next(); 
      
      var repo = git( project.path );
      var branch = req.param('branchName') || 'master';
      var filePath = req.param('filePath') + '/';

      console.log('filePath ' , filePath );

      repo.show( branch , req.param('filePath') , function(err, raw) {
        if (err) { console.log(err); }

        var contents = raw;
        var type = mime.lookup( req.param('filePath')  );
        var rendered = false;

        // TODO: build a better handler
        switch (type) {
          case 'text/x-markdown':
            contents = req.app.locals.marked(contents);
            rendered = true;
          break;
          case 'application/javascript':
          case 'application/json':
            contents = req.app.locals.marked('```js\n' + contents + '```');
            rendered = true;
          break;
        }

        repo.lsTree( branch , filePath , function(err, tree) {
          repo.prepareTreeView( tree , branch , function( err , treeView ) {
            var files = treeView;

            // note the use of req.param('filePath') here
            // -- it doesn't have the trailing slash.
            repo.logFilePretty( req.param('filePath') , branch , 0 , function(err, commits) {
              if (err) { console.log(err); }
                
              // find a corresponding User based on the commit email
              async.map( commits , function( commit , done ) {
                Account.lookup( commit.author , function(err, author) {
                  commit._author = author;
                  done( err , commit );
                });
              }, function(err, results) {
                commits = results || [];
                
                return res.render('file', {
                  project: project,
                  branch: branch,
                  filePath: filePath,
                  files: files,
                  file: {
                      name: req.param('filePath')
                    , type: type
                    , contents: contents
                    , raw: raw
                    , commits: commits
                    , rendered: rendered
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
        var branch = req.param('branchName') || 'master';
        var branches = [];
        var commits = [];
        var files = [];
        var flags = {};
        var graph;
        
        async.waterfall([
          function(next) {
            
            switch (project._owner.type) {
              case 'Account':      context = Account;      break;
              case 'Organization': context = Organization; break;
            }
            
            context.findOne({ _id: project._owner.target }, function(err, owner) {
              if (err) {
                console.log(err);
              }
              project._owner = owner;
              project.path = config.git.data.path + '/' + project._id; // remove with lean()

              next(err);
            });
          },
          // get a clean list of all available branches
          function(next) {
            repo.shortBranches(function(err, gitBranches) {
              // TODO: fail far earlier
              if (gitBranches.length === 0) {
                flags.setup = true;
                next(true);
              }
              else {
                // no failure?  repo is setup?  GO.
                next(null, gitBranches);
              }
            });
          },
          function(gitBranches, next) {
            // get a clean list of all commits on the current branch
            // these will be added to the branch checker, which is used to
            // validate requests to view trees at specific commits
            // NOTE: this is different from the call used to collect commits
            // for display in the "commits" tab in the UI
            repo.logBranchPretty(branch, function(err, branchCommits) {
              if (err) {
                console.log(err);
              }

              branches = _.union(gitBranches, branchCommits.map(function (commit) {
                return commit.commit;
              }));
              
              commits = branchCommits;

              debug.git('BRANCH: ' + branch);
              debug.git('BRANCHES: ' + branches);

              // by checking our list of branches, we prevent remote code execs
              if (branches.indexOf(branch) === -1) {
                return next('Invalid branch');
              }
              next(err);
            });
          },
          function(next) {
            // browse the tree at the specific "branch" (can be a real branch,
            // OR it can be a commit sha )
            repo.lsTree( branch , function(err, tree) {
              repo.prepareTreeView( tree , branch , function( err , treeView ) {
                files = treeView;
                next( err );
              });
            });
          },
          function(next) {
            // collect the README file if it exists
            repo.show(branch, "README.md", next);
          },
          function(readme, next) {
            if (readme) {
              project.readme = req.app.locals.marked(readme);
            }

            // find a corresponding User based on the commit email
            async.map( commits , function( commit , done ) {
              Account.lookup( commit.author , function(err, author) {
                commit._author = author;
                done( err , commit );
              });
            }, function(err, results) {
              commits = results || [];
              next(err);
            });
          }
        ], function(err) {
          
          return res.render('project', {
            project: project
            //, repo: repo
            , branch: branch
            , branches: branches
            , commits: commits
            , files: files
            , issues: issues
            , docks: docks
            , forks: forks
            , releases: releases
            , contributors: contributors
            , flags: flags
          });

          res.provide( err , {
            project: project
            //, repo: repo
            , branch: branch
            , branches: branches
            , commits: commits
            , files: files
            , issues: issues
            , docks: docks
            , forks: forks
            , releases: releases
            , contributors: contributors
            , flags: flags
          } , {
            template: 'project'
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
    
    var preSaveCommand = '';

    if (req.param('fromProjectID')) {
      Project.findOne({ _id: req.param('fromProjectID') }).exec(function(err, upstream) {
        preSaveCommand = 'cp -r ' + upstream.path.replace(/\s/g, "\\ ") + ' ' + project.path.replace(/\s/g, "\\ ");

        project._upstream = upstream._id;

        createProject();
      });
    } else {
      preSaveCommand = '';
      
      req.app.repos.create( project._id.toString() , function( err ) {
        if (err) return next(err);
        
        createProject();
      } );
    }

    function createProject() {
      exec( preSaveCommand , function(err, stdout) {
        if (err) return next(err);
        
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
};
