// Client-side view model. The server is authoritative over swarm centroids/counts/state;
// the client renders each swarm as a cosmetic cloud of Units chasing the *interpolated*
// centroid — visually identical to the original, at a fraction of the bandwidth.
import { TAU, RENDER_UNIT_CAP } from '../shared/constants.js';
import { clamp } from '../shared/util.js';
import { Unit } from '../shared/Unit.js';

class ClientSwarm {
  constructor(id) {
    this.id = id;
    this.name = '…';
    this.hue = 45;
    this.bot = true;
    this.n = 0;
    this.cond = false;
    this.guard = false;
    this.energy = 1;
    // render (interpolated) + target (latest from server)
    this.cx = 0; this.cy = 0; this.tx = 0; this.ty = 0;
    this.gcx = 0; this.gcy = 0; this.gtx = 0; this.gty = 0;
    this.units = [];
    this.ready = false;
  }

  radius() { return 30 + Math.sqrt(this.n) * 7.5; }

  applySnapshot(s) {
    this.gcx = s.x; this.gcy = s.y; this.gtx = s.tx; this.gty = s.ty;
    this.n = s.n; this.cond = !!s.c; this.guard = !!s.g; this.energy = s.e / 100;
    if (!this.ready) {            // snap into place on first sight
      this.cx = this.gcx; this.cy = this.gcy; this.tx = this.gtx; this.ty = this.gty;
      this.ready = true;
    }
  }

  update(dt) {
    const k = clamp(dt * 14, 0, 1);              // smooth 15Hz centroid updates
    this.cx += (this.gcx - this.cx) * k; this.cy += (this.gcy - this.cy) * k;
    this.tx += (this.gtx - this.tx) * k; this.ty += (this.gty - this.ty) * k;

    // match cosmetic dot count to the score, but cap how many we actually draw (FPS)
    const shown = Math.min(this.n, RENDER_UNIT_CAP);
    while (this.units.length < shown) {
      const a = Math.random() * TAU, r = Math.random() * this.radius();
      this.units.push(new Unit(this.tx + Math.cos(a) * r, this.ty + Math.sin(a) * r));
    }
    if (this.units.length > shown) this.units.length = shown;

    const baseR = this.radius();
    for (const u of this.units) u.step(this.tx, this.ty, this.cond, baseR, dt);
  }
}

export class ClientWorld {
  constructor() {
    this.swarms = new Map();
    this.foods = [];          // {x,y,hue,phase}
    this.particles = [];      // {x,y,vx,vy,life,max,hue}
    this.t = 0;
  }

  _ensure(id) {
    let s = this.swarms.get(id);
    if (!s) { s = new ClientSwarm(id); this.swarms.set(id, s); }
    return s;
  }

  setRoster(list) {
    for (const e of list) {
      const s = this._ensure(e.id);
      s.name = e.name; s.hue = e.hue; s.bot = e.bot;
    }
  }

  applyState(msg) {
    const live = new Set();
    for (const snap of msg.swarms) {
      live.add(snap.id);
      this._ensure(snap.id).applySnapshot(snap);
    }
    for (const id of this.swarms.keys()) if (!live.has(id)) this.swarms.delete(id);
    if (msg.fx) for (const f of msg.fx) this.spark(f.x, f.y, f.h, f.n);
  }

  setFoods(flat) {
    const arr = [];
    for (let i = 0; i + 2 < flat.length; i += 3) {
      const x = flat[i], y = flat[i + 1], hue = flat[i + 2];
      arr.push({ x, y, hue, phase: ((x * 0.7 + y * 1.3) % TAU + TAU) % TAU });
    }
    this.foods = arr;
  }

  spark(x, y, hue, n) {
    if (this.particles.length > 600) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, sp = 30 + Math.random() * 160;
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.25 + Math.random() * 0.35, max: 0.6, hue });
    }
  }

  update(dt) {
    this.t += dt;
    for (const s of this.swarms.values()) s.update(dt);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const q = this.particles[i];
      q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.92; q.vy *= 0.92; q.life -= dt;
      if (q.life <= 0) this.particles.splice(i, 1);
    }
  }

  // leaderboard: live swarms by size desc
  ranking() {
    return [...this.swarms.values()].sort((a, b) => b.n - a.n);
  }
}
