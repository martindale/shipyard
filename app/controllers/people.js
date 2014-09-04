module.exports = {
  list: function(req, res, next) {
    People.find().exec(function(err, people) {
      res.provide( err, people , {
        template: 'people'
      });
    });
  },
  view: function(req, res, next) {
    People.findOne({ slug: req.param('usernameSlug') }).exec(function(err, person) {
      if (err) { console.log(err); }
      if (!person) { return next(); }

      Project.find({ _owner: person._actor }).lean().exec(function(err, projects) {

        projects = projects.map(function(x) {
          x._owner = person;
          return x;
        });

        res.provide( err, { 
            person: person
          , projects: projects
        }, {
          template: 'person'
        });
      });
    });
  },
  // TODO: build a proper profile edit (including deletion of emails)
  // or, just use Maki.
  addEmail: function(req, res, next) {
    if (!req.param('email')) return next(400);
    
    People.findOneAndUpdate({
      slug: req.param('usernameSlug')
    }, {
      $addToSet: {
        emails: req.param('email')
      }
    }, function(err, person) {
      if (err || !person) return next(err);
      return res.redirect('/' + person.slug );
    });
  },
  // TODO: build a proper profile edit (including deletion of emails)
  // or, just use Maki.
  removeEmail: function(req, res, next) {
    People.findOneAndUpdate({
      slug: req.param('usernameSlug')
    }, {
      $pull: {
        emails: req.param('email')
      }
    }, function(err, person) {
      if (err || !person) return next(err);
      return res.status(200).end();
    });
  }
}
