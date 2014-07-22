var chai = require('chai');
var should = chai.should();
var request = require("supertest-as-promised");
var testBistro = require('./helpers/test-bistro.js');

chai.use(require('./helpers/chai.js'));

describe('orders access', function() {

    var paths = {
        orders: '/api/v1/orders',
        ordersCount: '/api/v1/orders/count'
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
            limits: [ { dec: 1, limit: fixtures.limits.limit1.__id } ],
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
                    res.body.should.be.an('array').with.length(0);
                })
                .end(done);
        });
        it('should have zero count', function(done){
            request(app)
                .get(paths.ordersCount)
                .expect({count: 0})
                .end(done);
        });
    });

    describe('post /orders', function(){
        var order = {
            _id: 'shouldnotmatter',
            currency: 'chf',
            articles: [{
                count: 1,
                article: fixtures.articles.article1._id
            }]
        };
        it('should add an order with order no 1', function(done){
            request(app)
                .post(paths.orders)
                .type('json')
                .send(order)
                .expect(function(res){
                    res.body.should.be.an('object');
                    res.body.should.have.a.property('_id').that.is.a('string');
                    res.body.should.have.a.property('no', 1);
                    res.body.should.have.a.property('currency', order.currency);
                    res.body.should.have.a.property('articles').that.is.an('array');
                })
                .expect(200)
                .then(function(oldRes){
                    return request(app)
                        .get(paths.orders + '/' + oldRes.body._id)
                        .expect(function(res){
                            res.body.should.be.an('object');
                            res.body.should.have.a.property('_id').that.is.a('string');
                            res.body.should.have.a.property('no', 1);
                            res.body.should.have.a.property('currency', order.currency);
                            res.body.should.have.a.property('articles').that.is.an('array');
                        })
                        .expect(200);
                })
                .then(function(oldRes){
                    return request(app)
                        .get(paths.orders)
                        .accept('json')
                        .expect(function(res){
                            res.body.should.be.an('array').with.length(1);
                            res.body[0].should.be.an('object');
                            res.body[0].should.have.a.property('_id', oldRes.body._id);
                            res.body[0].should.have.a.property('no', 1);
                            res.body[0].should.have.a.property('currency', order.currency);
                            res.body[0].should.have.a.property('articles').that.is.an('array');
                        })
                        .expect(200);
                })
                .then(function(){
                    request(app)
                        .get(paths.ordersCount)
                        .expect(200)
                        .expect({count: 1});
                })
                .catch(done)
                .done(done);
        });
        it('should increment the order number on every new order', function(done){
            var order = {
                currency: 'eur',
                articles: [
                    { count: 1, article: fixtures.articles.article1._id},
                    { count: 2, article: fixtures.articles.article2._id}
                ]
            };
            request(app)
                .post(paths.orders)
                .type('json')
                .send(order)
                .expect(function(res){
                    res.body.should.be.an('object');
                    res.body.should.have.a.property('_id').that.is.a('string');
                    res.body.should.have.a.property('no', 2);
                    res.body.should.have.a.property('currency', order.currency);
                    res.body.should.have.a.property('articles').that.is.an('array');
                })
                .expect(200)
                .then(function(){
                    request(app)
                        .get(paths.ordersCount)
                        .expect(200)
                        .expect({count: 2});
                })
                .catch(done)
                .done(done);
        });
    });
});