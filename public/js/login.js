var socket;

$(document).ready(function() {
    pg = particleground(document.getElementById('dotsBkg'), {
        dotColor: 'rgba(41, 164, 104, 0.10)',
        lineColor: 'rgba(41, 164, 104, 0.05)'
    });
});

function loadUserPage() {
    $(".loginStuff").hide("slow");
    $(".connectWhatTitle").removeClass("middle");
    setTimeout(function() {
        if (qs("joinId")) {
            window.location = "/join/" + qs("joinId");
        } else {
            loadGamesList();
        }
    }, 500);
}

function needsLogin() {
    $(".loginStuff").css("display", "inline-block");
    socket = io('/');
    $(".inviteButton").click(function() {
        var oldText = $(".inviteText").val();
        if (oldText && oldText != "") {
            $(".inviteText").val("");
            socket.on("offlineAuth", function(data) {
                if (data) {
                    document.cookie = "fbtoken=" + oldText;
                    document.cookie = "fbid=" + oldText;
                    document.cookie = "fbname=" + data.name;
                    document.cookie = "offlineAuth=" + oldText;
                    window.location = "/";
                }
            });
            socket.emit('offlineAuth', {
                inviteCode: oldText
            });
        }
    });
}

function login() {
    FB.login(function(fb) {
        document.cookie = "fbtoken=" + fb.authResponse.accessToken;
        document.cookie = "fbid=" + fb.authResponse.userID;
        FB.api('/me', {
            fields: 'name'
        }, function(response) {
            document.cookie = "fbname=" + response.name;
            loadUserPage();
        });
    }, {
        scope: 'read_custom_friendlists'
    });
}

function logout(callback) {
    document.cookie.split(";").forEach(function(c) {
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
    FB.logout(function(response) {
        callback();
    });
}

function getFriendsList() {
    FB.api('/me/friendlists', function(response) {
        if (response && !response.error) {
            console.log(JSON.stringify(response))
        }
    });
}