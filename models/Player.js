SCHEMA_VERSION = 1;

/*
	ID
	name
	gamesWon
	gamesLost

*/
function Player(fbid, name, isOffline, offlinePic) {
  if(!fbid || !name) throw "Illegal arguments while making a player.";
  this.fbid =  fbid;
  this.name = name;
  this.gamesWon = 0;
  this.gamesLost = 0;
  this.isOffline = !!isOffline;
  this.offlinePic = offlinePic;
}

module.exports = {
  name: "ConnectWhatPlayer",
  constructor: Player
}