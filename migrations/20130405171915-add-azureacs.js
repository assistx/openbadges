var dbm = require('db-migrate');
var async = require('async');
var type = dbm.dataType;

exports.up = function(db, callback) {
  async.series([
    function(cb) { addColumnIfNeeded(db, 'user', 'fed_id', 'ALTER TABLE `user` ADD fed_id varchar(255) DEFAULT NULL UNIQUE', cb); },
    function(cb) { addColumnIfNeeded(db, 'user', 'fed_id', 'ALTER TABLE `user` ADD fed_issuer varchar(255) DEFAULT NULL', cb); },
  ], callback);
};

exports.down = function(db, callback) {
  async.series([
    db.runSql.bind(db, 'ALTER TABLE `user` ' +
                       'DROP COLUMN fed_id;'),
    db.runSql.bind(db, 'ALTER TABLE `user` ' +
                       'DROP COLUMN fed_issuer;')
  ], callback);
};

function addColumnIfNeeded(database, tableName, columnName, alterTableCommand, callback) {
    try {
        console.log("checking for column...", columnName);
        database.runSql.bind(database, 'select ' + columnName + ' from `' + tableName + '` limit 1');
        console.log("found");
    } catch (err) {
        console.log("not found, adding", err);
        database.runSql.bind(database, alterTableCommand);
    }
    callback();
}