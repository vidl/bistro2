var q = require('q');

module.exports = function(mongoosePromise){
    var deferred = q.defer();
    mongoosePromise.then(function(obj){
        deferred.resolve(obj);
    }).then(null, function(err){
        deferred.reject(err);
    });
    return deferred.promise;
};