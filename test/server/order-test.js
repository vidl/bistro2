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
        orderInc: '/order/inc',
        orderDec: '/order/dec'
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

    describe('/order', function(){
        var serverSession = request.agent(app);
        it('returns an empty order on get', function(done){
            serverSession.get(paths.order)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(function(res){
                    res.body.should.be.an('object');
                    res.body.should.have.a.property('_id').that.is.a('string');
                    res.body.should.have.a.property('no', 1);
                    res.body.should.have.a.property('articles').that.is.an('array').and.empty;
                })
                .expect(200, done);
        });

        it('can add an article using put on /order/inc', function(done){
            serverSession.put(paths.orderInc)
                .send({article : fixtures.articles.article1._id})
                .expect(function(res){
                    res.body.should.have.a.property('no', 1);
                    res.body.should.have.a.property('articles');
                    res.body.should.not.have.a.property('currency');
                    res.body.articles.should.be.an('array').with.lengthOf(1);
                    res.body.articles[0].should.have.a.property('count', 1);
                    res.body.articles[0].should.have.a.deep.property('article._id', fixtures.articles.article1._id.toHexString());
                    res.body.should.have.a.deep.property('total.chf', 1.2);
                    res.body.should.have.a.deep.property('total.eur', 1);
                })
                .expect(200)
                .then(function(){
                    return serverSession.put(paths.orderInc)
                        .send({article: fixtures.articles.article1._id})
                        .expect(function (res) {
                            res.body.should.have.a.property('no', 1);
                            res.body.should.have.a.property('articles');
                            res.body.should.not.have.a.property('currency');
                            res.body.articles.should.be.an('array').with.lengthOf(1);
                            res.body.articles[0].should.have.a.property('count', 2);
                            res.body.articles[0].should.have.a.deep.property('article._id', fixtures.articles.article1._id.toHexString());
                            res.body.should.have.a.deep.property('total.chf', 2.4);
                            res.body.should.have.a.deep.property('total.eur', 2);

                        })
                        .expect(200);
                })
                .then(function(){
                    return serverSession.put(paths.orderInc)
                        .send({article: fixtures.articles.article2._id})
                        .expect(function (res) {
                            res.body.should.have.a.property('no', 1);
                            res.body.should.have.a.property('articles');
                            res.body.should.not.have.a.property('currency');
                            res.body.articles.should.be.an('array').with.lengthOf(2);
                            res.body.articles[0].should.have.a.property('count', 2);
                            res.body.articles[0].should.have.a.deep.property('article._id', fixtures.articles.article1._id.toHexString());
                            res.body.articles[1].should.have.a.property('count', 1);
                            res.body.articles[1].should.have.a.deep.property('article._id', fixtures.articles.article2._id.toHexString());
                            res.body.should.have.a.deep.property('total.chf', 4.8);
                            res.body.should.have.a.deep.property('total.eur', 4);

                        })
                        .expect(200);
                })
                .done(noErr(done),done);
        });

        it('can remove an article using put on /order/dec', function(done) {
            serverSession.put(paths.orderDec)
                .send({article : fixtures.articles.article2._id})
                .expect(function(res){
                    res.body.should.have.a.property('no', 1);
                    res.body.should.have.a.property('articles');
                    res.body.should.not.have.a.property('currency');
                    res.body.articles.should.be.an('array').with.lengthOf(1);
                    res.body.articles[0].should.have.a.property('count', 2);
                    res.body.articles[0].should.have.a.deep.property('article._id', fixtures.articles.article1._id.toHexString());
                    res.body.should.have.a.deep.property('total.chf', 2.4);
                    res.body.should.have.a.deep.property('total.eur', 2);
                })
                .expect(200)
                .then(function(){
                    return serverSession.put(paths.orderDec)
                        .send({article: fixtures.articles.article2._id})
                        .expect(480)
                        .expect(function(res){
                            res.body.should.be.an('object');
                            res.body.should.have.a.property('message', 'Validation failed');
                            res.body.should.have.a.property('errors').that.is.an('object');
                            res.body.errors.should.have.a.property('articles.1.count');
                        });
                })
                .done(noErr(done),done);

        });

        it('can commit an order using post', function(done){
           serverSession.post(paths.order)
               .send({currency: 'eur'})
               .expect(function(res){
                   res.body.should.have.a.property('no', 1);
                   res.body.should.have.a.property('articles');
                   res.body.articles.should.be.an('array').with.lengthOf(1);
                   res.body.articles[0].should.have.a.property('count', 2);
                   res.body.articles[0].should.have.a.deep.property('article._id', fixtures.articles.article1._id.toHexString());
                   res.body.should.have.a.deep.property('total.chf', 2.4);
                   res.body.should.have.a.deep.property('total.eur', 2);
                   res.body.should.have.a.property('currency', 'eur');

               })
               .expect(200)
               .then(function(){
                   return serverSession.get(paths.order)
                       .expect(function(res){
                           res.body.should.be.an('object');
                           res.body.should.have.a.property('_id').that.is.a('string');
                           res.body.should.have.a.property('no', 2);
                           res.body.should.have.a.property('articles').that.is.an('array').and.empty;

                       })
                       .expect(200);
                })
               .done(noErr(done), done);
        });

        it('can commit only with currencies chf and eur', function(done){
           serverSession.post(paths.order)
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
                           res.body.should.have.a.property('articles').that.is.an('array').and.empty;

                       })
                       .expect(200);
               })
               .done(noErr(done), done);
        });

    });

});