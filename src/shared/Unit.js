// A single mite. Orbits its swarm's command point; the cloud of units *is* the swarm.
// Same integration runs server-side (authoritative, drives food/combat) and client-side
// (purely cosmetic cloud around the interpolated centroid) — identical look, no shared state.
import { TAU, WORLD } from './constants.js';
import { rnd } from './util.js';

export class Unit {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.vx = rnd(-20, 20); this.vy = rnd(-20, 20);
    this.oa = rnd(0, TAU);                 // orbit angle
    this.or = Math.random();               // orbit radius factor
    this.os = rnd(0.4, 1.4) * (Math.random() < 0.5 ? -1 : 1); // orbit speed
    this.hit = false;
    this.dead = false;
  }

  // Integrate one step toward the formation point (tx,ty).
  // cond = condensed (tight comet), baseR = formation radius.
  step(tx, ty, cond, baseR, dt) {
    this.oa += this.os * dt * (cond ? 2.2 : 1);
    const spreadK = cond ? 0.16 : 1;
    const fr = (8 + this.or * baseR) * spreadK;
    const fx = tx + Math.cos(this.oa) * fr;
    const fy = ty + Math.sin(this.oa) * fr;
    const stiff = cond ? 10 : 5.5;
    this.vx += (fx - this.x) * stiff * dt * 60 * 0.16;
    this.vy += (fy - this.y) * stiff * dt * 60 * 0.16;
    const damp = Math.pow(cond ? 0.86 : 0.90, dt * 60);
    this.vx *= damp; this.vy *= damp;
    this.x += this.vx * dt; this.y += this.vy * dt;
  }

  // World boundary is lethal (server gameplay). Returns true if it just died.
  burnedAtBorder() {
    if (Math.hypot(this.x, this.y) > WORLD) { this.dead = true; return true; }
    return false;
  }
}
