var mongoose = require('mongoose')
  , Schema = mongoose.Schema
  , ObjectId = mongoose.SchemaTypes.ObjectId
  , slug = require('mongoose-slug');
  
var notifications = require('maki-mongoose-hooks');
var redis = require('redis');
var client = redis.createClient();

// this defines the fields associated with the model,
// and moreover, their type.
var ProjectSchema = new Schema({
    name: { type: String, required: true }
  , description: { type: String }
  , created: { type: Date, required: true, default: Date.now }
  , _creator: { type: ObjectId, ref: 'Actor', required: true }
  , _owner:   { type: ObjectId, ref: 'Actor', required: true }
  , _upstream: { type: ObjectId, ref: 'Project' }
});

// attach a URI-friendly slug
ProjectSchema.plugin( slug( 'name' , {
  required: true
}) );

// TODO: make maki-mongoose-hooks more extensible,
// i.e., without these stubs
ProjectSchema.plugin( notifications , {
  maki: {
    redis: client
  },
  resource: {
    routes: {
      query: '/projects'
    }
  }
});

ProjectSchema.virtual('path').get(function() {
  return config.git.data.path + '/' + this._id;
});

ProjectSchema.statics.getForks = function( parent , callback ) {
  Project.find({ _upstream: parent._id }, { _id: 1 }).exec(function(err, forks) {
    var collectors = forks.map(function(fork) {
      return function(done) {
        Project.lookup({ _id: fork._id }, done );
      }
    });
    async.parallel( collectors , callback );
  });
}

ProjectSchema.statics.lookup = function( params , callback) {
  var actorQuery = {};
  var projectQuery = {};

  if (params.uniqueSlug) {
    var parts = params.uniqueSlug.split('/');
    var actorSlug = parts[0];
    var projectSlug = parts[1];
    
    actorQuery.slug = actorSlug;
  } else if (params.actor && params.actor._id ) {
    actorQuery._id = params.actor._id;
  }

  Actor.findOne( actorQuery ).exec(function(err, actor) {
    
    if (Object.keys(actorQuery).length && actor) {
      projectQuery['_owner'] = actor._id;
    }
    
    if (params._id) projectQuery._id = params._id;
    if (projectSlug) projectQuery.slug = projectSlug;
    
    Project.findOne( projectQuery ).populate('_owner _upstream').exec(function(err, project) {
      if (!project) return callback(404);
      if (!project._upstream) return callback( err , project );

      Actor.populate( project , {
        path: '_upstream._owner'
      }, function(err, project) {
        
        // multiple-actor model
        var contexts = {
            Person: Account
          , Organization: Organization
        };
        contexts[ project._upstream._owner.type ].populate( project , {
          path: '_upstream._owner.target'
        }, callback );
      });

    });
  });
};

var Project = mongoose.model('Project', ProjectSchema);

// export the model to anything requiring it.
module.exports = {
  Project: Project
};
