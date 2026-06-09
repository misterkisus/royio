// DOM-free client view model (ClientWorld + ClientSwarm + particles).
import { ClientWorld } from '../src/client/ClientWorld.js';
import { MSG } from '../src/shared/constants.js';

const w = new ClientWorld();
w.setRoster([
  { id: 1, name: 'Я', hue: 45, bot: false },
  { id: 2, name: 'Бот', hue: 200, bot: true },
]);
w.applyState({
  type: MSG.STATE, t: 0,
  swarms: [
    { id: 1, x: 100, y: 0, tx: 120, ty: 0, n: 30, c: 1, g: 0, e: 80 },
    { id: 2, x: -100, y: 50, tx: -100, ty: 50, n: 12, c: 0, g: 1, e: 100 },
  ],
  fx: [{ x: 0, y: 0, h: 45, n: 5 }], feed: [],
});
const s1 = w.swarms.get(1), s2 = w.swarms.get(2);
console.assert(s1 && s1.name === 'Я' && !s1.bot, 'roster merged');
console.assert(s1.cond === true && Math.abs(s1.energy - 0.8) < 1e-9, 'state decoded');
console.assert(s1.ready && s1.cx === 100, 'first snapshot snaps');
console.assert(w.particles.length === 5, 'fx spawned particles');

for (let i = 0; i < 40; i++) w.update(1 / 60);
console.assert(s1.units.length === 30, 'cloud matches count');
console.assert(s2.units.length === 12, 'cloud matches count 2');

w.applyState({ type: MSG.STATE, t: 1, swarms: [{ id: 1, x: 100, y: 0, tx: 100, ty: 0, n: 10, c: 0, g: 0, e: 50 }], fx: [] });
w.update(1 / 60);
console.assert(s1.units.length === 10, 'cloud shrinks');
console.assert(!w.swarms.has(2), 'absent swarm removed');

w.setFoods([10, 20, 200, -30, -40, 90]);
console.assert(w.foods.length === 2 && w.foods[0].x === 10 && w.foods[1].hue === 90, 'foods decoded');
console.assert(w.foods.every(f => f.phase >= 0), 'food phase valid');

w.setRoster([{ id: 3, name: 'Большой', hue: 10, bot: true }]);
w.applyState({ type: MSG.STATE, t: 2, swarms: [
  { id: 1, x: 0, y: 0, tx: 0, ty: 0, n: 10, c: 0, g: 0, e: 50 },
  { id: 3, x: 0, y: 0, tx: 0, ty: 0, n: 99, c: 0, g: 0, e: 50 },
], fx: [] });
console.assert(w.ranking()[0].id === 3, 'ranking sorts by size');

console.log('clientworld.test OK');
