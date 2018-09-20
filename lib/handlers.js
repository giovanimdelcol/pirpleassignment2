//dependencies
var datalib = require('./data');
var helpers = require('./helpers');
var itens   = require('./../.data/itens/itens');
var config  = require('./config');
// initialize container
var handlers = {};

// Not-Found
handlers.notFound = function(data, callback){
    callback(404);
};

  
// Users
handlers.users = function(data, callback){
    var acceptableMethods = ['post', 'get', 'put', 'delete'];
    if(acceptableMethods.indexOf(data.method) > -1){
        handlers._users[data.method](data, callback);
    } else {
        callback(405);
    }
};

// Container for all the users methods
handlers._users  = {};

//Basic email validation
handlers._users.validateEmail = function(email) {
    var re = /\S+@\S+\.\S+/;
    return re.test(email);
}

// User POST method - create new users
// Required data: firstName, lastName, email, streetAddress, password
// optional data: none
handlers._users.post = function (data, callback) {
    //validate received info
    var firstName     = typeof(data.payload.firstName)     == 'string' && data.payload.firstName.trim().length > 0      ? data.payload.firstName.trim() : false;
    var lastName      = typeof(data.payload.lastName)      == 'string' && data.payload.lastName.trim().length > 0       ? data.payload.lastName.trim() : false;
    var email         = typeof(data.payload.email)         == 'string' && data.payload.email.trim().length > 0          ? data.payload.email.trim() : false;
    var streetAddress = typeof(data.payload.streetAddress) == 'string' &&  data.payload.streetAddress.trim().length > 0 ? data.payload.streetAddress.trim() : false;
    var password      = typeof(data.payload.password)      == 'string' && data.payload.password.trim().length > 0       ? data.payload.password.trim() : false;

    if (!(firstName && lastName && email && streetAddress && password)){
        callback(400,{'Error' : 'Missing required fields'});
        return;
    };

    if (!handlers._users.validateEmail(email)){
        callback(400,{'Error' : 'Invalid email'});
        return;
    };
    
    datalib.read('users', email, function(err, data){
        if (!err){
            //if there isn't an error the user was read from the filesystem
            callback(400, {'Error' : 'A user with that email already exists'});
            return
        };

        //if there's and error (user doesn't exist), create the user
        // Hash the password
        var hashedPassword = helpers.hash(password);

        // Create the user object
        if(hashedPassword){
            var userObject = {
                'firstName'      : firstName,
                'lastName'       : lastName,
                'email'          : email,
                'hashedPassword' : hashedPassword,
                'streetAddress'  : streetAddress
            }
        } else {
            callback(500,{'Error' : 'Could not hash the user\'s password.'});
            return;
        };

        datalib.create('users', email, userObject, function(err){
            if(!err){
              callback(200);
            } else {
              callback(500, {'Error' : 'Could not create the new user'} );
            }
        });

    });

};

// User GET method - return user info from user email
// Required data: email
// optional data: none
handlers._users.get = function (data, callback){
    var email = typeof(data.queryStringObject.email) == 'string' && data.queryStringObject.email.trim().length > 0 ? data.queryStringObject.email.trim() : false;
    if (!email){
        callback(400,{'Error' : 'Missing required field'});
        return;
    }

    // Get token from headers
    var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
    // Verify that the given token is valid for the email
    handlers._tokens.verifyToken(token, email, function(tokenIsValid) {
        if(tokenIsValid){
            // Lookup the user
            datalib.read('users', email, function(err, data){
            if(!err && data){
                // Remove the hashed password from the user user object before returning it to the requester
                delete data.hashedPassword;
                callback(200, data);
            } else {
                callback(404);
            }
            });
        } else {
            callback(403,{"Error" : "Missing required token in header or token is invalid."})
        }
    });

};

// User DELETE method - erase user
// Required data: email
// optional data: none
handlers._users.delete = function (data, callback){
    var email = typeof(data.payload.email) == 'string' && data.payload.email.trim().length > 0 ? data.payload.email.trim() : false;
    if (!email){
        callback(400, {'Error' : 'Missing required field'});
        return;
    };

    // Get token from headers
    var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
    // Verify that the given token is valid for the email 
    handlers._tokens.verifyToken(token, email, function(tokenIsValid){ 
        if(tokenIsValid){
            datalib.delete('users', email, function(err, userData){
                if (err){
                    callback(500, {'Error' : 'Could not delete specified user.'});
                    return;
                }

                callback(200, {'Deleted User with email' : userData.email});

            });

        } else {
            callback(403,{"Error" : "Missing required token in header or token is invalid."})
        }
    });   

};

