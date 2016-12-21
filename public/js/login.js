function loadUserPage() {
    $(".loginStuff").hide("slow");
    setTimeout(function() {
    	window.location = "/playeRroom.html";
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
