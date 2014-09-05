module.exports = {
  list: function(req, res, next) {
    Project.lookup({ uniqueSlug: req.param('uniqueSlug') }, function(err, project) {
      if (!project) { return next(); }

      Issue.find({ _project: project._id }).populate('_creator').exec(function(err, issues) {
        res.provide( err, {
            issues: issues
          , project: project
        }, {
          template: 'issues'
        });
      });
    });
  },
  view: function(req, res, next) {
    Project.lookup({ uniqueSlug: req.param('uniqueSlug') }, function(err, project) {
      if (!project) { return next(); }

      Issue.findOne({ _project: project._id, id: req.param('issueID') }).populate('_creator _comments _references._issue _references._creator').exec(function(err, issue) {
        if (!issue) { return next(); }

        Account.populate( issue , {
          path: '_comments._author'
        }, function(err, issue) {
          res.provide( err, {
              issue: issue
            , project: project
          }, {
            template: 'issue'
          });
        });

      });
    });
  },
  addComment: function(req, res, next) {
    Project.lookup({ uniqueSlug: req.param('uniqueSlug') }, function(err, project) {
      if (!project) { return next(); }

      Issue.findOne({ _project: project._id, id: req.param('issueID') }).exec(function(err, issue) {
        if (!issue) { return next(); }

        var comment = new Comment({
            message: req.param('message')
          , _author: req.user._id
        });
        comment.save(function(err) {
          issue._comments.push( comment._id );
          issue.save(function(err) {
            res.redirect( '/' + project._owner.slug + '/' + project.slug + '/issues/' + issue.id + '#' + comment._id );
          });
        });
      });
    });
  },
  diffForm: function(req, res, next) {
    Project.lookup({ uniqueSlug: req.param('uniqueSlug') }, function(err, project) {
      if (!project) return next();

      var collectors = [];
      var parts = [];
      
      var repo = git( project.path );
      
      if (req.param('upstreamUniqueSlug')) {
        
        parts = req.param('upstreamUniqueSlug').split('/');
        
        // TODO: default to upstream if no specific diff passed
        collectors.push( function(done) {
          //if (!req.param('upstreamUniqueSlug') && !project._upstream) return done(404);
          Project.lookup({ uniqueSlug: parts.slice(0, 2).join('/') }, function(err, upstream) {
            console.log(err, upstream);
            done(err, upstream)
          });
        } );
      }
      
      async.parallel( collectors , function(err, results) {
        if (err) return next(err);
        
        var upstream = results[0];
        
        var fromBranch = req.param('fromBranch') || 'master';
        var toBranch = parts[2] || 'master';
        
        var upstreamUniqueSlug = upstream._owner.slug + '/' + upstream.slug;
        
        repo.remote.add( upstreamUniqueSlug , upstream.path , function(err) {
          if (err) { console.log(err); }
          
          repo.diffBranches( fromBranch , upstreamUniqueSlug + '/' + toBranch , function(err, changes) {
            if (err) { console.log(err , changes); }
              
            async.map( changes , function( commit , done ) {
              Account.lookup( commit.author , function(err, author) {
                commit._author = author;
                done( err , commit );
              });
            }, function(err, results) {
              res.render('pull-request-new', {
                original: project,
                upstream: upstream,
                fromBranch: fromBranch,
                toBranch: toBranch,
                changes: changes
              });
            });
          });
        });
      });
    });
  },
  createForm: function(req, res, next) {
    Project.lookup({ uniqueSlug: req.param('uniqueSlug') }, function(err, project) {
      if (!project) return next();
      var collectors = [];
      
      async.parallel( collectors , function(err, results) {
        if (err) return next(err);
        
        res.render('issue-new', {
          project: project,
          original: project,
          upstream: results[0]
        });
      });

    });
  },
  create: function(req, res, next) {
    Project.lookup({ uniqueSlug: req.param('uniqueSlug') }, function(err, project) {
      if (!project) { return next(); }

      Issue.find({ _project: project._id }, { id: 1 }).exec(function(err, issues) {
        if (!issues || !issues.length) {
          var issues = [{ id: 0 }];
        }

        var id = _.max(issues.map(function(x) { return x.id; }));
        var issue = new Issue({
            id: ++id
          , _project: project._id
          , name: req.param('name')
          , description: req.param('description')
          , _creator: req.user._id
        });
        issue.save(function(err) {
          if (err) { console.log(err); }
          res.redirect( '/' + project._owner.slug + '/' + project.slug + '/issues/' + issue.id );
        });
      });
    });
  }
}
