const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const FB = require('fb');
const bodyParser = require('body-parser');
const db = require('./models/db');
const yields = require('express-yields');
const cookieParser = require('cookie-parser');
const co = require('co');


app.use(express.static('public'));
app.use(bodyParser.json());
app.use(cookieParser())

app.get('/', function(req, res) {
    res.sendFile(__dirname + '/public/index.html')
});

app.get('/reset', function*(req, res) {
    yield db.connect();
    db.Games.remove({});
    res.redirect("/");
});

app.get('/api/v1/me', function*(req, res) {
    if (!req.cookies.fbtoken) {
        res.status(401).end("You are not authenticated.");
    } else {
        yield db.connect();
        var fbUser = yield getFbUser(req.cookies.fbtoken);
        if (!fbUser) {
            res.status(401).end("You are not authenticated.");
            return;
        }
        var player = yield makePlayer(fbUser.id, fbUser.name);
        res.json(player);
    }
});

app.get('/api/v1/games', function*(req, res) {
    if (!req.cookies.fbtoken) {
        res.status(401).end("You are not authenticated.");
    } else {
        yield db.connect();
        var fbUser = yield getFbUser(req.cookies.fbtoken);
        if (!fbUser) {
            res.status(401).end("You are not authenticated.");
            return;
        }
        var player = yield makePlayer(fbUser.id, fbUser.name);
        var games = yield getGames(player);
        res.json(games);
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
                var repeats = 0;
                for (var i = 0; i < game.players.length; i++) {
                    if (game.players[i] == player._id) {
                        repeats++;
                    }
                }
                if (repeats < 2) {
                    game.players.push(player._id);
                    game = yield(cb) => {
                        db.Games.update({
                            _id: game._id
                        }, game, cb);
                    }
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

function* getPlayerById(dbId) {
    return (yield(cb) => {
        db.Players.find({
            _id: dbId
        }, {
            limit: 1
        }).toArray(cb);
    })[0];
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
    var game = (yield getGames(player))[0];
    //	If game not found, create a new one.
    if (!game || game.length == 0) {
        var newGame = new db.Game(player._id, randomId());
        console.log("Created a new game with shortID " + newGame.shortId);
        game = (yield(cb) => {
            db.Games.insert(newGame, cb);
        }).ops[0];
    }
    game.status = "your turn";
    game.gameUrl = "http://localhost:3000/join/" + game.shortId;
    for (var j = 0; j < game.players.length; j++) {
        game.players[j] = yield getPlayerById(game.players[j]);
    }
    return game;
}

function* getGames(player) {
    var games = (yield(cb) => {
        var games = db.Games.find({
            players: {
                $in: [player._id]
            }
        }, {
            limit: 1
        }).toArray(cb);
        return games;
    });
    for (var i = 0; i < games.length; i++) {
        for (var j = 0; j < games[i].players.length; j++) {
            games[i].players[j] = yield getPlayerById(games[i].players[j]);
            games[i].status = "your turn";
            games[i].gameUrl = "http://localhost:3000/join/" + games[i].shortId;
        }
    }
    return games;
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
    socket.on('join', co.wrap(function*(data) {
        if (!data.fbtoken) {
            console.log("NO cookie!");
        } else {
            yield db.connect();
            var fbUser = yield getFbUser(data.fbtoken);
            var player = yield makePlayer(fbUser.id, fbUser.name);
            var game = yield makeGame(player);
            socket.emit('game', game);
        }
    }));

    socket.on('ready', co.wrap(function*(data) {
        if (!data.fbtoken) {
            console.log("NO cookie!");
        } else {
            yield db.connect();
            var fbUser = yield getFbUser(data.fbtoken);
            var player = yield makePlayer(fbUser.id, fbUser.name);
            var game = yield makeGame(player);
            if (game.scores.length < game.players.length) {
                game.scores.push(0);
                game = yield(cb) => {
                    db.Games.update({
                        _id: game._id
                    }, game, cb);
                }
            } else {
                socket.emit('start', game);
            }
        }
    }));
});

http.listen(3000, function() {
    console.log('yolo on port 3000');
});