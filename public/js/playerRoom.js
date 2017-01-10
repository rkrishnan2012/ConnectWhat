var socket;
var shortId;
var myId;
var pg;

function needsLogin() {
    window.location = "/";
}

function loadUserPage() {
    pg = particleground(document.getElementById('dotsBkg'), {
        dotColor: 'rgba(41, 164, 104, 0.10)',
        lineColor: 'rgba(41, 164, 104, 0.05)'
    });
    socket = io('/');
    socket.on('connect', function() {
        socket.emit('join', {
            fbtoken: getCookie("fbtoken")
        });
    });
    socket.on('game', function(game) {
        console.log(game);
        $(".infoText").text("Share the link below to invite your friend to this game.");
        $(".inviteLink").text(game.gameUrl);
        shortId = game.shortId;
        getFbProPicUrl(game.players[0].fbid, function(url) {
            animateCircle('circle1', url);
        });
        if (game.players.length > 1) {
            getFbProPicUrl(game.players[1].fbid, function(url) {
                animateCircle('circle2', url);
                readyToStart();
            });
        }
    });
    socket.on('pickWord', function(words) {
        console.log("Pick words!");
        pickWordsState(words);
    });
    socket.on('wordsChosen', function(game) {
        wordsChosen(game);
    });
    socket.on('disconnect', function() {});
}

function wordsChosen(game) {
    console.log(game);
    var myid = getCookie("fbid");
    for(var i = 0; i < game.players.length; i++) {
        if(game.players[i].fbid == myid) {
            $(".waitingForResult").hide("slow");
            $(".definitionTable").show();
            $(".gameTimer").show();
            $(".gameTimer .timer").text("30");
            pg.destroy();
            var j = 30;
            var timerid;
            timerid = setInterval(function() {
                j--;
                $(".gameTimer .timer").text(j);
                if(j == 0) {
                    window.clearInterval(timerid);
                    $(".gameTimer").hide();
                    $(".definitionTable").addClass("hidden");
                }
            }, 1000);
            $(".word1").text(game.words[i][0].word);
            $(".word2").text(game.words[i][1].word);
            $(".definition1").text(game.words[i][0].longSummary);
            $(".definition2").text(game.words[i][1].longSummary);
            break;
        }
    }
}

function readyToStart() {
    $(".gameStatus").text("Ready to start!");
    $(".gameStatus").removeClass("waiting");
    $(".gameStatus").addClass("ready");
    $(".gameStatus").click(function() {
        socket.emit('ready', {
            fbtoken: getCookie("fbtoken"),
            shortId: shortId
        });
        $(".gameStatus").prop('onclick', null).off('click');
        $(".gameStatus").text("Waiting on opponent");
        $(".gameStatus").removeClass("ready");
        $(".gameStatus").addClass("waiting");
    });
}

