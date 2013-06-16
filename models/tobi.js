var crypto = require('crypto');
var regex = require('../lib/regex');
var mysql = require('../lib/mysql');
var Base = require('./mysql-base');

var Tobi = function (attributes) {
  this.attributes = attributes;
};

Base.apply(Tobi, 'tobi');

Tobi.summarizeForUser = function(userId, cb) {
    this.find({user_id: userId}, function(err, results) {
      var originPerms = {};
      if (err) return cb(err);
      results.forEach(function(result) {
        var origin = result.get('serviceNamespace');
        if (!(origin in originPerms))
          originPerms[origin] = [];
        originPerms[origin] = _.union(originPerms[origin],
                                      result.get('permissions'));
      });
      cb(null, Object.keys(originPerms).sort().map(function(origin) {
        return {
          origin: origin,
          permissions: originPerms[origin].sort()
        };
      }));
    });
};

module.exports = Tobi;
