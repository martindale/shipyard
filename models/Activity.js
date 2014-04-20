var mongoose = require('mongoose')
  , Schema = mongoose.Schema
  , ObjectId = mongoose.SchemaTypes.ObjectId;

// this defines the fields associated with the model,
// and moreover, their type.
var ActivitySchema = new Schema({
    verb:      { type: String }
  , published: { type: Date     ,               default: Date.now, required: true }
  , language:  { type: String   , enum:['en'] , default: 'en'                     }
  , _actor:    { type: ObjectId ,                                  required: true }
  , _object:   { type: ObjectId ,                                  required: true }
  , _target:   { type: ObjectId                                                   }
});

ActivitySchema.methods.create = function( data , callback ) {
  var activity = new Activity( data );
  activity.save( callback );
}

var Activity = mongoose.model('Activity', ActivitySchema);

// export the model to anything requiring it.
module.exports = {
  Activity: Activity
};