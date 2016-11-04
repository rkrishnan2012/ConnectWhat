var MongoClient = require('mongodb').MongoClient;
var wait = require("wait.for-es6");

var PlayerModel = require("../models/Player");

var dbURI = 'mongodb://localhost:27017';

function* connect(){
  if(!module.exports.db){
    module.exports.db = yield [MongoClient.connect,dbURI];  

    module.exports.Players = module.exports.db.collection(PlayerModel.name);
    module.exports.Player = PlayerModel.constructor;

    console.log("MongoClient connected to " + dbURI);
  }
}

function* disconnect(){
  module.exports.Players = null;

  module.exports.db = yield [gracefulShutdown, 0];  
}

// Close current mongoose connection then output to console
function gracefulShutdown(msg, callback) {
  module.exports.db.close(()=>{
    console.log('Mongoose disconnected through ' + msg);
    callback();
  });
};

/*
 This following three method is use to listen for three scenario listed below.
 It will gracefully closes the Mongoose connection before it actually ends.
*/
// Listen for SIGUSR2, which is what nodemon uses
// once() is attached for one time listener vs on()
process.once('SIGUSR2', function() {
  gracefulShutdown('nodemon restart', function() {
    process.kill(process.pid, 'SIGUSR2');
  });
});

// Listen for SIGINT emitted on application termination
process.on('SIGINT', function() {
  gracefulShutdown('app termination', function() {
    process.exit(0);
  });
});

// Listen for SIGTERM emitted
process.on('SIGTERM', function() {
  gracefulShutdown('Heroku app shutdown', function() {
    process.exit(0);
  });
});

module.exports = {
  connect: connect,
  disconnect: disconnect
};