// Canvas renderer for the arena + minimap. Reads the ClientWorld view model and a Camera.
import { TAU, WORLD } from '../shared/constants.js';
import { clamp } from '../shared/util.js';

export class Renderer {
  constructor(canvas, minimap) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.mm = minimap;
    this.mmCtx = minimap.getContext('2d');
    this.W = 0; this.H = 0; this.DPR = 1;
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  resize() {
    this.DPR = Math.min(window.devicePixelRatio || 1, 1.75);
    this.W = innerWidth; this.H = innerHeight;
    this.cv.width = this.W * this.DPR; this.cv.height = this.H * this.DPR;
    this.ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);
  }

  render(world, cam, selfId) {
    const { ctx, W, H } = this;
    const z = cam.z;
    const w2sX = x => (x - cam.x) * z + W / 2;
    const w2sY = y => (y - cam.y) * z + H / 2;

    ctx.fillStyle = '#070710';
    ctx.fillRect(0, 0, W, H);

    // grid
    const grid = 110 * z;
    ctx.strokeStyle = 'rgba(128,137,179,0.07)';
    ctx.lineWidth = 1;
    const ox = (-cam.x * z + W / 2) % grid, oy = (-cam.y * z + H / 2) % grid;
    ctx.beginPath();
    for (let x = ox; x < W; x += grid) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let y = oy; y < H; y += grid) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();

    // border
    ctx.strokeStyle = 'rgba(255,77,109,0.85)';
    ctx.lineWidth = 6 * z;
    ctx.beginPath(); ctx.arc(w2sX(0), w2sY(0), WORLD * z, 0, TAU); ctx.stroke();

    const pad = 60 / z;
    const vx0 = cam.x - (W / 2) / z - pad, vx1 = cam.x + (W / 2) / z + pad;
    const vy0 = cam.y - (H / 2) / z - pad, vy1 = cam.y + (H / 2) / z + pad;

    ctx.globalCompositeOperation = 'lighter';

    // pollen
    for (const f of world.foods) {
      if (f.x < vx0 || f.x > vx1 || f.y < vy0 || f.y > vy1) continue;
      const tw = 0.6 + Math.sin(world.t * 3 + f.phase) * 0.4;
      ctx.fillStyle = `hsla(${f.hue},90%,65%,${0.5 * tw})`;
      ctx.beginPath(); ctx.arc(w2sX(f.x), w2sY(f.y), 3.6 * z, 0, TAU); ctx.fill();
      ctx.fillStyle = `hsla(${f.hue},90%,80%,${0.9 * tw})`;
      ctx.beginPath(); ctx.arc(w2sX(f.x), w2sY(f.y), 1.6 * z, 0, TAU); ctx.fill();
    }

    // swarms
    for (const s of world.swarms.values()) {
      if (!s.ready) continue;
      if (s.cx < vx0 - 500 || s.cx > vx1 + 500 || s.cy < vy0 - 500 || s.cy > vy1 + 500) continue;
      const alpha = s.guard ? 0.45 : 1;
      const ur = (s.cond ? 2.6 : 2.1) * z;
      ctx.fillStyle = `hsla(${s.hue},95%,60%,${0.16 * alpha})`;
      for (const u of s.units) {
        if (u.x < vx0 || u.x > vx1 || u.y < vy0 || u.y > vy1) continue;
        ctx.beginPath(); ctx.arc(w2sX(u.x), w2sY(u.y), ur * 3, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = `hsla(${s.hue},95%,${s.cond ? 75 : 65}%,${0.95 * alpha})`;
      for (const u of s.units) {
        if (u.x < vx0 || u.x > vx1 || u.y < vy0 || u.y > vy1) continue;
        ctx.beginPath(); ctx.arc(w2sX(u.x), w2sY(u.y), ur, 0, TAU); ctx.fill();
      }
    }

    // particles
    for (const q of world.particles) {
      ctx.fillStyle = `hsla(${q.hue},95%,75%,${clamp(q.life / q.max, 0, 1)})`;
      ctx.beginPath(); ctx.arc(w2sX(q.x), w2sY(q.y), 2.6 * z, 0, TAU); ctx.fill();
    }

    ctx.globalCompositeOperation = 'source-over';

    // names + counts
    ctx.textAlign = 'center';
    for (const s of world.swarms.values()) {
      if (!s.ready) continue;
      if (s.cx < vx0 || s.cx > vx1 || s.cy < vy0 || s.cy > vy1) continue;
      const r = s.radius() * (s.cond ? 0.3 : 1) * z;
      ctx.fillStyle = s.id === selfId ? 'rgba(255,195,77,.95)' : 'rgba(240,242,255,.85)';
      ctx.font = `${Math.max(10, 12 * z)}px Verdana`;
      ctx.fillText(`${s.name} · ${s.n}`, w2sX(s.cx), w2sY(s.cy) - r - 10);
    }
  }

  renderMinimap(world, selfId) {
    const S = 118, c = S / 2, k = c / WORLD * 0.92, ctx = this.mmCtx;
    ctx.clearRect(0, 0, S, S);
    ctx.strokeStyle = 'rgba(255,77,109,.6)';
    ctx.beginPath(); ctx.arc(c, c, WORLD * k, 0, TAU); ctx.stroke();
    for (const s of world.swarms.values()) {
      if (!s.ready) continue;
      const me = s.id === selfId;
      ctx.fillStyle = me ? '#ffc34d' : `hsla(${s.hue},80%,60%,.8)`;
      ctx.beginPath();
      ctx.arc(c + s.cx * k, c + s.cy * k, me ? 3 : clamp(1 + s.n / 90, 1, 3), 0, TAU);
      ctx.fill();
    }
  }
}
