SCHEMA_VERSION = 1;

/*
	ID
  players - an array of
  
*/
function Game(ownerPlayerId, shortId) {
  this.shortId = shortId;
  this.players = [ownerPlayerId];
  this.startDate = new Date();
  this.endDate = null;
  this.scores = [];
}

module.exports = {
  name: "ConnectWhatGame",
  constructor: Game
}