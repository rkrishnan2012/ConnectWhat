var socket;

function needsLogin() {
    window.location = "/";
}

function loadUserPage() {
    getFbProPicUrl("me", function(url) {
        animateCircle('circle1', url);
    });

    socket = io('/');

    socket.on('connect', function() {
        socket.emit('join', {
            fbtoken: getCookie("fbtoken")
        });
    });

    socket.on('game', function(game) {
        console.log(game);
        $(".inviteLink").text(game.gameUrl);

        if (game.players.length > 1) {
            getFbProPicUrl("me", function(url) {
                animateCircle('circle2', url);
                setTimeout(readyToStart, 2000);
            });
        }
    });

    socket.on('start', function(game) {
        
    });

    socket.on('disconnect', function() {});
}

function readyToStart() {
    $(".gameStatus").text("Ready to start!");
    $(".gameStatus").removeClass("waiting");
    $(".gameStatus").addClass("ready");

    $(".gameStatus").click(function() {
        socket.emit('ready', {
            fbtoken: getCookie("fbtoken")
        });
        $(".gameStatus").prop('onclick', null).off('click');
        $(".gameStatus").text("Waiting on opponent");
        $(".gameStatus").removeClass("ready");
        $(".gameStatus").addClass("waiting");
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
        'stroke-dashoffset 2s ease-in-out';
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
    pattern.setAttribute("id", "img1");
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
    document.querySelector('.' + svgClassName + ' path').setAttribute("fill", "url(#img1)");
}

function getFbProPicUrl(id, callback) {
    FB.api('/' + id, {
        fields: 'name'
    }, function(response) {
        callback("https://graph.facebook.com/" + response.id + "/picture?type=large&w‌​idth=500&height=500");
    });
}