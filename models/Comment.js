var mongoose = require('mongoose')
  , Schema = mongoose.Schema
  , ObjectId = mongoose.SchemaTypes.ObjectId
  , passportLocalMongoose = require('passport-local-mongoose')
  , slug = require('mongoose-slug');

// this defines the fields associated with the model,
// and moreover, their type.
var CommentSchema = new Schema({
    name: { type: String, required: true }
  , description: { type: String, required: true }
  , created: { type: Date, required: true, default: Date.now }
  , _author: { type: ObjectId, ref: 'Account', required: true }
  , _parent: { type: ObjectId }
});

// attach a URI-friendly slug
CommentSchema.plugin( slug( 'username' , {
  required: true
}) );

var Comment = mongoose.model('Comment', CommentSchema);

// export the model to anything requiring it.
module.exports = {
  Comment: Comment
};