/**
 * What a supernova looks like — and does — from Earth.
 *
 * Brightness is exact photometry (inverse-square law + magnitude scale).
 * The environmental estimates are deliberately simple scalings anchored to
 * published work: ozone depletion from Gehrels et al. (2003), the ~8–10 pc
 * "kill distance" from Fields et al. (2020), neutrino dose from the
 * standard 10⁵³ erg burst. They are order-of-magnitude educational
 * estimates, not predictions.
 */
import {
  SOLAR_LUMINOSITY_W, SUN_ABS_BOL_MAG, LIGHT_YEAR_M, PARSEC_M, AU_M, FOE,
  MAG_SUN, MAG_FULL_MOON, MAG_VENUS_MAX, MAG_SIRIUS, MAG_DAYTIME_LIMIT, MAG_NAKED_EYE_LIMIT, YEAR_S,
} from '../core/constants.js';
import { bolometricCorrection } from './stellarModel.js';
import { clamp } from '../core/math.js';

const SOLAR_CONSTANT = 1361; // W/m²
const OZONE_REF_PC = 8; // Gehrels et al. 2003: ~47% column depletion at 8 pc for a canonical SN
const OZONE_REF_FRACTION = 0.47;
const NEUTRINO_LETHAL_AU = 2.3; // distance where a 10⁵³ erg neutrino burst delivers ~5 Sv

export const lightTravelYears = (distanceLy) => distanceLy; // by definition of the light-year

/** Apparent bolometric and (approximate) visual magnitude of a source of luminosity L (W). */
export function apparentMagnitudes(Lwatts, distanceLy, Tcolor = 6000) {
  const dPc = Math.max(distanceLy * LIGHT_YEAR_M / PARSEC_M, 1e-12);
  const Mbol = SUN_ABS_BOL_MAG - 2.5 * Math.log10(Math.max(Lwatts, 1e-30) / SOLAR_LUMINOSITY_W);
  const mBol = Mbol + 5 * Math.log10(dPc) - 5;
  const mV = mBol - bolometricCorrection(Tcolor);
  return { mBol, mV, Mbol };
}

/** Illuminance in lux from visual magnitude (Sun ≈ −26.74 → ~1.05×10⁵ lux). */
export const illuminanceLux = (mV) => Math.pow(10, (-14.18 - mV) / 2.5);

export function brightnessComparison(mV) {
  const ratio = (ref) => Math.pow(10, (ref - mV) / 2.5);
  let label;
  if (mV > MAG_NAKED_EYE_LIMIT) label = 'Too faint for the naked eye';
  else if (mV > 1) label = 'An ordinary naked-eye star';
  else if (mV > MAG_SIRIUS) label = 'Among the brightest stars in the sky';
  else if (mV > MAG_VENUS_MAX) label = 'Brighter than any star; rivals Venus';
  else if (mV > -8) label = 'Visible in broad daylight';
  else if (mV > MAG_FULL_MOON) label = 'Casts shadows at night; a brilliant point brighter than Venus';
  else if (mV > -20) label = 'Outshines the full Moon — a point of light painful to look at';
  else if (mV > MAG_SUN) label = 'A second sun in the sky';
  else label = 'Brighter than the Sun — the sky itself glows';
  return {
    vsSirius: ratio(MAG_SIRIUS),
    vsVenus: ratio(MAG_VENUS_MAX),
    vsFullMoon: ratio(MAG_FULL_MOON),
    vsSun: ratio(MAG_SUN),
    visibleDaytime: mV < MAG_DAYTIME_LIMIT,
    castsShadows: mV < -8,
    label,
  };
}

/**
 * Environmental / biological impact estimate for the peak of an explosion.
 * @param {object} p supernova params (from buildSupernovaModel)
 * @param {number} peakL peak luminosity (W)
 * @param {number} distanceLy
 */
