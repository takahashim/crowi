var debug = require('debug')('crowi:lib:middlewares');

exports.loginChecker = function(crowi, app) {
  return function(req, res, next) {
    var User = crowi.model('User');

    // session に user object が入ってる
    if (req.session.user && '_id' in req.session.user) {
      User.findById(req.session.user._id, function(err, userData) {
        if (err) {
          next();
        } else {
          req.user = req.session.user = userData;
          res.locals.user = req.user;
          next();
        }
      });
    } else {
      req.user = req.session.user = false;
      res.locals.user = req.user;
      next();
    }
  };
};

exports.swigFunctions = function(crowi, app) {
  return function(req, res, next) {
    require('../util/swigFunctions')(crowi, app, res.locals);
    next();
  };
};

exports.swigFilters = function(app, swig) {
  return function(req, res, next) {

    swig.setFilter('path2name', function(string) {
      return string.replace(/.+\/(.+)?$/, '$1');
    });

    swig.setFilter('datetz', function(input, format) {
      // timezone
      var swigFilters = require('swig/lib/filters');
      return swigFilters.date(input, format, app.get('tzoffset'));
    });

    swig.setFilter('presentation', function(string) {
      // 手抜き
      return string
        .replace(/[\n]+#/g, '\n\n\n#')
        .replace(/\s(https?.+(jpe?g|png|gif))\s/, '\n\n\n![]($1)\n\n\n');
    });

    swig.setFilter('picture', function(user) {
      if (!user) {
        return '';
      }

      user.fbId = user.userId; // migration
      if (user.image && user.image != '/images/userpicture.png') {
        return user.image;
      } else if (user.fbId) {
        return '//graph.facebook.com/' + user.fbId + '/picture?size=square';
      } else {
        return '/images/userpicture.png';
      }
    });

    next();
  };
};

exports.adminRequired = function() {
  return function(req, res, next) {
    if (req.user && '_id' in req.user) {
      if (req.user.admin) {
        next();
        return;
      }
      return res.redirect('/');
    }
    return res.redirect('/login');
  };
};

exports.loginRequired = function(crowi, app) {
  return function(req, res, next) {
    var User = crowi.model('User')

    if (req.user && '_id' in req.user) {
      if (req.user.status === User.STATUS_ACTIVE) {
        // Active の人だけ先に進める
        return next();
      } else if (req.user.status === User.STATUS_REGISTERED) {
        return res.redirect('/login/error/registered');
      } else if (req.user.status === User.STATUS_SUSPENDED) {
        return res.redirect('/login/error/suspended');
      } else if (req.user.status === User.STATUS_INVITED) {
        return res.redirect('/login/invited');
      }
    }

    req.session.jumpTo = req.originalUrl;
    return res.redirect('/login');
  };
};

exports.accessTokenParser = function(crowi, app) {
  return function(req, res, next) {
    var accessToken = req.query.access_token;
    if (!accessToken) {
      return next();
    }

    var User = crowi.model('User')

    User.findUserByApiToken(accessToken)
    .then(function(userData) {
      req.user = userData;
      next();
    }).catch(function(err) {
      next();
    });
  };
};

// this is for Installer
exports.applicationNotInstalled = function() {
  return function(req, res, next) {
    var config = req.config;

    if (Object.keys(config.crowi).length !== 1) {
      return res.render('500', { error: 'Application already installed.' });
    }

    return next();
  };
};

exports.applicationInstalled = function() {
  return function(req, res, next) {
    var config = req.config;

    if (Object.keys(config.crowi).length === 1) { // app:url is set by process
      return res.redirect('/installer');
    }

    return next();
  };
};

exports.awsEnabled = function() {
  return function (req, res, next) {
    var config = req.config;
    if (config.crowi['aws:region'] !== '' && config.crowi['aws:bucket'] !== '' && config.crowi['aws:accessKeyId'] !== '' && config.crowi['aws:secretAccessKey'] !== '') {
      req.flash('globalError', 'AWS settings required to use this function. Please ask the administrator.');
      return res.redirect('/');
    }

    return next();
  };
};
