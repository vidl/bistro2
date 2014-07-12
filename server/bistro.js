var express = require('express');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var data = require('./data');


module.exports = function(dbConnection) {

    var dataService = data(dbConnection);

    var app = express();
    app.use(bodyParser.json());
    app.use(methodOverride());
    dataService.addRestRoutes(app);

    return app;
};

