var dbm = require('db-migrate');
var async = require('async');
var type = dbm.dataType;

exports.up = function(db, callback) {
  async.series([
    db.runSql.bind(db, 'ALTER TABLE `user` ' +
                       'ADD fed_id varchar(255) DEFAULT NULL UNIQUE;')
  ], callback);
};

exports.down = function(db, callback) {
  async.series([
    db.runSql.bind(db, 'ALTER TABLE `user` ' +
                       'DROP COLUMN fed_id;')
  ], callback);
};
