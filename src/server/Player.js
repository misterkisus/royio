// One connected client. Spectates a lobby until it claims a slot (a Swarm controlled by
// its PlayerController). On death/leave the slot reverts and the Player spectates again.
import { MSG } from '../shared/constants.js';

let SEQ = 1;

export class Player {
  constructor(ws) {
    this.id = SEQ++;
    this.ws = ws;
    this.name = 'рой';
    this.lobby = null;     // current Lobby (set by LobbyManager)
    this.swarm = null;     // controlled Swarm, or null while spectating
    this.alive = true;     // socket open
  }

  get spectating() { return !this.swarm; }

  send(obj) { this.sendStr(JSON.stringify(obj)); }

  // pre-serialised broadcasts (state/foods) reuse one string for the whole lobby
  sendStr(str) {
    if (this.ws.readyState === 1) {
      try { this.ws.send(str); } catch { /* socket dying; cleanup handles it */ }
    }
  }

  welcome(lobbyId)  { this.send({ type: MSG.WELCOME, lobbyId, selfId: null }); }
  assign(lobbyId, selfId) { this.send({ type: MSG.ASSIGN, lobbyId, selfId }); }
  died(by, byName, stats) { this.send({ type: MSG.DIED, by, byName, stats }); }
}