// User PUT method - update user info
// Required data: email
// Optional data: firstName, lastName, streetAddress, password (at least one)
handlers._users.put = function (data, callback){
    //validate received info
    var email         = typeof(data.payload.email)         == 'string' && data.payload.email.trim().length > 0          ? data.payload.email.trim() : false;
    if (!email){
        callback(400, {'Error' : 'Missing required field'});
        return;
    };

    //validate opt data
    var firstName     = typeof(data.payload.firstName)     == 'string' && data.payload.firstName.trim().length > 0      ? data.payload.firstName.trim() : false;
    var lastName      = typeof(data.payload.lastName)      == 'string' && data.payload.lastName.trim().length > 0       ? data.payload.lastName.trim() : false;
    var streetAddress = typeof(data.payload.streetAddress) == 'string' &&  data.payload.streetAddress.trim().length > 0 ? data.payload.streetAddress.trim() : false;
    var password      = typeof(data.payload.password)      == 'string' && data.payload.password.trim().length > 0       ? data.payload.password.trim() : false;

    if(!(firstName || lastName || password || streetAddress)){
        callback(400,{'Error' : 'Missing fields to update.'});
        return;   
    }

    // Get token from headers
    var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
    // Verify that the given token is valid for the email
    handlers._tokens.verifyToken(token, email, function(tokenIsValid){ 
        if(tokenIsValid){
            datalib.read('users', email, function(err, userData){
                if(err || !userData){
                    callback(400, {'Error' : 'Specified user does not exist.'});
                    return;
                }

                if (firstName){
                    userData.firstName = firstName;
                };
                if (lastName){
                    userData.lastName = lastName;
                };
                if (streetAddress){
                    userData.streetAddress = streetAddress;
                };
                if (password){
                    userData.hashedPassword = helpers.hash(password);
                };

                //store updated user
                datalib.update('users', email, userData, function(err){
                    if (err){
                        callback(500, {'Error' : 'Could not update user.'})
                    } else {
                        callback(200);
                    }
                });

            });

        } else {
            callback(403,{"Error" : "Missing required token in header or token is invalid."})
        }
    });   

};


// Tokens
handlers.tokens = function(data, callback){
    var acceptableMethods = ['post', 'get', 'put', 'delete'];
    if(acceptableMethods.indexOf(data.method) > -1){
        handlers._tokens[data.method](data,callback);
    } else {
        callback(405);
    }
};

// Container for all the tokens methods
handlers._tokens  = {};

