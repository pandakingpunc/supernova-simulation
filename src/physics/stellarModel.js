/**
 * Stellar structure approximations: mass–luminosity, mass–radius,
 * lifetimes and classification. These are textbook power-law fits
 * (e.g. Salaris & Cassisi, Kippenhahn) good to within a factor of ~2 for
 * main-sequence stars, which is all a real-time simulation needs.
 */
import { SOLAR_TEFF_K, SOLAR_METALLICITY, MIN_STAR_MASS, MAX_STAR_MASS } from '../core/constants.js';
import { clamp } from '../core/math.js';

/** Main-sequence luminosity in solar units (piecewise mass–luminosity relation). */
export function mainSequenceLuminosity(M) {
  if (M < 0.43) return 0.23 * Math.pow(M, 2.3);
  if (M < 2) return Math.pow(M, 4);
  if (M < 55) return 1.4 * Math.pow(M, 3.5);
  return 32000 * M; // radiation-pressure dominated, L ∝ M
}

/** Zero-age main-sequence radius in solar units. */
export function mainSequenceRadius(M) {
  return M < 1 ? Math.pow(M, 0.8) : Math.pow(M, 0.57);
}

/** Effective temperature from Stefan–Boltzmann: L = 4πR²σT⁴ (solar units in, Kelvin out). */
export function effectiveTemperature(L, R) {
  return SOLAR_TEFF_K * Math.pow(L / (R * R), 0.25);
}

/** Luminosity from radius and temperature (solar units). */
export function luminosityFrom(R, T) {
  return R * R * Math.pow(T / SOLAR_TEFF_K, 4);
}

/**
 * Main-sequence lifetime in years. Fuel ∝ M, burn rate ∝ L, normalised to
 * ~10 Gyr for the Sun. Metallicity nudges opacity/luminosity slightly.
 */
export function mainSequenceLifetime(M, Z = SOLAR_METALLICITY) {
  const zFactor = Math.pow(Z / SOLAR_METALLICITY, 0.05);
  return clamp(1e10 * (M / mainSequenceLuminosity(M)) * zFactor, 3e6, 3e13);
}

// Spectral class boundaries (Kelvin). Harvard classification.
const SPECTRAL = [
  ['O', 30000, 60000],
  ['B', 10000, 30000],
  ['A', 7500, 10000],
  ['F', 6000, 7500],
  ['G', 5200, 6000],
  ['K', 3700, 5200],
  ['M', 2400, 3700],
];

/** "G2", "M1", "B8" from effective temperature. */
export function spectralType(T) {
  if (T >= 60000) return 'O2';
  if (T < 2400) return 'L0';
  for (const [cls, lo, hi] of SPECTRAL) {
    if (T >= lo && T < hi) {
      // subtype 0 (hottest) .. 9 (coolest) across the class, spaced in log T
      const f = (Math.log(hi) - Math.log(T)) / (Math.log(hi) - Math.log(lo));
      return `${cls}${Math.min(9, Math.floor(f * 10))}`;
    }
  }
  return 'M9';
}

/** MK luminosity class from how inflated the star is relative to its ZAMS radius. */
export function luminosityClass(M, R, L) {
  const ratio = R / mainSequenceRadius(M);
  if (L > 3e5 && ratio > 3) return 'Ia+';
  if (ratio > 25) return L > 3e4 ? 'Ia' : 'Iab';
  if (ratio > 8) return M > 8 ? 'Ib' : 'III';
  if (ratio > 2.2) return 'IV';
  if (ratio < 0.02) return 'D'; // degenerate
  return 'V';
}

const CLASS_LABELS = {
  'Ia+': 'hypergiant',
  Ia: 'luminous supergiant',
  Iab: 'supergiant',
  Ib: 'supergiant',
  III: 'giant',
  IV: 'subgiant',
  V: 'main-sequence (dwarf)',
  D: 'degenerate',
};

const COLOUR_WORDS = [
  [3700, 'red'], [5200, 'orange'], [6000, 'yellow'], [7500, 'yellow-white'], [10000, 'white'], [30000, 'blue-white'], [Infinity, 'blue'],
];

export function colourWord(T) {
  for (const [lim, word] of COLOUR_WORDS) if (T < lim) return word;
  return 'blue';
}

/** Full classification of a star from its physical parameters. */
export function classify({ mass, radius, temperature, luminosity }) {
  const spec = spectralType(temperature);
  const lum = luminosityClass(mass, radius, luminosity);
  const words = CLASS_LABELS[lum] ?? lum;
  const colour = colourWord(temperature);
  let flavour = `${colour} ${words}`;
  if (lum === 'V' && mass < 0.6) flavour = 'red dwarf';
  if (lum === 'V' && temperature > 30000) flavour = 'blue main-sequence O star';
  if (mass > 40 && temperature > 25000 && radius < 30) flavour = 'Wolf–Rayet / stripped massive star';
  return { spectral: spec, lumClass: lum, type: `${spec} ${lum}`, description: flavour };
}

/** Approximate bolometric correction (mag) so bolometric magnitudes can be shown as visual ones. */
export function bolometricCorrection(T) {
  const x = Math.log10(clamp(T, 1000, 1e6)) - 3.762;
  // Clamped at −5 mag: even a 10⁵ K breakout flash keeps a few percent of its light in the visual band.
  return Math.max(-5, T > 5800 ? -8 * x * x : -20 * x * x);
}

export function validMass(M) {
  return clamp(M, MIN_STAR_MASS, MAX_STAR_MASS);
}
