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
  this._paths = {};
  this._turn = [];
  this.scores = [];
  this.status = "pregame";
  this.words = [];
  this._lookups = [];
  this._explanations = [];
}

module.exports = {
  name: "ConnectWhatGame",
  constructor: Game
}