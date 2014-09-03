module.exports = {
  index: function(req, res, next) {
  
  },
  list: function(req, res, next) {
  
  },
  view: function(req, res, next) {
    Organization.findOne({ slug: req.param('organizationSlug') }).exec(function(err, organization) {
      if (!organization) { return next(); }

      res.provide( err , { organization: organization } , {
        template: 'organization'
      });
    });
  }
}