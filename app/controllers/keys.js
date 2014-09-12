module.exports = {
  createForm: function(req, res, next) {
      res.render('key-new');
  },
  create: function(req, res, next) {
    //TODO: Actual error handling
    PublicKey.count({ _actor: req.user._id, key: req.param('key') }).exec(function(err, keys) {
      if (keys && keys > 0) {
        //Key already exists
        //TODO: give them an error
        return res.redirect('/' + req.user.slug);
      }
      
      var key = new PublicKey({
          _owner: req.user._id
        , name: req.param('name')
        , key: req.param('key')
      });
      
      key.save(function(err) {
        if (err) { console.log(err); }
        res.redirect('/' + req.user.slug);
      });
    });
  }
}