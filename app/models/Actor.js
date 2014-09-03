var mongoose = require('mongoose')
  , Schema = mongoose.Schema
  , ObjectId = mongoose.SchemaTypes.ObjectId
  , slug = require('mongoose-slug');

// this defines the fields associated with the model,
// and moreover, their type.
var ActorSchema = new Schema({
    type: { type: String , enum: [ 'Person', 'Organization' ], required: true }
  , target: { type: ObjectId, required: true }
  , slug: { type: String }
});

var Actor = mongoose.model('Actor', ActorSchema);

// export the model to anything requiring it.
module.exports = {
  Actor: Actor
};