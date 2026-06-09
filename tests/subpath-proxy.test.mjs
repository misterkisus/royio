// Prove the app works behind a reverse proxy mounted at /roy that STRIPS the prefix
// (exactly what the nginx config does). Spins the real server on :3010, a mirror proxy on
// :3011, then checks static + module + WebSocket join all flow through /roy/.
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { WebSocket } from 'ws';
import { MSG } from '../src/shared/constants.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const APP_PORT = 3010, PROXY_PORT = 3011, PREFIX = '/roy';
const wait = ms => new Promise(r => setTimeout(r, ms));

// 1) boot the real server
const app = spawn(process.execPath, ['server.js'], {
  cwd: path.join(root, '..'), env: { ...process.env, PORT: String(APP_PORT) }, stdio: 'ignore',
});
await wait(700);

// 2) a tiny prefix-stripping reverse proxy (mirrors `proxy_pass http://app/;` under `location /roy/`)
const strip = url => (url === PREFIX ? '/' : url.startsWith(PREFIX + '/') ? url.slice(PREFIX.length) : null);
const proxy = http.createServer((req, res) => {
  const p = strip(req.url);
  if (p === null) { res.writeHead(404); res.end(); return; }
  const up = http.request({ host: 'localhost', port: APP_PORT, path: p, method: req.method, headers: req.headers },
    r => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
  req.pipe(up); up.on('error', () => { res.writeHead(502); res.end(); });
});
proxy.on('upgrade', (req, socket, head) => {
  socket.on('error', () => {});
  const p = strip(req.url) || '/';
  const up = http.request({ host: 'localhost', port: APP_PORT, path: p, method: 'GET', headers: req.headers });
  up.on('upgrade', (r, us, uh) => {
    us.on('error', () => {});
    socket.write('HTTP/1.1 101 Switching Protocols\r\n' +
      Object.entries(r.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n') + '\r\n\r\n');
    if (uh && uh.length) us.unshift(uh);
    us.pipe(socket); socket.pipe(us);
  });
  up.on('error', () => socket.destroy());
  if (head && head.length) up.write(head);
  up.end();
});
await new Promise(r => proxy.listen(PROXY_PORT, r));

const get = url => new Promise((res, rej) => {
  http.get(url, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => res({ code: r.statusCode, ct: r.headers['content-type'], body: b })); }).on('error', rej);
});

let ok = true;
const check = (cond, label) => { if (!cond) { ok = false; console.error('FAIL:', label); } };

// 3) static + module through /roy/
const index = await get(`http://localhost:${PROXY_PORT}/roy/`);
check(index.code === 200 && index.body.includes('<title>'), 'index served at /roy/');
check(index.body.includes('src="src/client/main.js"'), 'index uses RELATIVE script src (resolves under /roy/)');

const mod = await get(`http://localhost:${PROXY_PORT}/roy/src/client/main.js`);
check(mod.code === 200 && (mod.ct || '').includes('javascript'), 'client module served with js mime');

const shared = await get(`http://localhost:${PROXY_PORT}/roy/src/shared/constants.js`);
check(shared.code === 200, 'shared module reachable (relative import path works under /roy/)');

// 4) WebSocket join through /roy/
const ws = new WebSocket(`ws://localhost:${PROXY_PORT}/roy/`);
const seen = { welcome: false, state: false, assign: false };
ws.on('message', d => { const m = JSON.parse(d);
  if (m.type === MSG.WELCOME) seen.welcome = true;
  if (m.type === MSG.STATE) seen.state = true;
  if (m.type === MSG.ASSIGN) seen.assign = true;
});
await new Promise((r, j) => { ws.on('open', r); ws.on('error', j); });
await wait(250);
ws.send(JSON.stringify({ type: MSG.HELLO, name: 'ПроксиТест' }));
await wait(300);
check(seen.welcome, 'WS welcome through /roy/');
check(seen.state, 'WS state stream through /roy/');
check(seen.assign, 'WS join (assign) through /roy/');

ws.close(); proxy.close(); app.kill();
await wait(150);
console.log(ok ? 'subpath-proxy.test OK — /roy/ static + modules + WebSocket all work behind a stripping proxy'
                : 'subpath-proxy.test FAILED');
process.exit(ok ? 0 : 1);
