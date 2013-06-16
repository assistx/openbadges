var dbm = require('db-migrate');
var type = dbm.dataType;
var async = require('async');

var schemas = [
  "CREATE TABLE IF NOT EXISTS `tobi` ("
    + "id                BIGINT AUTO_INCREMENT PRIMARY KEY,"
    + "user_id           BIGINT NOT NULL,"
    + "service_namespace VARCHAR(255) NOT NULL,"
    + "service_key       MEDIUMTEXT NOT NULL,"
    + "origin            VARCHAR(255) NOT NULL,"
    + "FOREIGN KEY user_fkey (user_id) REFERENCES `user`(id)"
  + ") ENGINE=InnoDB;"
];

exports.up = function(db, callback) {
  async.map(schemas, function(schema, callback) {
    db.runSql(schema, callback);
  }, callback);
};

exports.down = function(db, callback) {
  async.series([
    db.runSql.bind(db, 'DROP TABLE IF EXISTS `tobi`;')
  ], callback);
};
