'use strict';

//var {addPlayer} = require('./models/Player.js');

window.fbAsyncInit = function () {
    FB.init({ appId: '1893670000921517', xfbml: true, version: 'v2.7' });
    FB.getLoginStatus(function (response) {
        if (response.status === 'connected') {
            console.log('Logged in.');
            loadExistingUserPage();
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

function isExistingUser(userId, userName){

}

function newUser(userID, userName){

    $.post('/game', {
        id: userID,
        name: userName
    },
    function(data, status){
        if(status === 'success')
        {
            console.log("Success: adding new user");
        } 
        else 
        {
            console.log("Failed: adding new user");
        }
    });
}

function login() {
    FB.login(function (response) {
        // handle the response
        console.log("Login!");

        FB.api('/me', {fields: 'name'}, function(response) {
            if( isExistingUser(response.id, response.name) ) {

            } else {
                newUser(response.id, response.name);
            }
        });
        
        

        FB.api('/me', {edge: 'picture'}, function(response) {
            console.log("Picture: " + response);
        });

        newUser(response.id, responsename);
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

function test() {
}