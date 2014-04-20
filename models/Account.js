var mongoose = require('mongoose')
  , Schema = mongoose.Schema
  , ObjectId = mongoose.SchemaTypes.ObjectId
  , passportLocalMongoose = require('passport-local-mongoose')
  , slug = require('mongoose-slug');

// this defines the fields associated with the model,
// and moreover, their type.
var AccountSchema = new Schema({
    username: { type: String, required: true }
  , email:    { type: String, required: true }
  , created:  { type: Date, required: true, default: Date.now }
  , _actor:   { type: ObjectId, ref: 'Actor' }
});

// attach the passport fields to the model
AccountSchema.plugin(passportLocalMongoose);

// attach a URI-friendly slug
AccountSchema.plugin( slug( 'username' , {
  required: true
}) );

AccountSchema.pre('save', function(next) {
  var self = this;
  if (typeof(this._actor) == 'undefined' || !this._actor) {
    var actor = new Actor({
        type: 'Person'
      , target: self._id
      , slug: self.slug
    });
    this._actor = actor._id;

    actor.save( function(err) {
      if (err) { console.log(err); }
      next(err);
    });
  } else {
    next();
  }
});

var Account = mongoose.model('Account', AccountSchema);

// export the model to anything requiring it.
module.exports = {
  Account: Account
};