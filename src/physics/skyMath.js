/**
 * Minimal positional astronomy for the Earth View: where is the Sun, the
 * Moon and a given star in the local sky for an observer at latitude φ on
 * a given day and local (solar) time. Accuracy ~1°, which is plenty for a
 * horizon-scale visualisation.
 */
import { DEG } from '../core/math.js';

const OBLIQUITY = 23.44 * DEG;
const SYNODIC_MONTH = 29.530589; // days
const NEW_MOON_2026_DOY = 18.83; // 2026-01-18 19:52 UTC

/** Sun's ecliptic longitude (rad) — 0 at the March equinox (~day 80). */
export function sunEclipticLongitude(dayOfYear) {
  return ((dayOfYear - 80) / 365.25) * Math.PI * 2;
}

/** Equatorial coordinates from ecliptic longitude (latitude 0). */
export function eclipticToEquatorial(lambda) {
  const ra = Math.atan2(Math.cos(OBLIQUITY) * Math.sin(lambda), Math.cos(lambda));
  const dec = Math.asin(Math.sin(OBLIQUITY) * Math.sin(lambda));
  return { raH: ((ra / DEG / 15) + 24) % 24, decDeg: dec / DEG };
}

export function sunRaDec(dayOfYear) {
  return eclipticToEquatorial(sunEclipticLongitude(dayOfYear));
}

/** Local sidereal time (hours). At local solar noon the Sun's RA is on the meridian. */
export function localSiderealTime(dayOfYear, localHour) {
  const { raH } = sunRaDec(dayOfYear);
  return (((raH + (localHour - 12)) % 24) + 24) % 24;
}

/** Horizontal coordinates (degrees). Azimuth 0 = north, 90 = east. */
export function altAz(raH, decDeg, lstH, latDeg) {
  const H = (lstH - raH) * 15 * DEG;
  const dec = decDeg * DEG;
  const lat = latDeg * DEG;
  const xN = -Math.sin(lat) * Math.cos(dec) * Math.cos(H) + Math.cos(lat) * Math.sin(dec);
  const yE = -Math.cos(dec) * Math.sin(H);
  const zUp = Math.cos(lat) * Math.cos(dec) * Math.cos(H) + Math.sin(lat) * Math.sin(dec);
  return { alt: Math.asin(Math.max(-1, Math.min(1, zUp))) / DEG, az: ((Math.atan2(yE, xN) / DEG) + 360) % 360 };
}

/** Crude Moon: position along the ecliptic from its age, phase from elongation. */
export function moonApprox(dayOfYear) {
  const age = (((dayOfYear - NEW_MOON_2026_DOY) % SYNODIC_MONTH) + SYNODIC_MONTH) % SYNODIC_MONTH;
  const elongation = (age / SYNODIC_MONTH) * Math.PI * 2; // 0 new, π full
  const lambda = sunEclipticLongitude(dayOfYear) + elongation;
  const eq = eclipticToEquatorial(lambda);
  const illuminated = (1 - Math.cos(elongation)) / 2;
  const phaseAngleDeg = Math.abs(180 - (elongation / DEG) % 360);
  // Allen's astrophysical quantities: m = −12.73 + 0.026|α| + 4e−9 α⁴
  const magnitude = -12.73 + 0.026 * phaseAngleDeg + 4e-9 * Math.pow(phaseAngleDeg, 4);
  return { ...eq, ageDays: age, illuminated, elongation, magnitude, waxing: age < SYNODIC_MONTH / 2 };
}

/**
 * Find the next local hour (within 24h, 10-minute steps) when the object rises
 * above `minAlt`, or null if it never does today.
 */
export function nextRise(raH, decDeg, latDeg, dayOfYear, fromHour, minAlt = 5) {
  for (let i = 1; i <= 144; i++) {
    const h = fromHour + i / 6;
    const { alt } = altAz(raH, decDeg, localSiderealTime(dayOfYear, h % 24), latDeg);
    if (alt > minAlt) return h % 24;
  }
  return null;
}

/** Day of year (1..366) for a Date. */
export function dayOfYear(date = new Date()) {
  const start = Date.UTC(date.getFullYear(), 0, 1);
  const now = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((now - start) / 864e5) + 1;
}

export function dateLabel(dayOfYear) {
  const d = new Date(Date.UTC(2026, 0, 1) + (dayOfYear - 1) * 864e5);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function hourLabel(h) {
  const hh = Math.floor(((h % 24) + 24) % 24);
  const mm = Math.floor((((h % 1) + 1) % 1) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
