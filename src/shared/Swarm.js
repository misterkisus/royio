// A swarm: a cloud of Units sharing one mind. Movement intent comes from a Controller
// (BotController or PlayerController) so the same Swarm works for AI and humans alike.
import { TAU, WORLD, START_UNITS, MIN_UNITS, UNIT_CAP } from './constants.js';
import { rnd } from './util.js';
import { Unit } from './Unit.js';

export class Swarm {
  constructor(world, { name, hue }) {
    this.world = world;
    this.id = world.nextId++;
    this.name = name;
    this.hue = hue;
    this.controller = null;      // assigned by the World/Lobby

    const a = rnd(0, TAU), rr = Math.sqrt(Math.random()) * (WORLD * 0.72);
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    this.tx = x; this.ty = y;    // commanded target point
    this.cx = x; this.cy = y;    // centroid (derived)
    this.dest = { x, y };        // where the controller wants to go
    this.units = [];

    this.cond = false;           // currently condensed
    this.wantCond = false;       // controller's intent this tick
    this.energy = 1;
    this.kills = 0;
    this.peak = 0;
    this.dead = false;
    this.guard = 2.5;            // spawn protection (seconds)
    this.lastHitBy = null;
    this.lastHitT = 0;
  }

  get isBot() { return !!this.controller && this.controller.isBot; }
  get count() { return this.units.length; }
  radius() { return 30 + Math.sqrt(this.units.length) * 7.5; }

  populate(n = START_UNITS) {
    for (let i = 0; i < n; i++) {
      this.units.push(new Unit(this.tx + rnd(-40, 40), this.ty + rnd(-40, 40)));
    }
    this.peak = this.units.length;
  }

  addUnit(x, y, vx = rnd(-60, 60), vy = rnd(-60, 60)) {
    if (this.units.length >= UNIT_CAP) return null;
    const u = new Unit(x, y);
    u.vx = vx; u.vy = vy;
    this.units.push(u);
    return u;
  }

  update(dt) {
    if (this.dead) return;
    this.guard = Math.max(0, this.guard - dt);

    // intent
    this.controller?.command(this, dt);

    // energy economics: condensing burns fuel, spreading regenerates it
    if (this.wantCond && this.energy > 0.04) {
      this.cond = true;
      this.energy = Math.max(0, this.energy - 0.24 * dt);
      if (this.energy <= 0) this.cond = false;
    } else {
      this.cond = false;
      this.energy = Math.min(1, this.energy + 0.13 * dt);
    }

    // ease the command point toward the destination
    const spd = this.cond ? 330 : 215;
    let dx = this.dest.x - this.tx, dy = this.dest.y - this.ty;
    const dd = Math.hypot(dx, dy);
    if (dd > 2) {
      const k = Math.min(1, spd * dt / dd);
      this.tx += dx * k; this.ty += dy * k;
    }
    const tm = Math.hypot(this.tx, this.ty);
    if (tm > WORLD - 40) { this.tx *= (WORLD - 40) / tm; this.ty *= (WORLD - 40) / tm; }

    // formation physics + border attrition
    const baseR = this.radius();
    let sx = 0, sy = 0;
    for (const u of this.units) {
      u.step(this.tx, this.ty, this.cond, baseR, dt);
      if (u.burnedAtBorder()) { this.world.spark(u.x, u.y, 0, 1); continue; }
      sx += u.x; sy += u.y;
      u.hit = false;
    }
    for (let i = this.units.length - 1; i >= 0; i--) {
      if (this.units[i].dead) this.units.splice(i, 1);
    }
    if (this.units.length > 0) { this.cx = sx / this.units.length; this.cy = sy / this.units.length; }
    if (this.units.length > this.peak) this.peak = this.units.length;

    if (this.units.length < MIN_UNITS) this.world.killSwarm(this);
  }

  // compact dynamic state for a network snapshot
  snapshot() {
    return {
      id: this.id,
      x: Math.round(this.cx), y: Math.round(this.cy),
      tx: Math.round(this.tx), ty: Math.round(this.ty),
      n: this.units.length,
      c: this.cond ? 1 : 0,
      g: this.guard > 0 ? 1 : 0,
      e: Math.round(this.energy * 100),
    };
  }
}
