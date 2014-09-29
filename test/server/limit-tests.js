var chai = require('chai');
var should = chai.should();
var request = require("supertest-as-promised");
var testBistro = require('./helpers/test-bistro.js');

chai.use(require('./helpers/chai.js'));

var noErr = testBistro.noErr;

describe('limit logic', function() {

    var paths = {
        availability: '/availability',
        order: '/order',
        orderInc: '/order',
        orderDec: '/order'
    };
    var app = testBistro.app;

    var id = testBistro.id;
    var fixtures = {};
    fixtures.limits = {
        limit1: { _id: id(), name: 'limit1', available: 10},
        limit2: { _id: id(), name: 'limit2', available: 7}
    };
    fixtures.articles = {
        article1: {
            _id: id(),
            name: 'article1',
            price: {
                chf: 1.2,
                eur: 1
            },
            limits: [
                { dec: 1, limit: fixtures.limits.limit1._id },
                { dec: 2, limit: fixtures.limits.limit2._id }
            ],
            kitchen: true,
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
        },
        article3: {
            _id: id(),
            name: 'article3',
            price: {
                chf: 2.4,
                eur: 2
            },
            limits: [
                { dec: 1, limit: fixtures.limits.limit1._id }
            ],
            kitchen: true,
            active: true
        },
        article4: {
            _id: id(),
            name: 'article4',
            price: {
                chf: 2.4,
                eur: 2
            },
            limits: [
                { dec: 1, limit: fixtures.limits.limit2._id }
            ],
            kitchen: true,
            active: true
        }
    };

    before(function (done) {
        testBistro.fixtures.clearAllAndLoad(fixtures, done);
    });

    describe('get /limits', function(){
        var serverSession = request.agent(app);

        it('returns used = 0 since there are no orders', function(done){
            serverSession.get(paths.availability)
                .expect(function(res){
                    res.body.should.be.an('object');
                    res.body[fixtures.limits.limit1._id.toHexString()].should.deep.equals({total: 10, used: 0});
                    res.body[fixtures.limits.limit2._id.toHexString()].should.deep.equals({total: 7, used: 0});
                })
                .expect(200, done);
        });
        it('increases the use count of a limit in case of orders', function(done){
            serverSession.put(paths.orderInc)
                .send({article: fixtures.articles.article1._id, incAmount: 1})
                .expect(200)
                .then(function(){
                    return serverSession.get(paths.availability)
                        .expect(function (res) {
                            res.body[fixtures.limits.limit1._id.toHexString()].should.deep.equals({total: 10, used: 1});
                            res.body[fixtures.limits.limit2._id.toHexString()].should.deep.equals({total: 7, used: 2});
                        })
                        .expect(200);
                })
                .then(function(){
                    return serverSession.put(paths.orderInc)
                        .send({article: fixtures.articles.article1._id, incAmount: 1})
                        .expect(200);
                })
                .then(function(){
                    return serverSession.get(paths.availability)
                        .expect(function (res) {
                            res.body[fixtures.limits.limit1._id.toHexString()].should.deep.equals({total: 10, used: 2});
                            res.body[fixtures.limits.limit2._id.toHexString()].should.deep.equals({total: 7, used: 4});
                        })
                        .expect(200);
                })
                    .then(function(){
                    return serverSession.put(paths.orderInc)
                        .send({article: fixtures.articles.article2._id, incAmount: 1})
                        .expect(200);
                })
                .then(function(){
                    return serverSession.get(paths.availability)
                        .expect(function (res) {
                            res.body[fixtures.limits.limit1._id.toHexString()].should.deep.equals({total: 10, used: 2});
                            res.body[fixtures.limits.limit2._id.toHexString()].should.deep.equals({total: 7, used: 4});
                        })
                        .expect(200);
                })
                .then(function(){
                    return serverSession.put(paths.orderInc)
                        .send({article: fixtures.articles.article3._id, incAmount: 1})
                        .expect(200);
                })
                .then(function(){
                    return serverSession.get(paths.availability)
                        .expect(function (res) {
                            res.body[fixtures.limits.limit1._id.toHexString()].should.deep.equals({total: 10, used: 3});
                            res.body[fixtures.limits.limit2._id.toHexString()].should.deep.equals({total: 7, used: 4});
                        })
                        .expect(200);
                })
                .then(function(){
                    return serverSession.put(paths.orderDec)
                        .send({article: fixtures.articles.article1._id, incAmount: -1})
                        .expect(200);
                })
                .then(function(){
                    return serverSession.get(paths.availability)
                        .expect(function (res) {
                            res.body[fixtures.limits.limit1._id.toHexString()].should.deep.equals({total: 10, used: 2});
                            res.body[fixtures.limits.limit2._id.toHexString()].should.deep.equals({total: 7, used: 2});
                        })
                        .expect(200);
                })
                .done(noErr(done),done);
        });

        it('cannot order more than the limit - attempt will return status code 480', function(done){
            serverSession.put(paths.orderInc)
                .send({article: fixtures.articles.article1._id, incAmount: 1})
                .expect(200)
                .then(function(){
                    return serverSession.put(paths.orderInc)
                        .send({article: fixtures.articles.article1._id, incAmount: 1})
                        .expect(200);
                })
                .then(function(){
                    return serverSession.get(paths.availability)
                        .expect(function (res) {
                            res.body[fixtures.limits.limit1._id.toHexString()].should.deep.equals({total: 10, used: 4});
                            res.body[fixtures.limits.limit2._id.toHexString()].should.deep.equals({total: 7, used: 6});
                        })
                        .expect(200);
                })
                .then(function(){
                    return serverSession.put(paths.orderInc)
                        .send({article: fixtures.articles.article1._id, incAmount: 1})
                        .expect(480);
                })
                .then(function(){
                    return serverSession.get(paths.availability)
                        .expect(function (res) {
                            res.body[fixtures.limits.limit1._id.toHexString()].should.deep.equals({total: 10, used: 4});
                            res.body[fixtures.limits.limit2._id.toHexString()].should.deep.equals({total: 7, used: 6});
                        })
                        .expect(200);
                })
                .then(function(){
                    return serverSession.put(paths.orderInc)
                        .send({article: fixtures.articles.article4._id, incAmount: 1})
                        .expect(200);
                })
                .then(function(){
                    return serverSession.get(paths.availability)
                        .expect(function (res) {
                            res.body[fixtures.limits.limit1._id.toHexString()].should.deep.equals({total: 10, used: 4});
                            res.body[fixtures.limits.limit2._id.toHexString()].should.deep.equals({total: 7, used: 7});
                        })
                        .expect(200);
                })
                .then(function(){
                    return serverSession.put(paths.orderInc)
                        .send({article: fixtures.articles.article4._id, incAmount: 1})
                        .expect(480);
                })
                .done(noErr(done),done);

        });
    })
});