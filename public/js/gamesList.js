function loadGamesList() {
    $(".yourgames").show();
    $(".gamesList").show();
    $(".yourgames").text(getCookie("fbname") + "'s games");

    $(".createNewBtn").click(function() {
        window.location = "/new";
    });

    $.get("/api/v1/games", function(data) {
        console.log(data);
        for (var i = 0; i < data.length; i++) {
            var tr = $("<tr>");
            var link = (location.origin + "/join/" + data[i].shortId);
            tr.append(($("<td>").text(data[i].status)))
                .append(($("<td>").html(data[i].players.map(function(item) {
                    return item.name + "<br/>";
                }))))
                .append(($("<td>").html(data[i].scores.map(function(item) {
                    return item + "<br/>";
                }))))
                .append(($("<td>").html("<a href='" + link + "'>" + link + "</a>")));
            $(".gamesListTable tbody").append(tr);
        }
    });
}