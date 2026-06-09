// Movement intents for a Swarm. A controller's job each tick: set swarm.dest and swarm.wantCond.
// Swappable at runtime — that is how a human "replaces a bot" in a slot.
import { TAU, WORLD, INPUT_REACH } from './constants.js';
import { rnd, d2 } from './util.js';

// ---------------------------------------------------------------------------
// Human player: drives the swarm from a network-supplied target offset.
// ---------------------------------------------------------------------------
export class PlayerController {
  constructor(player) {
    this.isBot = false;
    this.player = player;          // owning network Player (may be null in tests)
    this.input = { ox: 0, oy: 0, cond: false };
    this.spawnedAt = Date.now();
  }

  setInput(ox, oy, cond) {
    // clamp the commanded offset so a client can't target arbitrarily far away
    const m = Math.hypot(ox, oy);
    if (m > INPUT_REACH) { ox = ox / m * INPUT_REACH; oy = oy / m * INPUT_REACH; }
    this.input.ox = ox; this.input.oy = oy; this.input.cond = !!cond;
  }

  command(s) {
    s.dest = { x: s.cx + this.input.ox, y: s.cy + this.input.oy };
    s.wantCond = this.input.cond;
  }
}

// ---------------------------------------------------------------------------
// Bot brain: farm pollen when calm, flee the strong, dive on the weak.
// ---------------------------------------------------------------------------
export class BotController {
  constructor() {
    this.isBot = true;
    this.brainT = 0;
    this.mode = 'farm';            // farm | flee | hunt
    this.prey = null;
    this.temper = Math.random();   // 0 coward .. 1 berserk
  }

  command(s, dt) {
    this._think(s, dt);
  }

  _think(s, dt) {
    this.brainT -= dt;
    if (this.brainT > 0) return;
    this.brainT = rnd(0.18, 0.32);
    const n = s.units.length;
    const world = s.world;

    // sense neighbours
    let threat = null, threatD = 1e18, prey = null, preyD = 1e18;
    for (const o of world.swarms) {
      if (o === s || o.dead) continue;
      const dd = d2(s.cx, s.cy, o.cx, o.cy);
      const ratio = o.units.length / Math.max(1, n);
      if (ratio > 1.15 && o.cond && dd < 700 * 700 && dd < threatD) { threat = o; threatD = dd; }
      if (ratio < 0.8 && o.guard <= 0 && dd < 800 * 800 && dd < preyD) { prey = o; preyD = dd; }
    }

    const m = Math.hypot(s.cx, s.cy);

    if (threat && (this.temper < 0.85 || threat.units.length > n * 2)) {
      this.mode = 'flee';
      const ang = Math.atan2(s.cy - threat.cy, s.cx - threat.cx) + rnd(-0.4, 0.4);
      let fx = s.cx + Math.cos(ang) * 600, fy = s.cy + Math.sin(ang) * 600;
      if (Math.hypot(fx, fy) > WORLD - 200) {       // don't flee into the wall
        const toC = Math.atan2(-s.cy, -s.cx);
        fx = s.cx + Math.cos(toC + 1.1) * 600; fy = s.cy + Math.sin(toC + 1.1) * 600;
      }
      s.dest = { x: fx, y: fy };
      s.wantCond = s.energy > 0.25;
      return;
    }

    const wantHunt = prey && s.energy > 0.55 && n > 22 && Math.random() < 0.3 + this.temper * 0.6;
    if (this.mode === 'hunt' && this.prey && !this.prey.dead && s.energy > 0.12) {
      const p = this.prey;
      s.dest = { x: p.cx, y: p.cy };
      s.wantCond = d2(s.cx, s.cy, p.cx, p.cy) < 520 * 520;
      if (p.units.length > s.units.length * 1.1) { this.mode = 'farm'; this.prey = null; s.wantCond = false; }
      return;
    }
    if (wantHunt) {
      this.mode = 'hunt'; this.prey = prey;
      s.dest = { x: prey.cx, y: prey.cy };
      s.wantCond = d2(s.cx, s.cy, prey.cx, prey.cy) < 520 * 520;
      return;
    }

    // farm: head to nearest pollen, peel off the wall
    this.mode = 'farm'; s.wantCond = false; this.prey = null;
    if (m > WORLD - 320) { s.dest = { x: s.cx * -0.2, y: s.cy * -0.2 }; return; }
    let best = null, bd = 1e18;
    for (let i = 0; i < world.foods.length; i += 3) {
      const f = world.foods[i];
      const dd = d2(s.cx, s.cy, f.x, f.y);
      if (dd < bd) { bd = dd; best = f; }
    }
    s.dest = best ? { x: best.x, y: best.y } : { x: rnd(-1, 1) * WORLD * 0.5, y: rnd(-1, 1) * WORLD * 0.5 };
  }
}
