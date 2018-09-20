//dependencies
var http  = require('http');
var https = require('https');
var fs    = require('fs');
var url   = require('url');
var path  = require('path');
var StringDecoder = require('string_decoder').StringDecoder;
var handlers = require('./handlers');
var util  = require('util');
var config = require('./config');
var debug = util.debuglog('server');
var helpers = require('./helpers');

//instantiate the server obj
var server = {};

// Define the request router
server.router = {
    'users' : handlers.users,
    'tokens' : handlers.tokens,
    'carts' : handlers.carts,
    'itens' : handlers.itens,
    'order' : handlers.order
};
 

//instantiate http and https server properties
server.httpServer = http.createServer(function(req, res) {
    server.unifiedServer(req, res);
});
server.httpsServerOptions = {
   'key': fs.readFileSync(path.join(__dirname,'/../https/key.pem')),
   'cert': fs.readFileSync(path.join(__dirname,'/../https/cert.pem'))
 };
server.httpsServer = https.createServer(server.httpsServerOptions, function(req, res) {
    server.unifiedServer(req, res);
});

//shared logic between http and https servers
server.unifiedServer = function (req, res) {

    //parse url into object
    var parsedUrl = url.parse(req.url, true);
    
    //obtain the required path
    var trimmedPath = parsedUrl.pathname.replace(/^\/+|\/+$/g, '');

    // Get the query string as an object
    var queryStringObject = parsedUrl.query;

    //get the method
    var method = req.method.toLowerCase();

    //objectify the headers
    var headers = req.headers;

    //Get the payload, if it exists
    var decoder = new StringDecoder('utf-8');
    //initialize the buffer that will receive the data
    var buffer = '';
    //bind 'data' req event to fill the buffer
    req.on('data', function (data) {
        //append the received data to the buffer
        buffer += decoder.write(data);
    });

    //bind the 'end' event to the function passing the request to the proper handler
    req.on('end', function (){
        //write any remaining bytes to our buffed
        buffer += decoder.end();

        //select the handler from the route
        var chosenHandler = typeof(server.router[trimmedPath]) !== 'undefined' ? server.router[trimmedPath] : handlers.notFound;

        //build data object that the handler shall receive
        var data = {
            'trimmedPath' : trimmedPath,
            'queryStringObject' : queryStringObject,
            'method' : method,
            'headers' : headers,
            'payload' : helpers.parseJsonToObject(buffer)
        };

        //send the data to the proper handler, giving it a callback that will trigger the response
        chosenHandler(data, function(statusCode, payload){
            
            //use the status returned by the handler or default to 200
            statusCode = typeof(statusCode) == 'number' ? statusCode : 200;            
            //use the payload returned by the handler or default to empty object
            payload = typeof(payload) == 'object' ? payload : {};

            //stringfy the payload
            var payloadString = JSON.stringify(payload);

            //return the http response
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(statusCode);
            res.end(payloadString);

            // If the response is 200, print green, otherwise print red
            if(statusCode == 200){
                debug('\x1b[32m%s\x1b[0m', method.toUpperCase() + ' /' + trimmedPath + ' ' + statusCode);
            } else {
                debug('\x1b[31m%s\x1b[0m', method.toUpperCase() + ' /' + trimmedPath + ' ' + statusCode);
            }

        });

    });

};

// Init script
server.init = function(){
    // Start the HTTP server
    server.httpServer.listen(config.httpPort, function(){
        console.log('\x1b[36m%s\x1b[0m','The HTTP server is running on port ' + config.httpPort);
    });

    // Start the HTTPS server
    server.httpsServer.listen(config.httpsPort, function(){
        console.log('\x1b[35m%s\x1b[0m','The HTTPS server is running on port ' + config.httpsPort);
    });
};


// Export the module
module.exports = server;
