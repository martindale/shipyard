//'use strict'
// TODO: evaluate strict mode
require('debug-trace')({ always: process.env.SHIPRIGHT_TRACE });
debug = {
  http:   require('debug')('http'),
  git:    require('debug')('git'),
  marked: require('debug')('marked')
};

var fs = require('fs');

var express = require('express');
var app = express();
var mongoose = require('mongoose');
var flashify = require('flashify');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var GoogleStrategy = require('passport-google').Strategy;
var passportLocalMongoose = require('passport-local-mongoose');
var RedisStore = require('connect-redis')(express);
var redis = require('redis');

var RoleProvider = require('connect-roles');
var client = new RoleProvider({
  failureHandler: function(req, res, action) {
    res.status(403);
    res.format({
      json: function() {
        res.send({ status: error , message: 'Access denied '});
      },
      html: function() {
        res.render('access-denied', { action: action });
      }
    });
  }
});
client.use('authenticate', function(req, action) {
  if (!req.user || !req.user._id) return false;
  return true;
});
client.use('git push', function(req, action) {
  if (!req.project) return false;
  
  // temporary
  return true;
  
  if (!req.user) return false;
  if (req.user._actor.toString() === project._actor.toString()) return true;
});

var moment = require('moment');
var marked = require('marked');
marked.setOptions({
    smartypants: true
  , highlight: function(code) {
      return require('highlight.js').highlightAuto(code).value;
    }
});
var slugify = require('mongoose-slug/node_modules/speakingurl');

var sessionStore = new RedisStore();

config   = require('./config');
database = require('./db');

// quick hack
config.git.data.path = __dirname + '/' + config.git.data.path;
if (!fs.existsSync( config.git.data.path )) {
  fs.mkdirSync( config.git.data.path , 0766 , function(err) {
    if (err) { console.log(err); }
  });
}

// GLOBAL LIBRARIES
// TODO: should we do this?
_     = require('underscore');
async = require('async');
git   = require('./lib/gitty'); // thanks, @gordonwritescode!

Account = People  = require('./app/models/Account').Account;
Comment           = require('./app/models/Comment').Comment;
Issue             = require('./app/models/Issue').Issue;
Organization      = require('./app/models/Organization').Organization;
Project           = require('./app/models/Project').Project;
PublicKey         = require('./app/models/PublicKey').PublicKey;

Actor             = require('./app/models/Actor').Actor;
Activity          = require('./app/models/Activity').Activity;

var pages         = require('./app/controllers/pages');
var people        = require('./app/controllers/people');
var projects      = require('./app/controllers/projects');
var organizations = require('./app/controllers/organizations');
var issues        = require('./app/controllers/issues');
var keys          = require('./app/controllers/keys');


