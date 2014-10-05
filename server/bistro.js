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

function removeDocument(docToRemove){
    var deferred = q.defer();
    docToRemove.remove(function(err){
        if (err) {
            deferred.reject(err);
        } else {
            deferred.resolve(docToRemove);
        }
    });
    return deferred.promise;
}

function handleError(res){
    return function(err){
        res.status(480);
        res.json(err);
        console.log(err.stack);
    }
}

function addToBody(res){
    return function(doc){
        res.json(doc);
        return doc;
    };
}

function setOrderState(state){
    return function(order){
        order.state = state;
        return order;
    };
}

function incItem(order, articleId, incAmount){
    var item = _.find(order.items, function(item){
        return item.article.equals(articleId);
    });
    if (item == undefined){
        item = { count: incAmount, article: articleId};
        order.items.push(item);
    } else {
        item.count += incAmount;
    }
    return item;
}

function removeOrderFromSession(req){
    delete req.session.orderId;
}

function getOrderIdFromSession(req){
    return req.session.orderId;
}

function setOrderIdToSession(req, order){
    req.session.orderId = order._id;
}

function wrapMpromise(mongoosePromise){
    var deferred = q.defer();
    mongoosePromise.then(function(obj){
        deferred.resolve(obj);
    }).then(null, function(err){
        deferred.reject(err);
    });
    return deferred.promise;
}

module.exports = function(dbConnection) {

    var dataService = dbo(dbConnection);

    var createOrder = function(){
        return wrapMpromise(dataService.model.order.create({state: 'editing'}));
    };

    var getOrder = function(orderId){
        if (orderId) {
            return wrapMpromise(dataService.model.order.findById(orderId).exec());
        } else {
            var deferred = q.defer();
            deferred.resolve();
            return deferred.promise;
        }
    };

    var getOrCreateOrder = function(orderId){
        return getOrder(orderId)
            .then(function(order){
                return order ? order : createOrder();
            });
    };


    var printOrder = function(noPrint){
        return function(order){
            var deferred = q.defer();
            // TODO printing
            deferred.resolve(order);
            return deferred.promise;
        };
    };

    var getAggregatedLimits = function(){
        function setupTotal(limits){
            var total = {};
            _.each(limits,function(limit){
                total[limit._id.toHexString()] = { used: 0, total: limit.available};
            });
            return total;
        }

        function aggregateUsed(total, orders){
            _.each(orders, function(order){
                _.each(order.items, function(item){
                    _.each(item.article.limits, function(articleLimit){
                        var limitId = articleLimit.limit.toHexString();
                        total[limitId].used += articleLimit.dec * item.count;
                    });
                });
            });
            return total;
        }

        return wrapMpromise(dataService.model.limit.find({}).exec()).then(function(limits){
            var total = setupTotal(limits);
            return wrapMpromise(dataService.model.order.find({})
                .populate({path: 'items.article', select: 'limits'})
                .exec()).then(function(orders){
                    return aggregateUsed(total, orders);
            });
        });
    };

    var populate = function(what){
        return function(model){
            var deferred = q.defer();
            model.populate(what, function(err, model){
                if (err) {
                    deferred.reject(err);
                } else {
                    deferred.resolve(model);
                }
            });
            return deferred.promise;
        };
    };

    var ensureLimitsNotReached = function(articleId, incAmount){
        var deferred = q.defer();
        if (incAmount <= 0) {
            deferred.resolve();
        } else {
            dataService.model.article.findById(articleId).exec()
            .then(function (article){
                getAggregatedLimits().then(function(aggergatedLimits){
                    _.each(article.limits, function(limitConfig){
                        var aggergatedLimit = aggergatedLimits[limitConfig.limit.toHexString()];
                        var maxAvailable = aggergatedLimit.total - aggergatedLimit.used;
                        if (maxAvailable < incAmount * limitConfig.dec) {
                            deferred.reject(limitConfig.limit);
                        }
                    });
                    if (deferred.promise.isPending()) {
                        deferred.resolve();
                    }
                })
                .catch(function(err){
                    deferred.reject(err);
                });
            }, function(err){
                deferred.reject(err);
            });

        }
        return deferred.promise;
    };

    var app = express();
    app.use(bodyParser.json());
    app.use(methodOverride());
    app.use(session(sessionOptions));
    dataService.addRestRoutes(app);

    app.get('/currencies', function(req, res){
        res.json(dataService.availableCurrencies);
    });

    app.get('/order', function(req, res){
        getOrCreateOrder(getOrderIdFromSession(req))
            .then(function(order){
                setOrderIdToSession(req, order);
                return order;
            })
            .then(populate('items.article'))
            .catch(handleError(res))
            .done(addToBody(res));
    });

    app.post('/order/select', function(req, res){

        getOrder(req.param('order'))
            .then(function(order){
                if (!order){
                    throw new Error('Bestellung nicht gefunden');
                }
                if (order.state != 'preordered'){
                    throw new Error('Status der gewählten Bestellung ist ungültig');
                }
                return order;
            })
            .then(setOrderState('editing'))
            .then(saveDocument)
            .then(function(order){
                var existingOrderId = getOrderIdFromSession(req);
                setOrderIdToSession(req, order);
                return getOrder(existingOrderId);
            })
            .then(function(order){
                if (order){
                    return removeDocument(order);
                }
            })
            .catch(handleError(res))
            .done(function(){
                res.json({});
            });
    });

    app.post('/order/item', function(req, res){
        var articleId = req.param('article');
        var incAmount = parseInt(req.param('incAmount'));
        ensureLimitsNotReached(articleId, incAmount)
            .then(function(){
                return getOrCreateOrder(getOrderIdFromSession(req));
            })
            .then(function(order){
                setOrderIdToSession(req, order);
                incItem(order, articleId, incAmount);
                return order;
            })
            .then(setOrderState('editing'))
            .then(saveDocument)
            .then(populate('items.article'))
            .then(function(order){
                // add the new limits to the response object
                return getAggregatedLimits().then(function(limits){
                    return {
                        limits: limits,
                        order: order
                    };
                });
            })
            .catch(handleError(res))
            .done(addToBody(res));

    });

    app.post('/order/preorder', function(req, res){
        getOrder(getOrderIdFromSession(req))
            .then(function(order){
                if (!order){
                    throw new Error('Keine Bestellung gewählt')
                }
                order.kitchenNotes = req.param('kitchenNotes') || order.kitchenNotes;
                order.name = req.param('name');
                if (!order.name){
                    throw new Error('Kein Name angegeben');
                }
                return order;
            })
            .then(setOrderState('preordered'))
            .then(saveDocument)
            .then(createOrder)
            .then(function(order){
                setOrderIdToSession(req, order);
                return order;
            })
            .catch(handleError(res))
            .done(addToBody(res))
    });

    app.post('/order/send', function(req, res){
        getOrder(getOrderIdFromSession(req))
            .then(function(order){
                if (!order){
                    throw new Error('Keine Bestellung gewählt')
                }
                order.currency = req.param('currency') || dataService.availableCurrencies[0];
                order.kitchenNotes = req.param('kitchenNotes') || order.kitchenNotes;
                order.voucher = req.param('voucher') || false;
                return order;
            })
            .then(setOrderState('sent'))
            .then(saveDocument)
            .then(printOrder(req.param('noPrint')))
            .then(createOrder)
            .then(function(order){
                setOrderIdToSession(req, order);
                return order;
            })
            .catch(handleError(res))
            .done(addToBody(res));

    });

    app.get('/availability', function(req, res){
       getAggregatedLimits()
           .catch(handleError(res))
           .done(addToBody(res));
    });
    return app;
};