// Tokens - post
// Required data: email, password
// Optional data: none
handlers._tokens.post = function(data,callback){
    var email = typeof(data.payload.email) == 'string' && data.payload.email.trim().length > 0 ? data.payload.email.trim() : false;
    var password = typeof(data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;
    if(email && password){
        // Lookup the user who matches that email
        datalib.read('users', email, function(err, userData){
            if(!err && userData){
                // Hash the sent password, and compare it to the password stored in the user object
                var hashedPassword = helpers.hash(password);
                if(hashedPassword == userData.hashedPassword){
                    // If valid, create a new token with a random name. Set an expiration date 1 hour in the future.
                    var tokenId = helpers.createRandomString(20);
                    var expires = Date.now() + 1000 * 60 * 60;
                    var tokenObject = {
                        'email' : email,
                        'id' : tokenId,
                        'expires' : expires
                    };

                    // Store the token
                    datalib.create('tokens', tokenId, tokenObject, function(err){
                        if(!err){
                            callback(200, tokenObject);
                        } else {
                            callback(500, {'Error' : 'Could not create the new token'});
                        }
                    });
                } else {
                    callback(400, {'Error' : 'Password did not match the specified user\'s stored password'});
                }
            } else {
                callback(400, {'Error' : 'Could not find the specified user.'});
            }
        });
    } else {
        callback(400,{'Error' : 'Missing required field(s).'})
    }
};

// Tokens - get
// Required data: id
// Optional data: none
handlers._tokens.get = function(data, callback){
    // Check that id is valid
    var id = typeof(data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
    if(id){
        // Lookup the token
        datalib.read('tokens', id, function(err, tokenData){
            if(!err && tokenData){
                callback(200, tokenData);
            } else {
                callback(404);
            }
        });
    } else {
        callback(400, {'Error' : 'Missing required field, or field invalid'})
    }
};

// Tokens - put
// Required data: id, extend
// Optional data: none
handlers._tokens.put = function(data,callback){
    var id = typeof(data.payload.id) == 'string' && data.payload.id.trim().length == 20 ? data.payload.id.trim() : false;
    var extend = typeof(data.payload.extend) == 'boolean' && data.payload.extend == true ? true : false;
    if(id && extend){
        // Lookup the existing token
        datalib.read('tokens', id, function(err,tokenData){
            if(!err && tokenData){
                // Check to make sure the token isn't already expired
                if(tokenData.expires > Date.now()){
                    // Set the expiration an hour from now
                    tokenData.expires = Date.now() + 1000 * 60 * 60;
                    // Store the new updates
                    datalib.update('tokens', id, tokenData, function(err){
                        if(!err){
                            callback(200);
                        } else {
                            callback(500,{'Error' : 'Could not update the token\'s expiration.'});
                        }
                    });
                } else {
                    callback(400,{"Error" : "The token has already expired, and cannot be extended."});
                }
            } else {
                callback(400,{'Error' : 'Specified user does not exist.'});
            }
        });
    } else {
        callback(400,{"Error": "Missing required field(s) or field(s) are invalid."});
    }
};


// Tokens - delete
// Required data: id
// Optional data: none
handlers._tokens.delete = function(data,callback){
    // Check that id is valid
    var id = typeof(data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
    if(id){
        // Lookup the token
        datalib.read('tokens', id, function(err, tokenData){
            if(!err && tokenData){
                // Delete the token
                datalib.delete('tokens', id, function(err){
                if(!err){
                    callback(200);
                } else {
                    callback(500, {'Error' : 'Could not delete the specified token'});
                }
                });
            } else {
                callback(400, {'Error' : 'Could not find the specified token.'});
            }
        });
    } else {
        callback(400,{'Error' : 'Missing required field'})
    }
};

// Verify if a given token id is currently valid for a given user
handlers._tokens.verifyToken = function(id, email, callback){
    // Lookup the token
    datalib.read('tokens', id, function(err, tokenData){
        if(!err && tokenData){
            // Check that the token is for the given user and has not expired
            if(tokenData.email == email && tokenData.expires > Date.now()){
                callback(true);
            } else {
                callback(false);
            };
        } else {
            callback(false);
        }
    });
};

//Itens
handlers.itens = function(data, callback){
    var acceptableMethods = ['get'];
    if(acceptableMethods.indexOf(data.method) > -1){
        handlers._itens[data.method](data, callback);
    } else {
        callback(405);
    }
};

// Container for all the itens methods
handlers._itens  = {};

// Item GET method - return list of available itens
// Required data: email
// optional data: none
handlers._itens.get = function (data, callback){
    var email = typeof(data.queryStringObject.email) == 'string' && data.queryStringObject.email.trim().length > 0 ? data.queryStringObject.email.trim() : false;
    if (!email){
        callback(400,{'Error' : 'Missing required field'});
        return;
    }

    // Get token from headers
    var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
    // Verify that the given token is valid for the email
    handlers._tokens.verifyToken(token, email, function(tokenIsValid) {
        if(tokenIsValid){
            // Lookup the itens
            callback(200, itens.available);
        } else {
            callback(403,{"Error" : "Missing required token in header or token is invalid."})
        }
    });

};

//Carts
handlers.carts = function(data, callback){
    var acceptableMethods = ['put', 'post', 'get'];
    if(acceptableMethods.indexOf(data.method) > -1){
        handlers._carts[data.method](data, callback);
    } else {
        callback(405);
    }
};

// Container for all the carts methods
handlers._carts  = {};

// Item GET method - return current cart
// Required data: email - as this relation will be 1-1 the primary identifier for the cart will be the user email as well
// optional data: none
handlers._carts.get = function (data, callback){
    var email = typeof(data.queryStringObject.email) == 'string' && data.queryStringObject.email.trim().length > 0 ? data.queryStringObject.email.trim() : false;
    if (!email){
        callback(400,{'Error' : 'Missing required field'});
        return;
    }

    // Get token from headers
    var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
    // Verify that the given token is valid for the email
    handlers._tokens.verifyToken(token, email, function(tokenIsValid) {
        if(tokenIsValid){
            // Lookup the cart            
            datalib.read('carts', email, function(err, cartData){
                if(!err && cartData){
                    callback(200, cartData);
                } else {
                    callback(404);
                };
            });
        } else {
            callback(403, {"Error" : "Missing required token in header or token is invalid."});
        }
    });

};

// User PUT method - update cart info
// Required data: email, itens (at least one item)
handlers._carts.put = function (data, callback){
    //validate received info
    var email         = typeof(data.payload.email)         == 'string' && data.payload.email.trim().length > 0          ? data.payload.email.trim() : false;
    if (!email){
        callback(400, {'Error' : 'Missing required field'});
        return;
    };

    var receivedItens      = data.payload.itens instanceof Array ? data.payload.itens : false;
    if (!receivedItens){
        callback(400, {'Error': 'Itens received are not an Array'});
        return;
    }

    receivedItens = data.payload.itens.length > 0 ? data.payload.itens : false;
    if (!receivedItens){
        callback(400, {'Error': 'No item received'});
        return;
    }    

    var validItens = true;
    for (i = 0; i < receivedItens.length; i++) {
        item = receivedItens[i];
        var productName = typeof(item.productName)     == 'string' && item.productName.trim().length > 0      ? item.productName.trim() : false;
        var productQt   = typeof(item.productQt)       == 'number' && item.productQt > 0      ? item.productQt : false;
        if (!(productName && productQt)){
            console.log('product name or quantity are invalid', item.productName, item.productQt);
            validItens = false;
            break;
        }
        
        var itemRecord  = itens.available.find(obj => obj.productName === productName);

        //if the item is not found, return the error
        if (!itemRecord){
            console.log('product not found', productName);
            validItens = false;
            break;
        }

        //set the price obtained from the data to the item before insert it to the cart
        item.Price      = itemRecord.Price;

    };

    if (!validItens){
        callback(400, {'Error': 'Invalid(s) Item(ns) received'});
        return;
    };
    
    // Get token from headers
    var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
    // Verify that the given token is valid for the email
    handlers._tokens.verifyToken(token, email, function(tokenIsValid){ 
        if(tokenIsValid){

            datalib.read('users', email, function(err, userData){
                if(err || !userData){
                    callback(400, {'Error' : 'Specified user does not exist.'});
                    return;
                }
            
                //check if there's an open cart
                datalib.read('carts', email, function(err, cartData){
                    if(err || !cartData){
                        callback(400, {'Error' : 'No Cart is currently opened for the user.'});
                        return;
                    }
                    
                    //update cart's itens with the received ones
                    cartData.itens = receivedItens;

                    //store updated cart
                    datalib.update('carts', email, cartData, function(err){
                        if (err){
                            callback(500, {'Error' : 'Could not update cart.'})
                        } else {
                            callback(200);
                        }
                    });
                });

            });

        } else {
            callback(403,{"Error" : "Missing required token in header or token is invalid."})
        }
    });   

};


// Carts POST method - create new cart
// Required data: email, itens (at least one item)
// optional data: none
handlers._carts.post = function (data, callback) {
    //validate received info
    var email         = typeof(data.payload.email)         == 'string' && data.payload.email.trim().length > 0          ? data.payload.email.trim() : false;
    if (!email){
        callback(400, {'Error' : 'Missing required field'});
        return;
    };

    var receivedItens      = data.payload.itens instanceof Array ? data.payload.itens : false;
    if (!receivedItens){
        callback(400, {'Error': 'Itens received are not an Array'});
        return;
    }

    receivedItens = data.payload.itens.length > 0 ? data.payload.itens : false;
    if (!receivedItens){
        callback(400, {'Error': 'No item received'});
        return;
    }    

    var validItens = true;
    for (i = 0; i < receivedItens.length; i++) {
        item = receivedItens[i];
        var productName = typeof(item.productName)     == 'string' && item.productName.trim().length > 0      ? item.productName.trim() : false;
        var productQt   = typeof(item.productQt)       == 'number' && item.productQt > 0      ? item.productQt : false;
        if (!(productName && productQt)){
            console.log('product name or quantity are invalid', item.productName, item.productQt);
            validItens = false;
            break;
        }
        
        var itemRecord  = itens.available.find(obj => obj.productName === productName);

        //if the item is not found, return the error
        if (!itemRecord){
            console.log('product not found', productName);
            validItens = false;
            break;
        }

        //set the price obtained from the data to the item before insert it to the cart
        item.Price      = itemRecord.Price;

    };

    if (!validItens){
        callback(400, {'Error': 'Invalid(s) Item(ns) received'});
        return;
    };
    
    // Get token from headers
    var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
    // Verify that the given token is valid for the email
    handlers._tokens.verifyToken(token, email, function(tokenIsValid){ 
        if(tokenIsValid){

            datalib.read('users', email, function(err, userData){
                if(err || !userData){
                    callback(400, {'Error' : 'Specified user does not exist.'});
                    return;
                }
            
                //check if there's an open cart
                datalib.read('carts', email, function(err, cartData){
                    
                    if(cartData){
                        callback(400, {'Error' : 'A cart is already opened for the user.'});
                        return;
                    };
                    
                    cartData = {};
                    //set cart's itens
                    cartData.itens = receivedItens;

                    //store updated cart
                    datalib.create('carts', email, cartData, function(err){
                        if (err){
                            callback(500, {'Error' : 'Could not create cart.'})
                        } else {
                            callback(200);
                        }
                    });
                });

            });

        } else {
            callback(403,{"Error" : "Missing required token in header or token is invalid."})
        }
    });  
        

};

//Order
handlers.order = function(data, callback){
    var acceptableMethods = ['post'];
    if(acceptableMethods.indexOf(data.method) > -1){
        handlers._order[data.method](data, callback);
    } else {
        callback(405);
    }
};

// Container for all the order methods
handlers._order  = {};

// Order POST method - turn current cart into an order and close the cart if the payment was accepted
// Required data: email
// optional data: none
handlers._order.post = function (data, callback) {
    //validate received info
    var email         = typeof(data.payload.email) == 'string' && data.payload.email.trim().length > 0          ? data.payload.email.trim() : false;
    if (!email){
        callback(400, {'Error' : 'Missing required field'});
        return;
    };
    
    // Get token from headers
    var token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
    // Verify that the given token is valid for the email
    handlers._tokens.verifyToken(token, email, function(tokenIsValid){ 
        if(tokenIsValid){

            datalib.read('users', email, function(err, userData){
                if(err || !userData){
                    callback(400, {'Error' : 'Specified user does not exist.'});
                    return;
                }
            
                //check if there's an open cart
                datalib.read('carts', email, function(err, cartData){
                    
                    if(err || !cartData){
                        callback(400, {'Error' : 'No cart is currently opened for the user'});
                        return;
                    };

                    //store the order
                    var ordersList = [];
                    datalib.create('orders', email, ordersList, function(err){                        
                        
                        datalib.read('orders', email, function(err, ordersData){
                            if (!err && ordersData) {
                                ordersList = ordersData;
                            }
                                                        
                            var amount = 0 ;
                            cartData.itens.forEach((item)=>{
                                amount += item.Price * item.productQt;
                            })
                            ordersList.push(cartData);

                            datalib.update('orders', email, ordersList, function(err){
                                if (err){
                                    callback(500, {'Alert' : 'Could not update orders list.'})
                                } else {
                                    //erase cart
                                    datalib.delete('carts', email, function(err){
                                        if (err){
                                            callback(500, {'Error' : 'Could not delete cart.'});
                                            return
                                        } else {                             

                                            //charge via stripe
                                            helpers.createStripeCharge(amount, config.stripe.token, function(err){
                                                if (!err) {                                            
                                                    callback(200);
                                                    helpers.sendMailgun(JSON.stringify(cartData), 'Order description', email, function(err){
                                                        if (err) {
                                                            console.log('Error sending mailgun order email. ', err);
                                                        }
                                                    })
                                                } else {                                            
                                                    callback(500, {'Error' : 'Could not charge credit card.', err})
                                                }
                                            
                                            });
                                        }
                                    });   
                                }
                            })
                        });

                    });


                });

            });

        } else {
            callback(403,{"Error" : "Missing required token in header or token is invalid."})
        }
    });  
        

};

// Export the handlers
module.exports = handlers;
