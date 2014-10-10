var q = require('q');

module.exports = {
    wrapMpromise: function(mongoosePromise) {
        var deferred = q.defer();
        mongoosePromise.then(function(obj){
            deferred.resolve(obj);
        }).then(null, function(err){
            deferred.reject(err);
        });
        return deferred.promise;
    },
    wrapMongooseCallback: function(doc, method){
        var deferred = q.defer();
        var args = Array.prototype.slice.call(arguments).slice(2);
        args.push(function(err, arg){
            if (err) {
                deferred.reject(err);
            } else {
                deferred.resolve(arg);
            }
        });
        method.apply(doc, args);
        return deferred.promise;
    }
};