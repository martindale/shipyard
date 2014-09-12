var mongoose = require('mongoose')
  , Schema = mongoose.Schema
  , ObjectId = mongoose.SchemaTypes.ObjectId
  , slug = require('mongoose-slug')
  , crypto = require('crypto')
  , keyManager = require('../../lib/keyManager');

// this defines the fields associated with the model,
// and moreover, their type.
var PublicKeySchema = new Schema({
    name: { type: String, required: true }
  , created: { type: Date, required: true, default: Date.now }
  , key: {type: String, required: true, index: true, unique: true}
  , _owner: {type: ObjectId, required: true, ref: 'Actor'}
  , disabled: {type: Boolean, default: false}
});

PublicKeySchema.virtual('fingerprint').get(function() {
  var cleanPub = this.key.replace(/^(ssh-[dr]s[as]\s+)|(\s+.+\@.+)|\n/g, '');
  var keyBuffer = new Buffer(cleanPub, 'base64');
  var fingerprint = crypto.createHash('md5').update(keyBuffer).digest('hex');
  return fingerprint.replace(/(.{2})(?=.)/g, '$1:');
});

// attach a URI-friendly slug
PublicKeySchema.plugin( slug( 'name' , {
  required: true
}) );

PublicKeySchema.post('init', function() {
  this.meta = {};
  this.meta.old = this.toObject();
});

PublicKeySchema.pre('save', function (next) {
  if (!this.meta) this.meta = {};

  this.meta.wasNew      = this.isNew;
  this.meta.wasModified = this.isModified();

  // test
  if (this.meta.wasModified) {
    this.meta.modifiedPaths = this.modifiedPaths();
  }

  next();
});

PublicKeySchema.post('save', function(doc) {
  if (doc.meta.wasNew) {
    keyManager.addKey(doc, function(err) {
      if (err) {
        console.log(err);
      }
      else {
        console.log("updated authorized_keys :D");
      }
    });
  }
});

var PublicKey = mongoose.model('PublicKey', PublicKeySchema);

PublicKey.schema.path('key').validate(keyManager.checkKey, "Invalid SSH key");

// export the model to anything requiring it.
module.exports = {
  PublicKey: PublicKey
};