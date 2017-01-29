const Promise = require('bluebird-co');
const dbUtils = require('./DBUtils.js');
const db = require('./models/db');
const request = require("request");

var io;
var HOPS = 10;

module.exports = function(http) {
	io = require('socket.io')(http);
	io.on('connection', onConnection);
}

onConnection = function(socket) {
    /**
     * For people that don't have facebook, offline authentication can be done
     * by sending an invite code via websocket. This invite code is the "fbid" field
     * in the player table.
     */
    onOfflineAuth = Promise.coroutine(function*(data) {
        yield db.connect();
        var player = (yield(cb) => {
            db.Players.find({
                fbid: data.inviteCode,
                isOffline: true
            }, {
                limit: 1
            }).toArray(cb);
        })[0];
        socket.emit("offlineAuth", player);
    });

    /**
     * User is asking to join the game (listen for websocket events).
     * We will now emit the "wordsChosen" and "turn" event, or the "finished" event if the game is over.
     * Then we will emit a "game" event to everyone in the websocket channel to indicate someone joined the socket.
     */
    onJoin = Promise.coroutine(function*(data) {
        if (data.fbtoken && data.gameId) {
            yield db.connect();
            var fbUser = yield dbUtils.getFbUser(data.fbtoken);
            if (!fbUser) return;

            var game = yield dbUtils.getGameByShortId(data.gameId);
            if (!game) return;

            var player = yield dbUtils.getOrMakePlayer(fbUser.id, fbUser.name);

            socket.join(game.shortId);
            game = yield dbUtils.sanitizeForPlayer(game);
            if (game.status == "starting" || game.status == "started") {
                socket.emit("wordsChosen", game);
                socket.emit('turn', game);
            } else if (game.status == "completed") {
                socket.emit("finished", game);
            } else {
                io.to(game.shortId).emit('game', game);
            }

            console.log(fbUser.name + " joined websocket for " + game.shortId);
        }
    });

    /**
     * User pressed the "ready" button. We will mark them as ready (by adding an item to the "score" array).
     * if all players have pressed "ready" then we will emit a "pickWord" event to all users with a list of topics
     * that we get from bumblebee. This will be their first word to pick.
     */
    onReady = Promise.coroutine(function*(data) {
        if (data.fbtoken) {
            yield db.connect();
            var fbUser = yield dbUtils.getFbUser(data.fbtoken);
            if (!fbUser) return;

            var player = yield dbUtils.getOrMakePlayer(fbUser.id, fbUser.name);

            var game = yield dbUtils.getGameByShortId(data.shortId);
            if (!game) return;

            if (game.scores.length < game.players.length) {
                game.scores.push(0);
                yield dbUtils.saveGame(game);
            }

            //	Check if all players have pressed "ready". In which case we send "pickWord" event.
            if (game.scores.length == game.players.length) {
                request.post('http://localhost:1250/api/topics', {}, function(error, response, body) {
                    var body = JSON.parse(response.body);
                    var words = body.splice(0, 12);
                    //	If there is only 1 player in the game (you're solo), then have the computer
                    //	pick a random word as that user's first word.
                    if (game.players.length == 1) {
                        Promise.coroutine(playerPickFirstWord)(socket, {
                            fbtoken: data.fbtoken,
                            word: words[Math.floor(Math.random() * words.length)]._id,
                            shortId: data.shortId
                        });
                    } else {
                        //	Tell all users in the game to pick a word from one of these words.
                        io.to(game.shortId).emit('pickWord', words);
                    }
                });
            }
        }
    });

    /**
     * A user picks a word which they believe is the next word in the path.
     */
    onMove = Promise.coroutine(function* data(data) {
        if (!data.fbtoken) return;
        var fbUser = yield dbUtils.getFbUser(data.fbtoken);
        if (!fbUser) return;
        var player = yield dbUtils.getOrMakePlayer(fbUser.id, fbUser.name);
        var game = yield dbUtils.getGameByShortId(data.shortId);
        if (!game) return;

        //	The players, scores, _turn, and _paths array in the game are all in the same order, so 
        //	let's lookup what the index of that player is in the list.
        var idx;
        for (var i = 0; i < game.players.length; i++) {
            if (game.players[i].toString() == player._id.toString()) {
                idx = i;
            }
        }

        //	Check if there are still turns remaining
        if (game._turn[idx] < HOPS - 2) {
            //	Check if the word they chose is the next word in the path.
            if (game._paths[idx][game._turn[idx]][0] == data.word) {
                //	Number of points gain = how far they are from end * 10
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
            //	Increment the turn number.
            game._turn[idx]++;
            yield dbUtils.saveGame(game);

            //	If all players have reached the last turn, then the game is finished.
            var finished = true;
            for (var i = 0; i < game._turn.length; i++) {
                if (game._turn[i] < HOPS - 2) finished = false;
            }

            //	If game is finished, then emit a "finished" event.
            //	Regardless of game finished or not, emit a "done" event if this player is finished with their path.
            if (finished) {
                game.status = "completed";
                yield dbUtils.saveGame(game);
                var game = yield dbUtils.sanitizeForPlayer(game);
                socket.emit("done", game);
                //	3 seconds delay after finishing a game to declare it's done (for suspense lol)
                setTimeout(function() {
                    console.log("Game " + game.shortId + " is finished!");
                    io.to(game.shortId).emit("finished", game);
                }, 3000);
            } else {
                var tempgame = yield dbUtils.sanitizeForPlayer(game);
                io.to(game.shortId).emit("score", tempgame);

                if (game._turn[idx] == HOPS - 2) {
                    socket.emit("done", tempgame);
                } else {
                    console.log(tempgame);
                    setTimeout(function() {
                        socket.emit("turn", tempgame);
                    }, 1000)
                }
            }
        }
    });

    socket.on('offlineAuth', onOfflineAuth);
    socket.on('join', onJoin);
    socket.on('ready', onReady);
    socket.on("doneWord1", Promise.coroutine(function*(data) {
        yield playerPickFirstWord(socket, data);
    }));
    socket.on("doneWord2", Promise.coroutine(function*(data) {
        yield playerPickSecondWord(socket, data);
    }));
    socket.on("move", onMove);
}


function* playerPickFirstWord(socket, data) {
    if (!data.fbtoken || !data.shortId) return;
    var fbUser = yield dbUtils.getFbUser(data.fbtoken);
    if (!fbUser) return;

    var player = yield dbUtils.getOrMakePlayer(fbUser.id, fbUser.name);
    var game = yield dbUtils.getGameByShortId(data.shortId);
    if (!game) return;

    //	The players, scores, _turn, and _paths array in the game are all in the same order, so 
    //	let's lookup what the index of that player is in the list.
    var idx;
    for (var i = 0; i < game.players.length; i++) {
        if (game.players[i].toString() == player._id.toString()) {
            idx = i;
        }
    }

    //	Get index of player for whom we will pick words.
    var otherPlayerIdx = (idx + 1) % game.players.length;
    game.words[otherPlayerIdx] = [data.word];
    yield dbUtils.saveGame(game);

    //	If this is a solo game, the computer chose a player's word.
    if (game.players.length > 1) {
        console.log(fbUser.name + " has chosen opponent's first word as " + data.word);
    } else {
        console.log(fbUser.name + "'s first word chosen by computer is " + data.word);
    }

    //	Get a list of words that are 10 hops away from this word using Bumblebee.
    request.post('http://localhost:1250/api/topics', {
        form: {
            startWord: data.word,
            maxHops: 10
        }
    }, Promise.coroutine(function*(err, resp, body) {
        console.log("Bumblebee returned subtopics of " + data.word);
        if (err) console.log(err);
        if (body) {
            game = yield dbUtils.getGameByShortId(data.shortId);
            game._paths = game._paths || {};
            var body = JSON.parse(resp.body);
            var words = [];
            for (var i = 0; i < Math.min(12, body.endNodes.length); i++) {
                words.push(body.endNodes[i]);
                game._paths[body.endNodes[i].title] = body.paths[i];
            }
            yield dbUtils.saveGame(game);
            //	If this is a solo player, then the computer should pick the next word for them (a random one)
            if (game.players.length == 1) {
            	var randomWordIdx = Math.floor(Math.random() * words.length);
            	console.log(words);
            	console.log(randomWordIdx);
                Promise.coroutine(playerPickSecondWord)(socket, {
                    fbtoken: data.fbtoken,
                    word: words[randomWordIdx].title,
                    shortId: data.shortId
                });
            } else {
                socket.emit('pickWord2', words);
            }
        }
    }));
};


/**
 * Some player or computer has chosen words for another player. Mark this in the database.
 */
function* playerPickSecondWord(socket, data) {
    if (!data.fbtoken || !data.shortId) return;
    var fbUser = yield dbUtils.getFbUser(data.fbtoken);
    var player = yield dbUtils.getOrMakePlayer(fbUser.id, fbUser.name);
    var game = yield dbUtils.getGameByShortId(data.shortId);
    if (!game) return;
    game.words = game.words || [];

    //	The players, scores, _turn, and _paths array in the game are all in the same order, so 
    //	let's lookup what the index of that player is in the list.
    var idx;
    for (var i = 0; i < game.players.length; i++) {
        if (game.players[i].toString() == player._id.toString()) {
            idx = i;
        }
    }

    //	Find the other player's ID. If this is solo player, the computer just chose your words.
    //	so otherPlayerIdx = you.
    var otherPlayerIdx = (idx + 1) % game.players.length;
    game.words[otherPlayerIdx][1] = data.word;

    //	Check if all players' words are chosen.
    var allChosen = game.words.length == game.players.length;
    for (var k = 0; k < game.words.length; k++) {
        if (!game.words[k] || game.words[k].length != 2) allChosen = false;
    }

    //	If all words have been chosen, then game status becomes "started".
    if (allChosen) {
        game.status = "started";
        game._turn = [];
        var newPaths = [];
        //	Set every player to be in turn 1.
        for (var i = 0; i < game.players.length; i++) {
            game._turn.push(1);
            newPaths.push(game._paths[game.words[i][1]]);
        }
        game._paths = newPaths;

        console.log("All players have chosen their words for " + game.shortId);

        //  Make a list of words to lookup definitions for (every word in every player's path).
        lookups = game.words.reduce(function(a, b) {
            return a.concat(b);
        }, []);
        yield dbUtils.saveGame(game);

        console.log(lookups);
        //	Lookup the definitions for all the words.
        request.post('http://localhost:1250/api/lookup', {
            form: {
                terms: JSON.stringify(lookups)
            }
        }, Promise.coroutine(function*(err, resp, body) {
            if (body) {
                var body = JSON.parse(resp.body).result;
                var game = yield dbUtils.getGameByShortId(data.shortId);
                game._lookups = body;
                console.log(body);
                yield dbUtils.saveGame(game);
                //	Remove the words that the user shouldn't see yet.
                game = yield dbUtils.sanitizeForPlayer(game);

                //	Tell all players that words have been chosen for all players
                io.to(game.shortId).emit("wordsChosen", game);

                //	Give them 15 seconds before the first turn.
                setTimeout(function() {
                    io.to(game.shortId).emit("turn", game);
                }, 15000);
            }
        }));
    } else {
        yield dbUtils.saveGame(game);
        if (game.players.length > 1) {
            console.log(fbUser.name + " has chosen opponent's second word as " + data.word);
        } else {
            console.log(fbUser.name + "'s second word chosen by computer is " + data.word);
        }
    }
}