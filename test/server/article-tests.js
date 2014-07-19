var chai = require('chai');
var should = chai.should();
var request = require("supertest-as-promised");
var testBistro = require('./helpers/test-bistro.js');

chai.use(require('./helpers/chai.js'));

describe('articles access', function() {

    var paths = {
        articles: '/api/v1/articles',
        articlesCount: '/api/v1/articles/count'
    };
    var app = testBistro.app;


    before(function (done) {
        testBistro.fixtures.clearAllAndLoad({}, done);
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
                .end(done);
        });
        it('should have zero count', function(done){
            request(app)
                .get(paths.articlesCount)
                .expect({count: 0})
                .end(done);
        });
    });

    describe('post /articles', function(){
        var article = {
            _id: 'shouldnotmatter',
            name: 'Test-article1',
            price: { chf: 5.4, eur: 4.0 }
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
                })
                .expect(200)
            .then(function(oldRes){
                return request(app)
                    .get(paths.articles + '/' + oldRes.body._id)
                    .expect(function(res){
                        res.body.should.be.an('object');
                        res.body.should.have.a.property('_id').that.is.a('string');
                        res.body.should.have.a.property('name', article.name);
                        res.body.should.have.a.deep.property('price.chf', article.price.chf);
                        res.body.should.have.a.deep.property('price.eur', article.price.eur);
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
                request(app)
                    .get(paths.articlesCount)
                    .expect(200)
                    .expect({count: 1});
            })
            .catch(done)
            .done(done);
        });
    });

    describe('put /articles', function(){
        it('should update an existing article', function(done){
            request(app)
                .get(paths.articles)
                .accept('json')
            .then(function(res){
                res.body.should.be.an('array').with.length(1);
                res.body[0].should.have.a.property('name', 'Test-article1');
                res.body[0].should.have.a.deep.property('price.chf', 5.4);
                res.body[0].should.have.a.deep.property('price.eur', 4);
                return request(app)
                    .put(paths.articles + '/' + res.body[0]._id)
                    .type('json')
                    .send({name: 'blabla'})
                    .expect(200);

            })
            .then(function(res){
                res.body.should.be.an('object');
                res.body.should.have.a.property('_id').that.is.a('string');
                res.body.should.have.a.property('name', 'blabla');
                res.body.should.have.a.deep.property('price.chf', 5.4);
                res.body.should.have.a.deep.property('price.eur', 4);
            })
            .catch(done)
            .done(done);
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
                request(app)
                    .get(paths.articles)
                    .accept('json')
                    .expect(function(res){
                        res.body.should.be.an('array').with.length(0);
                    })
                    .expect(200);
            })
            .catch(done)
            .done(done);
       });
    });

});

