var url = require('url');
var utils = require('./lib/utils');
var logger = require('./lib/logging').logger;
var Model = require('./models/tobi');

exports.initTOBI = function (app) {    
    app.all('/tobi/*', allowCors);
    app.post('/tobi/accept', requestAccess);
    app.post('/tobi/accepted', allowAccess);
};

function requestAccess(req, res) {
  if (!req.body)
    return res.send('body expected', 400);
  if (!req.body.callback)
    return res.send('callback expected', 400);
  if (!req.body.serviceNamespace)
    return res.send('serviceNamespace expected', 400);
  if (!req.body.serviceKey)
    return res.send('serviceKey expected', 400);

  var originErr = originValidator(req.query.callback);
  var parsed = url.parse(req.query.callback, false, true);
  
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
     service_key: req.session.tobiregister.serviceKey,
     origin: req.session.tobiregister.callback
  });
  
  model.save(function(err) {
    req.session.tobiregister = null;
    if (err) {
      logger.warn('There was an error creating a backpack connect token');
      logger.debug(err);
      return next(err);
    }
    return res.redirect(utils.extendUrl(req.body.callback, { status: "success" }), 303);
  });
}

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
