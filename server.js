var http = require('http');
var express = require('express');
var path = require('path');
var bistro = require('./server/bistro');

var port = process.env.PORT || 8081;

var app = bistro('mongodb://127.0.0.1:27017/bistro');

app.use(express.static('client'));
app.use('/pdfs', express.static(__dirname + '/pdfs'));

http.createServer(app).listen(port, '0.0.0.0', function() {
    console.log('Express server listening on port ' + port);
});
