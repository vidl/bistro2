var express = require('express');
var session = require('express-session');
var uid2 = require('uid2');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var _ = require('underscore');
var dbo = require('./dbo');

var sessionOptions = {
    secret: uid2(25),
    resave: true,
    saveUninitialized: true
};

module.exports = function(dbConnection) {

    var dataService = dbo(dbConnection);

    var getOrderFromSession = function(req, next){
        function updateSessionAndReturn(err, order){
            if (err) throw err;
            req.session.orderId = order._id;
            next(order);
        }
        if (req.session.orderId) {
            console.log('read order from db');
            dataService.model.order.findById(req.session.orderId, updateSessionAndReturn);
        } else {
            console.log('create new order');
            dataService.model.order.create({}, updateSessionAndReturn);
        }
    };

    var incArticle = function(order, articleId, incAmount){
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
    };

    var handleIncRequest = function (req, res, incAmount){
        getOrderFromSession(req, function(order){
            incArticle(order, req.body.article, incAmount);
            order.save(function(err){
                if (err) throw err;
                res.json(order);
            });
        });
    };

    var app = express();
    app.use(bodyParser.json());
    app.use(methodOverride());
    app.use(session(sessionOptions));
    dataService.addRestRoutes(app);

    app.get('/order', function(req, res){
        getOrderFromSession(req, function(order){
            res.json(order);
        });
    });

    app.put('/order/inc', function(req, res){
        handleIncRequest(req, res, 1);
    });

    app.put('/order/dec', function(req, res){
        handleIncRequest(req, res, -1);
    });

    app.post('/order', function(req, res){
        getOrderFromSession(req, function(order){
            order.update({ currency : req.params.currency || 'chf'}, function(err, order){
                delete req.session.orderId;
                if (!req.params.noPrint){
                    // TODO print
                }
                res.json(order);
            });
        });
    });

    return app;
};

