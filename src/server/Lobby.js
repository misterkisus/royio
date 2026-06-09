// One arena instance. Always holds SLOTS_PER_LOBBY swarms (humans + bots). A human "joins"
// by converting a bot slot into a fresh player swarm; on death/leave the slot reverts to a bot.
// Invariant: liveSwarms + pendingBotRespawns === SLOTS_PER_LOBBY (so the arena is always full).
import { SLOTS_PER_LOBBY, START_UNITS, BOT_RESPAWN_MS, MSG } from '../shared/constants.js';
import { rnd } from '../shared/util.js';
import { pickName, pickHue, PLAYER_HUE } from '../shared/names.js';
import { Swarm } from '../shared/Swarm.js';
import { World } from '../shared/World.js';
import { BotController, PlayerController } from '../shared/controllers.js';

export class Lobby {
  constructor(id) {
    this.id = id;
    this.world = new World();
    this.players = new Set();      // every connected client viewing this lobby (incl. spectators)
    this.respawns = [];            // [{at}] pending bot refills
    this.pendingFx = [];
    this.pendingFeed = [];
    this.rosterDirty = true;
    for (let i = 0; i < SLOTS_PER_LOBBY; i++) this._spawnBot();
  }

  // ---- slot accounting ----
  get humanCount() {
    let n = 0;
    for (const s of this.world.swarms) if (!s.dead && !s.isBot) n++;
    return n;
  }
  hasFreeSlot() { return this.humanCount < SLOTS_PER_LOBBY; }
  isEmpty() { return this.players.size === 0; }

  // ---- spawning ----
  _spawnBot() {
    const s = new Swarm(this.world, { name: pickName(), hue: pickHue() });
    s.controller = new BotController();
    s.populate(rnd(20, 110) | 0);
    this.world.addSwarm(s);
    this.rosterDirty = true;
    return s;
  }

  _spawnPlayer(player, name) {
    const s = new Swarm(this.world, { name, hue: PLAYER_HUE });
    const ctrl = new PlayerController(player);
    s.controller = ctrl;
    s.populate(START_UNITS);
    this.world.addSwarm(s);
    player.swarm = s;
    this.rosterDirty = true;
    return s;
  }

  // ---- players ----
  addSpectator(player) {
    this.players.add(player);
    player.lobby = this;
  }

  // Turn a bot (or a queued bot slot) into this player's fresh swarm. Returns the swarm or null if full.
  claim(player, name) {
    let bot = this.world.swarms.find(s => !s.dead && s.isBot);
    if (bot) {
      this.world.removeSwarm(bot);            // swap the bot out (no pollen burst — clean handover)
    } else if (this.respawns.length > 0) {
      this.respawns.pop();                    // consume a pending bot slot instead
    } else {
      return null;                            // genuinely full: all slots are humans
    }
    return this._spawnPlayer(player, name);
  }

  // Player gives up its slot but keeps watching (menu / death screen).
  releaseSlot(player) {
    if (!player.swarm) return;
    this.world.removeSwarm(player.swarm);
    player.swarm = null;
    this.respawns.push({ at: Date.now() + BOT_RESPAWN_MS });
    this.rosterDirty = true;
  }

  // Full disconnect.
  removePlayer(player) {
    this.releaseSlot(player);
    this.players.delete(player);
  }

  // ---- simulation ----
  step(dt) {
    this.world.step(dt);
    const ev = this.world.drainEvents();
    if (ev.fx.length) this.pendingFx.push(...ev.fx);
    if (ev.feed.length) this.pendingFeed.push(...ev.feed);
    if (ev.deaths.length) this._handleDeaths(ev.deaths);
    this._processRespawns();
  }

  _handleDeaths(deaths) {
    for (const { swarm, killer } of deaths) {
      const ctrl = swarm.controller;
      if (ctrl && !ctrl.isBot && ctrl.player) {
        const p = ctrl.player;
        const stats = {
          peak: swarm.peak,
          kills: swarm.kills,
          time: Math.floor((Date.now() - ctrl.spawnedAt) / 1000),
        };
        p.died(killer ? killer.id : null, killer ? killer.name : null, stats);
        p.swarm = null;
      }
      this.world.removeSwarm(swarm);
      this.respawns.push({ at: Date.now() + BOT_RESPAWN_MS });
      this.rosterDirty = true;
    }
  }

  _processRespawns() {
    if (!this.respawns.length) return;
    const now = Date.now();
    for (let i = this.respawns.length - 1; i >= 0; i--) {
      if (this.respawns[i].at <= now) {
        this.respawns.splice(i, 1);
        this._spawnBot();
      }
    }
  }

  // ---- serialisation ----
  roster() {
    return {
      type: MSG.ROSTER,
      swarms: this.world.swarms
        .filter(s => !s.dead)
        .map(s => ({ id: s.id, name: s.name, hue: s.hue, bot: s.isBot })),
    };
  }

  state() {
    const swarms = [];
    for (const s of this.world.swarms) if (!s.dead) swarms.push(s.snapshot());
    const msg = {
      type: MSG.STATE,
      t: Math.round(this.world.t * 1000),
      swarms,
      fx: this.pendingFx,
      feed: this.pendingFeed,
    };
    this.pendingFx = [];
    this.pendingFeed = [];
    return msg;
  }

  foods() {
    const f = [];
    for (const o of this.world.foods) { f.push(Math.round(o.x), Math.round(o.y), Math.round(o.hue)); }
    return { type: MSG.FOODS, f };
  }
}
