module.exports = function (chai, utils) {
    var Assertion = chai.Assertion;

    var fn = function (str) {
        var obj = this._obj;

        new Assertion(obj).to.be.a('string');

        // second, our type check
        this.assert(
                obj.indexOf(str) === 0
            , "expected #{this} to start with #{exp}"
            , "expected #{this} not to start with #{exp}"
            , str  // expected
            , obj  // actual
        );
    };
    Assertion.addMethod('startsWith', fn);
    Assertion.addMethod('startWith', fn);

};