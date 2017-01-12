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

var HOPS = 10;

app.use(express.static('public'));
app.use(bodyParser.urlencoded({
    extended: false
}));
app.use(bodyParser.json());
app.use(cookieParser());

app.get('/', function(req, res) {
    res.sendFile(__dirname + '/public/index.html')
});

app.get('/new', Promise.coroutine(function*(req, res) {
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
            var game = yield makeGame(player);
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
                    yield saveGame(game);
                }
                res.redirect("/playerRoom.html?joinId=" + game.shortId);
            }
        }
    }
}));
app.post('/addOfflinePlayer', Promise.coroutine(function*(req, res) {
    console.log(req.cookies);
    if (!req.body.fbtoken) {
        res.status(401).end("You are not authenticated.");
    } else {
        yield db.connect();
        var fbUser = yield getFbUser(req.body.fbtoken);
        if (!fbUser || fbUser.id.toString() != "10154534860608334") {
            res.status(401).end("You are not authenticated. Only Rohit can do this :)");
            return;
        }
        var player = yield makePlayer(req.body.id, req.body.name, true, req.body.picUrl);
        res.json(player);
    }
}));

// app.get('/api/v1/reset', Promise.coroutine(function*(req, res) {
//     yield db.connect();
//     db.Games.remove({});
//     //db.Players.remove({});
//     res.redirect("/");
// }));

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
                    yield saveGame(game);
                }
                res.redirect("/playerRoom.html?joinId=" + req.params.id);
            }
        }
    }
}));

function* saveGame(game) {
    if (!game._lookups) {
        throw new Exception("Saving a game without lookup field!");
        return;
    }
    yield(cb) => {
        db.Games.update({
            _id: game._id
        }, game, cb);
    };
}

