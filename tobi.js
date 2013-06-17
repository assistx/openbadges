var url = require('url');
var utils = require('./lib/utils');
var logger = require('./lib/logging').logger;
var Model = require('./models/tobi');
var async = require('async');
var request = require('request');

exports.initTOBI = function (app) {    
    app.all('/tobi/*', allowCors);
    app.post('/tobi/accept', requestAccess);
    app.post('/tobi/accepted', allowAccess);
    app.post('/tobi/revoke-origin', revokeOrigin);
};

exports.sendToServiceBus = function sendToServiceBus(user_id, badge, callback) {
  var errors = [];
  Model.getAllFederations(user_id, function(err, federations){
     if (err) { console.log("An error hit", err); errors.push(err); callback(errors); }
     else {
         async.forEach(federations, function(federation, cb) {
            renewToken(JSON.parse(federation.get("service_key")), function(token) {
                if (token) {
                    federation.set('service_key', JSON.stringify(token));
                    federation.save(function(err) {
                      if (err) {
                        logger.warn('There was an error saving a refreshed tobi token');
                        logger.debug(err);
                        errors.push(err);
                      }
                      postMessageToServiceBus(token, badge, function(err) {
                         if (err) { errors.push(err); }
                         cb();
                      });
                    });
                } else {
                    errors.push("Auth error - no new token returned");
                }
            });
         }, function() {
             if (errors.length > 0)
                callback(errors);
            else 
                callback(null);
         });
     }
  });  
};

function requestAccess(req, res) {
  if (!req.body)
    return res.send('body expected', 400);
  if (!req.body.callback)
    return res.send('callback expected', 400);
  if (!req.body.serviceKey)
    return res.send('serviceKey expected', 400);

  var originErr = originValidator(req.body.callback);
  var parsed = url.parse(req.body.callback, false, true);
  
  if (originErr)
    return res.send('invalid callback: ' + originErr, 400);
  
  req.session.tobiregister = {};
  req.session.tobiregister.callback = req.body.callback;
  var serviceToken = JSON.parse(req.body.serviceKey);
  req.session.tobiregister.serviceNamespace = serviceToken.topic;
  req.session.tobiregister.serviceKey = serviceToken;
  
  return res.render('tobi-connect.html', {
    clientDomain: parsed.hostname,
    csrfToken: req.session._csrf,
    callback: req.body.callback,
    denyCallback: utils.extendUrl(req.body.callback, {error: 'access_denied'})
  });
}

function allowAccess(req, res, next) {
  if (!req.user)
    return res.send(403);
  if (!req.session.tobiregister)
    return res.send('tobi expected', 400);
  if (!req.session.tobiregister.callback)
    return res.send('callback expected', 400);
  if (!req.session.tobiregister.serviceNamespace)
    return res.send('serviceNamespace expected', 400);
  if (!req.session.tobiregister.serviceKey)
    return res.send('serviceKey expected', 400);
  
  var originErr = originValidator(req.session.tobiregister.callback);
  
  if (originErr)
    return res.send('invalid callback: ' + originErr, 400);
    
  var model = new Model({
     user_id: req.user.get('id'),
     service_namespace: req.session.tobiregister.serviceNamespace,
     service_key: JSON.stringify(req.session.tobiregister.serviceKey),
     origin: req.session.tobiregister.callback
  });
  
  model.save(function(err) {
    var cburl = req.session.tobiregister.callback;
    req.session.tobiregister = null;
    if (err) {
      logger.warn('There was an error creating a backpack connect token');
      logger.debug(err);
      return next(err);
    }
    return res.redirect(utils.extendUrl(cburl, { status: "success" }), 303);
  });
}

function revokeOrigin(req, res, next) {
  if (!req.user)
    return res.send(403);
  if (!req.body)
    return res.send('body expected', 400);
  if (!req.body.origin)
    return res.send('origin URL expected', 400);

  Model.revokeOriginForUser({
    origin: req.body.origin,
    user_id: req.user.get('id')
  }, function(err) {
    if (err) {
      logger.warn('There was an error revoking an origin for a user');
      logger.debug(err);
      return next(err);
    }
    return res.send(204);
  });
};

function allowCors(req, res, next) {
  res.set('access-control-allow-origin', '*');
  res.set('access-control-allow-headers', 'Content-Type, Authorization');
  res.set('access-control-expose-headers', 'WWW-Authenticate');
  if (req.method == 'OPTIONS')
    return res.send(200);
  next();
}

function originValidator(value, attributes) {
      var parsedOrigin = url.parse(value, false, true);
    
      if (!(parsedOrigin.protocol &&
            parsedOrigin.protocol.match(/^https?:/)))
        return "invalid origin protocol";
    
      if (!parsedOrigin.host)
        return "invalid origin host";
}

function renewToken(serviceKey, callback) {
    request(
        { method: 'POST'
            , uri: serviceKey.refresh_token_url || 'https://techcert.azurewebsites.net/Account/refreshToken'
            , form: {refresh_token: serviceKey.refresh_token}
        }
        , function (error, response, body) {
            if (!error && response.statusCode == 200) {
                var result = JSON.parse(body);
                if (!result.error && result.refresh_token)
                    callback(result);
                else
                    callback(null);
            } else {
                callback(null);
            }
        }
    );    
}

function postMessageToServiceBus(serviceKey, badge, callback) {
    var serviceBusUrl = 'https://' + url.parse(serviceKey.scope, false, true).hostname + '/' + serviceKey.topic + '/messages';
    var auth = 'WRAP access_token="' + serviceKey.access_token + '"';
    var message = { messageType: 'BadgeAward', version: 1.0, payload: badge};
    request(
        { method: 'POST'
            , uri: serviceBusUrl
            , headers: {
                'content-type': 'text/json'
                , 'Authorization': auth
            }
            , body: JSON.stringify(message)
        }
        , function (error, response, body) {
            if (error) {
                callback(error);
            }
            else if (response.statusCode != 201) {
                callback("Error - (" + response.statusCode + ") " + body);
            }
            else {
                callback(null);
            }
        }
    );     
}
