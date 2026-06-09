// Sim + lobby slot/redirect logic (no sockets).
import { LobbyManager } from '../src/server/LobbyManager.js';
import { SLOTS_PER_LOBBY } from '../src/shared/constants.js';

const mgr = new LobbyManager();
const dt = 1 / 30;
const mkPlayer = (id) => ({
  id, name: 'p' + id, lobby: null, swarm: null, alive: true,
  send() {}, sendStr() {}, welcome() {}, assign() {},
  died(by, byName, stats) { this.deathStats = stats; },
});
const step = n => { for (let i = 0; i < n; i++) mgr.step(dt); };

const l0 = mgr.lobbies[0];
console.assert(mgr.lobbies.length === 1, 'one lobby at boot');
console.assert(l0.world.swarms.length === SLOTS_PER_LOBBY, 'bots fill lobby');
console.assert(l0.humanCount === 0, 'no humans yet');

const players = [];
for (let i = 0; i < SLOTS_PER_LOBBY; i++) {
  const p = mkPlayer(i); mgr.assignSpectator(p);
  const r = mgr.claim(p, p.name);
  console.assert(r.swarm, `player ${i} got a swarm`);
  players.push(p);
}
console.assert(mgr.lobbies.length === 1, 'still one lobby');
console.assert(l0.humanCount === SLOTS_PER_LOBBY, 'lobby full of humans');
console.assert(!l0.hasFreeSlot(), 'no free slot when full');

const overflow = mkPlayer(99); mgr.assignSpectator(overflow);
const r = mgr.claim(overflow, overflow.name);
console.assert(mgr.lobbies.length === 2, 'overflow opened a 2nd lobby');
console.assert(r.lobby !== l0, 'overflow player in different lobby');
console.assert(r.swarm, 'overflow player got a swarm');

step(300);
for (const l of mgr.lobbies) {
  console.assert(l.world.swarms.length + l.respawns.length === SLOTS_PER_LOBBY, `invariant lobby ${l.id}`);
}

mgr.remove(overflow);
step(2);
console.assert(mgr.lobbies.length === 1, 'empty overflow lobby reaped');

const victim = players[0];
victim.swarm.units.length = 0;
victim.swarm.world.killSwarm(victim.swarm);
step(1);
console.assert(victim.swarm === null, 'dead player reverts to spectator');
console.assert(victim.deathStats, 'dead player received stats');
console.assert(l0.humanCount === SLOTS_PER_LOBBY - 1, 'one human gone after death');

console.log('lobby.test OK');
