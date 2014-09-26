var chai = require('chai');
var should = chai.should();
var request = require("supertest-as-promised");
var testBistro = require('./helpers/test-bistro.js');

chai.use(require('./helpers/chai.js'));

var noErr = testBistro.noErr;


describe('articles access', function() {

    var paths = {
        articles: '/api/v1/articles',
        articlesCount: '/api/v1/articles/count'
    };
    var app = testBistro.app;

    var id = testBistro.id;
    var fixtures = {};
    fixtures.limits = {
        limit1: { _id: id(), name: 'limit1', available: 10},
        limit2: { _id: id(), name: 'limit2', available: 7}
    };

    before(function (done) {
        testBistro.fixtures.clearAllAndLoad(fixtures, done);
    });

    describe('get /articles', function() {
        it('respond with json', function(done){
            request(app)
                .get(paths.articles)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(200, done);
        });
        it('returns empty array', function(done){
            request(app)
                .get(paths.articles)
                .accept('json')
                .expect(function(res){
                    res.body.should.be.an('array').with.length(0);
                })
                .expect(200, done);
        });
        it('should have zero count', function(done){
            request(app)
                .get(paths.articlesCount)
                .expect({count: 0})
                .expect(200, done);
        });
    });

    describe('post /articles', function(){
        var article = {
            _id: 'shouldnotmatter',
            name: 'Test-article1',
            price: { chf: 5.4, eur: 4.0 },
            limits: [
                { dec: 1, limit: fixtures.limits.limit1 }
            ]
        };
        it('should add an article', function(done){
            request(app)
                .post(paths.articles)
                .type('json')
                .send(article)
                .expect(function(res){
                    res.body.should.be.an('object');
                    res.body.should.have.a.property('_id').that.is.a('string');
                    res.body.should.have.a.property('name', article.name);
                    res.body.should.have.a.deep.property('price.chf', article.price.chf);
                    res.body.should.have.a.deep.property('price.eur', article.price.eur);
                    res.body.limits.should.have.an('array').with.length(1);
                    res.body.limits[0].should.have.a.property('dec', article.limits[0].dec);
                    res.body.limits[0].should.have.a.property('limit', fixtures.limits.limit1._id.toString());
                })
                .expect(200)
            .then(function(oldRes){
                return request(app)
                    .get(paths.articles + '/' + oldRes.body._id)
                    .query({populate: 'limits.limit'})
                    .expect(function(res){
                        res.body.should.be.an('object');
                        res.body.should.have.a.property('_id').that.is.a('string');
                        res.body.should.have.a.property('name', article.name);
                        res.body.should.have.a.deep.property('price.chf', article.price.chf);
                        res.body.should.have.a.deep.property('price.eur', article.price.eur);
                        res.body.limits.should.have.an('array').with.length(1);
                        res.body.limits[0].should.have.a.property('dec', article.limits[0].dec);
                        res.body.limits[0].should.have.a.deep.property('limit.name', fixtures.limits.limit1.name);
                    })
                    .expect(200);
            })
            .then(function(oldRes){
                return request(app)
                    .get(paths.articles)
                    .accept('json')
                    .expect(function(res){
                        res.body.should.be.an('array').with.length(1);
                        res.body[0].should.be.an('object');
                        res.body[0].should.have.a.property('_id', oldRes.body._id);
                        res.body[0].should.have.a.property('name', article.name);
                        res.body[0].should.have.a.deep.property('price.chf', article.price.chf);
                        res.body[0].should.have.a.deep.property('price.eur', article.price.eur);
                    })
                    .expect(200);
            })
            .then(function(){
                return request(app)
                    .get(paths.articlesCount)
                    .expect({count: 1})
                    .expect(200);
            })
            .done(noErr(done), done);
        });
    });

    describe('post or put /articles', function(){
        it('should update an existing article', function(done){
            request(app)
                .get(paths.articles)
                .accept('json')
                .expect(function(res) {
                    res.body.should.be.an('array').with.length(1);
                    res.body[0].should.have.a.property('name', 'Test-article1');
                    res.body[0].should.have.a.deep.property('price.chf', 5.4);
                    res.body[0].should.have.a.deep.property('price.eur', 4);
                })
            .then(function(res) {
                console.log('post %s\n', res.body[0].name);
                return request(app)
                    .post(paths.articles + '/' + res.body[0]._id)
                    .type('json')
                    .send({name: 'blabla', limits:[
                        { dec: 0, limit: fixtures.limits.limit1._id },
                        { dec: 2, limit: fixtures.limits.limit2._id }
                    ]})
                    .expect(function (res) {
                        res.body.should.be.an('object');
                        res.body.should.have.a.property('_id').that.is.a('string');
                        res.body.should.have.a.property('name', 'blabla');
                        res.body.should.have.a.deep.property('price.chf', 5.4);
                        res.body.should.have.a.deep.property('price.eur', 4);
                        res.body.limits.should.be.an('array').of.length(1);
                        res.body.limits[0].should.have.a.property('dec', 2);
                    })
                    .expect(200);
            }).then(function(){
                return request(app)
                    .get(paths.articles)
                    .accept('json')
                    .expect(function(res){
                        console.log('check again\n')
                        res.body.should.be.an('array').with.length(1);
                        res.body[0].should.be.an('object');
                        res.body[0].should.have.a.property('name', 'blabla');
                        res.body[0].should.have.a.deep.property('price.chf', 5.4);
                        res.body[0].should.have.a.deep.property('price.eur', 4);
                        res.body[0].limits.should.be.an('array').of.length(1);
                        res.body[0].limits[0].should.have.a.property('dec', 2);
                    })
                    .expect(200);

            })
            .done(noErr(done), done);
        });
    });

    describe('delete /articles', function(){
        it('removes an existing article', function(done){
            request(app)
                .get(paths.articles)
                .accept('json')
                .expect(200)
            .then(function(res){
                return request(app)
                    .delete(paths.articles + '/' + res.body[0]._id)
                    .expect(200);
            })
            .then(function(){
                return request(app)
                    .get(paths.articlesCount)
                    .expect({count: 0})
                    .expect(200);
            })
            .then(function(){
                return request(app)
                    .get(paths.articles)
                    .accept('json')
                    .expect(function(res){
                        res.body.should.be.an('array').with.length(0);
                    })
                    .expect(200);
            })
            .done(noErr(done), done);
       });
    });

});

