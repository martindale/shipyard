var mongoose = require('mongoose')
  , Schema = mongoose.Schema
  , ObjectId = mongoose.SchemaTypes.ObjectId
  , slug = require('mongoose-slug');

// this defines the fields associated with the model,
// and moreover, their type.
var OrganizationSchema = new Schema({
    name: { type: String, required: true }
  , created: { type: Date, required: true, default: Date.now }
});

// attach a URI-friendly slug
OrganizationSchema.plugin( slug( 'name' , {
  required: true
}) );

var Organization = mongoose.model('Organization', OrganizationSchema);

// export the model to anything requiring it.
module.exports = {
  Organization: Organization
};