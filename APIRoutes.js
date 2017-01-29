const db = require('./models/db');
const dbUtils = require('./DBUtils.js');
const Promise = require('bluebird-co');

module.exports.GetRoot = function(req, res) {
    res.sendFile(__dirname + '/public/index.html')
}

/**
 * GET /new route
 * create a new player (if they don't exist already) and make a new game
 * with that player as the owner
 */
module.exports.GetNew = Promise.coroutine(function*(req, res) {
    if (!req.cookies.fbtoken) {
        res.status(401).end("You are not authenticated.");
    } else {
    	yield db.connect();
        var fbUser = yield dbUtils.getFbUser(req.cookies.fbtoken);
        if (!fbUser) {
            res.status(401).end("You are not authenticated.");
        } else {
            var player = yield dbUtils.getOrMakePlayer(fbUser.id, fbUser.name);
            var game = yield dbUtils.makeGame(player);
            res.redirect("/playerRoom.html?joinId=" + game.shortId);
        }
    }
});

/**
 * POST /api/v1/offlinePlayer
 * Only accessible by Rohit (facebook authenticated) and allows adding invite codes.
 */
module.exports.PostOfflinePlayer = Promise.coroutine(function*(req, res) {
    if (!req.body.fbtoken) {
        res.status(401).end("You are not authenticated.");
    } else {
        yield db.connect();
        var fbUser = yield dbUtils.getFbUser(req.body.fbtoken);
        if (!fbUser || fbUser.id.toString() != "10154534860608334") {
            res.status(401).end("You are not authenticated. Only Rohit can do this :)");
            return;
        }
        var player = yield dbUtils.getOrMakePlayer(req.body.id, req.body.name, true, req.body.picUrl);
        res.json(player);
    }
});

/**
 * GET /api/v1/reset
 * Clear the games and player database.
 */
module.exports.GetReset = Promise.coroutine(function*(req, res) {
    yield db.connect();
    db.Games.remove({});
    db.Players.remove({});
    res.redirect("/");
});

/**
 * GET /api/v1/me
 * Returns a JSON of the currently authenticated user.
 */
module.exports.GetMe = Promise.coroutine(function*(req, res) {
    if (!req.cookies.fbtoken) {
        res.status(401).end("You are not authenticated.");
    } else {
        yield db.connect();
        var fbUser = yield dbUtils.getFbUser(req.cookies.fbtoken);
        if (!fbUser) {
            res.status(401).end("You are not authenticated.");
            return;
        }
        var player = yield dbUtils.getOrMakePlayer(fbUser.id, fbUser.name);
        res.json(player);
    }
});

/**
 * GET /api/v1/games
 * Returns a JSON array of games attached to the current user.
 */
module.exports.GetGames = Promise.coroutine(function*(req, res) {
    if (!req.cookies.fbtoken) {
        res.status(401).end("You are not authenticated.");
    } else {
        yield db.connect();
        var fbUser = yield dbUtils.getFbUser(req.cookies.fbtoken);
        if (!fbUser) {
            res.status(401).end("You are not authenticated.");
            return;
        }
        var player = yield dbUtils.getOrMakePlayer(fbUser.id, fbUser.name);
        var games = yield dbUtils.getGames(player);
        //	We can't return the database's game list because
        //	it has answers. We sanitize it first.
        for (var i = 0; i < games.length; i++) {
            games[i] = yield dbUtils.sanitizeForPlayer(games[i]);
        }
        res.json(games);
    }
});

/**
 * GET /join/:id
 * User tries to join some game. We add them to the game and redirect to the player room.
 */
module.exports.GetJoinGameId = Promise.coroutine(function*(req, res) {
    if (!req.cookies.fbtoken) {
        res.redirect(302, '/?needsLogin=true&joinId=' + req.params.id);
    } else {
    	yield db.connect();
        var fbUser = yield dbUtils.getFbUser(req.cookies.fbtoken);
        if (!fbUser) {
            res.status(401).end("You are not authenticated.");
        } else {
            console.log(fbUser.name + " trying to join " + req.params.id);
            var player = yield dbUtils.getOrMakePlayer(fbUser.id, fbUser.name);
            var game = yield dbUtils.getGameByShortId(req.params.id);
            if (!game) {
                res.redirect(404, "/?invalidGameId=true");
            } else {
            	//	Check if the user is already in the list and add them if not.
                var repeats = 0;
                for (var i = 0; i < game.players.length; i++) {
                    if (game.players[i].toString() == player._id.toString()) {
                        repeats++;
                    }
                }
                if (repeats == 0) {
                    game.players.push(player._id);
                    yield dbUtils.saveGame(game);
                }
                res.redirect("/playerRoom.html?joinId=" + req.params.id);
            }
        }
    }
});