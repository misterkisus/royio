// Tiny math/RNG helpers shared by sim and rendering.

export const rnd = (a, b) => a + Math.random() * (b - a);
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const d2 = (ax, ay, bx, by) => {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
};
export const hypot = Math.hypot;
export const lerp = (a, b, t) => a + (b - a) * t;
