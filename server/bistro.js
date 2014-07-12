var express = require('express');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var dbo = require('./dbo');


module.exports = function(dbConnection) {

    var dataService = dbo(dbConnection);

    var app = express();
    app.use(bodyParser.json());
    app.use(methodOverride());
    dataService.addRestRoutes(app);

    return app;
};

