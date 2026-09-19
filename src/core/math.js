export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const smoothstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
/** Logarithmic interpolation, for quantities spanning orders of magnitude. */
export const logLerp = (a, b, t) => Math.exp(lerp(Math.log(a), Math.log(b), t));
export const log10 = Math.log10;
export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

/** Deterministic pseudo random generator (mulberry32). */
export function makeRng(seed = 1) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uniform random direction on the unit sphere. */
export function randomDirection(rng, out = [0, 0, 0]) {
  const z = rng() * 2 - 1;
  const phi = rng() * TAU;
  const r = Math.sqrt(1 - z * z);
  out[0] = r * Math.cos(phi);
  out[1] = r * Math.sin(phi);
  out[2] = z;
  return out;
}

/** Piecewise log-log interpolation through anchor points [[x, y], ...] sorted by x. */
export function logLogInterp(points, x) {
  if (x <= points[0][0]) return points[0][1];
  const last = points[points.length - 1];
  if (x >= last[0]) return last[1];
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    if (x >= x0 && x <= x1) {
      const t = (Math.log(x) - Math.log(x0)) / (Math.log(x1) - Math.log(x0));
      return Math.exp(lerp(Math.log(y0), Math.log(y1), t));
    }
  }
  return last[1];
}
