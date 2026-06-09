// HTTP (static client) + WebSocket (realtime) + the global fixed-timestep loop.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { WebSocketServer } from 'ws';

import { SIM_HZ, STATE_HZ, FOOD_HZ, SIM_DT, MSG } from '../shared/constants.js';
import { cleanName } from '../shared/names.js';
import { LobbyManager } from './LobbyManager.js';
import { Player } from './Player.js';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

export class GameServer {
  constructor({ root, port = 3000 }) {
    this.root = root;
    this.port = port;
    this.manager = new LobbyManager();
    this.http = http.createServer((req, res) => this._serveStatic(req, res));
    this.wss = new WebSocketServer({ server: this.http });
    this.wss.on('connection', ws => this._onConnect(ws));
    this._tick = 0;
  }

  start() {
    const STATE_DIV = Math.round(SIM_HZ / STATE_HZ);
    const FOOD_DIV = Math.round(SIM_HZ / FOOD_HZ);
    this.http.listen(this.port, () => {
      console.log(`РОЙ.IO сервер на http://localhost:${this.port}`);
    });
    this.loop = setInterval(() => {
      this.manager.step(SIM_DT);
      this._tick++;
      if (this._tick % STATE_DIV === 0) this._broadcastState();
      if (this._tick % FOOD_DIV === 0) this._broadcast('foods');
    }, 1000 / SIM_HZ);
  }

  stop() { clearInterval(this.loop); this.wss.close(); this.http.close(); }

  // ---- per-lobby broadcasts (one serialised string reused for every viewer) ----
  _broadcastState() {
    for (const lobby of this.manager.lobbies) {
      if (lobby.players.size === 0) { lobby.state(); continue; } // drain buffers even with no viewers
      if (lobby.rosterDirty) { this._sendToLobby(lobby, lobby.roster()); lobby.rosterDirty = false; }
      this._sendToLobby(lobby, lobby.state());
    }
  }
  _broadcast(kind) {
    for (const lobby of this.manager.lobbies) {
      if (lobby.players.size === 0) continue;
      this._sendToLobby(lobby, lobby[kind]());
    }
  }
  _sendToLobby(lobby, msg) {
    const str = JSON.stringify(msg);
    for (const p of lobby.players) p.sendStr(str);
  }

  // ---- connection lifecycle ----
  _onConnect(ws) {
    const player = new Player(ws);
    const lobby = this.manager.assignSpectator(player);
    player.welcome(lobby.id);
    player.send(lobby.roster());
    player.send(lobby.foods());
    player.send(lobby.state());

    ws.on('message', raw => this._onMessage(player, raw));
    ws.on('close', () => { player.alive = false; this.manager.remove(player); });
    ws.on('error', () => { player.alive = false; });
  }

  _onMessage(player, raw) {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    switch (m.type) {
      case MSG.HELLO: {
        player.name = cleanName(m.name);
        const { lobby, swarm } = this.manager.claim(player, player.name);
        if (swarm) {
          player.assign(lobby.id, swarm.id);
          player.send(lobby.roster());   // new lobby composition right away
          player.send(lobby.foods());
        }
        break;
      }
      case MSG.INPUT: {
        const ctrl = player.swarm && player.swarm.controller;
        if (ctrl && !ctrl.isBot) ctrl.setInput(+m.ox || 0, +m.oy || 0, !!m.cond);
        break;
      }
      case MSG.LEAVE: {
        if (player.lobby && player.swarm) player.lobby.releaseSlot(player);
        break;
      }
    }
  }

  // ---- static files ----
  _serveStatic(req, res) {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath === '/' || urlPath === '') urlPath = '/index.html';
    const filePath = path.normalize(path.join(this.root, urlPath));
    if (!filePath.startsWith(this.root)) { res.writeHead(403); res.end('forbidden'); return; }
    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(data);
    });
  }
}
