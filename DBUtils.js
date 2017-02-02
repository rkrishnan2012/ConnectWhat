const db = require('./models/db');
const FB = require('fb');

module.exports.saveGame = function* (game) {
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

module.exports.getFbUser = function* (facebookToken) {
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

module.exports.getPlayerById = function* (dbId) {
    return (yield(cb) => {
        db.Players.find({
            _id: dbId
        }, {
            limit: 1
        }).toArray(cb);
    })[0];
}

module.exports.getOrMakePlayer = function* (facebookID, name, isOffline, offlinePic) {
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
        return (yield module.exports.getOrMakePlayer(facebookID, name, isOffline, offlinePic));
    } else {
        return player;
    }
}

module.exports.makeGame = function* (player) {
    var newGame = new db.Game(player._id, module.exports.randomId());
    console.log(player.name + " created a new game with shortID " + newGame.shortId);
    (yield(cb) => {
        db.Games.insert(newGame, cb);
    });
    return newGame;
}

module.exports.getGames = function* (player) {
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

module.exports.getGameByShortId = function* (shortId) {
    var game = (yield(cb) => {
        db.Games.find({
            shortId: shortId
        }, {
            limit: 1
        }).toArray(cb);
    })[0];
    return game;
}

module.exports.randomId = function () {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }
    return s4() + s4();
}

module.exports.shuffle = function (array) {
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


module.exports.sanitizeForPlayer = function*(game) {
    for (var j = 0; j < game.words.length; j++) {
        var lookupWord = game._lookups[game.words[j][0]] || {};
        game.words[j][0] = {
            word: game.words[j][0],
            longSummary: lookupWord.longSummary
        };
        lookupWord = game._lookups[game.words[j][1]] || {};
        game.words[j][1] = {
            word: game.words[j][1],
            longSummary: lookupWord.longSummary
        };
    }
    for (var j = 0; j < game._paths.length; j++) {
        game._paths[j] = game._paths[j].slice(0, game._turn[j] + 1);

        if(game._lookups.length > 0) {
            game._lookups[j] = game._lookups[j].slice(0, game._turn[j] + 1);
        }

        if(game._explanations.length > 0) {
            game._explanations[j] = game._explanations[j].slice(0, game._turn[j] - 1);
        }
        
        if (game._paths[j].length > 0) {
            game._paths[j][game._paths[j].length - 1] = module.exports.shuffle(game._paths[j][game._paths[j].length - 1]);
        }
    }

    for (var j = 0; j < game.players.length; j++) {
        game.players[j] = yield module.exports.getPlayerById(game.players[j]);
    }
    return game;
}
