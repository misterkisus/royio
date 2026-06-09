// Shared tunables and protocol constants. Imported by both Node server and browser client.
// Single source of truth — keep gameplay numbers here, not duplicated across sides.

export const TAU = Math.PI * 2;

// ---- arena / economy ----
export const WORLD = 3400;        // arena radius
export const FOOD_TARGET = 520;   // pollen kept on the field
export const UNIT_CAP = 260;      // max mites per swarm
export const START_UNITS = 32;    // a player/bot starts with this many
export const MIN_UNITS = 5;       // below this a swarm is "scattered" (dead)

// ---- lobby ----
export const SLOTS_PER_LOBBY = 9; // total swarms in a lobby (bots + humans)
                                  // => max humans per lobby; overflow spawns a new lobby

// ---- timing ----
export const SIM_HZ = 30;         // authoritative simulation ticks / second
export const STATE_HZ = 15;       // swarm state broadcasts / second
export const FOOD_HZ = 6;         // pollen broadcasts / second (rarely changes)
export const SIM_DT = 1 / SIM_HZ;

// ---- player control ----
export const INPUT_REACH = 700;   // max target offset a client may command from its centroid
export const BOT_RESPAWN_MS = 2000;

// ---- protocol message types ----
export const MSG = {
  // server -> client
  WELCOME: 'welcome',   // {lobbyId, selfId, cfg}
  ASSIGN:  'assign',    // {lobbyId, selfId}  — you now control a swarm (after join/respawn)
  ROSTER:  'roster',    // {swarms:[{id,name,hue,bot}]} — composition changed
  STATE:   'state',     // {t, swarms:[...], fx:[...], board:[...]}
  FOODS:   'foods',     // {f:[x,y,hue, ...]} flat
  DIED:    'died',      // {by, byName, stats:{peak,kills,time}}
  // client -> server
  HELLO:   'hello',     // {name} — request a slot (join / respawn)
  INPUT:   'input',     // {ox, oy, cond}
  LEAVE:   'leave',     // give up current slot, return to spectating
};

// fx kinds emitted by combat (drives client particles)
export const FX = { TRADE: 0, FALL: 1, CONVERT: 2, BURST: 3 };
