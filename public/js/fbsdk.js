function getCookie(name) {
  var value = "; " + document.cookie;
  var parts = value.split("; " + name + "=");
  if (parts.length == 2) return parts.pop().split(";").shift();
}

window.fbAsyncInit = function() {
    FB.init({
        appId: '1893670000921517',
        xfbml: true,
        version: 'v2.7'
    });
    FB.getLoginStatus(function(response) {
        fb = response;
        if (response.status === 'connected') {
            document.cookie = "fbtoken=" + fb.authResponse.accessToken;
            loadUserPage();
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