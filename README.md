# РОЙ.IO — multiplayer

Swarm-mind arena. You aren't one — you're a thousand. **Spread** to farm pollen, **condense**
into a comet to fight. Now with authoritative multiplayer: **live players take over bot slots in
the same arena, and when a lobby is full the next player spills into another one.**

## Run

```bash
npm install
npm start            # -> http://localhost:3000
```

Open the page in several tabs/devices on the network to play together. `PORT=8080 npm start`
to change the port.

```bash
npm test             # headless suite: lobby/slot logic, client view model, full client flow
```

> The original single-file prototype is kept as `roy-io-v2.html` for reference. The live game
> is now `index.html` + the `src/` modules served by the Node server.

## How multiplayer works

The **server is authoritative**: it runs the whole simulation (swarm physics, combat, pollen,
bots). Clients send *intent* (a target direction + condense flag) and render the state the server
broadcasts. No gameplay logic runs on the client, so players can't cheat the simulation.

- A **Lobby** always holds `SLOTS_PER_LOBBY` (9) swarms. Empty slots are bots.
- **Joining replaces a bot**: a free bot slot is swapped for a fresh player swarm. Leaving or
  dying reverts the slot to a bot, so the arena is always full and lively.
- **Overflow → another lobby**: when every slot in a lobby is a human, the next player is routed
  to a lobby that has room, creating a new one if needed (`LobbyManager.claim`). Empty extra
  lobbies are reaped.
- Invariant maintained at all times: `liveSwarms + pendingBotRespawns === SLOTS_PER_LOBBY`.

### Bandwidth

The server is authoritative over each swarm's **centroid, target, count, condense/energy/guard**
— not the hundreds of individual mites. The client renders each swarm as a cosmetic cloud of
units chasing the interpolated centroid (same `Unit.step` physics as the server). Visually
identical to the prototype, a fraction of the data. Pollen is sent at 6 Hz, swarm state at 15 Hz,
the sim ticks at 30 Hz.

## Layout

```
server.js                 entry — boots the GameServer
index.html                client shell (markup + styles)
src/
  shared/                 sim core — runs on the server, imported by the client too
    constants.js          tunables + protocol message types (single source of truth)
    util.js  math.js→util  rng / clamp / distance helpers
    Unit.js               one mite; formation integration (shared by server & cosmetic cloud)
    Swarm.js              a swarm; delegates movement intent to a Controller
    controllers.js        BotController (AI) + PlayerController (network input)
    World.js              authoritative arena: combat, pickups, deaths, events
    names.js              bot names + hue palette
  server/
    Player.js             one connection; spectates until it claims a slot
    Lobby.js              one arena; bot/human slot management + serialisation
    LobbyManager.js       routing, overflow → new lobby, reaping
    GameServer.js         HTTP static + WebSocket + fixed-timestep loop
  client/
    Net.js                WebSocket link + auto-reconnect
    ClientWorld.js        view model: interpolation + cosmetic unit clouds + particles
    Renderer.js           canvas arena + minimap
    Input.js              mouse / keyboard / touch joystick → intent
    Hud.js                leaderboard, kill feed, stats, lobby badge, hints
    main.js               App orchestrator: net ↔ world ↔ render, camera, screens
```

## Protocol (JSON over WebSocket)

| Dir | type | payload |
|-----|------|---------|
| S→C | `welcome` | `{lobbyId, selfId:null}` — assigned a lobby to spectate |
| S→C | `assign`  | `{lobbyId, selfId}` — you now control swarm `selfId` |
| S→C | `roster`  | `{swarms:[{id,name,hue,bot}]}` — composition changed |
| S→C | `state`   | `{t, swarms:[{id,x,y,tx,ty,n,c,g,e}], fx, feed}` @15 Hz |
| S→C | `foods`   | `{f:[x,y,hue,…]}` @6 Hz |
| S→C | `died`    | `{by, byName, stats:{peak,kills,time}}` |
| C→S | `hello`   | `{name}` — join / respawn (claim a slot) |
| C→S | `input`   | `{ox, oy, cond}` — target offset from centroid + condense |
| C→S | `leave`   | give up the slot, return to spectating |
```
