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
const request = require("request");
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
        console.log("Needs login!!");
        res.redirect(302, '/?needsLogin=true&joinId=' + req.params.id);
    } else {
        var fbUser = yield getFbUser(req.cookies.fbtoken);
        if (!fbUser) {
            console.log("Needs login1!!");
            res.redirect(401, '/?needsLogin=true&joinId=' + req.params.id);
        } else {
            var player = yield makePlayer(fbUser.id, fbUser.name);
            var game = yield getGameByShortId(req.params.id);
            if (!game) {
                res.redirect(404, "/?invalidGameId=true");
            } else {
                var repeats = 0;
                for (var i = 0; i < game.players.length; i++) {
                    if (game.players[i] == player._id) {
                        console.log("REPEAT!");
                        repeats++;
                    }
                }
                if (repeats == 0) {
                    game.players.push(player._id.toString());
                    yield(cb) => {
                        db.Games.update({
                            _id: game._id
                        }, game, cb);
                    }
                }
                res.redirect("/");
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
    //  Try to find a game with you in it
    var game = (yield getGames(player))[0];
    //  If game not found, create a new one.
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
            console.log("Player joined " + game.shortId);
            socket.join(game.shortId);
            io.to(game.shortId).emit('game', game);
        }
    }));
    socket.on('ready', co.wrap(function*(data) {
        if (!data.fbtoken) {
            console.log("NO cookie!");
        } else {
            yield db.connect();
            var fbUser = yield getFbUser(data.fbtoken);
            var player = yield makePlayer(fbUser.id, fbUser.name);
            var game = yield getGameByShortId(data.shortId);
            if (game.scores.length < game.players.length) {
                game.scores.push(0);
                yield(cb) => {
                    db.Games.update({
                        _id: game._id
                    }, game, cb);
                }
            }
            if (game.scores.length == game.players.length) {
                request.post('http://localhost:1250/api/topics', {}, function(error, response, body) {
                    var body = JSON.parse(response.body);
                    var words = [];
                    for (var i = 0; i < 12; i++) {
                        words.push(body[i]);
                    }
                    io.to(game.shortId).emit('pickWord', words);
                });
            }
        }
    }));
    socket.on("doneWord1", co.wrap(function* data(data) {
        var fbUser = yield getFbUser(data.fbtoken);
        var player = yield makePlayer(fbUser.id, fbUser.name);
        var game = yield getGameByShortId(data.shortId);
        game.words = game.words || [];
        for (var i = 0; i < game.players.length; i++) {
            if (game.players[i] != player._id) {
                game.words[i] = [data.word];
                yield(cb) => {
                    db.Games.update({
                        _id: game._id
                    }, game, cb);
                }
                request.post('http://localhost:1250/api/topics', {
                    form: {
                        startWord: data.word
                    }
                }, function(err, resp, body) {
                    if (body) {
                        var body = JSON.parse(resp.body);
                        var words = [];
                        for (var i = 0; i < 12; i++) {
                            words.push(body.endNodes[i]);
                        }
                        console.log("Picking words 2!");
                        socket.emit('pickWord2', words);
                    }

                });
                break;
            }
        }
    }));
    socket.on("doneWord2", co.wrap(function* data(data) {
        var fbUser = yield getFbUser(data.fbtoken);
        var player = yield makePlayer(fbUser.id, fbUser.name);
        var game = yield getGameByShortId(data.shortId);
        game.words = game.words || [];
        for (var i = 0; i < game.players.length; i++) {
            if (game.players[i] != player._id) {
                console.log("Player " + i + "'s words are chosen.");
                game.words[i].push(data.word);
                var allChosen = true;
                for (var k = 0; k < game.words.length; k++) {
                    if (game.words[k].length != 2) allChosen = false;
                }
                if(allChosen) {
                    game.status = "started";
                }
                yield(cb) => {
                    db.Games.update({
                        _id: game._id
                    }, game, cb);
                }
                if (allChosen) {
                    for (var j = 0; j < games[i].players.length; j++) {
                        game.players[j] = yield getPlayerById(game.players[j]);
                        game.status = "started";
                        game.gameUrl = "http://localhost:3000/join/" + game.shortId;
                    }
                    io.to(game.shortId).emit("wordsChosen", game);
                }
                break;
            }
        }
    }));
});
http.listen(3000, function() {
    console.log('yolo on port 3000');
});