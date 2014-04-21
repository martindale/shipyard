var fs = require('fs');
var exec = require('child_process').exec;

module.exports = {
  index: function(req, res, next) {

  },
  list: function(req, res, next) {
    Project.find().exec(function(err, projects) {
      res.provide( err , { projects: projects } , {
        template: 'projects'
      });
    });
  },
  git: {
    refs: function(req, res, next) {
      Project.lookup( req.param('uniqueSlug') , function(err, project) {
        if (err) { return next(); }
        exec('git receive-pack ' + project.path , function(err, stdout, stderr) {
          res.send( stdout );
        });
      });
    }
  },
  viewBlob: function(req, res, next) {
    Project.lookup( req.param('uniqueSlug') , function(err, project) {
      if (!project) { return next(); }

      var command = 'cd ' + project.path + ' && git show ' + req.param('branchName') + ':' + req.param('filePath');
      console.log(command);
      exec( command , function(err, stdout, stderr) {
        res.provide( err , {
          file: {
              name: req.param('filePath')
            , contents: stdout
          }
        } , {
          template: 'file'
        });
      });
    });
  },
  view: function(req, res, next) {
    Actor.findOne({ slug: req.param('actorSlug') }).exec(function(err, actor) {
      if (!actor) { return next(); }

      Project.findOne({
          _owner: actor._id
        , slug: req.param('projectSlug')
      }).populate('_owner').lean().exec(function(err, project) {
        if (!project) { return next(); }

        var context = Account;

        switch (project._owner.type) {
          case 'Account':      var context = Account;      break;
          case 'Organization': var context = Organization; break;
        }

        context.findOne({ _id: project._owner.target }, function(err, owner) {
          if (err) { console.log(err); }

          project._owner = owner;
          project.path = config.git.data.path + '/' + project._id; // remove with lean()

          var repo = git( config.git.data.path + '/' + project._id );

          var branch = req.param('branchName') || 'master';

          exec('cd '+project.path+ ' && git ls-tree ' + branch, function(err, stdout, stderr) {
            if (err) { console.log(err); }

            var tree = stdout.split('\n').map(function(x) {
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

            tree.sort(function(a, b) {
              if (a.name < b.name) return -1;
              if (a.name > b.name) return 1;
              return 0;
            });

            async.parallel(tree.map(function(x) {
              return function(done) {

                x.commit = {
                  timestamp: new Date()
                };

                done( null , x );
              };
            }), function(err, completedTree) {
              console.log(completedTree)

              exec('cd '+project.path+' && git for-each-ref --format=\'%(refname:short)\' refs/heads/', function(err, stdout, stderr) {
                var branches = stdout.split('\n');
                repo.log(function(err, log) {
                  res.provide( err , {
                      project: project
                    , repo: repo
                    , branch: branch
                    , branches: branches
                    , commits: log
                    , files: completedTree
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

    var path = config.git.data.path + '/' + project._id ;

    // TODO: use job scheduler
    Git.Repo.init( path , false , function(err, repo) {
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


      /*
      var file = path + '/README.md';
      var buffer = new Buffer('# ' + project.name + '\n')
      fs.writeFileSync( file , buffer )

      repo.createBlobFromFile( file , function(err, blob) {
        if (err) { console.log(err); }

        var builder = Git.TreeBuilder.create();
        builder.repo = repo;


        builder.insert( file , blob.Oid , false );

        builder.write(function(err, treeID) {
          if (err) { console.log(err); }

          var signature = Git.Signature.create('Eric Martindale', 'eric@ericmartindale.com', 0, 0 );

          repo.createCommit( null , signature , signature , 'test 1', 'master', null, function(err, commit) {
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
        });
      });*/
    });
  }
}