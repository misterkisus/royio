// Authoritative arena simulation: swarms, pollen, combat, pickups.
// Headless — emits events (fx / feed / deaths) for a host (Lobby) to broadcast and react to.
// Respawn policy lives in the Lobby, not here.
import { TAU, WORLD, FOOD_TARGET, UNIT_CAP, MIN_UNITS } from './constants.js';
import { rnd, d2 } from './util.js';

const CELL = 26;

export class World {
  constructor() {
    this.nextId = 1;
    this.swarms = [];
    this.foods = [];        // {x,y,hue}
    this.t = 0;
    this._cluster = null;
    // event buffers, drained by the host each tick
    this.fxEvents = [];     // {x,y,h,n}
    this.feedEvents = [];   // {byId,byName,victimId,victimName}
    this.deaths = [];       // {swarm,killer}
    this.scatterFood(FOOD_TARGET);
  }

  addSwarm(s) { this.swarms.push(s); return s; }
  removeSwarm(s) {
    const i = this.swarms.indexOf(s);
    if (i >= 0) this.swarms.splice(i, 1);
  }

  // ---- pollen ----
  addFood(x, y, hue) {
    const a = Math.atan2(y, x), r = Math.hypot(x, y);
    if (r > WORLD - 20) { x = Math.cos(a) * (WORLD - 30); y = Math.sin(a) * (WORLD - 30); }
    this.foods.push({ x, y, hue: hue !== undefined ? hue : rnd(0, 360) });
  }
  scatterFood(n) {
    for (let i = 0; i < n; i++) {
      if (Math.random() < 0.5 || !this._cluster || Math.random() < 0.05) {
        const a = rnd(0, TAU), r = Math.sqrt(Math.random()) * (WORLD - 60);
        this._cluster = { x: Math.cos(a) * r, y: Math.sin(a) * r };
      }
      this.addFood(this._cluster.x + rnd(-160, 160), this._cluster.y + rnd(-160, 160));
    }
  }

  spark(x, y, hue, n) {
    if (this.fxEvents.length > 120) return;
    this.fxEvents.push({ x: Math.round(x), y: Math.round(y), h: Math.round(hue), n });
  }

  // ---- main tick ----
  step(dt) {
    this.t += dt;
    for (const s of this.swarms) s.update(dt);

    const hash = this._buildHash();
    this._combat(hash);
    this._pickup(hash);

    for (const s of this.swarms) {
      if (s.dead) continue;
      for (let i = s.units.length - 1; i >= 0; i--) if (s.units[i].dead) s.units.splice(i, 1);
      if (s.units.length < MIN_UNITS) this.killSwarm(s);
    }
    if (this.foods.length < FOOD_TARGET) this.scatterFood(Math.min(5, FOOD_TARGET - this.foods.length));
  }

  // pull and clear accumulated events
  drainEvents() {
    const ev = { fx: this.fxEvents, feed: this.feedEvents, deaths: this.deaths };
    this.fxEvents = []; this.feedEvents = []; this.deaths = [];
    return ev;
  }

  // ---- spatial hash + combat ----
  _buildHash() {
    const map = new Map();
    for (const s of this.swarms) {
      if (s.dead) continue;
      for (const u of s.units) {
        const key = ((u.x / CELL) | 0) + ',' + ((u.y / CELL) | 0);
        let arr = map.get(key);
        if (!arr) { arr = []; map.set(key, arr); }
        arr.push({ u, s });
      }
    }
    return map;
  }

  _combat(hash) {
    const R2 = 13 * 13;
    for (const [key, arr] of hash) {
      if (arr.length < 1) continue;
      const [kx, ky] = key.split(',').map(Number);
      for (const a of arr) {
        if (a.u.dead || a.u.hit || a.s.guard > 0) continue;
        let resolved = false;
        for (let ox = -1; ox <= 1 && !resolved; ox++) for (let oy = -1; oy <= 1 && !resolved; oy++) {
          const narr = hash.get((kx + ox) + ',' + (ky + oy));
          if (!narr) continue;
          for (const b of narr) {
            if (b.s === a.s || b.u.dead || b.u.hit || b.s.guard > 0) continue;
            if (d2(a.u.x, a.u.y, b.u.x, b.u.y) > R2) continue;
            this._resolve(a, b);
            resolved = true;
            break;
          }
        }
      }
    }
  }

  _resolve(a, b) {
    const ac = a.s.cond, bc = b.s.cond;
    a.u.hit = b.u.hit = true;
    const mark = (v, att) => { v.s.lastHitBy = att.s; v.s.lastHitT = this.t; };
    const drop = (u) => { if (Math.random() < 0.65) this.addFood(u.x + rnd(-5, 5), u.y + rnd(-5, 5)); };
    if (ac === bc) {                         // equal trade 1:1 — both fall to pollen
      a.u.dead = b.u.dead = true;
      mark(a, b); mark(b, a);
      drop(a.u); drop(b.u);
      this.spark((a.u.x + b.u.x) / 2, (a.u.y + b.u.y) / 2, (a.s.hue + b.s.hue) / 2, 2);
    } else {
      const c = ac ? a : b, sp = ac ? b : a;  // condensed beats spread
      sp.u.dead = true; mark(sp, c);
      if (Math.random() < 0.4 && c.s.units.length < UNIT_CAP) {
        const nu = c.s.addUnit(sp.u.x, sp.u.y, sp.u.vx, sp.u.vy);  // poach the mite
        if (nu) this.spark(sp.u.x, sp.u.y, c.s.hue, 3);
        else drop(sp.u);
      } else {
        drop(sp.u);
        this.spark(sp.u.x, sp.u.y, sp.s.hue, 2);
      }
      if (Math.random() < 0.3) { c.u.dead = true; mark(c, sp); drop(c.u); this.spark(c.u.x, c.u.y, c.s.hue, 1); }
    }
  }

  _pickup(hash) {
    const R2 = 15 * 15;
    for (let i = this.foods.length - 1; i >= 0; i--) {
      const f = this.foods[i];
      const kx = (f.x / CELL) | 0, ky = (f.y / CELL) | 0;
      let eater = null;
      outer:
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
        const arr = hash.get((kx + ox) + ',' + (ky + oy));
        if (!arr) continue;
        for (const e of arr) {
          if (e.u.dead) continue;
          if (d2(f.x, f.y, e.u.x, e.u.y) < R2) { eater = e.s; break outer; }
        }
      }
      if (eater) {
        this.foods.splice(i, 1);
        const nu = eater.addUnit(f.x, f.y, rnd(-60, 60), rnd(-60, 60));
        if (nu) this.spark(f.x, f.y, f.hue, 1);
      }
    }
  }

  killSwarm(s) {
    if (s.dead) return;
    s.dead = true;
    for (const u of s.units) if (Math.random() < 0.8) this.addFood(u.x + rnd(-8, 8), u.y + rnd(-8, 8), s.hue);
    for (let i = 0; i < 14; i++) this.addFood(s.cx + rnd(-60, 60), s.cy + rnd(-60, 60), s.hue);
    this.spark(s.cx, s.cy, s.hue, 26);

    const by = (this.t - s.lastHitT < 3) ? s.lastHitBy : null;
    if (by && !by.dead) { by.kills++; by.energy = 1; }   // finishing a swarm = full charge
    this.feedEvents.push({
      byId: by ? by.id : null, byName: by ? by.name : null,
      victimId: s.id, victimName: s.name,
    });
    this.deaths.push({ swarm: s, killer: by });
  }
}
