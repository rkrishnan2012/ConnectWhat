const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const FB = require('fb');
const bodyParser = require('body-parser');
const db = require('./models/db');
const yields = require('express-yields');
const cookieParser = require('cookie-parser')

app.use(express.static('public'));
app.use(bodyParser.json());
app.use(cookieParser())

app.get('/', function(req, res) {
    res.sendFile(__dirname + '/public/index.html')
});

app.post('/api/v1/game', function*(req, res) {
    if (!req.body.fbtoken) {
        res.status(401).end();
    } else {
        yield db.connect();
        var fbUser = yield getFbUser(req.body.fbtoken);
        var player = yield makePlayer(fbUser.id, fbUser.name);
        var game = yield makeGame(player);
        console.log(game);
        res.json({
            status: "OK",
            gameUrl: "http://bit.ly/" + game.shortId,
            players: game.players
        });
    }
});

app.get('/join/:id', function*(req, res) {
    yield db.connect();
    if (!req.cookies.fbtoken) {
        res.redirect(401, '/?needsLogin=true&join=' + req.params.id);
    } else {
        var fbUser = yield getFbUser(req.cookies.fbtoken);
        if (!fbUser) {
            res.redirect(401, '/?needsLogin=true&join=' + req.params.id);
        } else {
            var player = yield makePlayer(fbUser.id, fbUser.name);
            var game = yield getGameByShortId(req.params.id);
            if (!game) {
                res.redirect(404, "/?invalidGameId=true");
            } else {
                game.players.push(player._id);
                game = yield(cb) => {
                    db.Games.update({
                    	_id: game._id
                    }, game, cb);
                }
                res.redirect("/?join=" + req.params.id);
            }
        }
    }
});

function* getFbUser(facebookToken) {
    var fb = FB.withAccessToken(facebookToken);
    return (yield(cb) => {
        fb.api("/me", function(res) {
            if (!res || res.error) {
                console.log(!res ? 'error occurred' : res.error);
                cb(null, null);
            } else {
                cb(null, res);
            }
        });
    });
}

function* makePlayer(facebookID, name) {
    var player = (yield(cb) => {
        db.Players.find({
            fbid: facebookID
        }, {
            limit: 1
        }).toArray(cb);
    })[0];
    if (!player || player.length == 0) {
        return yield(cb) => {
            db.Players.insert(new db.Player(facebookID, name), cb);
        }
    } else {
        return player;
    }
}

function* makeGame(player) {
    //	Try to find a game with you in it
    var game = (yield(cb) => {
        db.Games.find({
            players: {
                $in: [player._id]
            }
        }, {
            limit: 1
        }).toArray(cb);
    })[0];
    //	If game not found, create a new one.
    if (!game || game.length == 0) {
        var newGame = new db.Game(player._id, randomId());
        return yield(cb) => {
            db.Games.insert(newGame, cb);
        }
    } else {
        return game;
    }
}

function* getGameByShortId(shortId) {
    var game = (yield(cb) => {
        db.Games.find({
            shortId: shortId
        }, {
            limit: 1
        }).toArray(cb);
    })[0];
    return game;
}

function randomId() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }
    return s4() + s4();
}

io.on('connection', function(socket) {
    console.log('a user connected!');
});

http.listen(3000, function() {
    console.log('yolo on port 3000');
});