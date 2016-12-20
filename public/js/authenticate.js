window.fbAsyncInit = function () {
    FB.init({ appId: '1893670000921517', xfbml: true, version: 'v2.7' });
    FB.getLoginStatus(function (response) {
        if (response.status === 'connected') {
            console.log('Logged in.');
            loadUserPage();
        } else {
            login();
        }
    });
};

(function (d, s, id) {
    var js,
        fjs = d.getElementsByTagName(s)[0];
    if (d.getElementById(id)) {
        return;
    }
    js = d.createElement(s);
    js.id = id;
    js.src = "//connect.facebook.net/en_US/sdk.js";
    fjs.parentNode.insertBefore(js, fjs);
} (document, 'script', 'facebook-jssdk'));

function loadUserPage(){
    
}

function login() {
    FB.login(function (response) {
        // handle the response
        console.log("Login!");

        FB.api('/me', {fields: 'name'}, function(response) {
            console.log(response.name, response.id);
        });

        FB.api('/me', {edge: 'picture'}, function(response) {
            console.log("Picture: " + response);
        });

    }, { scope: 'read_custom_friendlists' });
}

function logout() {
    FB.logout(function (response) {
        // user is now logged out
    });
}

function getFriendsList() {
    FB.api('/me/friendlists', function (response) {
        if (response && !response.error) {
            console.log(JSON.stringify(response))
        }
    });
}