const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const FB = require('fb');
const bodyParser = require('body-parser');
const db = require('./models/db');
const cookieParser = require('cookie-parser');
const Promise = require('bluebird-co');
const request = require("request");
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(cookieParser())
app.get('/', function(req, res) {
    res.sendFile(__dirname + '/public/index.html')
});
app.get('/reset', Promise.coroutine(function*(req, res) {
    yield db.connect();
    db.Games.remove({});
    db.Players.remove({});
    res.redirect("/");
}));
app.get('/api/v1/me', Promise.coroutine(function*(req, res) {
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
}));
app.get('/api/v1/games', Promise.coroutine(function*(req, res) {
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
        for (var i = 0; i < games.length; i++) {
            games[i] = yield sanitizeForPlayer(games[i]);
        }
        res.json(games);
    }
}));
app.get('/join/:id', Promise.coroutine(function*(req, res) {
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
            console.log(fbUser.name + " trying to join " + req.params.id);
            var player = yield makePlayer(fbUser.id, fbUser.name);
            var game = yield getGameByShortId(req.params.id);
            if (!game) {
                res.redirect(404, "/?invalidGameId=true");
            } else {
                var repeats = 0;
                for (var i = 0; i < game.players.length; i++) {
                    if (game.players[i].toString() == player._id.toString()) {
                        repeats++;
                    }
                }
                if (repeats == 0) {
                    game.players.push(player._id);
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
}));

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
        yield(cb) => {
            db.Players.insert(new db.Player(facebookID, name), cb);
        }
        return (yield makePlayer(facebookID, name));
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
        console.log(player.name + " created a new game with shortID " + newGame.shortId);
        (yield(cb) => {
            db.Games.insert(newGame, cb);
        });
        return (yield makeGame(player));
    }
    game.gameUrl = "http://localhost:3000/join/" + game.shortId;
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

function* sanitizeForPlayer(game) {
    for (var j = 0; j < game.words.length; j++) {
        game.words[j][0] = {
            word: game.words[j][0],
            longSummary: game._lookups[game.words[j][0]].longSummary
        };
        game.words[j][1] = {
            word: game.words[j][1],
            longSummary: game._lookups[game.words[j][1]].longSummary
        };
    }
    for (var j = 0; j < game._paths.length; j++) {
        game._paths[j] = game._paths[j].slice(0, game._turn[j] + 1);
    }
    delete game._lookups;
    for (var j = 0; j < game.players.length; j++) {
        game.players[j] = yield getPlayerById(game.players[j]);
    }

    return game;
}

io.on('connection', function(socket) {
    socket.on('join', Promise.coroutine(function*(data) {
        if (!data.fbtoken) {
            console.log("NO cookie!");
        } else {
            yield db.connect();
            var fbUser = yield getFbUser(data.fbtoken);
            var player = yield makePlayer(fbUser.id, fbUser.name);
            var game = yield makeGame(player);
            console.log(fbUser.name + " joined websocket for " + game.shortId);
            socket.join(game.shortId);
            game = yield sanitizeForPlayer(game);
            if (game.status == "starting" || game.status == "started") {
                socket.emit("wordsChosen", game);
                socket.emit('turn', game);
            } else if(game.status == "completed") {
                socket.emit("finished", game);
            } else {
                io.to(game.shortId).emit('game', game);
            }
        }
    }));
    socket.on('ready', Promise.coroutine(function*(data) {
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
    socket.on("doneWord1", Promise.coroutine(function* data(data) {
        var fbUser = yield getFbUser(data.fbtoken);
        var player = yield makePlayer(fbUser.id, fbUser.name);
        var game = yield getGameByShortId(data.shortId);
        game.words = game.words || [];
        for (var i = 0; i < game.players.length; i++) {
            if (game.players[i].toString() != player._id.toString()) {
                game.words[i] = [data.word];
                yield((cb) => {
                    db.Games.update({
                        _id: game._id
                    }, game, cb);
                });
                console.log(fbUser.name + " has chosen opponent's first word as " + data.word);
                request.post('http://localhost:1250/api/topics', {
                    form: {
                        startWord: data.word
                    }
                }, Promise.coroutine(function*(err, resp, body) {
                    console.log("Bumblebee returned subtopics of " + data.word);
                    if (err) console.log(err);
                    if (body) {
                        game = yield getGameByShortId(data.shortId);
                        game._paths = game._paths || {};
                        var body = JSON.parse(resp.body);
                        var words = [];
                        for (var i = 0; i < 12; i++) {
                            words.push(body.endNodes[i]);
                            game._paths[body.endNodes[i].title] = body.paths[i];
                        }
                        yield((cb) => {
                            db.Games.update({
                                _id: game._id
                            }, game, cb);
                        });
                        socket.emit('pickWord2', words);
                    } else {
                        console.log("Body returned from bumblebee was null!");
                        console.log(resp);
                    }
                }));
                break;
            }
        }
    }));
    socket.on("doneWord2", Promise.coroutine(function* data(data) {
        var fbUser = yield getFbUser(data.fbtoken);
        console.log(fbUser.name + "'s second word picked.");
        var player = yield makePlayer(fbUser.id, fbUser.name);
        var game = yield getGameByShortId(data.shortId);
        game.words = game.words || [];
        for (var i = 0; i < game.players.length; i++) {
            if (game.players[i].toString() != player._id.toString()) {
                game.words[i][1] = data.word;
                var allChosen = game.words.length == game.players.length;
                for (var k = 0; k < game.words.length; k++) {
                    if (!game.words[k] || game.words[k].length != 2) allChosen = false;
                }
                if (allChosen) {
                    game.status = "started";
                    game._turn = [1, 1];
                    game._paths = [game._paths[game.words[0][1]], game._paths[game.words[1][1]]];
                    console.log("All players have chosen their words for " + game.shortId);
                    //  Make a list of words to lookup definitions for
                    lookups = game.words.reduce(function(a, b) {
                        return a.concat(b);
                    }, []);
                    yield(cb) => {
                        db.Games.update({
                            _id: game._id
                        }, game, cb);
                    }
                    request.post('http://localhost:1250/api/lookup', {
                        form: {
                            terms: JSON.stringify(lookups)
                        }
                    }, Promise.coroutine(function*(err, resp, body) {
                        if (body) {
                            var body = JSON.parse(resp.body).result;
                            //  Re-download game from db in case it has changed
                            var game = yield getGameByShortId(data.shortId);
                            game._lookups = body;
                            yield(cb) => {
                                db.Games.update({
                                    _id: game._id
                                }, game, cb);
                            }
                            game = yield sanitizeForPlayer(game);
                            io.to(game.shortId).emit("wordsChosen", game);
                            setTimeout(function() {
                                io.to(game.shortId).emit("turn", game);
                            }, 1000);
                        } else {
                            console.log("Body returned from bumblebee was null!");
                            console.log(resp);
                        }
                    }));
                } else {
                    yield(cb) => {
                        db.Games.update({
                            _id: game._id
                        }, game, cb);
                    }
                    console.log(fbUser.name + " has chosen opponent's second word as " + data.word);
                }
                break;
            }
        }
    }));
    socket.on("move", Promise.coroutine(function* data(data) {
        var fbUser = yield getFbUser(data.fbtoken);
        var player = yield makePlayer(fbUser.id, fbUser.name);
        var game = yield getGameByShortId(data.shortId);

        var idx;
        for (var i = 0; i < game.players.length; i++) {
            if (game.players[i].toString() == player._id.toString()) {
                idx = i;
            }
        }

        if (game._turn[idx] < 3) {
            if (game._paths[idx][game._turn[idx]][0] == data.word) {
                game.scores[idx] += (3 - game._turn[idx]) * 10;

                socket.emit("answer", {
                    turn: game._turn[idx],
                    correct: game._paths[idx][game._turn[idx]][0],
                    result: "correct"
                });
            } else {
                socket.emit("answer", {
                    turn: game._turn[idx],
                    correct: game._paths[idx][game._turn[idx]][0],
                    result: "incorrect"
                });
            }

            game._turn[idx]++;

            yield(cb) => {
                db.Games.update({
                    _id: game._id
                }, game, cb);
            }

            var finished = true;
            for (var i = 0; i < game._turn.length; i++) {
                if (game._turn[i] < 3) finished = false;
            }

            if (finished) {
                game.status = "completed";
                yield(cb) => {
                    db.Games.update({
                        _id: game._id
                    }, game, cb);
                }
                io.to(game.shortId).emit("finished", game);
            } else {
                if (game._turn[idx] == 3) {
                    socket.emit("done", game);
                } else {
                    game = yield sanitizeForPlayer(game);
                    setTimeout(function() {
                        socket.emit("turn", game);
                    }, 1000)
                }
            }
        }
    }));
});

http.listen(3000, function() {
    console.log('yolo on port 3000');
});