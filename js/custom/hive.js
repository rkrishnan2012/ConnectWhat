$(document).ready(function() {
    /*if ($(window).width() >= 800) {
        $('#stage').fullpage({
            menu: '.nav',
            anchors: ['headerSlide', 'bumblebeeSlide', 'exampleSlide', 'pricingSlide', 'footerSlide'],
            afterLoad: function(anchorLink, index) {
                if (index == 2) {
                    new Odometer({
                        theme: 'default',
                        el: document.querySelector("#millionTopic")
                    }).update(1371958);
                    new Odometer({
                        theme: 'default',
                        el: document.querySelector("#millionData")
                    }).update(14051603);
                }
            },
        });
    } else {*/
        new Odometer({
            theme: 'default',
            el: document.querySelector("#millionTopic")
        }).update(1371958);
        new Odometer({
            theme: 'default',
            el: document.querySelector("#millionData")
        }).update(14051603);
    //}

    $("#typingData").typed({
        strings: ["customer reviews", "ad analytics", "twitter feeds", "news articles", "journal articles"],
        typeSpeed: 40,
        loop: true,
        backSpeed: 25,
        shuffle: true,
        startDelay: 2000,
        backDelay: 2000,
    });
});

$(".btn-go").click(function() {
    callBumblebee();
});

$(".btn-stop").click(function() {
    if (xhr) {
        setTimeout(function() {
            xhr.abort();
        }, 500);
    }
});

$("#nav ul li a[href^='#']").on('click', function(e) {

   // prevent default anchor click behavior
   e.preventDefault();

   // store hash
   var hash = this.hash;

   // animate
   $('html, body').animate({
       scrollTop: $(hash).offset().top
     }, 300, function(){

       // when done, add hash to url
       // (default click behaviour)
       window.location.hash = hash;
     });

});

$("#stage a[href^='#']").on('click', function(e) {

   // prevent default anchor click behavior
   e.preventDefault();

   // store hash
   var hash = this.hash;

   // animate
   $('html, body').animate({
       scrollTop: $(hash).offset().top
     }, 300, function(){

       // when done, add hash to url
       // (default click behaviour)
       window.location.hash = hash;
     });

});

/**
* Listen for enter key when user finish inputing text
*/
$("#markup-text").on('keydown', function(e) {
    if (e.which == 13 || e.keyCode == 13) {
        callBumblebee();
    }
});

$("#markup-text").focusout(function(e) {
    if($("#markup-text").val() == "") {
        $(".markup-span .input__label-content").text("Haley Anderson and Usain Bolt participated in the Olympics");
    } else {
        $(".markup-span .input__label-content").html("&nbsp;");
    }
}); 

function callBumblebee() {
    $('.btn-go').hide();
    $('.btn-stop').removeClass("hidden");
    $(".progress").removeClass("hidden");
    $(".markup-span").hide();
    var apiUrl = "http://bumblebee.hivelabs.it/api/relation";
    if (location.protocol == "file:" || location.host.indexOf("9000") >= 0) {
        apiUrl = "http://" + location.hostname + ":1250/api/relation";
    }
    console.log(apiUrl); 
    var text = $("#markup-text").val() == "" ? "Haley Anderson and Usain Bolt participated in the Olympics" : $("#markup-text").val();
    xhr = $.ajax({
        type: "POST",
        url: apiUrl,
        data: {
            markup: text,
            maxHops: $("#maxHopsOption").val()
        },
        success: function(data, status, headers, config) {
            $(".markup-span").show();
            $('.btn-stop').addClass("hidden");
            $(".progress").addClass("hidden");
            $('.btn-go').show();
            $('.response').removeClass("hidden");
            loadGraph(data);
        },
        error: function() {
            $('.btn-stop').addClass("hidden");
            $(".progress").addClass("hidden");
            $('.btn-go').show();
            $(".markup-span").show();
        }
    });
}

