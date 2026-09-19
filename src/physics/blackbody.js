/**
 * Approximate sRGB colour of a blackbody at temperature T (Kelvin).
 * Table derived from Mitchell Charity's blackbody colour data (CIE 1931,
 * D65 white point), which is the standard reference for "what colour is a
 * star". Log-linear interpolation between anchor points is plenty for visuals.
 */
const TABLE = [
  [1000, [1.0, 0.22, 0.0]],
  [1500, [1.0, 0.42, 0.05]],
  [2000, [1.0, 0.55, 0.15]],
  [2500, [1.0, 0.64, 0.3]],
  [3000, [1.0, 0.71, 0.42]],
  [3500, [1.0, 0.78, 0.55]],
  [4000, [1.0, 0.83, 0.66]],
  [4500, [1.0, 0.88, 0.76]],
  [5000, [1.0, 0.92, 0.84]],
  [5500, [1.0, 0.95, 0.91]],
  [6000, [1.0, 0.98, 0.97]],
  [6500, [0.98, 0.98, 1.0]],
  [7000, [0.93, 0.95, 1.0]],
  [8000, [0.85, 0.9, 1.0]],
  [10000, [0.78, 0.85, 1.0]],
  [15000, [0.7, 0.8, 1.0]],
  [25000, [0.64, 0.74, 1.0]],
  [40000, [0.6, 0.7, 1.0]],
  [100000, [0.58, 0.68, 1.0]],
  [1e6, [0.56, 0.66, 1.0]],
];

export function blackbodyRGB(T) {
  if (!(T > 0)) return [1, 1, 1];
  if (T <= TABLE[0][0]) return TABLE[0][1].slice();
  const last = TABLE[TABLE.length - 1];
  if (T >= last[0]) return last[1].slice();
  for (let i = 0; i < TABLE.length - 1; i++) {
    const [t0, c0] = TABLE[i];
    const [t1, c1] = TABLE[i + 1];
    if (T >= t0 && T <= t1) {
      const f = (Math.log(T) - Math.log(t0)) / (Math.log(t1) - Math.log(t0));
      return [c0[0] + (c1[0] - c0[0]) * f, c0[1] + (c1[1] - c0[1]) * f, c0[2] + (c1[2] - c0[2]) * f];
    }
  }
  return last[1].slice();
}

export function rgbToCss([r, g, b], alpha = 1) {
  const c = (v) => Math.round(Math.max(0, Math.min(1, v)) * 255);
  return alpha >= 1 ? `rgb(${c(r)},${c(g)},${c(b)})` : `rgba(${c(r)},${c(g)},${c(b)},${alpha})`;
}
