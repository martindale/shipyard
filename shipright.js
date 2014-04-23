var fs = require('fs')
  , express = require('express')
  , app = express()
  , mongoose = require('mongoose')
  , flashify = require('flashify')
  , passport = require('passport')
  , LocalStrategy = require('passport-local').Strategy
  , passportLocalMongoose = require('passport-local-mongoose')
  , RedisStore = require('connect-redis')(express)
  , redis = require('redis');

var moment = require('moment');
var marked = require('marked');
marked.setOptions({
    smartypants: true
  , highlight: function(code) {
      return require('highlight.js').highlightAuto(code).value;
    }
});

var sessionStore = new RedisStore();

config   = require('./config');
database = require('./db');

// quick hack
config.git.data.path = __dirname + '/' + config.git.data.path;

// GLOBAL LIBRARIES
// TODO: should we do this?
_     = require('underscore');
async = require('async');
Git   = require('nodegit');
git   = require('gitty'); // thanks, @gordonwritescode!

Account = People  = require('./models/Account').Account;
Comment           = require('./models/Comment').Comment;
Issue             = require('./models/Issue').Issue;
Organization      = require('./models/Organization').Organization;
Project           = require('./models/Project').Project;

Actor             = require('./models/Actor').Actor;
Activity          = require('./models/Activity').Activity;

var pages         = require('./controllers/pages');
var people        = require('./controllers/people');
var projects      = require('./controllers/projects');
var organizations = require('./controllers/organizations');
var issues        = require('./controllers/issues');

app.locals.pretty = true;
app.locals.moment = moment;
app.locals.marked = marked;

app.use(require('less-middleware')({ 
    debug: true
  , src: __dirname + '/private'
  , dest: __dirname + '/public'
}));
// any files in the /public directory will be accessible over the web,
// css, js, images... anything the browser will need.
app.use(express.static(__dirname + '/public'));

// jade is the default templating engine.
app.engine('jade', require('jade').__express);

// set up middlewares for session handling
app.use(express.cookieParser( config.cookieSecret ));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.session({
    secret: config.cookieSecret
  , store: sessionStore
}));

/* Configure the registration and login system */
app.use(passport.initialize());
app.use(passport.session());

app.set('view engine', 'jade');

passport.use(new LocalStrategy( Account.authenticate() ) );

passport.serializeUser( Account.serializeUser() );
passport.deserializeUser( Account.deserializeUser() );

/* configure some local variables for use later */
app.use(function(req, res, next) {
  res.locals.user = req.user;
  res.locals.next = req.path;

  console.log(req.method + ' ' + req.path);

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

function requireLogin(req, res, next) {
  if (req.user) { return next(); }
  // require the user to log in
  res.status(401).render('login', {
    next: req.path
  });
}

app.get('/', pages.index );

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
app.post('/register', function(req, res) {
  Account.register(new Account({ email : req.body.email, username : req.body.username }), req.body.password, function(err, user) {
    if (err) {
      console.log(err);
      return res.render('register', { user : user });
    }

    req.login( user , function(err) {
      var next = req.param('next') ? req.param('next') : '/';
      res.redirect( next );
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

app.get('/projects',                          projects.list );
app.get('/projects/new', requireLogin ,       projects.createForm );
app.post('/projects',    requireLogin ,       projects.create );

app.get('/:actorSlug/:projectSlug',                  setupRepo, projects.view );
app.get('/:actorSlug/:projectSlug/tree/:branchName', setupRepo, projects.view );
app.get('/:actorSlug/:projectSlug/issues',           setupRepo, issues.list );
app.get('/:actorSlug/:projectSlug/issues/:issueID',  setupRepo, issues.view );
app.get('/:actorSlug/:projectSlug/issues/new',       setupRepo, issues.createForm );
app.post('/:actorSlug/:projectSlug/issues',          setupRepo, issues.create );

function setupRepo(req, res, next) {
  req.params.uniqueSlug = req.param('actorSlug') + '/' + req.param('projectSlug');
  next();
}
//app.get('/:actorSlug/:projectSlug.git/info/refs',               setupRepo , projects.git.refs );
app.get('/:actorSlug/:projectSlug/blob/:branchName/:filePath',  setupRepo , projects.viewBlob );

function setupPushover(req, res, next) {
  Project.lookup( req.param('uniqueSlug') , function(err, project) {
    req.params.projectID = project._id;
    next();
  });
}
var pushover = require('pushover');
var repos = pushover( config.git.data.path );
repos.on('push', function (push) {
  console.log('push ' + push.repo + '/' + push.commit
      + ' (' + push.branch + ')'
  );
  push.accept();
});
repos.on('fetch', function (fetch) {
  console.log('fetch ' + fetch.commit);
  fetch.accept();
});

app.get('/:actorSlug/:projectSlug.git/info/refs', setupRepo , setupPushover , function(req, res) {
  console.log('handling....')
  repos.handle(req, res)
});

app.get('/:organizationSlug', organizations.view );
app.get('/:usernameSlug',     people.view );

app.get('*', function(req, res) {
  res.status(404).render('404');
});

app.listen( config.appPort , function() {
  console.log('Demo application is now listening on http://localhost:' + config.appPort + ' ...');
});

