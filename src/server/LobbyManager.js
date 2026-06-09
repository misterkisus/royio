// Routes players to lobbies. Keeps one lobby alive at minimum; spawns more on overflow
// ("если слоты превышены — на другое лобби") and reaps empty extras.
import { Lobby } from './Lobby.js';

export class LobbyManager {
  constructor() {
    this.lobbies = [];
    this._seq = 1;
    this._create();   // the main lobby always exists
  }

  _create() {
    const lobby = new Lobby(this._seq++);
    this.lobbies.push(lobby);
    return lobby;
  }

  // Pick a lobby for a fresh connection to watch — prefer one it could actually join.
  assignSpectator(player) {
    const lobby = this.lobbies.find(l => l.hasFreeSlot()) || this._create();
    lobby.addSpectator(player);
    return lobby;
  }

  // Hand the player a slot. Tries its current lobby, then any other, then a brand-new one.
  // Returns { lobby, swarm }. Always succeeds.
  claim(player, name) {
    let lobby = player.lobby;
    if (!lobby || !lobby.hasFreeSlot()) {
      const target = this.lobbies.find(l => l.hasFreeSlot()) || this._create();
      if (target !== lobby) this._move(player, target);
      lobby = target;
    }
    const swarm = lobby.claim(player, name);
    return { lobby, swarm };
  }

  _move(player, target) {
    if (player.lobby) player.lobby.removePlayer(player);
    target.addSpectator(player);
  }

  remove(player) {
    const lobby = player.lobby;
    if (!lobby) return;
    lobby.removePlayer(player);
    player.lobby = null;
    // reap empty extra lobbies (keep at least one)
    if (lobby.isEmpty() && this.lobbies.length > 1) {
      const i = this.lobbies.indexOf(lobby);
      if (i >= 0) this.lobbies.splice(i, 1);
    }
  }

  step(dt) { for (const l of this.lobbies) l.step(dt); }
}