app.locals.pretty = true;
app.locals.moment = moment;
app.locals.marked = function( inputString , context ) {
  var parsed = marked( inputString );

  if (context && context.project && context.issue) {
    parsed = parsed.replace(/\#(\d+)/g, '<a href="/'+context.project._owner.slug+'/'+context.project.slug+'/issues/$1">#$1</a>');
  
    // TODO: use a job scheduler
    var references = parsed.match(/\#(\d+)/g);
    if (references) {
      references.forEach(function(id) {
        var query = { _project: context.project._id , id: id.slice(1) };
        debug.marked(query);
        Issue.findOne( query ).exec(function(err, issue) {
          if (err || !issue) { return; }

          var list = issue._references.map(function(x) { return x._id; });
          debug.marked(list);
          
          if (issue._references.map(function(x) { return x._issue.toString(); }).indexOf( context.issue._id.toString() ) < 0) {
            issue._references.push({
                _issue: context.issue._id
              , _creator: (context.comment) ? context.comment._author : context.issue._creator._id
            });
            issue.save(function(err) {
              if (err) { console.log(err); }
              // TODO: broadcast event on a redis channel
            });
          }
        });
      });
    }

    var mentions = parsed.match(/(\@)(\w+)/g);
    parsed = parsed.replace(/(\@)(\w+)/g, '<a href="/$2">$1$2</a>');
    if (mentions) {
      
      console.log(mentions);
      
      mentions.map(function(x) {
        return slugify(x);
      }).forEach(function(username) {
        Actor.findOne({ slug: username }).exec(function(err, actor) {
          if (err) console.log(err);
          
          console.log(actor);
          maki.queue.enqueue('test', {
            target: actor._id,
            issue: context.issue._id
          }, function(err, job) {
            
            console.log(err , job );
            
          });
        });
      });
    }
  }
  return parsed;
};

app.use(require('less-middleware')({ 
    debug: false
  , src: __dirname + '/private'
  , dest: __dirname + '/public'
}));
// any files in the /public directory will be accessible over the web,
// css, js, images... anything the browser will need.
app.use(express.static(__dirname + '/public'));

// jade is the default templating engine.
app.engine('jade', require('jade').__express);

// set up middlewares for session handling
app.use( require('cookie-parser')( config.cookieSecret ) );
app.use( require('body-parser')() );
app.use( require('express-session')({
    secret: config.cookieSecret
  , store: sessionStore
}));

app.set('view engine', 'jade');
app.set('views', 'app/views');

// TODO: utilize confluence, sensemaker
passport.use(Account.createStrategy());
passport.use(new GoogleStrategy({
    returnURL: 'http://eric.bp:9200/auth/google/callback',
    realm: 'http://eric.bp:9200/',
    passReqToCallback: true
  },
  function(req, identifier, user, done) {
    Account.findOne({
      $or: [
          { 'profiles.google.id': identifier },
          { _id: (req.user) ? req.user._id : undefined }
        ]
    }).exec(function(err, account) {
      if (err) { return done(err); }
      if (!account) var account = new Account();

      if (account.profiles.google.map(function(x) { return x.id; }).indexOf( identifier ) < 0) {
        account.profiles.google.push({
          id: identifier
        });
      }

      account.emails = _.union( account.emails , user.emails.map(function(x) { return x.value; } ) );
      if (!account.username) { account.username = user.displayName; }

      account.save(function(err) {
        done(err, account);
      });

    });
  }
));

passport.serializeUser( Account.serializeUser() );
passport.deserializeUser( Account.deserializeUser() );

/* Configure the registration and login system */
app.use(passport.initialize());
app.use(passport.session());
app.use(client.middleware());

/* configure some local variables for use later */
app.use(function(req, res, next) {

  res.locals.user = req.user;
  res.locals.next = req.path;

  debug.http(req.method + ' ' + req.path);

  // TODO: consider moving to a prototype on the response
  res.provide = function(err, resource, options) {
    if (err) { resource = err; }
    if (!options) { options = {}; }

    res.format({
        // TODO: strip non-public fields from pure JSON results
        json: function() { res.send( resource ); }
      , html: function() {
          if (options.template) {
            // TODO: determine appropriate resource format
            res.render( options.template , _.extend({ resource: resource } , resource ) );
          } else {
            res.send( resource );
          }
        }
    });
  };

  next();
});

var makiFormHandler = function(req, res, next) {
  var supportedMethods = ['patch'];
  var proposedMethod = (req.param('method')) ? req.param('method').toLowerCase() : null;
  if (supportedMethods.indexOf( proposedMethod ) >= 0) {
    req.method = req.param('method').toUpperCase();
    // TODO: force use of req.body / req.params?
    // otherwise, form control seems to utilize query strings / request body
  }
  next();
}
app.use( makiFormHandler );

app.get('/', pages.index );

app.get('/auth/google',
  passport.authenticate('google'));

app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/');
  });

app.get('/register', function(req, res) {
  res.render('register');
});

app.get('/login', function(req, res) {
  var next = req.param('next') ? req.param('next') : '/';
  if (req.user) {
    res.redirect('next')
  } else {
    res.render('login', {
      next: next
    });
  }
});

/* when a POST request is made to '/register'... */
app.post('/register', function(req, res, next) {
  Account.register(new Account({
    email : req.body.email,
    username : req.body.username,
    emails: [ req.body.emails ]
  }), req.body.password, function(err, user) {
    if (err) {
      console.log(err);
      return res.render('register', { user : user });
    }

    req.login( user , function(err) {
      var path = req.param('next') || '/';
      return res.redirect( path );
    });
  });
});

app.post('/login', passport.authenticate('local'), function(req, res) {
  var next = req.param('next') ? req.param('next') : '';
  if (next) { // TODO: prevent malicious redirects
    res.redirect( next );
  } else {
    //req.flash('info', '<strong>Welcome back!</strong>  We\'re glad to have you.');
    res.redirect('/');
  }
});

app.get('/logout', function(req, res, next) {
  req.logout();
  res.redirect('/');
});

// I HATE ROUTING.
// TODO: replace all manual routing with Maki.

app.get('/projects',                                  projects.list );
app.get('/projects/new', client.can('authenticate') , projects.createForm );
app.post('/projects',    client.can('authenticate') , projects.create );

