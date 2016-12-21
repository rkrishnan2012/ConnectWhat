// A $( document ).ready() block.
$(document).ready(function() {
	$.ajax({
        url: "/api/v1/games",
        type: "GET",
        success: function(games) {
        	for (i = 0; i < games.length; i++) { 
                console.log(games[i]);
                
                //N/A below is where result should go
    			$("#tablefriendsname").append("<tr><td>" + games[i].players[1].name + "</td><td>" + games[i].status + "</td><td>" + "N/A" + "</td><td>" + games[i].scores[0] + "</td><td>" + games[i].gameUrl  + "</td></tr>");
    		}
        }
    });
});