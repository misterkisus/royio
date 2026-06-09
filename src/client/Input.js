// Local input → a commanded target offset (ox,oy from the swarm centroid) + condense flag.
// Desktop: mouse aims, LMB/Space condenses. Touch: floating joystick aims, СЖАТЬ button condenses.
import { INPUT_REACH } from '../shared/constants.js';

export class Input {
  constructor(canvas) {
    this.cv = canvas;
    this.mouse = { x: innerWidth / 2, y: innerHeight / 2, down: false };
    this.keys = {};
    this.condBtn = false;
    this.usingTouch = matchMedia('(pointer:coarse)').matches;
    this.joy = { active: false, id: -1, ox: 0, oy: 0, dx: 0, dy: 0 };
    this.joyBase = document.getElementById('joyBase');
    this.joyKnob = document.getElementById('joyKnob');
    this._wire();
  }

  get cond() {
    return this.mouse.down || !!this.keys['Space'] || this.condBtn;
  }

  // target offset relative to the player's swarm centroid, in world units
  offset(self, cam) {
    if (!self) return { ox: 0, oy: 0 };
    if (this.usingTouch) {
      const m = Math.hypot(this.joy.dx, this.joy.dy);
      if (this.joy.active && m > 12) {
        return { ox: this.joy.dx / m * INPUT_REACH, oy: this.joy.dy / m * INPUT_REACH };
      }
      return { ox: 0, oy: 0 };   // finger up → swarm idles and feeds
    }
    const wx = (this.mouse.x - innerWidth / 2) / cam.z + cam.x;
    const wy = (this.mouse.y - innerHeight / 2) / cam.z + cam.y;
    return { ox: wx - self.cx, oy: wy - self.cy };
  }

  _joyShow() {
    this.joyBase.style.display = this.joyKnob.style.display = 'block';
    this.joyBase.style.left = this.joy.ox + 'px'; this.joyBase.style.top = this.joy.oy + 'px';
    const m = Math.hypot(this.joy.dx, this.joy.dy), cap = 46, k = m > cap ? cap / m : 1;
    this.joyKnob.style.left = (this.joy.ox + this.joy.dx * k) + 'px';
    this.joyKnob.style.top = (this.joy.oy + this.joy.dy * k) + 'px';
  }
  _joyHide() { this.joyBase.style.display = this.joyKnob.style.display = 'none'; }

  _wire() {
    addEventListener('pointermove', e => {
      if (e.pointerType === 'touch') {
        if (this.joy.active && e.pointerId === this.joy.id) {
          this.joy.dx = e.clientX - this.joy.ox; this.joy.dy = e.clientY - this.joy.oy; this._joyShow();
        }
        return;
      }
      this.mouse.x = e.clientX; this.mouse.y = e.clientY;
    });
    this.cv.addEventListener('pointerdown', e => {
      if (e.pointerType === 'touch') {
        this.usingTouch = true;
        if (!this.joy.active) {
          this.joy.active = true; this.joy.id = e.pointerId;
          this.joy.ox = e.clientX; this.joy.oy = e.clientY; this.joy.dx = this.joy.dy = 0;
          this._joyShow();
        }
        return;
      }
      this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.down = true;
    });
    const end = e => {
      if (this.joy.active && e.pointerId === this.joy.id) { this.joy.active = false; this.joy.dx = this.joy.dy = 0; this._joyHide(); }
      if (e.pointerType !== 'touch') this.mouse.down = false;
    };
    addEventListener('pointerup', end);
    addEventListener('pointercancel', end);
    addEventListener('keydown', e => { this.keys[e.code] = true; if (e.code === 'Space') e.preventDefault(); });
    addEventListener('keyup', e => this.keys[e.code] = false);

    const cb = document.getElementById('condBtn');
    cb.addEventListener('pointerdown', e => { e.preventDefault(); this.condBtn = true; });
    cb.addEventListener('pointerup', () => this.condBtn = false);
    cb.addEventListener('pointercancel', () => this.condBtn = false);
  }
}
