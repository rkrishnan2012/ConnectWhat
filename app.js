const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);

const db = require('./models/db');

app.use(express.static('public'));

app.get('/', function(req, res) {
  res.sendFile(__dirname + '/index.html')
});

app.post('/game', function(req, res) {
	res.json({
		status: "OK",
		gameUrl: "http://bit.ly/blah"
	});
})

io.on('connection', function(socket) {
  console.log('a user connected!');
});

http.listen(3000, function() {
  console.log('yolo on port 3000');
});
