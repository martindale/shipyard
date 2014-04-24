var mongoose = require('mongoose')
  , Schema = mongoose.Schema
  , ObjectId = mongoose.SchemaTypes.ObjectId;

// this defines the fields associated with the model,
// and moreover, their type.
var CommentSchema = new Schema({
    message: { type: String, required: true }
  , published: { type: Date, required: true, default: Date.now }
  , _author: { type: ObjectId, ref: 'Account', required: true }
  , _parent: { type: ObjectId }
});

var Comment = mongoose.model('Comment', CommentSchema);

// export the model to anything requiring it.
module.exports = {
  Comment: Comment
};