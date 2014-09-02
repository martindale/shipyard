var mongoose = require('mongoose')
  , Schema = mongoose.Schema
  , ObjectId = mongoose.SchemaTypes.ObjectId
  , passportLocalMongoose = require('passport-local-mongoose')
  , slug = require('mongoose-slug');

// this defines the fields associated with the model,
// and moreover, their type.
var IssueSchema = new Schema({
    id: { type: Number, required: true }
  , name: { type: String, required: true }
  , description: { type: String }
  , status: { type: String, enum: ['open', 'closed'], default: 'open' }
  , type: { type: String, enum: ['issue', 'dock'], default: 'issue' }
  , created: { type: Date, required: true, default: Date.now }
  , closed: { type: Date, default: Date.now }
  , _project: { type: ObjectId, ref: 'Project', required: true }
  , _creator: { type: ObjectId, ref: 'Account', required: true }
  , _assignees: [ { type: ObjectId, ref: 'Account' } ]
  , _comments:  [ { type: ObjectId, ref: 'Comment' } ]
  , _references: [ new Schema({
        _issue: { type: ObjectId, ref: 'Issue', required: true }
      , _creator: { type: ObjectId, ref: 'Account', required: true }
      , timestamp:{ type: Date, required: true, default: Date.now }
    }) ]
});

IssueSchema.index({ _project: 1, id: 1 }, { unique: true });

var Issue = mongoose.model('Issue', IssueSchema);

// export the model to anything requiring it.
module.exports = {
  Issue: Issue
};