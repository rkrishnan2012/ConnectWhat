SCHEMA_VERSION = 1;

/*
	ID
	name
	gamesWon
	gamesLost

*/
function Player(id, name, gamesWon, gamesLost) {
  if(!id || !name || !gamesWon || !gamesLost) throw "Illegal arguments while making a player.";
  this._id =  id;
  this.name = name;
  this.gamesWon = gamesWon;
  this.gamesLost = gamesLost;
}

module.exports = {
  name: "ConnectWhatPlayer",
  constructor: Player
}