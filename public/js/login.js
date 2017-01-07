function loadUserPage() {
    $(".loginStuff").hide("slow");

    setTimeout(function() {
        if(qs("joinId")) {
            window.location = "/join/" + qs("joinId");
        } else {
            window.location = "/playerRoom.html";
        }
    }, 500);

    FB.api('/me', {
        fields: 'name'
    }, function(response) {
        console.log(response.name, response.id);
    });

    FB.api('/me', {
        edge: 'picture'
    }, function(response) {
        console.log("Picture: " + JSON.stringify(response));
    });
}

function needsLogin() {
    $(".loginStuff").show("slow");
}

function login() {
    FB.login(function(response) {
        loadUserPage();
    }, {
        scope: 'read_custom_friendlists'
    });
}

function logout() {
    FB.logout(function(response) {
        // user is now logged out
    });
}

function getFriendsList() {
    FB.api('/me/friendlists', function(response) {
        if (response && !response.error) {
            console.log(JSON.stringify(response))
        }
    });
}

qs = function(key) {
    key = key.replace(/[*+?^$.\[\]{}()|\\\/]/g, "\\$&"); // escape RegEx meta chars
    var match = location.search.match(new RegExp("[?&]" + key + "=([^&]+)(&|$)"));
    return match && decodeURIComponent(match[1].replace(/\+/g, " "));
}