import {
  SOLAR_MASS_KG, SOLAR_RADIUS_M, SOLAR_LUMINOSITY_W, AU_M, LIGHT_YEAR_M, PARSEC_M,
  YEAR_S, DAY_S, HOUR_S, MINUTE_S, ERG,
} from './constants.js';

const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const sup = (n) => String(n).split('').map((c) => SUP[c] ?? c).join('');

/** Scientific notation with unicode superscripts: 1.23×10⁴⁴ */
export function sci(v, digits = 2) {
  if (!isFinite(v)) return '—';
  if (v === 0) return '0';
  const e = Math.floor(Math.log10(Math.abs(v)));
  const m = v / 10 ** e;
  if (e >= -2 && e < 4) return v.toPrecision(digits + 1).replace(/\.?0+$/, '');
  return `${m.toFixed(digits)}×10${sup(e)}`;
}

/** Compact number with SI-ish grouping (1.2 k, 3.4 M, 5.6 G, ...). */
export function compact(v, digits = 2) {
  if (!isFinite(v)) return '—';
  const abs = Math.abs(v);
  if (abs < 1e3) return abs < 10 ? v.toFixed(digits) : Math.round(v).toLocaleString('en-US');
  const units = ['k', 'M', 'G', 'T', 'P', 'E'];
  let i = -1;
  let x = v;
  while (Math.abs(x) >= 1000 && i < units.length - 1) { x /= 1000; i++; }
  return `${x.toFixed(digits)} ${units[i]}`;
}

export const fmtSolarMass = (m) => `${m < 10 ? m.toFixed(2) : m < 100 ? m.toFixed(1) : Math.round(m)} M☉`;
export const fmtSolarRadius = (r) => `${r < 10 ? r.toFixed(3) : r < 1000 ? r.toFixed(1) : compact(r, 1)} R☉`;
export const fmtSolarLum = (l) => `${sci(l)} L☉`;
export const fmtKelvin = (t) => `${sci(t)} K`;
export const fmtDensity = (g) => `${sci(g)} g/cm³`; // input g/cm^3

export function fmtDistanceLy(ly) {
  if (ly < 1e-4) return `${(ly * LIGHT_YEAR_M / AU_M).toFixed(3)} AU`;
  if (ly < 0.1) return `${(ly * LIGHT_YEAR_M / AU_M).toFixed(0)} AU`;
  if (ly < 1000) return `${ly.toFixed(ly < 10 ? 2 : 0)} ly`;
  return `${compact(ly, 1)} ly`;
}

export function fmtLengthMeters(m) {
  if (!isFinite(m)) return '—';
  if (m < 1e3) return `${m.toFixed(0)} m`;
  if (m < 1e7) return `${(m / 1e3).toFixed(0)} km`;
  if (m < SOLAR_RADIUS_M * 5) return `${compact(m / 1e3, 1)} km`;
  if (m < AU_M * 0.5) return `${(m / SOLAR_RADIUS_M).toFixed(1)} R☉`;
  if (m < LIGHT_YEAR_M * 0.05) return `${(m / AU_M).toFixed(2)} AU`;
  if (m < PARSEC_M * 100) return `${(m / LIGHT_YEAR_M).toFixed(2)} ly`;
  return `${(m / PARSEC_M).toFixed(1)} pc`;
}

export function fmtVelocity(mps) {
  if (!isFinite(mps)) return '—';
  if (mps < 1e3) return `${mps.toFixed(0)} m/s`;
  return `${compact(mps / 1e3, 1)} km/s`;
}

export function fmtEnergy(j) {
  if (!isFinite(j) || j <= 0) return '0';
  return `${sci(j / ERG)} erg`;
}

/** Human readable duration from seconds: "1.2 s", "14.8 h", "112 d", "3.4 kyr" */
export function fmtDuration(s, digits = 1) {
  if (!isFinite(s)) return '—';
  const abs = Math.abs(s);
  const sign = s < 0 ? '−' : '';
  if (abs < 1e-3) return `${sign}${(abs * 1e6).toFixed(0)} µs`;
  if (abs < 1) return `${sign}${(abs * 1e3).toFixed(0)} ms`;
  if (abs < MINUTE_S) return `${sign}${abs.toFixed(digits)} s`;
  if (abs < HOUR_S) return `${sign}${(abs / MINUTE_S).toFixed(digits)} min`;
  if (abs < DAY_S) return `${sign}${(abs / HOUR_S).toFixed(digits)} h`;
  if (abs < YEAR_S) return `${sign}${(abs / DAY_S).toFixed(digits)} d`;
  return `${sign}${fmtYears(abs / YEAR_S)}`;
}

export function fmtYears(y, digits = 1) {
  if (!isFinite(y)) return '—';
  const abs = Math.abs(y);
  if (abs < 1e3) return `${abs.toFixed(abs < 10 ? digits : 0)} yr`;
  if (abs < 1e6) return `${(abs / 1e3).toFixed(digits)} kyr`;
  if (abs < 1e9) return `${(abs / 1e6).toFixed(digits)} Myr`;
  if (abs < 1e12) return `${(abs / 1e9).toFixed(digits)} Gyr`;
  return `${sci(abs, 1)} yr`;
}

/** Timeline stamp used in the event log. */
export function fmtTimestamp(s) {
  if (s < 0) return `−${fmtDuration(-s)}`;
  if (s < 60) return `+${s.toFixed(2)} s`;
  if (s < HOUR_S) return `+${(s / MINUTE_S).toFixed(1)} min`;
  if (s < DAY_S * 2) return `+${(s / HOUR_S).toFixed(1)} h`;
  if (s < YEAR_S) return `+${(s / DAY_S).toFixed(0)} d`;
  return `+${fmtYears(s / YEAR_S)}`;
}

export const toKg = (msun) => msun * SOLAR_MASS_KG;
export const toMeters = (rsun) => rsun * SOLAR_RADIUS_M;
export const toWatts = (lsun) => lsun * SOLAR_LUMINOSITY_W;
export const lyToMeters = (ly) => ly * LIGHT_YEAR_M;
export const lyToParsec = (ly) => ly * LIGHT_YEAR_M / PARSEC_M;
