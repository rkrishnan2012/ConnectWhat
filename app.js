const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

app.get('/', function(req, res) {
  res.sendFile(__dirname + '/index.html')
});

io.on('connection', function(socket) {
  console.log('a user connected!');
});

http.listen(3000, function() {
  console.log('yolo on port 3000');
});