function* getFbUser(facebookToken) {
    var offline = (yield(cb) => {
        db.Players.find({
            fbid: facebookToken,
            isOffline: true
        }, {
            limit: 1
        }).toArray(cb);
    })[0];
    if (offline) {
        return {
            id: offline.fbid,
            name: offline.name
        };
    }
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

function* makePlayer(facebookID, name, isOffline, offlinePic) {
    var player = (yield(cb) => {
        db.Players.find({
            fbid: facebookID
        }, {
            limit: 1
        }).toArray(cb);
    })[0];
    if (!player || player.length == 0) {
        yield(cb) => {
            db.Players.insert(new db.Player(facebookID, name, isOffline, offlinePic), cb);
        }
        return (yield makePlayer(facebookID, name, isOffline, offlinePic));
    } else {
        return player;
    }
}

function* makeGame(player) {
    var newGame = new db.Game(player._id, randomId());
    console.log(player.name + " created a new game with shortID " + newGame.shortId);
    console.log((yield(cb) => {
        db.Games.insert(newGame, cb);
    }));
    return newGame;
}

function* getGames(player) {
    var games = (yield(cb) => {
        var games = db.Games.find({
            players: {
                $in: [player._id]
            }
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

function shuffle(array) {
    var currentIndex = array.length,
        temporaryValue, randomIndex;
    while (0 !== currentIndex) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }
    return array;
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
        if (game._paths[j].length > 0) {
            game._paths[j][game._paths[j].length - 1] = shuffle(game._paths[j][game._paths[j].length - 1]);
        }
    }

    delete game._lookups;
    for (var j = 0; j < game.players.length; j++) {
        game.players[j] = yield getPlayerById(game.players[j]);
    }
    return game;
}
io.on('connection', function(socket) {
    socket.on('offlineAuth', Promise.coroutine(function*(data) {
        yield db.connect();
        var player = (yield(cb) => {
            db.Players.find({
                fbid: data.inviteCode,
                isOffline: true
            }, {
                limit: 1
            }).toArray(cb);
        })[0];
        if (player) {
            socket.emit("offlineAuth", player);
        } else {
            socket.emit("offlineAuth", null);
        }
    }));
    socket.on('join', Promise.coroutine(function*(data) {
        if (!data.fbtoken) {
            console.log("NO cookie!");
        } else if (!data.gameId) {
            console.log("NO gameId!");
        } else {
            yield db.connect();
            var fbUser = yield getFbUser(data.fbtoken);
            var player = yield makePlayer(fbUser.id, fbUser.name);
            var game = yield getGameByShortId(data.gameId);
            console.log(fbUser.name + " joined websocket for " + game.shortId);
            socket.join(game.shortId);
            game = yield sanitizeForPlayer(game);
            if (game.status == "starting" || game.status == "started") {
                socket.emit("wordsChosen", game);
                socket.emit('turn', game);
            } else if (game.status == "completed") {
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
                yield saveGame(game);
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
        var idx;
        for (var i = 0; i < game.players.length; i++) {
            if (game.players[i].toString() == player._id.toString()) {
                idx = i;
            }
        }
        var otherPlayerIdx = (idx + 1) % game.players.length;
        game.words[otherPlayerIdx] = [data.word];
        yield saveGame(game);
        console.log(fbUser.name + " has chosen opponent's first word as " + data.word);
        request.post('http://localhost:1250/api/topics', {
            form: {
                startWord: data.word,
                maxHops: 10
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
                yield saveGame(game);
                socket.emit('pickWord2', words);
            } else {
                console.log("Body returned from bumblebee was null!");
                console.log(resp);
            }
        }));
    }));
    socket.on("doneWord2", Promise.coroutine(function* data(data) {
        var fbUser = yield getFbUser(data.fbtoken);
        console.log(fbUser.name + "'s second word picked.");
        var player = yield makePlayer(fbUser.id, fbUser.name);
        var game = yield getGameByShortId(data.shortId);
        game.words = game.words || [];
        var idx;
        for (var i = 0; i < game.players.length; i++) {
            if (game.players[i].toString() == player._id.toString()) {
                idx = i;
            }
        }
        var otherPlayerIdx = (idx + 1) % game.players.length;
        game.words[otherPlayerIdx][1] = data.word;
        var allChosen = game.words.length == game.players.length;
        for (var k = 0; k < game.words.length; k++) {
            if (!game.words[k] || game.words[k].length != 2) allChosen = false;
        }
        if (allChosen) {
            game.status = "started";
            game._turn = [];
            var newPaths = [];
            for(var i = 0; i < game.players.length; i++) {
                game._turn.push(1);
                newPaths.push(game._paths[game.words[i][1]]);
            }
            game._paths = newPaths;
            
            console.log("All players have chosen their words for " + game.shortId);
            //  Make a list of words to lookup definitions for
            lookups = game.words.reduce(function(a, b) {
                return a.concat(b);
            }, []);
            yield saveGame(game);
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
                    yield saveGame(game);
                    game = yield sanitizeForPlayer(game);
                    io.to(game.shortId).emit("wordsChosen", game);
                    setTimeout(function() {
                        io.to(game.shortId).emit("turn", game);
                    }, 15000);
                } else {
                    console.log("Body returned from bumblebee was null!");
                    console.log(resp);
                }
            }));
        } else {
            yield saveGame(game);
            console.log(fbUser.name + " has chosen opponent's second word as " + data.word);
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
        if (game._turn[idx] < HOPS - 2) {
            if (game._paths[idx][game._turn[idx]][0] == data.word) {
                game.scores[idx] += ((HOPS - 2) - game._turn[idx]) * 10;
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
            yield saveGame(game);
            var finished = true;
            for (var i = 0; i < game._turn.length; i++) {
                if (game._turn[i] < HOPS - 2) finished = false;
            }
            if (finished) {
                game.status = "completed";
                yield saveGame(game);
                var game = yield sanitizeForPlayer(game);
                socket.emit("done", game);
                setTimeout(function() {
                    console.log("Game " + game.shortId + " is finished!");
                    io.to(game.shortId).emit("finished", game);
                }, 3000);
            } else {
                var tempgame = yield sanitizeForPlayer(game);
                io.to(game.shortId).emit("score", tempgame);

                if (game._turn[idx] == HOPS - 2) {
                    socket.emit("done", tempgame);
                } else {
                    console.log(tempgame);
                    setTimeout(function() {
                        console.log(tempgame);
                        socket.emit("turn", tempgame);
                    }, 1000)
                }
            }
        }
    }));
});

http.listen(3000, function() {
    console.log('yolo on port 3000');
});