// App orchestrator: wires Net ↔ ClientWorld ↔ Renderer/Input/Hud, owns the camera and screens.
import { MSG, SLOTS_PER_LOBBY, WORLD } from '../shared/constants.js';
import { clamp } from '../shared/util.js';
import { Net } from './Net.js';
import { ClientWorld } from './ClientWorld.js';
import { Renderer } from './Renderer.js';
import { Input } from './Input.js';
import { Hud } from './Hud.js';

const $ = id => document.getElementById(id);

class App {
  constructor() {
    this.world = new ClientWorld();
    this.renderer = new Renderer($('cv'), $('minimap'));
    this.input = new Input($('cv'));
    this.hud = new Hud();
    this.cam = { x: 0, y: 0, z: 0.55 };

    this.mode = 'menu';        // menu | play | dead
    this.selfId = null;
    this.lobbyId = null;
    this._inputAcc = 0;
    this._roam = 0;

    this.net = new Net({
      [MSG.WELCOME]: m => this._onWelcome(m),
      [MSG.ASSIGN]:  m => this._onAssign(m),
      [MSG.ROSTER]:  m => { this.world.setRoster(m.swarms); this._updateLive(); },
      [MSG.STATE]:   m => this._onState(m),
      [MSG.FOODS]:   m => this.world.setFoods(m.f),
      [MSG.DIED]:    m => this._onDied(m),
      status:        s => this._onStatus(s),
    });

    this._wireButtons();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  // ---- network handlers ----
  _onWelcome(m) {
    this.lobbyId = m.lobbyId;
    this.selfId = null;
    this.hud.setLobby(m.lobbyId);
    this._updateLive();
  }
  _onAssign(m) {
    this.selfId = m.selfId;
    this.lobbyId = m.lobbyId;
    this.hud.setLobby(m.lobbyId);
    this._enterPlay();
  }
  _onState(m) {
    this.world.applyState(m);
    if (m.feed) for (const ev of m.feed) this.hud.addFeed(ev, this.selfId);
  }
  _onDied(m) {
    this.selfId = null;
    this.mode = 'dead';
    const t = m.stats?.time | 0;
    $('deadTitle').textContent = m.byName ? `${m.byName.toUpperCase()} РАССЕЯЛ ТВОЙ РОЙ` : 'РОЙ ИСТАЯЛ';
    $('deadStats').innerHTML =
      `Пик роя: <b>${m.stats?.peak ?? 0}</b> мошек · Рассеял роёв: <b>${m.stats?.kills ?? 0}</b><br>` +
      `Прожил: <b>${(t / 60 | 0)}:${String(t % 60).padStart(2, '0')}</b>`;
    this._hide('hud'); this._show('dead');
    this._enableButtons();
  }
  _onStatus(s) {
    const ns = $('netStatus');
    if (s === 'offline') {
      ns.textContent = 'СОЕДИНЕНИЕ ПОТЕРЯНО · ПЕРЕПОДКЛЮЧЕНИЕ…';
      ns.style.display = 'block';
      $('playBtn').disabled = true;
    } else {
      ns.style.display = 'none';
      $('playBtn').disabled = false;
      this._updateLive();
    }
  }

  _updateLive() {
    const ranked = this.world.ranking();
    const humans = ranked.reduce((a, s) => a + (s.bot ? 0 : 1), 0);
    const info = $('liveInfo');
    if (info) info.textContent = this.net.connected
      ? `ЛОББИ #${this.lobbyId ?? '—'} · ИГРОКОВ ${humans}/${SLOTS_PER_LOBBY} · АРЕНА ЖИВА`
      : 'подключение…';
  }

  // ---- screens ----
  _enterPlay() {
    this.mode = 'play';
    this._hide('menu'); this._hide('dead'); this._show('hud');
    this._enableButtons();
    if (!this.hud.hintUsed) this.hud.showHint();
  }
  _toMenu() {
    this.net.leave();
    this.selfId = null;
    this.mode = 'menu';
    this._hide('hud'); this._hide('dead'); this._show('menu');
    this._updateLive();
  }
  _join() {
    const name = $('nameInput').value.trim();
    $('playBtn').disabled = true;
    $('playBtn').textContent = 'ВЫПУСКАЕМ…';
    $('respawnBtn').disabled = true;
    this.net.join(name);
  }
  _enableButtons() {
    $('playBtn').disabled = !this.net.connected;
    $('playBtn').textContent = 'ВЫПУСТИТЬ РОЙ';
    $('respawnBtn').disabled = false;
  }
  _wireButtons() {
    $('playBtn').onclick = () => this._join();
    $('respawnBtn').onclick = () => this._join();
    $('toMenuBtn').onclick = () => this._toMenu();
    $('nameInput').addEventListener('keydown', e => { if (e.key === 'Enter') this._join(); });
  }

  _show(id) { const e = $(id); e.classList.remove('hidden'); e.style.display = id === 'hud' ? 'block' : 'flex'; }
  _hide(id) { const e = $(id); e.classList.add('hidden'); e.style.display = 'none'; }

  // ---- camera ----
  _updateCamera(dt) {
    const self = this.selfId != null ? this.world.swarms.get(this.selfId) : null;
    if (this.mode === 'play' && self) {
      const tz = clamp(1.1 / (1 + self.n / 420), 0.34, 1.0);
      this.cam.z += (tz - this.cam.z) * clamp(dt * 2, 0, 1);
      this.cam.x += (self.cx - this.cam.x) * clamp(dt * 5, 0, 1);
      this.cam.y += (self.cy - this.cam.y) * clamp(dt * 5, 0, 1);
    } else {
      // spectating: slow orbit over the live arena (menu / death demo)
      this._roam += dt;
      this.cam.z += (0.55 - this.cam.z) * clamp(dt * 2, 0, 1);
      const tx = Math.cos(this._roam / 11) * WORLD * 0.25;
      const ty = Math.sin(this._roam / 11) * WORLD * 0.25;
      this.cam.x += (tx - this.cam.x) * clamp(dt * 1.5, 0, 1);
      this.cam.y += (ty - this.cam.y) * clamp(dt * 1.5, 0, 1);
    }
  }

  _sendInput(dt) {
    this._inputAcc -= dt;
    if (this._inputAcc > 0) return;
    this._inputAcc = 0.05;     // 20 Hz
    if (this.mode !== 'play') return;
    const self = this.world.swarms.get(this.selfId);
    if (!self) return;
    const { ox, oy } = this.input.offset(self, this.cam);
    const cond = this.input.cond;
    if (cond && !this.hud.hintUsed) { this.hud.hintUsed = true; this.hud.hideHint(); }
    this.net.input(ox, oy, cond);
  }

  // ---- main loop ----
  _loop(now) {
    const dt = Math.min((now - (this._last || now)) / 1000, 0.05);
    this._last = now;

    this.world.update(dt);
    this._updateCamera(dt);
    this._sendInput(dt);

    this.renderer.render(this.world, this.cam, this.selfId);
    if (this.mode === 'play') {
      this.hud.render(this.world, this.selfId, dt);
      this.renderer.renderMinimap(this.world, this.selfId);
    }
    requestAnimationFrame(this._loop);
  }
}

new App();
