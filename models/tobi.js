var crypto = require('crypto');
var regex = require('../lib/regex');
var mysql = require('../lib/mysql');
var Base = require('./mysql-base');

var Tobi = function (attributes) {
  this.attributes = attributes;
};

Base.apply(Tobi, 'tobi');

module.exports = Tobi;
