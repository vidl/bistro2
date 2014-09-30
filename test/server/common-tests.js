var chai = require('chai');
var should = chai.should();
var request = require("supertest-as-promised");
var testBistro = require('./helpers/test-bistro.js');

chai.use(require('./helpers/chai.js'));

var noErr = testBistro.noErr;


describe('common features', function() {

    var app = testBistro.app;

    describe('get /currencies', function () {
        it('respond with json', function (done) {
            request(app)
                .get('/currencies')
                .expect('Content-Type', /json/)
                .expect(function(res){
                    res.body.should.be.an('array').with.length(2);
                    res.body[0].should.equals('chf');
                    res.body[1].should.equals('eur');
                })
                .expect(200, done);


        });
    });
});
