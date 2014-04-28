var mongoose = require('mongoose')
  , Schema = mongoose.Schema
  , ObjectId = mongoose.SchemaTypes.ObjectId
  , passportLocalMongoose = require('passport-local-mongoose')
  , slug = require('mongoose-slug')
  , crypto = require('crypto');

// this defines the fields associated with the model,
// and moreover, their type.
var AccountSchema = new Schema({
    username: { type: String, required: true }
  , emails:   [ { type: String, required: true } ]
  , image: {
        url: { type: String, default: '/img/user-avatar.png' }
      , small: { type: String, default: '/img/user-avatar.png' }
    }
  , created:  { type: Date, required: true, default: Date.now }
  , _actor:   { type: ObjectId, ref: 'Actor' }
  , profiles: {
      google: [ new Schema({ id: String , email: String }) ]
    }
});

// attach the passport fields to the model
AccountSchema.plugin(passportLocalMongoose);

// attach a URI-friendly slug
AccountSchema.plugin( slug( 'username' , {
  required: true
}) );

AccountSchema.pre('save', function(next) {
  var self = this;

  if (!this.image || !this.image.url || this.image.url == '/img/user-avatar.png' || (this.image.url.match('gravatar.com') && this.email)) {
    this.image = undefined; // delete element to let mongoose handle it...
    this.save(); // save now.

    var hash = crypto.createHash('md5').update( (self.email) ? self.email.toLowerCase() : 'test@test.com' ).digest("hex");
    this.image = {
        url: 'https://secure.gravatar.com/avatar/' + hash + '?s=260&d=' + encodeURIComponent( 'http://coursefork.org/img/user-avatar.png' )
      , small: 'https://secure.gravatar.com/avatar/' + hash + '?d=' + encodeURIComponent( 'http://coursefork.org/img/user-avatar.png' )
    }
  }

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