var express = require('express');
var session = require('express-session');
var uid2 = require('uid2');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var _ = require('underscore');
var moment = require('moment');
var dbo = require('./dbo');
var q = require('q');
var print = require('./print');
var pdfs = require('./pdfs');
var mongoosePromiseHelper = require('./wrapMPromise')
var wrapMpromise = mongoosePromiseHelper.wrapMpromise;
var wrapMongooseCallback = mongoosePromiseHelper.wrapMongooseCallback;

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

function getOrderIdFromSession(req){
    return req.session.orderId;
}

function setOrderIdToSession(req, order){
    req.session.orderId = order._id;
}

module.exports = function(dbConnection, disablePrinting, pdfSettings) {

    var dataService = dbo(dbConnection);
    var printService = print({dataService: dataService, disablePrinting: disablePrinting});
    var pdfService = pdfs(pdfSettings || {});

    var createPrintJob = function(documentType, printerType){
        return function(data){
            return pdfService[documentType](data)
                .then(function(file){
                    return wrapMpromise(dataService.model.printJob.create({
                        type: printerType || documentType,
                        file: file,
                        pending: true,
                        comment: 'Auftrag erstellt'
                    }));
                })
                .then(function (){
                    return data;
                });
        };
    };

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

    var assignOrderNumber = function(order) {
        return wrapMpromise(dataService.model.order.findOne().sort('-no').exec())
            .then(function(orderWithBiggestNo) {
                var lastNo = orderWithBiggestNo ? (orderWithBiggestNo.no || 0) : 0;
                order.no = lastNo + 1;
                return order;
            });
    };

    var getAggregatedLimits = function(){
        function setupTotal(limits){
            var total = {};
            _.each(limits,function(limit){
                total[limit._id.toHexString()] = { used: 0, total: limit.available, name: limit.name};
            });
            return total;
        }

        function aggregateUsed(total, orders){
            _.each(orders, function(order){
                _.each(order.items, function(item){
                    _.each(item.article.limits || [], function(articleLimit){
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

    var calculateBalanceAndStatistics = function() {
        var balanceAndStatistics = {
            balance: {
                revenues: {},
                vouchers: {}
            },
            articles: {},
            orderDateRange: {
                from: null,
                to: null
            },
            orderCount: 0
        };
        var dateMax = function(m1, m2) {
            return m1 == null || m2.isAfter(m1) ? m2 : m1;
        };
        var dateMin = function(m1, m2) {
            return m1 == null || m2.isBefore(m1) ? m2 : m1;
        };

        return wrapMpromise(dataService.model.order.find({state: 'sent'}).populate('items.article').exec())
            .then(function(orders){
                _.each(dataService.availableCurrencies, function(currency){
                    balanceAndStatistics.balance.revenues[currency] = 0;
                    balanceAndStatistics.balance.vouchers[currency] = 0;
                });
                balanceAndStatistics.orderCount = orders.length;
                _.each(orders, function(order){
                    if (order.voucher) {
                        balanceAndStatistics.balance.vouchers[order.currency] += order.total[order.currency];
                    } else {
                        balanceAndStatistics.balance.revenues[order.currency] += order.total[order.currency];
                    }
                    var timeOfOrder = moment(order._id.getTimestamp());
                    balanceAndStatistics.orderDateRange.to = dateMax(balanceAndStatistics.orderDateRange.to, timeOfOrder);
                    balanceAndStatistics.orderDateRange.from = dateMin(balanceAndStatistics.orderDateRange.from, timeOfOrder);
                    _.each(order.items, function(item){
                        var article = balanceAndStatistics.articles[item.article._id];
                        if (!article) {
                            balanceAndStatistics.articles[item.article._id] = article = {
                                name: item.article.name,
                                group: item.article.group,
                                count: 0
                            };
                        }
                        article.count += item.count;
                    });
                });
                return getAggregatedLimits();
            })
            .then(function(limits){
                balanceAndStatistics.limits = limits;
                return balanceAndStatistics;
            });
    };

    var app = express();
    app.use(bodyParser.json());
    app.use(methodOverride());
    app.use(session(sessionOptions));
    dataService.addRestRoutes(app);

    app.get('/currencies', function(req, res){
        res.json(dataService.availableCurrencies);
    });

    app.get('/availablePrinters', function(req, res){
       printService.getPrinters()
           .catch(handleError(res))
           .done(addToBody(res));
    });
    app.get('/kitchenPrinterTypes', function(req, res){
       res.json(printService.kitchenPrinterTypes);
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
        var noPrint = req.param('noPrint') || false;
        getOrder(getOrderIdFromSession(req))
            .then(function(order){
                if (!order){
                    throw new Error('Keine Bestellung gewählt')
                }
                order.currency = req.param('currency') || dataService.availableCurrencies[0];
                order.kitchenNotes = req.param('kitchenNotes') || order.kitchenNotes;
                order.voucher = req.param('voucher') || false;
                if (order.kitchen) {
                    return assignOrderNumber(order);
                } else {
                    return order;
                }
            })
            .then(setOrderState('sent'))
            .then(saveDocument)
            .then(populate('items.article'))
            .then(function(order){
                if (order.kitchen) {
                    return printService.getKitchenPrinterType()
                        .then(function(type){
                            return createPrintJob('kitchen' + type, 'kitchen')(order);
                        });
                } else {
                    return order;
                }
            })
            .then(createPrintJob('receipt'))
            .then(createOrder)
            .then(function(order){
                setOrderIdToSession(req, order);
                return order;
            })
            .catch(handleError(res))
            .done(addToBody(res));

    });

    app.post('/order/print', function(req, res){
        getOrder(req.param('order'))
            .then(populate('items.article'))
            .then(createPrintJob(req.param('type')))
            .catch(handleError(res))
            .done(function(){
                res.json({});
            });
    });

    app.get('/availability', function(req, res){
       getAggregatedLimits()
           .catch(handleError(res))
           .done(addToBody(res));
    });

    app.post('/availability/inc', function(req, res){
        var limitId = req.param('limit');
        var incAmount = parseInt(req.param('incAmount'));

        getAggregatedLimits()
            .then(function(limits){
                var limitToModify = limits[limitId];
                if (limitToModify) {
                    var available = limitToModify.total - limitToModify.used;
                    if (available < -incAmount) {
                        throw new Error("Limit kann nicht mehr reduziert werden");
                    } else {
                        return wrapMpromise(dataService.model.limit.update({_id: limitId}, {$inc: { 'available': incAmount}}).exec());
                    }
                } else {
                    throw new Error('Limit nicht gefunden');
                }
            })
            .then(getAggregatedLimits)
            .catch(handleError(res))
            .done(addToBody(res));
    });

    app.post('/printJob/cancel', function(req, res){
        printService.cancelJob(req.param('printJob'))
            .catch(handleError(res))
            .done(addToBody(res));
    });

    app.get('/balanceAndStatistics', function(req, res){
        calculateBalanceAndStatistics()
            .catch(handleError(res))
            .done(addToBody(res));

    });
    app.post('/balanceAndStatistics/print', function(req, res){
        calculateBalanceAndStatistics()
            .then(createPrintJob('balanceAndStatistics', 'kitchen'))
            .catch(handleError(res))
            .done(addToBody(res));

    });
    app.post('/balanceAndStatistics/startOver', function(req, res){
        wrapMpromise(dataService.model.printJob.remove({}).exec())
            .then(function(){
                return wrapMpromise(dataService.model.order.remove({}).exec());
            }).then(function(){
                return pdfService.removeAllPdfs();
            })
            .catch(handleError(res))
            .done(addToBody(res));
    });

    app.get('/tagGroups', function(req, res){
        wrapMpromise(
        dataService.model.setting
            .findOneOrCreate({name: 'tagGroups'}, {name: 'tagGroups', desc: 'Tag Gruppen', value: '.*', type: 'TagGroups'})
        )
        .catch(handleError(res))
        .done(addToBody(res));
    });

    return app;
};