app.get('/:actorSlug/:projectSlug',                                      setupRepo, projects.view );
app.get('/:actorSlug/:projectSlug/trees/:branchName(*)',                 setupRepo, projects.view );
app.get('/:actorSlug/:projectSlug/issues',                               setupRepo, issues.list );
app.get('/:actorSlug/:projectSlug/issues/:issueID',                      setupRepo, issues.view );

//app.post('/:actorSlug/:projectSlug/issues/:issueID', function() { console.log('fff'); },                    setupRepo, issues.edit );
app.patch('/:actorSlug/:projectSlug/issues/:issueID',                    setupRepo, issues.edit );

app.get('/:actorSlug/:projectSlug/issues/new',                           setupRepo, issues.createForm );
app.post('/:actorSlug/:projectSlug/issues', client.can('authenticate') , setupRepo, issues.create );

app.get('/:actorSlug/:projectSlug/diffs',                                                                          setupRepo,               issues.createForm );
app.get('/:actorSlug/:projectSlug/diffs/:fromBranch%E2%80%A6:upstreamUniqueSlug(*)?', client.can('authenticate') , setupRepo,               issues.diffForm );
app.post('/:actorSlug/:projectSlug/pulls',                                            client.can('authenticate') , setupRepo, setupProject, issues.createPullRequest );

app.post('/:actorSlug/:projectSlug/issues/:issueID/comments',                         client.can('authenticate') , setupRepo,               issues.addComment );

app.get('/:actorSlug/:projectSlug/blobs/:branchName/:filePath(*)', setupRepo , projects.viewBlob );
app.get('/:actorSlug/:projectSlug/commits/:commitID',              setupRepo , projects.viewCommit );

app.get('/people', people.list);

app.get('/:organizationSlug',      organizations.view );
app.get('/:usernameSlug',          people.view );
app.get('/:usernameSlug/keys/new', keys.createForm );
app.post('/:usernameSlug/keys',    keys.create );


app.post('/:usernameSlug/emails',   client.can('authenticate') , people.addEmail );
app.delete('/:usernameSlug/emails', client.can('authenticate') , people.removeEmail );

function setupRepo(req, res, next) {
  req.params.projectSlug = req.params.projectSlug.replace('.git', '');
  req.params.uniqueSlug = req.param('actorSlug') + '/' + req.param('projectSlug');
  next();
}

function setupProject(req, res, next) {
  req.pause();
  Project.lookup({ uniqueSlug: req.param('uniqueSlug') }, function(err, project) {
    if (err) { debug.http(err); }
    if (!project) { return next(); }

    req.projectID = project._id.toString();
    req.project = project;
    
    req.resume();
    next();
  });
}

var pushover = require('pushover');
app.repos = pushover( config.git.data.path );

app.repos.on('push', function (push) {
  debug.git('push ' + push.repo + '/' + push.commit
      + ' (' + push.branch + ')'
  );
  push.accept();
});
app.repos.on('fetch', function (fetch) {
  debug.git('fetch ' + fetch.commit);
  fetch.accept();
});

var gitAcceptRegex = new RegExp('^application/x-git(.*)');
var gitAgentRegex  = new RegExp('^git/(.*)');
app.get('/:actorSlug/:projectSlug*', setupRepo , setupProject , function(req, res, next) {
  if (!gitAgentRegex.exec( req.headers['user-agent'] ) ) return next();
  debug.git('pushover handling get...');
  app.repos.handle(req, res);
});
app.post('/:actorSlug/:projectSlug*', setupRepo , setupProject , client.can('git push') , function(req, res, next) {
  if (!gitAcceptRegex.exec( req.headers.accept ) ) return next();
  debug.git('pushover handling post...');
  app.repos.handle(req, res);
});

app.get('*', function(req, res) {
  res.status(404).render('404');
});

var WebSocketServer = require('maki-service-websockets');
var Queue           = require('maki-queue');

// Maki stub
// TODO: implement proper Maki
// maki exposes a lot of this automatically...
// TODO: document using Maki this way
var maki = {
  debug: true ,
  app: app ,
  routes: {
    '/projects': null // not really maki, just use a null handler
  },
  config: {
    redis: config.redis
  },
  clients: {},
  JSONRPC: require('maki-jsonrpc')
};
maki.httpd = require('http').createServer( maki.app );
maki.socks = new WebSocketServer();
maki.queue = new Queue({
  database: {
    name: config.databaseName
  }
});

maki.socks.bind( maki );
maki.queue.bind( maki );

maki.httpd.listen( config.http.port );
