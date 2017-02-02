const express = require('express');
const app = express();
const http = require('http').Server(app);
const FB = require('fb');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const Promise = require('bluebird-co');
const request = require("request");

const db = require('./models/db');
const DBUtils = require('./DBUtils.js');
const APIRoutes = require("./APIRoutes");

require("./SocketRoutes")(http);

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());

app.get('/', APIRoutes.GetRoot);

app.get('/new', APIRoutes.GetNew);

app.post('/api/v1/offlinePlayer', APIRoutes.PostOfflinePlayer);

app.get('/api/v1/reset', APIRoutes.GetReset);

app.get('/api/v1/me', APIRoutes.GetMe);

app.get('/api/v1/games', APIRoutes.GetGames);

app.get('/join/:id', APIRoutes.GetJoinGameId);

http.listen(9000, function() {
    console.log('yolo on port 80');
});
