$(document).ready(function() {
    if (getCookie("offlineAuth") && getCookie("fbid")) {
        socket = io('/');
        socket.on("offlineAuth", function(data) {
            if (data) {
                var oldText = getCookie("fbid");
                document.cookie = "fbtoken=" + oldText;
                document.cookie = "fbid=" + oldText;
                document.cookie = "fbname=" + data.name;
                document.cookie = "offlineAuth=" + oldText;
                loadUserPage();
            } else {
                needsLogin();
            }
        });
        socket.emit('offlineAuth', {
            inviteCode: getCookie("fbid")
        });
        return;
    }
    $(".facebookSide").show();
    $.getScript("//connect.facebook.net/en_US/all.js", function(data, err, resp) {
        $(".facebookSide").show();
        var appId = location.origin.indexOf("localhost") >= 0 ? "1960388977582952" : "1893670000921517";
        window.fbAsyncInit = function() {
            FB.init({
                appId: appId,
                xfbml: true,
                version: 'v2.7'
            });
            FB.getLoginStatus(function(response) {
                fb = response;
                if (getCookie("offlineAuth")) {
                    loadUserPage();
                    return;
                }
                if (response.status === 'connected') {
                    document.cookie = "fbtoken=" + fb.authResponse.accessToken;
                    document.cookie = "fbid=" + fb.authResponse.userID;
                    FB.api('/me', {
                        fields: 'name'
                    }, function(response) {
                        document.cookie = "fbname=" + response.name;
                        loadUserPage();
                    });
                } else {
                    needsLogin();
                }
            });
        };
        (function(d, s, id) {
            var js,
                fjs = d.getElementsByTagName(s)[0];
            if (d.getElementById(id)) {
                return;
            }
            js = d.createElement(s);
            js.id = id;
            js.src = "//connect.facebook.net/en_US/sdk.js";
            fjs.parentNode.insertBefore(js, fjs);
        }(document, 'script', 'facebook-jssdk'));
    });
})
qs = function(key) {
    key = key.replace(/[*+?^$.\[\]{}()|\\\/]/g, "\\$&"); // escape RegEx meta chars
    var match = location.search.match(new RegExp("[?&]" + key + "=([^&]+)(&|$)"));
    return match && decodeURIComponent(match[1].replace(/\+/g, " "));
}
getCookie = function(name) {
    var value = "; " + document.cookie;
    var parts = value.split("; " + name + "=");
    if (parts.length == 2) return parts.pop().split(";").shift();
}