function needsLogin() {
    window.location = "/";
}

function loadUserPage() {
	getFbProPicUrl("me", function(url) {
		$(".circle1").css("background-image", "url('" + url + "')");
	})
    
    $.ajax({
        url: "/api/v1/game",
        type: "POST",
        data: JSON.stringify({
            "fbtoken": fb.authResponse.accessToken
        }),
        contentType: 'application/json',
        success: function(res) {
            $(".inviteLink").text(res.gameUrl);
            if(res.players.length > 1) {
            	getFbProPicUrl("me", function(url) {
					$(".circle2").css("background-image", "url('" + url + "')");
				});
            }
        }
    });
}

function getFbProPicUrl(id, callback) {
    FB.api('/' + id, {
        fields: 'name'
    }, function(response) {
        callback("https://graph.facebook.com/" + response.id + "/picture?type=large&w‌​idth=500&height=500");
    });
}