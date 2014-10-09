var chai = require('chai');
var should = chai.should();
var request = require("supertest-as-promised");
var testBistro = require('./helpers/test-bistro.js');

chai.use(require('./helpers/chai.js'));

var noErr = testBistro.noErr;

describe('orders access', function() {

    var paths = {
        orders: '/api/v1/orders',
        ordersCount: '/api/v1/orders/count',
        order: '/order',
        orderItem: '/order/item',
        orderPreorder: '/order/preorder',
        orderSelect: '/order/select',
        orderSend: '/order/send'

    };
    var app = testBistro.app;

    var id = testBistro.id;
    var fixtures = {};
    fixtures.limits = {
        limit1: { _id: id(), name: 'limit1', available: 10}
    };
    fixtures.articles = {
        article1: {
            _id: id(),
            name: 'article1',
            price: {
                chf: 1.2,
                eur: 1
            },
            limits: [ { dec: 1, limit: fixtures.limits.limit1._id } ],
            kitchen: false,
            active: true
        },
        article2: {
            _id: id(),
            name: 'article2',
            price: {
                chf: 2.4,
                eur: 2
            },
            kitchen: true,
            active: true
        }
    };

    before(function (done) {
        testBistro.fixtures.clearAllAndLoad(fixtures, done);
    });

    describe('get /orders', function() {
        it('respond with json', function(done){
            request(app)
                .get(paths.orders)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(200, done);
        });
        it('returns empty array', function(done){
            request(app)
                .get(paths.orders)
                .accept('json')
                .expect(function(res){
                    res.body.should.be.an('array').and.empty;
                })
                .expect(200, done);
        });
        it('should have zero count', function(done){
            request(app)
                .get(paths.ordersCount)
                .expect({count: 0})
                .expect(200, done);
        });
    });

    describe('post /orders', function(){
        it('is not allowed', function(done){
            request(app)
                .post(paths.orders)
                .type('json')
                .send({doesNotMatter: 1})
                .expect(403, done);
        });
    });

    describe('put /orders', function(){
        it('is not allowed', function(done){
            request(app)
                .put(paths.orders + '/anid')
                .expect(403, done);
        });
    });

    var serverSession = request.agent(app);
    describe('/order', function() {
        it('returns an empty order on get', function (done) {
            serverSession.get(paths.order)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(function (res) {
                    res.body.should.be.an('object');
                    res.body.should.have.a.property('_id').that.is.a('string');
                    res.body.should.have.a.property('no', 1);
                    res.body.should.have.a.property('items').that.is.an('array').and.empty;
                    res.body.should.have.a.property('kitchen', false);
                    res.body.should.have.a.property('state', 'editing');
                })
                .expect(200, done);
        });

    });

    describe('post on /order/item', function() {
        it('can add an item', function (done) {
            serverSession.post(paths.orderItem)
                .send({article: fixtures.articles.article1._id, incAmount: 1})
                .expect(function (res) {
                    res.body.should.be.an('object');

                    res.body.should.have.a.property('order');
                    res.body.order.should.have.a.property('no', 1);
                    res.body.order.should.have.a.property('items');
                    res.body.order.should.not.have.a.property('currency');
                    res.body.order.items.should.be.an('array').with.lengthOf(1);
                    res.body.order.items[0].should.have.a.property('count', 1);
                    res.body.order.items[0].should.have.a.deep.property('article._id', fixtures.articles.article1._id.toHexString());
                    res.body.order.items[0].should.have.a.deep.property('article.name', fixtures.articles.article1.name);
                    res.body.order.should.have.a.deep.property('total.chf', 1.2);
                    res.body.order.should.have.a.deep.property('total.eur', 1);
                    res.body.order.should.have.a.property('kitchen', false);
                    res.body.order.should.have.a.property('state', 'editing');

                    res.body.should.have.a.property('limits').that.is.an('object');
                    res.body.limits.should.have.a.property(fixtures.limits.limit1._id.toString());
                    var limit1 = res.body.limits[fixtures.limits.limit1._id.toString()];
                    limit1.should.have.a.property('total', 10);
                    limit1.should.have.a.property('used', 1);
                })
                .expect(200)
                .then(function () {
                    return serverSession.post(paths.orderItem)
                        .send({article: fixtures.articles.article1._id, incAmount: 1})
                        .expect(function (res) {
                            res.body.should.be.an('object');

                            res.body.should.have.a.property('order');
                            res.body.order.should.have.a.property('no', 1);
                            res.body.order.should.have.a.property('items');
                            res.body.order.should.not.have.a.property('currency');
                            res.body.order.items.should.be.an('array').with.lengthOf(1);
                            res.body.order.items[0].should.have.a.property('count', 2);
                            res.body.order.items[0].should.have.a.deep.property('article._id', fixtures.articles.article1._id.toHexString());
                            res.body.order.should.have.a.deep.property('total.chf', 2.4);
                            res.body.order.should.have.a.deep.property('total.eur', 2);
                            res.body.order.should.have.a.property('kitchen', false);
                            res.body.order.should.have.a.property('state', 'editing');

                            res.body.should.have.a.property('limits').that.is.an('object');
                            res.body.limits.should.have.a.property(fixtures.limits.limit1._id.toString());
                            var limit1 = res.body.limits[fixtures.limits.limit1._id.toString()];
                            limit1.should.have.a.property('total', 10);
                            limit1.should.have.a.property('used', 2);
                        })
                        .expect(200);
                })
                .then(function () {
                    return serverSession.post(paths.orderItem)
                        .send({article: fixtures.articles.article2._id, incAmount: 1})
                        .expect(function (res) {
                            res.body.should.be.an('object');

                            res.body.should.have.a.property('order');
                            res.body.order.should.have.a.property('no', 1);
                            res.body.order.should.have.a.property('items');
                            res.body.order.should.not.have.a.property('currency');
                            res.body.order.items.should.be.an('array').with.lengthOf(2);
                            res.body.order.items[0].should.have.a.property('count', 2);
                            res.body.order.items[0].should.have.a.deep.property('article._id', fixtures.articles.article1._id.toHexString());
                            res.body.order.items[1].should.have.a.property('count', 1);
                            res.body.order.items[1].should.have.a.deep.property('article._id', fixtures.articles.article2._id.toHexString());
                            res.body.order.should.have.a.deep.property('total.chf', 4.8);
                            res.body.order.should.have.a.deep.property('total.eur', 4);
                            res.body.order.should.have.a.property('kitchen', true);
                            res.body.order.should.have.a.property('state', 'editing');

                            res.body.should.have.a.property('limits').that.is.an('object');
                            res.body.limits.should.have.a.property(fixtures.limits.limit1._id.toString());
                            var limit1 = res.body.limits[fixtures.limits.limit1._id.toString()];
                            limit1.should.have.a.property('total', 10);
                            limit1.should.have.a.property('used', 2);
                        })
                        .expect(200);
                })
                .done(noErr(done), done);
        });

        it('can remove an item', function (done) {
            serverSession.post(paths.orderItem)
                .send({article: fixtures.articles.article2._id, incAmount: -1})
                .expect(function (res) {
                    res.body.should.be.an('object');

                    res.body.should.have.a.property('order');
                    res.body.order.should.have.a.property('no', 1);
                    res.body.order.should.have.a.property('items');
                    res.body.order.should.not.have.a.property('currency');
                    res.body.order.items.should.be.an('array').with.lengthOf(1);
                    res.body.order.items[0].should.have.a.property('count', 2);
                    res.body.order.items[0].should.have.a.deep.property('article._id', fixtures.articles.article1._id.toHexString());
                    res.body.order.should.have.a.deep.property('total.chf', 2.4);
                    res.body.order.should.have.a.deep.property('total.eur', 2);
                    res.body.order.should.have.a.property('kitchen', false);
                    res.body.order.should.have.a.property('state', 'editing');

                    res.body.should.have.a.property('limits').that.is.an('object');
                    res.body.limits.should.have.a.property(fixtures.limits.limit1._id.toString());
                    var limit1 = res.body.limits[fixtures.limits.limit1._id.toString()];
                    limit1.should.have.a.property('total', 10);
                    limit1.should.have.a.property('used', 2);
                })
                .expect(200)
                .then(function () {
                    return serverSession.post(paths.orderItem)
                        .send({article: fixtures.articles.article2._id, incAmount: -1})
                        .expect(480)
                        .expect(function (res) {
                            res.body.should.be.an('object');
                            res.body.should.have.a.property('message', 'Validation failed');
                            res.body.should.have.a.property('errors').that.is.an('object');
                            res.body.errors.should.have.a.property('items.1.count');
                        });
                })
                .done(noErr(done), done);

        });
    });

    describe('post order/send', function(){
        it('can send an order', function(done){
           serverSession.post(paths.orderSend)
               .send({currency: 'eur'})
               .expect(function(res){
                   res.body.should.have.a.property('no', 2);
                   res.body.should.have.a.property('items');
                   res.body.items.should.be.an('array').with.lengthOf(0);
                   res.body.should.have.a.deep.property('total.chf', 0);
                   res.body.should.have.a.deep.property('total.eur', 0);
                   res.body.should.have.a.property('kitchen', false);
                   res.body.should.have.a.property('state', 'editing');
               })
               .expect(200)
               .then(function(){
                   return serverSession.get(paths.order)
                       .expect(function(res){
                           res.body.should.be.an('object');
                           res.body.should.have.a.property('_id').that.is.a('string');
                           res.body.should.have.a.property('no', 2);
                           res.body.should.have.a.property('items').that.is.an('array').and.empty;
                           res.body.should.have.a.property('state', 'editing');
                       })
                       .expect(200);
                })
               .done(noErr(done), done);
        });

        it('submits a print request', function(done){
            serverSession.get(paths.orders)
                .expect(function(res){
                    res.body.should.be.an('array').of.length(2);
                    res.body[0].should.have.a.property('no', 1);
                    res.body[0].should.have.a.deep.property('printRequested.kitchen', true);
                    res.body[0].should.have.a.deep.property('printRequested.receipt', true);
                })
                .expect(200, done);
        });

        it('can send only with currencies available currencies', function(done){
           serverSession.post(paths.orderSend)
               .send({currency: 'dollar'})
               .expect(function(res){
                   res.body.should.be.an('object');
                   res.body.should.have.a.property('message', 'Validation failed');
                   res.body.should.have.a.property('errors').that.is.an('object');
                   res.body.errors.should.have.a.property('currency');
               })
               .expect(480)
               .then(function(){
                   return serverSession.get(paths.order)
                       .expect(function(res){
                           res.body.should.be.an('object');
                           res.body.should.have.a.property('_id').that.is.a('string');
                           res.body.should.have.a.property('no', 2);
                           res.body.should.have.a.property('items').that.is.an('array').and.empty;
                           res.body.should.have.a.property('state', 'editing');
                       })
                       .expect(200);
               })
               .done(noErr(done), done);
        });

    });


    describe('post order/preorder', function(){
        before(function (done) {
            // new game
            serverSession = request.agent(app);
            testBistro.fixtures.clearAllAndLoad(fixtures, done);
        });
        it('needs a name', function(done){
            serverSession.post(paths.orderItem)
                .send({article: fixtures.articles.article1._id, incAmount: 1})
                .expect(200)
                .expect(function(res) {
                    res.body.should.be.an('object');
                    res.body.should.have.a.property('order');
                    res.body.order.should.have.a.property('_id').that.is.a('string');
                    res.body.order.should.have.a.property('no', 1);
                    res.body.order.should.have.a.property('items').that.is.an('array').with.lengthOf(1);
                    res.body.order.should.have.a.property('state', 'editing');
                })
                .then(function(){
                    return serverSession.post(paths.orderPreorder)
                        .send({some: 'arg'})
                        .expect(480);

                })
                .done(noErr(done), done);
        });
        it('can save an existing order', function(done){
            serverSession.post(paths.orderPreorder)
                .send({name: 'test-case'})
                .expect(function(res){
                    res.body.should.be.an('object');
                    res.body.should.have.a.property('_id').that.is.a('string');
                    res.body.should.have.a.property('no', 2);
                    res.body.should.have.a.property('items').that.is.an('array').and.empty;
                    res.body.should.have.a.property('state', 'editing');
                })
                .expect(200, done);
        });

        it('can select a preordered order', function(done){
            serverSession.get(paths.orders)
                .expect(function(res) {
                    res.body.should.be.an('array').with.lengthOf(2);
                    res.body[0].should.have.a.property('no', 1);
                    res.body[0].should.have.a.property('state', 'preordered');
                    res.body[0].should.have.a.property('name', 'test-case');

                    res.body[1].should.have.a.property('no', 2);
                    res.body[1].should.have.a.property('state', 'editing');
                }).then(function(res){
                    return serverSession.post(paths.orderSelect)
                        .send({order: res.body[0]._id})
                        .expect(200);
                }).then(function(){
                    return serverSession.get(paths.order)
                        .expect(200)
                        .expect(function(res){
                            res.body.should.be.an('object');
                            res.body.should.have.a.property('_id').that.is.a('string');
                            res.body.should.have.a.property('no', 1);
                            res.body.should.have.a.property('items').that.is.an('array').with.lengthOf(1);
                            res.body.should.have.a.property('state', 'editing');
                        });
                }).then(function(){
                    return serverSession.get(paths.orders)
                        .expect(200)
                        .expect(function(res) {
                            res.body.should.be.an('array').with.lengthOf(1);
                            res.body[0].should.have.a.property('no', 1);
                            res.body[0].should.have.a.property('state', 'editing');
                            res.body[0].should.have.a.property('name', 'test-case');
                        });
                })
                .done(noErr(done), done);
        });

        it('discard the current non-empty order when selecting an preordered order', function(done){
            serverSession.post(paths.orderSend)
                .send({currency: 'chf'})
                .expect(200)
                .then(function(){
                    return serverSession.post(paths.orderItem)
                        .send({article: fixtures.articles.article2._id, incAmount: 2})
                        .expect(200)
                        .expect(function(res){
                            res.body.should.be.an('object');
                            res.body.should.have.a.property('order');
                            res.body.order.should.have.a.property('_id').that.is.a('string');
                            res.body.order.should.have.a.property('no', 2);
                            res.body.order.should.have.a.property('items').that.is.an('array').with.lengthOf(1);
                            res.body.order.should.have.a.property('state', 'editing');

                        });
                })
                .then(function(){
                    return serverSession.post(paths.orderPreorder)
                        .send({name: 'test-case2'})
                        .expect(200);
                })
                .then(function(){
                    return serverSession.post(paths.orderItem)
                        .send({article: fixtures.articles.article1._id, incAmount: 3})
                        .expect(200)
                        .expect(function(res){
                            res.body.should.be.an('object');
                            res.body.should.have.a.property('order');
                            res.body.order.should.have.a.property('_id').that.is.a('string');
                            res.body.order.should.have.a.property('no', 3);
                            res.body.order.should.have.a.property('items').that.is.an('array').with.lengthOf(1);
                            res.body.order.should.have.a.property('state', 'editing');
                        });
                })
                .then(function(){
                    return serverSession.get(paths.orders)
                        .expect(200)
                        .expect(function(res){
                            res.body.should.be.an('array').with.lengthOf(3);
                            res.body[0].should.have.a.property('no', 1);
                            res.body[0].should.have.a.property('state', 'sent');
                            res.body[0].should.have.a.property('name', 'test-case');

                            res.body[1].should.have.a.property('no', 2);
                            res.body[1].should.have.a.property('state', 'preordered');
                            res.body[1].should.have.a.property('name', 'test-case2');

                            res.body[2].should.have.a.property('no', 3);
                            res.body[2].should.have.a.property('state', 'editing');
                        });
                })
                .then(function(res){
                    return serverSession.post(paths.orderSelect)
                        .send({order: res.body[1]._id})
                        .expect(200);
                })
                .then(function(){
                    return serverSession.get(paths.order)
                        .expect(200)
                        .expect(function(res){
                            res.body.should.be.an('object');
                            res.body.should.have.a.property('_id').that.is.a('string');
                            res.body.should.have.a.property('no', 2);
                            res.body.should.have.a.property('items').that.is.an('array').with.lengthOf(1);
                            res.body.should.have.a.property('state', 'editing');
                        })
                })
                .then(function(){
                    return serverSession.get(paths.orders)
                        .expect(200)
                        .expect(function(res){
                            res.body.should.be.an('array').with.lengthOf(2);
                            res.body[0].should.have.a.property('no', 1);
                            res.body[0].should.have.a.property('state', 'sent');
                            res.body[0].should.have.a.property('name', 'test-case');

                            res.body[1].should.have.a.property('no', 2);
                            res.body[1].should.have.a.property('state', 'editing');
                            res.body[1].should.have.a.property('name', 'test-case2');
                        });

                })
                .done(noErr(done),done);

        });
    });

});