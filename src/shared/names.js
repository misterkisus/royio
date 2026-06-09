// Bot name pool and swarm hue palette.

const NAMES = ['Саранча', 'Гнус', 'Мошкара', 'Комарилья', 'ЗлойУлей', 'Оводы_ТВ', 'Шершень228',
  'Мотыльки', 'Светляки', 'Тля', 'ЖукиВместе', 'Слепень', 'НеМошки', 'РойВойныч', 'Долгоносик',
  'ПчёлыПротивМёда', 'Стрекозлы', 'Жужжащие', 'Трутни', 'Мошка3000'];

export const HUES = [45, 160, 200, 280, 330, 20, 100, 250, 180, 310, 70, 140];
export const PLAYER_HUE = 45;

let pool = [];
export function pickName() {
  if (!pool.length) pool = [...NAMES].sort(() => Math.random() - 0.5);
  return pool.pop();
}
export const pickHue = () => HUES[(Math.random() * HUES.length) | 0];

// Sanitise a player-supplied name.
export function cleanName(raw) {
  const n = String(raw ?? '').trim().slice(0, 14);
  return n || 'Безымянный рой';
}