function loadGraph(item) {
    $("svg").html("");
    $(".responseDiv").css("display", "block");
    $(".entityTable").empty();
    var i = 0;
    var uniqNodes = {};
    var nodes = [];
    var paths = [];
    var probabilities = [];
    var origInputItems = [];
    item.result.intersections.relationship.forEach(function(item) {
        origInputItems = origInputItems.concat.apply(origInputItems, item.originalTerms);
        nodes = nodes.concat.apply(nodes, item.paths);
        paths.push(item.paths);
        probabilities.push(item.probabilities);
    });
    origInputItems = Array.from(new Set(origInputItems));
    var nodes = Array.from(new Set(nodes)).map(function(item) {
        if (!uniqNodes[item]) {
            $(".entityTable").append('<tr id=entity' + i + '><td>' + item + '</td></tr>');
        }
        uniqNodes[item] = i;
        return {
            name: item,
            shortName: item.length < 15 ? item : (item.substring(0, Math.min(15, item.length)) + "..."),
            group: i++
        };
    });
    $("#entitiesFoundHeader").text("Entities Found (" + nodes.length + ")");
    var relationships = item.result.intersections.relationship;
    console.log(item.result.intersections.relationship);
    var links = [];
    var group = 0;
    for (var k = 0; k < paths.length; k++) {
        for (var i = 0; i < paths[k].length; i++) {
            for (var j = 1; j < paths[k][i].length; j++) {
                links.push({
                    group: group++,
                    source: uniqNodes[paths[k][i][j - 1]],
                    target: uniqNodes[paths[k][i][j]],
                    probability: probabilities[k][i][j - 1],
                    reason: relationships[k].reasons[i][j - 1],
                    showReason: false
                });
            }
        }
    }
    /* setup */
    $("svg").show();
    var width = $("svg").width();
    var height = $(window).height();
    if (height > $(window).width()) {
        height = 350;
        $("svg").css("height", height + "px");
    }
    height -= 30;
    var svg = d3.select('svg');
    var g = svg.append('g') /*.attr('transform', 'translate(' + center + ')')*/ ;
    var g_links = g.append('g').attr('id', 'links');
    var g_nodes = g.append('g').attr('id', 'nodes');
    var g_texts = g.append('g').attr('id', 'texts');
    var node = g_nodes.selectAll('circle').data(nodes);
    node = node.enter().append('circle')
        .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged).on("end", dragended))
        .attr('r', 5).merge(node);
    var text = g_texts.selectAll('text').data(nodes);
    text = text.enter().append('text').merge(text);
    var link = g_links.selectAll('text').data(links);
    // build the arrow.
    g_links.append("svg:defs").selectAll("marker")
        .data(["end"])
        .enter().append("svg:marker")
        .attr("id", String)
        .attr("viewBox", "0 -10 20 20")
        .attr("refX", 30)
        .attr("refY", -1.5)
        .attr("markerUnits", "userSpaceOnUse")
        .attr("markerWidth", 12)
        .attr("markerHeight", 12)
        .attr("orient", "auto")
        .append("svg:path")
        .attr("d", "M0,-10L20,0L0,10").on('mousedown', function(dg) {
            //  console.log(dg);
        });
    // add the links and the arrows
    var path = g_links.append("svg:g").selectAll("path")
        .data(links)
        .enter().append("svg:path")
        .attr("class", "link")
        .attr("marker-mid", "url(#end)").attr("fill", "red")
        .on('mousedown', function(dg) {
            var link = links.filter(function(d) {
                return d.group == dg.group;
            });
            var dg = path.filter(function(d) {
                return d.group == dg.group;
            });
            if (dg.attr("selected") == null) {
                $("#selectedPathDetails").hide();
                $(".pathsTable").show();
                path
                    .attr('selected', null)
                    .attr("style", "stroke: rgba(41, 164, 104, 0.5);");
                dg.attr('selected', true);
                dg.attr("style", "stroke: rgba(109, 0, 255, 0.48);");
                $(".entityTable").find("tr").removeClass("selected");
                console.log(link[0]);
                $("#pathProbability").text(Math.round(link[0].probability * 1000) / 1000 + "%");
                $("#pathReason").html(link[0].reason);
                $("#entity" + uniqNodes[link[0].source.name]).addClass("selected");
                $("#entity" + uniqNodes[link[0].target.name]).addClass("selected");
                $("#selectedPathHeader").html("<span class='text-uppercase'>" + link[0].source.name +
                    "</span> to <br\><span class='text-uppercase'>" + link[0].target.name + "</span>");
            } else {
                $("#selectedPathDetails").show();
                $("#selectedPathHeader").html("");
                $(".pathsTable").hide();
                $(".entityTable").find("tr").removeClass("selected");
                path
                    .attr('selected', null)
                    .attr("style", "stroke: rgba(41, 164, 104, 0.5);");
            }
        });
    var simulation = d3.forceSimulation(nodes)
        .alphaDecay(0.01)
        .force('charge', d3.forceManyBody().strength(-500))
        .force('link', d3.forceLink(links).distance(function(d) {
            return 100;
        }))
        .force('centerX', d3.forceX([width / 2]))
        .force('centerY', d3.forceY([height / 2]))
        .on('tick', update);

    function update() {
        node.attr('cx', function(d) {
            return d.x = Math.max(50, Math.min(width - 50, d.x));
        }).attr('cy', function(d) {
            return d.y = Math.max(50, Math.min(height - 50, d.y));
        }).attr("style", function(d) {
            if (origInputItems.indexOf(d.name) >= 0) {
                return "fill: rgba(41, 164, 104, 0.5);r: 10; stroke: rgb(12, 152, 84); stroke-width: 5px;"
            }
            return "fill: rgba(41, 164, 104, 0.5);";
        });
        text.attr('x', function(d) {
            return d.x - (getTextWidth(d.shortName, "Gotham-Light 14px") / (4 / 3));
        }).attr('y', function(d) {
            return d.y - 10;
        }).text(function(d) {
            return d.shortName;
        });
        link.attr('x1', function(d) {
            return d.source.x;
        }).attr('y1', function(d) {
            return d.source.y;
        }).attr('x2', function(d) {
            return d.target.x;
        }).attr('y2', function(d) {
            return d.target.y;
        });
        path.attr("d", function(d) {
            var dx = d.target.x - d.source.x,
                dy = d.target.y - d.source.y,
                dr = Math.sqrt(dx * dx + dy * dy);
            return "M" +
                d.source.x + "," +
                d.source.y + "A" +
                dr + "," + dr + " 0 0,1 " +
                d.target.x + "," +
                d.target.y;
        });
    }

    function getTextWidth(text, font) {
        // re-use canvas object for better performance
        var canvas = getTextWidth.canvas || (getTextWidth.canvas = document.createElement("canvas"));
        var context = canvas.getContext("2d");
        context.font = font;
        var metrics = context.measureText(text);
        return metrics.width;
    }

    function dragstarted(d) {
        if (!d3.event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x, d.fy = d.y;
    }

    function dragged(d) {
        d.fx = d3.event.x, d.fy = d3.event.y;
    }

    function dragended(d) {
        if (!d3.event.active) simulation.alphaTarget(0);
        d.fx = null, d.fy = null;
    }
}
