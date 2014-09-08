var mongoose = require('mongoose')
  , Schema = mongoose.Schema
  , ObjectId = mongoose.SchemaTypes.ObjectId
  , slug = require('mongoose-slug');

// this defines the fields associated with the model,
// and moreover, their type.
var PublicKeySchema = new Schema({
    name: { type: String, required: true }
  , created: { type: Date, required: true, default: Date.now }
  , key: {type: String, required: true}
  , _actor: {type: ObjectId, required: true, ref: 'Actor'}
  , disabled: {type: Boolean, default: false}
});

// attach a URI-friendly slug
PublicKeySchema.plugin( slug( 'name' , {
  required: true
}) );

var PublicKey = mongoose.model('PublicKey', PublicKeySchema);

PublicKey.schema.path('key').validate(keyMananger.checkKey(value), "Invalid SSH key");

// export the model to anything requiring it.
module.exports = {
  PublicKey: PublicKey
};