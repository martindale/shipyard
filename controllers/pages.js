module.exports = {
  index: function(req, res, next) {
    async.parallel([
      function(done) {
        Project.find().limit(10).populate('_owner').exec( done );
      },
      function(done) {
        Activity.find().limit(10).sort('-_id').exec( done );
      },
    ], function(err, results) {
      res.provide( err , {
          projects:   results[0]
        , activities: results[1]
      }, {
        template: 'index'
      });
    });
  },
  examples: function(req, res, next) {
    require('fs').readFile('examples.json', function(err, data) {
      res.provide(  err , JSON.parse(data) , {
        template: 'examples'
      });
    });
  }
}