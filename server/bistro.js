var express = require('express');
var session = require('express-session');
var uid2 = require('uid2');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var _ = require('underscore');
var dbo = require('./dbo');
var q = require('q');

var sessionOptions = {
    secret: uid2(25),
    resave: true,
    saveUninitialized: true
};

function saveDocument(docToSave){
    var deferred = q.defer();
    docToSave.save(function(err){
        if (err) {
            deferred.reject(err);
        } else {
            deferred.resolve(docToSave);
        }
    });
    return deferred.promise;

}

function handleError(res){
    return function(err){
        res.status(480);
        res.json(err);
    }
}

function addToBody(res){
    return function(doc){
        res.json(doc);
    };
}

function incArticle(order, articleId, incAmount){
    var article = _.find(order.articles, function(article){
        return article.article.equals(articleId);
    });
    if (article == undefined){
        article = { count: incAmount, article: articleId};
        order.articles.push(article);
    } else {
        article.count += incAmount;
    }
    return article;
}

function removeOrderFromSession(req){
    return function(order){
        delete req.session.orderId;
        return order;
    };
}

module.exports = function(dbConnection) {

    var dataService = dbo(dbConnection);

    var getOrderFromSession = function(req){
        var deferred = q.defer();
        function resolveOrReject(err, order){
            if (err) {
                deferred.reject(err);
            } else {
                req.session.orderId = order._id;
                deferred.resolve(order);
            }
        }
        if (req.session.orderId) {
            dataService.model.order.findById(req.session.orderId, resolveOrReject);
        } else {
            dataService.model.order.create({}, resolveOrReject);
        }
        return deferred.promise;
    };

    var commitOrder = function(currency){
        return function(order){
            order.currency = currency;
            return saveDocument(order);
        };
    };

    var printOrder = function(noPrint){
        return function(order){
            var deferred = q.defer();
            // TODO printing
            deferred.resolve(order);
            return deferred.promise;
        };
    };

    var handleIncRequest = function (req, incAmount){
        return getOrderFromSession(req)
        .then(function(order){
            incArticle(order, req.body.article, incAmount);
            return saveDocument(order);
        });
    };

    var app = express();
    app.use(bodyParser.json());
    app.use(methodOverride());
    app.use(session(sessionOptions));
    dataService.addRestRoutes(app);

    app.get('/order', function(req, res){
        getOrderFromSession(req)
            .catch(handleError(res))
            .done(addToBody(res));
    });

    app.put('/order/inc', function(req, res){
        handleIncRequest(req, 1)
            .catch(handleError(res))
            .done(addToBody(res));

    });

    app.put('/order/dec', function(req, res){
        handleIncRequest(req, -1)
            .catch(handleError(res))
            .done(addToBody(res));
    });

    app.post('/order', function(req, res){
        getOrderFromSession(req)
            .then(commitOrder(req.param('currency') || 'chf'))
            .then(printOrder(req.param('noPrint')))
            .then(removeOrderFromSession(req))
            .catch(handleError(res))
            .done(addToBody(res));

    });

    return app;
};

