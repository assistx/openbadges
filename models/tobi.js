var crypto = require('crypto');
var regex = require('../lib/regex');
var mysql = require('../lib/mysql');
var Base = require('./mysql-base');
var _ = require('underscore');
var url = require('url');

var Tobi = function (attributes) {
  this.attributes = attributes;
};

Base.apply(Tobi, 'tobi');

Tobi.summarizeForUser = function(userId, cb) {
    this.find({user_id: userId}, function(err, results) {
      var originPerms = {};
      if (err) return cb(err);
      results.forEach(function(result) {
        var origin = result.get('origin');
        if (!(origin in originPerms))
          originPerms[origin] = [];
        originPerms[origin] = originPerms[origin];
      });
      cb(null, Object.keys(originPerms).sort().map(function(origin) {
        return {
          origin: origin,
          domain: url.parse(origin, false, true).hostname
        };
      }));
    });
};

Tobi.revokeOriginForUser = function(options, cb) {
    this.findAndDestroy({
      origin: options.origin,
      user_id: options.user_id
    }, cb);
};

Tobi.getAllFederations = function(userId, cb) {
    this.find({user_id: userId}, function(err, results){
        if (err) return cb(err);
        else return cb(null, results);
    });
};

Tobi.updateServiceKey = function updateServiceKey(serviceKey) {
  this.set('serivce_key', JSON.stringify(serviceKey));
};

module.exports = Tobi;