function pickWordsState(words, second) {
    console.log(words);
    $(".circle1").attr("class", "circle circle1 smallSvg");
    $(".circle2").attr("class", "circle circle2 smallSvg");
    $(".circleset").addClass("small");
    $(".inviteLink").hide("slow");
    if (!second) {
        $(".infoText").text("Choose a topic from the below list");
    } else {
        $(".infoText").text("Choose another topic from the below list");
    }

    $(".wordsTable").css("display", "inline-block");
    var tbody = $(".wordsTable").find('tbody');
    $(".wordsTable tbody td").remove();
    for (var i = 0; i < words.length / 3; i++) {
        var tr = tbody.append($('<tr>'));
        for (var j = 0; j < 3; j++) {
            if (!second) {
                tr.append($('<td class="">').attr('wordNum', 3 * i + j).text(words[3 * i + j].result.title));
            } else {
                tr.append($('<td class="">').attr('wordNum', 3 * i + j).text(words[3 * i + j].title));
            }
        }
    }
    $(".gameStatus").text("Select a topic");
    $(".gameStatus").removeClass("ready");
    $(".gameStatus").addClass("waiting");

    var chosenWords = [];
    $(".wordsTable td").click(function(event) {
        var i = $(event.target).attr("wordNum");
        console.log($(event.target).attr("class"));
        $(".gameStatus").prop('onclick', null).off('click');
        if ($(event.target).attr("class").indexOf("active") == -1) {
            if (chosenWords.length < 1) {
                $(event.target).addClass("active");
                chosenWords.push(i);
            }
        } else {
            $(event.target).removeClass("active");
            if (chosenWords[0] == i) chosenWords.splice(0, 1);
        }
        if (chosenWords.length == 1) {
            $(".infoText").text("");
            if (!second) {
                $(".gameStatus").text("Continue");
            } else {
                $(".gameStatus").text("Start game");
            }
            $(".gameStatus").removeClass("waiting");
            $(".gameStatus").addClass("ready");
            $(".gameStatus").click(function() {
                if (!second) {
                    $(".gameStatus").removeClass("ready");
                    $(".gameStatus").addClass("waiting");
                    $(".gameStatus").prop('onclick', null).off('click');
                    socket.on('pickWord2', function(words) {
                        console.log("Pick words!");
                        pickWordsState(words, true);
                    });
                    socket.emit("doneWord1", {
                        shortId: shortId,
                        word: words[chosenWords[0]]._id,
                        fbtoken: getCookie("fbtoken")
                    });
                } else {
                    socket.emit("doneWord2", {
                        shortId: shortId,
                        word: words[chosenWords[0]].title,
                        fbtoken: getCookie("fbtoken")
                    });
                    $(".gameChooseOverlay").hide("slow");
                    $(".waitingForResult").show("slow");
                }
            })
        } else {
            $(".infoText").text("Choose a topic from the below list");
            $(".subInfoText").text("");
            $(".gameStatus").text("Select a topic");
            $(".gameStatus").removeClass("ready");
            $(".gameStatus").addClass("waiting");
        }
        console.log(chosenWords);
    });
}

function animateCircle(svgClassName, imageUrl) {
    $("." + svgClassName).css("display", "inline");
    var path = document.querySelector('.' + svgClassName + ' path');
    var length = path.getTotalLength();
    // Clear any previous transition
    path.style.transition = path.style.WebkitTransition =
        'none';
    // Set up the starting positions
    path.style.strokeDasharray = length + ' ' + length;
    path.style.strokeDashoffset = length;
    // Trigger a layout so styles are calculated & the browser
    // picks up the starting position before animating
    path.getBoundingClientRect();
    // Define our transition
    path.style.transition = path.style.WebkitTransition =
        'stroke-dashoffset .5s ease-in-out';
    // Go!
    path.style.strokeDashoffset = '0';
    setImageCircle(svgClassName, imageUrl);
    setTimeout(function() {
        showImageCircle(svgClassName);
    }, 2000);
}

function setImageCircle(svgClassName, imageUrl) {
    var path = $('.' + svgClassName + ' path');
    var defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    var pattern = document.createElementNS("http://www.w3.org/2000/svg", "pattern");
    pattern.setAttribute("id", svgClassName);
    pattern.setAttribute("patternUnits", "userSpaceOnUse");
    pattern.setAttribute("height", "200");
    pattern.setAttribute("width", "200");
    var image = document.createElementNS("http://www.w3.org/2000/svg", "image");
    image.setAttribute("x", "0");
    image.setAttribute("y", "0");
    image.setAttribute("height", "200");
    image.setAttribute("width", "200");
    image.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", imageUrl);
    pattern.appendChild(image);
    defs.appendChild(pattern);
    console.log(path);
    $(defs).insertBefore(path);
}

function showImageCircle(svgClassName) {
    document.querySelector('.' + svgClassName + ' path').setAttribute("fill", "url(#" + svgClassName + ")");
}

function getFbProPicUrl(id, callback) {
    callback("https://graph.facebook.com/" + id + "/picture?type=large&w‌​idth=300&height=300");
}