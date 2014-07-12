var MongoClient = require('mongodb').MongoClient;
var _ = require('underscore');
var Q = require('q');

function clearCollection(db, collName){
    var deferred = Q.defer();
    db.dropCollection(collName, function(err){
        err ? deferred.reject(err) : deferred.resolve(db);
    });
    return deferred.promise;
}

function connect(dbConnection) {
    var deferred = Q.defer();
    MongoClient.connect(dbConnection, function(err, db) {
        err ? deferred.reject(err) : deferred.resolve(db);
    });
    return deferred.promise;
}


module.exports = function(dbConnection) {
    return {
        dropDatabase: function(callback){
            connect(dbConnection).then(function(db){
                db.dropDatabase(callback);
            }).catch(callback).done();
        },
        clearCollections: function (collections, callback) {
            var promise = connect(dbConnection);
            _.each(collections, function(collName){
                promise.then(function(db){
                    return clearCollection(db, collName);
                });
            });
            promise
                .then(function(db){
                    db.close();
                    callback();
                })
                .catch(callback)
                .done();

        }
    };
};