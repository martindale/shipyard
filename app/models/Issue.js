var mongoose = require('mongoose')
  , Schema = mongoose.Schema
  , ObjectId = mongoose.SchemaTypes.ObjectId
  , passportLocalMongoose = require('passport-local-mongoose')
  , slug = require('mongoose-slug');

// this defines the fields associated with the model,
// and moreover, their type.
var IssueSchema = new Schema({
    id:          { type: Number }
  , name:        { type: String, required: true }
  , description: { type: String }
  , status:      { type: String, enum: ['open', 'closed'], default: 'open' }
  // TODO: consider UX of "attaching code" to "issues" instead
  , type:        { type: String, enum: ['issue', 'dock'],  default: 'issue' }
  , created:     { type: Date, required: true, default: Date.now }
  , closed:      { type: Date, default: Date.now }
  , _project:    { type: ObjectId, ref: 'Project', required: true }
  , _creator:    { type: ObjectId, ref: 'Account', required: true }
  , _assignees:  [ { type: ObjectId, ref: 'Account' } ]
  , _comments:   [ { type: ObjectId, ref: 'Comment' } ]
  , _references: [ new Schema({
        _issue:   { type: ObjectId, ref: 'Issue', required: true }
      , _creator: { type: ObjectId, ref: 'Account', required: true }
      , timestamp:{ type: Date, required: true, default: Date.now }
    }) ]
});

IssueSchema.index({ _project: 1, id: 1 }, { unique: true });

IssueSchema.pre('save', function(next) {
  var issue = this;
  // increment numeric ID
  Issue.find({ _project: issue._project }, { id: 1 }).exec(function(err, issues) {
    if (!issues || !issues.length) {
      var issues = [{ id: 0 }];
    }

    var largestID = _.max(issues.map(function(x) { return x.id; }));
    issue.id = ++largestID;
    
    next();
  });
});

var Issue = mongoose.model('Issue', IssueSchema);

// export the model to anything requiring it.
module.exports = {
  Issue: Issue
};
