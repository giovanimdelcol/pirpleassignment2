//requiring the server dependency
var server = require ('./lib/server');

//declare the main obj of the application
var app = {};

//configure the initial behavior of our app
app.init = function(){
    server.init();
};

//initiate the app
app.init();

// Export the app
module.exports = app;