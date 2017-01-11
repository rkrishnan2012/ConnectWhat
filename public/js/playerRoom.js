var socket;
var shortId;
var myId;
var pg;
var timerid;

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
    socket.on("turn", function(game) {
        $(".gameTimer").hide();
        $(".definitionTable").addClass("disabled");
        $(".treeViewContent").show();
        $(".treeViewContent").show();
        $(".gameStatus").hide();
        $(".rightInfoBox").show();
        $(".choicesTable").show();
        $("#dotsBkg").remove();
        $(".betweenGame").hide();
        $(".duringGame").show();
        showTree(game);
    });

    socket.on("answer", function(data) {
        if (data.result == "correct") {
            $(".betweenGame .instruction").removeClass("wrong");
            $(".betweenGame .instruction").addClass("correct");
            $(".betweenGame .instruction").text("Correct :)");
        } else {
            $(".betweenGame .instruction").addClass("wrong");
            $(".betweenGame .instruction").removeClass("correct");
            $(".betweenGame .instruction").text("Wrong :(");
        }
    });

    socket.on("done", function(data) {
        $(".gameTimer").hide();
        $(".definitionTable").hide();
        $(".treeViewContent").hide();
        $(".rightInfoBox").hide();
        $(".waitingForResult").text("Ayeee. Now we wait for your opponent to finish.");
        $(".waitingForResult").show("slow");
    });

    socket.on("finished", function(game) {
        $(".gameTimer").hide();
        $(".definitionTable").hide();
        $(".treeViewContent").hide();
        $(".rightInfoBox").hide();
        $(".gameStatus").hide();
        var myIdx = 0;
        var highestIdx = 0;
        var highestScore = 0;
        for (var i = 0; i < game.players.length; i++) {
            if(game.scores[i] > highestScore) {
                highestScore = game.scores[i];
                highestIdx = i;
            }
            if (game.players[i].fbid == myIdx) {
                myIdx = i;
            }
        }
        if(highestIdx == myIdx) {
            $(".waitingForResult").removeClass("loss");
            $(".waitingForResult").addClass("win");
            $(".waitingForResult").text("You're god at this :D");    
        } else {
            $(".waitingForResult").removeClass("win");
            $(".waitingForResult").addClass("loss");
            $(".waitingForResult").text("Dang you lost, oh well :(");    
        }
        
        $(".waitingForResult").show("slow");
    })

    socket.on('disconnect', function() {});
}

function showTree(game) {
    console.log(game);

    $(".treeViewContent").children().remove()

    var myid = getCookie("fbid");
    var idx = 0;
    for (var i = 0; i < game.players.length; i++) {
        if (game.players[i].fbid == myid) {
            idx = i;
        }
    }

    $(".word1").text(game.words[idx][0].word);
    $(".word2").text(game.words[idx][1].word);
    $(".definition1").text(game.words[idx][0].longSummary);
    $(".definition2").text(game.words[idx][1].longSummary);

    var prev = {
        name: game._paths[idx][0][0],
        children: []
    };
    var rootItem = prev;
    for (var i = 1; i < game._paths[idx].length; i++) {
        if (i == game._paths[idx].length - 1) {
            $(".choicesTable tbody").remove();
            var tbody = $(".choicesTable").append($("<tbody>"));
            for (var j = 0; j < game._paths[idx][i].length; j++) {
                prev.children.push({
                    name: game._paths[idx][i][j],
                    parent: prev.name,
                    children: []
                });
                var tr = $('<tr>');
                tr.append($('<td class="">').attr('word', game._paths[idx][i][j]).text(game._paths[idx][i][j]));
                tr.click(function(event) {
                    $(".betweenGame .instruction").removeClass("correct");
                    $(".betweenGame .instruction").removeClass("wrong");
                    $(".betweenGame .instruction").text("Hold Tight...");
                    $(".betweenGame").show();
                    $(".duringGame").hide();
                    socket.emit('move', {
                        fbtoken: getCookie("fbtoken"),
                        word: $(event.target).attr("word"),
                        shortId: game.shortId
                    });
                });
                tbody.append(tr);
            }
        } else {
            prev.children = prev.children || [];
            prev.children.push({
                name: game._paths[idx][i][0],
                parent: prev.name,
                children: []
            });
            prev = prev.children[0];
        }
    }
    console.log(rootItem);
    var width = $(".treeViewContent").width();
    var height = $("html").height() - $(".definitionTable").height();
    var svg = d3.select(".treeViewContent").append("svg");
    svg.attr('width', width);
    svg.attr('height', height);
    g = svg.append("g").attr("transform", "translate(50,0)");
    var tree = d3.cluster()
        .size([height, width - 160]);
    var stratify = d3.stratify()
        .parentId(function(d) {
            return d.id.substring(0, d.id.lastIndexOf("."));
        });
    var root = d3.hierarchy(rootItem);
    tree(root);
    var link = g.selectAll(".link")
        .data(root.descendants().slice(1))
        .enter().append("path")
        .attr("class", "link")
        .attr("d", function(d) {
            return "M" + d.y + "," + d.x +
                "C" + (d.parent.y + 100) + "," + d.x +
                " " + (d.parent.y + 100) + "," + d.parent.x +
                " " + d.parent.y + "," + d.parent.x;
        });
    var node = g.selectAll(".node")
        .data(root.descendants())
        .enter().append("g")
        .attr("class", function(d) {
            return "node" + (d.children ? " node--internal" : " node--leaf");
        }).attr("transform", function(d) {
            return "translate(" + d.y + "," + d.x + ")";
        })
    node.append("circle")
        .attr("r", 8);
    node.append("text")
        .attr("dy", -20)
        .attr("x", function(d) {
            return d.children ? -8 : 8;
        })
        .style("text-anchor", function(d) {
            return d.children ? "start" : "end";
        })
        .text(function(d) {
            return d.data.name;
        });
    // Toggle children on click.
    function click(d) {
        if (d.children) {
            d._children = d.children;
            d.children = null;
        } else {
            d.children = d._children;
            d._children = null;
        }
        update(d);
    }
}

function wordsChosen(game) {
    console.log(game);
    var myid = getCookie("fbid");
    for (var i = 0; i < game.players.length; i++) {
        if (game.players[i].fbid == myid) {
            $(".waitingForResult").hide("slow");
            $(".definitionTable").show();
            $(".gameTimer").show();
            $(".gameTimer .timer").text("30");
            pg.destroy();
            $(".dotsBkg").remove();
            var j = 30;
            timerid = setInterval(function() {
                j--;
                $(".gameTimer .timer").text(j);
                if (j == 0) {
                    window.clearInterval(timerid);
                }
            }, 1000);
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