export function assessImpact(p, peakL, distanceLy) {
  const dM = Math.max(distanceLy * LIGHT_YEAR_M, 1e3);
  const dPc = dM / PARSEC_M;
  const dAU = dM / AU_M;
  const eRel = p.E / FOE;

  const irradiance = peakL / (4 * Math.PI * dM * dM); // W/m² at Earth, at peak
  const vsSolar = irradiance / SOLAR_CONSTANT;

  // Ozone: column depletion ∝ gamma/X-ray fluence ∝ E / d²
  const ozoneDepletion = clamp(OZONE_REF_FRACTION * Math.pow(OZONE_REF_PC / dPc, 2) * Math.sqrt(eRel), 0, 0.95);
  const uvbIncrease = ozoneDepletion * 2; // ~2% more UV-B per 1% ozone lost (radiation amplification factor)
  // Cosmic-ray flux multiplier once the remnant shell reaches the solar system (thousands of years later)
  const cosmicRayFactor = 1 + 30 * Math.pow(10 / dPc, 2) * eRel;
  const ejectaArrivalYr = dM / p.vMax / YEAR_S;
  const neutrinoDoseSv = p.hasCollapse ? 5 * Math.pow(NEUTRINO_LETHAL_AU / dAU, 2) * (p.Eneutrino / 3e46) : 0;

  let tier;
  if (vsSolar > 1 || neutrinoDoseSv > 1) tier = 'sterilizing';
  else if (vsSolar > 0.05 || ozoneDepletion > 0.6) tier = 'catastrophic';
  else if (ozoneDepletion > 0.3) tier = 'severe';
  else if (ozoneDepletion > 0.05) tier = 'significant';
  else if (ozoneDepletion > 0.005 || cosmicRayFactor > 1.5) tier = 'minor';
  else tier = 'spectacle';

  return {
    distanceLy, distancePc: dPc, distanceAU: dAU,
    irradiance, vsSolar, ozoneDepletion, uvbIncrease, cosmicRayFactor, ejectaArrivalYr, neutrinoDoseSv,
    tier, ...TIER_INFO[tier],
  };
}

export const TIER_INFO = {
  spectacle: {
    title: 'Spectacular but harmless',
    summary: 'Far enough that only the light reaches us in any meaningful way. A once-in-history sky event with no measurable effect on Earth\'s biosphere.',
    colour: '#5fd3a6',
  },
  minor: {
    title: 'Minor environmental effects',
    summary: 'Slight ozone reduction and a modest rise in cosmic-ray flux for millennia after the shell arrives. Detectable in ice cores and sea-floor sediments (as ⁶⁰Fe), not dangerous.',
    colour: '#8fd35f',
  },
  significant: {
    title: 'Significant environmental stress',
    summary: 'Noticeable ozone loss and elevated UV-B for years. Increased cancer rates and damage to plankton and crops are plausible; an extinction-level event is unlikely at this distance.',
    colour: '#e6c84a',
  },
  severe: {
    title: 'Severe — extinction-level risk',
    summary: 'Inside the ~25–30 light-year "kill distance": tens of percent of the ozone layer destroyed for years, doubled UV-B, intense cosmic-ray bombardment. Comparable to the proposed cause of the late Ordovician extinction.',
    colour: '#f0863c',
  },
  catastrophic: {
    title: 'Catastrophic',
    summary: 'Hard radiation ionises the upper atmosphere, ozone is largely destroyed, and the peak brightness rivals daylight. Complex surface life would be severely affected worldwide.',
    colour: '#ef4f4f',
  },
  sterilizing: {
    title: 'Sterilizing',
    summary: 'The radiant energy at Earth is comparable to or exceeds sunlight, and/or the neutrino burst alone delivers a lethal dose. No plausible survival for surface life. (A purely hypothetical scenario.)',
    colour: '#ff2e7a',
  },
};

/** Convenience: magnitude of the star as it is now (pre-supernova) from Earth. */
export function quiescentMagnitude(star) {
  const L = star.luminosity * SOLAR_LUMINOSITY_W;
  return apparentMagnitudes(L, star.distanceLy, star.temperature);
}
