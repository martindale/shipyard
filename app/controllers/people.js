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

      console.log(person);
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
  }
}