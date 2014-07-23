var pow = require('pow-mongodb-fixtures');
var bistro = require('../../../server/bistro');

var dbConnection = 'mongodb://127.0.0.1:27017/bistro-test';
var app = bistro(dbConnection);
var fixtures = pow.connect(dbConnection);

exports.app = app;
exports.fixtures = fixtures;
exports.id = pow.createObjectId;
exports.noErr = function(done){
    return function(){
        done();
    };
};
