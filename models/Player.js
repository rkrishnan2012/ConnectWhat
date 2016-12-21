SCHEMA_VERSION = 1;

/*
	ID
	name
	gamesWon
	gamesLost

*/
function addPlayer(id, name, gamesWon, gamesLost) {
  if(!id || !name || !gamesWon || !gamesLost) throw "Illegal arguments while making a player.";
  this._id =  id;
  this.name = name;
  this.gamesWon = gamesWon;
  this.gamesLost = gamesLost;

  console.log("Player has been created");
}

function addPlayerTest( name, id ){
  console.log("addPlayerTest: " + name + " ", + id);
}

module.exports = {
  name: "ConnectWhatPlayer",
  constructor: addPlayer
}