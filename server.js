var http = require('http');
var bistro = require('./server/bistro');

var port = process.env.PORT || 8081;

var app = bistro('mongodb://127.0.0.1:27017/bistro');

http.createServer(app).listen(port, function() {
    console.log('Express server listening on port ' + port);
});
