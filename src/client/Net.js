// WebSocket link to the authoritative server. Dispatches typed messages to handlers
// and auto-reconnects. The client never simulates gameplay — it sends intent, renders state.
import { MSG } from '../shared/constants.js';

export class Net {
  constructor(handlers = {}) {
    this.handlers = handlers;          // {welcome, assign, roster, state, foods, died, status}
    this.ws = null;
    this.connected = false;
    this._retry = null;
    this.connect();
  }

  connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    // mount-agnostic: connect to the same base path the page was served from
    // ('/' in dev, '/roy/' behind a reverse proxy) so the WS upgrade routes correctly.
    const base = location.pathname.replace(/[^/]*$/, '');
    const ws = new WebSocket(`${proto}://${location.host}${base}`);
    this.ws = ws;
    ws.onopen = () => {
      this.connected = true;
      this.handlers.status?.('online');
    };
    ws.onclose = () => {
      this.connected = false;
      this.handlers.status?.('offline');
      this._scheduleReconnect();
    };
    ws.onerror = () => ws.close();
    ws.onmessage = (e) => this._dispatch(e.data);
  }

  _scheduleReconnect() {
    clearTimeout(this._retry);
    this._retry = setTimeout(() => this.connect(), 1500);
  }

  _dispatch(data) {
    let m;
    try { m = JSON.parse(data); } catch { return; }
    const fn = this.handlers[m.type];
    if (fn) fn(m);
  }

  send(obj) {
    if (this.connected && this.ws.readyState === 1) this.ws.send(JSON.stringify(obj));
  }

  join(name)              { this.send({ type: MSG.HELLO, name }); }
  leave()                 { this.send({ type: MSG.LEAVE }); }
  input(ox, oy, cond)     { this.send({ type: MSG.INPUT, ox: Math.round(ox), oy: Math.round(oy), cond }); }
}
