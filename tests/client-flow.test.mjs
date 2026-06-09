// Headless integration: run the REAL client (main.js) against a DOM/WebSocket shim and a
// scripted server, driving menu → play → death. Catches orchestration bugs.
import { MSG } from '../src/shared/constants.js';

const noop = () => {};
const ctxMethods = new Set(['setTransform', 'fillRect', 'beginPath', 'arc', 'fill', 'moveTo', 'lineTo', 'stroke', 'fillText', 'clearRect', 'save', 'restore', 'translate', 'scale']);
const ctxStub = new Proxy({}, { get: (_, k) => (ctxMethods.has(k) ? noop : 0), set: () => true });

class FakeEl {
  constructor(id) { this.id = id; this.style = {}; this._children = []; this.value = ''; this.disabled = false; this.textContent = ''; this.innerHTML = ''; this.onclick = null; }
  getContext() { return ctxStub; }
  classList = { add: noop, remove: noop };
  addEventListener() {}
  prepend(n) { this._children.unshift(n); }
  appendChild(n) { this._children.push(n); }
  removeChild(n) { const i = this._children.indexOf(n); if (i >= 0) this._children.splice(i, 1); }
  get children() { return this._children; }
  get lastChild() { return this._children[this._children.length - 1]; }
}
const els = new Map();
const getEl = id => { if (!els.has(id)) els.set(id, new FakeEl(id)); return els.get(id); };

const sockets = [];
class FakeWS { constructor() { this.readyState = 1; this.sent = []; sockets.push(this); } send(s) { this.sent.push(s); } close() { this.readyState = 3; this.onclose?.(); } }

let rafCb = null, now = 0;
Object.assign(globalThis, {
  innerWidth: 1280, innerHeight: 720,
  document: { getElementById: getEl, createElement: () => new FakeEl('dyn') },
  matchMedia: () => ({ matches: false }),
  addEventListener: noop,
  requestAnimationFrame: cb => { rafCb = cb; return 1; },
  WebSocket: FakeWS,
  location: { protocol: 'http:', host: 'localhost:3000', pathname: '/' },
  window: { devicePixelRatio: 1 },
});
const frames = (n, dt = 16) => { for (let i = 0; i < n; i++) { const cb = rafCb; rafCb = null; now += dt; if (cb) cb(now); } };
const recv = m => sockets[0].onmessage({ data: JSON.stringify(m) });

await import('../src/client/main.js');
const ws = sockets[0];
console.assert(ws, 'client opened a socket');
ws.onopen();

recv({ type: MSG.WELCOME, lobbyId: 1, selfId: null });
recv({ type: MSG.ROSTER, swarms: [{ id: 5, name: 'Бот', hue: 200, bot: true }, { id: 6, name: 'Бот2', hue: 90, bot: true }] });
recv({ type: MSG.FOODS, f: [100, 100, 50, -200, 0, 120] });
recv({ type: MSG.STATE, t: 0, swarms: [
  { id: 5, x: 0, y: 0, tx: 10, ty: 0, n: 40, c: 0, g: 0, e: 100 },
  { id: 6, x: 300, y: -100, tx: 300, ty: -100, n: 20, c: 1, g: 0, e: 60 },
], fx: [{ x: 0, y: 0, h: 50, n: 4 }], feed: [] });
frames(30);
console.assert(getEl('liveInfo').textContent.includes('ЛОББИ'), 'menu live info updated');

getEl('nameInput').value = 'Герой';
getEl('playBtn').onclick();
console.assert(ws.sent.some(s => JSON.parse(s).type === MSG.HELLO), 'join sent HELLO');

recv({ type: MSG.ASSIGN, lobbyId: 1, selfId: 7 });
recv({ type: MSG.ROSTER, swarms: [{ id: 7, name: 'Герой', hue: 45, bot: false }, { id: 5, name: 'Бот', hue: 200, bot: true }] });
recv({ type: MSG.STATE, t: 1, swarms: [
  { id: 7, x: 50, y: 50, tx: 80, ty: 50, n: 32, c: 0, g: 1, e: 100 },
  { id: 5, x: 0, y: 0, tx: 0, ty: 0, n: 40, c: 0, g: 0, e: 100 },
], fx: [], feed: [{ byId: 7, byName: 'Герой', victimId: 5, victimName: 'Бот' }] });
frames(40);
console.assert(ws.sent.some(s => JSON.parse(s).type === MSG.INPUT), 'play loop sends INPUT');
console.assert(getEl('hud').style.display === 'block', 'HUD shown in play');
console.assert(getEl('menu').style.display === 'none', 'menu hidden in play');
console.assert(getEl('boardRows').innerHTML.includes('Герой'), 'leaderboard shows player');
console.assert(getEl('feed').children.length >= 1, 'kill feed rendered');

recv({ type: MSG.DIED, by: 5, byName: 'Бот', stats: { peak: 88, kills: 3, time: 75 } });
frames(10);
console.assert(getEl('dead').style.display === 'flex', 'death screen shown');
console.assert(getEl('deadStats').innerHTML.includes('88'), 'death stats rendered');

getEl('toMenuBtn').onclick();
console.assert(ws.sent.some(s => JSON.parse(s).type === MSG.LEAVE), 'toMenu sent LEAVE');
console.assert(getEl('menu').style.display === 'flex', 'menu shown again');
frames(20);

console.log('client-flow.test OK');
process.exit(0);
