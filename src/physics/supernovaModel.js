/**
 * Parametric supernova model.
 *
 * Everything here is an analytic approximation chosen to reproduce the
 * order of magnitude and time ordering of real events, evaluated as a pure
 * function of time so any instant (including light-travel-delayed views)
 * can be sampled directly. Key ingredients and their sources:
 *
 *  - Explosion energy ~1e51 erg ("1 foe"), ejecta mass = star − remnant.
 *  - Ejecta velocity from uniform-sphere kinetic energy: E = 3/10 · M · v_max².
 *  - Shock breakout time = envelope radius / internal shock speed (~10⁴ km/s).
 *  - Plateau luminosity & duration from the Popov (1993) analytic scaling
 *    for hydrogen-rich (Type II-P) envelopes.
 *  - Radioactive tail: ⁵⁶Ni → ⁵⁶Co → ⁵⁶Fe decay powers (Nadyozhin 1994),
 *    diffused through the ejecta with an Arnett-style rise.
 *  - Free expansion until the swept-up ISM mass equals the ejecta mass, then
 *    Sedov–Taylor R ∝ t^(2/5).
 *  - Neutrino burst ~3e53 erg over a few seconds (SN 1987A).
 */
import {
  SOLAR_MASS_KG, SOLAR_RADIUS_M, SOLAR_LUMINOSITY_W, DAY_S, YEAR_S, HOUR_S, FOE, C,
  NI56_HALF_LIFE_S, CO56_HALF_LIFE_S, NI56_DECAY_POWER, CO56_DECAY_POWER,
  NEUTRINO_BURST_ENERGY_J, NEUTRINO_BURST_TIMESCALE_S, INTERNAL_SHOCK_SPEED, ISM_DENSITY,
  MIN_CORE_COLLAPSE_MASS, CHANDRASEKHAR_MASS, WOLF_RAYET_MASS, PISN_MIN_MASS, PISN_MAX_MASS, SOLAR_METALLICITY,
  NEUTRON_STAR_RADIUS_M,
} from '../core/constants.js';
import { clamp, logLogInterp, smoothstep } from '../core/math.js';
import { predictRemnant, schwarzschildRadius } from './remnants.js';

const LN2 = Math.LN2;
const TAU_NI = NI56_HALF_LIFE_S / LN2;
const TAU_CO = CO56_HALF_LIFE_S / LN2;

// Timing of the first second (core-collapse), from hydrodynamic simulations.
const T_INFALL = 0.05; // s, collapse becomes supersonic
const T_BOUNCE = 0.25; // s, core reaches nuclear density
const T_SHOCK_STALL = 0.3; // s
const T_SHOCK_REVIVAL = 0.5; // s, neutrino heating relaunches the shock

export const SCENARIO_INFO = {
  'core-collapse': { label: 'Type II core-collapse supernova', natural: true },
  'wr-collapse': { label: 'Type Ib/c stripped-envelope supernova', natural: true },
  hypernova: { label: 'Hypernova (collapsar, rapidly rotating core)', natural: true },
  pisn: { label: 'Pair-instability supernova', natural: true },
  'forced-collapse': { label: 'Experimental forced core collapse', natural: false },
  thermonuclear: { label: 'Experimental thermonuclear disruption (Type Ia-like)', natural: false },
};

/**
 * Decide which explosion channel a star would take.
 * @returns {string|null} scenario key or null when the star cannot explode naturally and forcing is off
 */
export function determineScenario(star, forced = false) {
  const M = star.mass;
  const Z = star.metallicity ?? SOLAR_METALLICITY;
  const rot = star.rotation ?? 0.05;
  if (M >= MIN_CORE_COLLAPSE_MASS) {
    if (M >= PISN_MIN_MASS && M <= PISN_MAX_MASS && Z / SOLAR_METALLICITY < 0.3) return 'pisn';
    if (rot >= 0.7 && M >= 25) return 'hypernova';
    if (M >= WOLF_RAYET_MASS) return 'wr-collapse';
    return 'core-collapse';
  }
  if (!forced) return null;
  return M < CHANDRASEKHAR_MASS ? 'thermonuclear' : 'forced-collapse';
}

/**
 * Build the model for a star at the moment of collapse.
 * @param {object} star star definition (mass, metallicity, rotation)
 * @param {{R:number, L:number, T:number}} collapseState star surface state at collapse (solar units)
 * @param {string} scenario scenario key
 */
export function buildSupernovaModel(star, collapseState, scenario) {
  const M = star.mass;
  const remnant = predictRemnant({
    mass: M, metallicity: star.metallicity, rotation: star.rotation,
    scenario: scenario === 'hypernova' ? 'hypernova' : scenario === 'pisn' ? 'pisn' : scenario === 'thermonuclear' ? 'thermonuclear' : scenario === 'forced-collapse' ? 'forced-collapse' : 'natural',
  });
  const Mpre = presupernovaMass(star); // mass left after stellar winds (M☉)
  remnant.mass = Math.min(remnant.mass, 0.7 * Mpre);
  remnant.radiusM = remnant.type === 'black-hole' ? schwarzschildRadius(remnant.mass) : remnant.radiusM;
  const Mej = Math.max(0.05, Mpre - remnant.mass); // M☉
  const MejKg = Mej * SOLAR_MASS_KG;
  const Rstar = collapseState.R * SOLAR_RADIUS_M; // m
  const Lstar = collapseState.L * SOLAR_LUMINOSITY_W; // W
  const hydrogenRich = collapseState.R > 30 && scenario !== 'wr-collapse' && scenario !== 'thermonuclear';

  let E, MNi; // J, M☉
  switch (scenario) {
    case 'hypernova': E = 20 * FOE; MNi = 0.5; break;
    case 'pisn': E = clamp(10 * Math.pow(M / 140, 2), 10, 100) * FOE; MNi = clamp(0.05 * (M - 100), 1, 40); break;
    case 'wr-collapse': E = clamp(0.6 + 0.04 * M, 1, 3) * FOE; MNi = clamp(0.05 + 0.002 * M, 0.08, 0.25); break;
    case 'forced-collapse': E = 0.7 * Math.sqrt(M / 8) * FOE; MNi = clamp(0.05 * (M / 8), 0.01, 0.1); break;
    case 'thermonuclear': E = 1.3 * (M / 1.4) * FOE; MNi = clamp(0.5 * (M / 1.4), 0.05, 0.8); break;
    default: E = clamp(0.6 + 0.04 * M, 0.6, 2.5) * FOE; MNi = clamp(0.03 + 0.004 * M, 0.02, 0.3);
  }
  MNi = Math.min(MNi, Mej * 0.6);

  const vMax = Math.sqrt((10 / 3) * E / MejKg); // m/s, outer ejecta
  const vPhot = 0.55 * vMax; // characteristic photospheric velocity
  const shockSpeed = Math.min(INTERNAL_SHOCK_SPEED, 0.9 * C);
  const hasCollapse = scenario !== 'thermonuclear' && scenario !== 'pisn';
  const tLaunch = hasCollapse ? T_SHOCK_REVIVAL : 0;
  const tBreakout = tLaunch + Rstar / shockSpeed;
  const tBoDur = Math.max(10, 2 * Rstar / C, Rstar / vMax * 0.05); // flash duration ~ light/shock crossing of outer layers
  const LBreakout = clamp(1e38 * Math.pow(collapseState.R / 500, 0.7) * Math.pow(vMax / 5e6, 1.5), 1e35, 5e39); // W
  const TBreakout = clamp(2e5 * Math.pow(collapseState.R / 500, -0.25), 5e4, 1e6);

  // Popov (1993) plateau scaling, normalised to a canonical II-P (R=500 R☉, E=1 foe, Mej=10 M☉)
  const LPlateau = hydrogenRich
    ? 1e35 * Math.pow(collapseState.R / 500, 2 / 3) * Math.pow(E / FOE, 5 / 6) * Math.pow(Mej / 10, -0.5)
    : 0;
  const tPlateau = hydrogenRich
    ? 100 * DAY_S * Math.pow(collapseState.R / 500, 1 / 6) * Math.pow(E / FOE, -1 / 6) * Math.pow(Mej / 10, 0.5)
    : 0;
  const tRise = 5 * DAY_S;
  // Arnett diffusion timescale for radioactively powered light (stripped envelopes, Ia, hypernovae)
  const tDiff = 16 * DAY_S * Math.pow(Mej / 3, 0.75) * Math.pow(E / FOE, -0.25);
  const tGamma = 200 * DAY_S * (Mej / 3) * Math.pow(E / FOE, -0.5); // gamma-ray trapping timescale

  // Free expansion → Sedov–Taylor when swept ISM mass equals ejecta mass
  const RSedov = Math.cbrt((3 * MejKg) / (4 * Math.PI * ISM_DENSITY));
  const tSedov = tBreakout + (RSedov - Rstar) / vMax;

  const remnantRadius = remnant.type === 'black-hole' ? schwarzschildRadius(remnant.mass) : remnant.radiusM;
  const pulsarLum = remnant.type === 'pulsar' ? 1e31 : remnant.type === 'magnetar' ? 3e30 : 0;

  const params = {
    scenario, label: SCENARIO_INFO[scenario].label, natural: SCENARIO_INFO[scenario].natural,
    hydrogenRich, hasCollapse,
    Mtotal: Mpre, Minitial: M, Mej, MNi, E, vMax, vPhot, Rstar, Lstar, Tstar: collapseState.T,
    tBreakout, tBoDur, LBreakout, TBreakout, LPlateau, tPlateau, tRise, tDiff, tGamma, RSedov, tSedov,
    remnant, remnantRadius, remnantMass: remnant.mass, pulsarLum,
    Eneutrino: hasCollapse ? NEUTRINO_BURST_ENERGY_J * (remnant.mass / 1.4) : 0,
  };

  const model = { params, star, collapseState, remnant, scenario };
  model.luminosity = (t) => luminosityAt(params, t);
  model.timeline = buildTimeline(params);
  model.eradTable = buildRadiatedEnergyTable(params);
  model.stateAt = (t) => stateAt(model, t);
  model.peak = findPeak(params);
  return model;
}

// ----------------------------------------------------------------------------

/**
 * Mass at the moment of collapse after a lifetime of stellar winds.
 * Red supergiants lose ~10–20%; stars above ~40 M☉ at solar metallicity are
 * stripped to Wolf–Rayet cores of only 10–30 M☉ (Woosley, Heger & Weaver 2002).
 */
export function presupernovaMass(star) {
  const M = star.mass;
  const zRel = (star.metallicity ?? SOLAR_METALLICITY) / SOLAR_METALLICITY;
  if (M < MIN_CORE_COLLAPSE_MASS) return M;
  if (M >= WOLF_RAYET_MASS) return zRel < 0.3 ? 0.85 * M : clamp(12 + 0.1 * M, 10, 30);
  return M * (1 - 0.12 * Math.sqrt(M / 15) * Math.pow(zRel, 0.5));
}

/** Radioactive decay power (W) of the Ni/Co chain at time t after explosion. */
function decayPower(MNiKg, t) {
  if (t <= 0) return 0;
  const eNi = Math.exp(-t / TAU_NI);
  const eCo = Math.exp(-t / TAU_CO);
  return MNiKg * (NI56_DECAY_POWER * eNi + CO56_DECAY_POWER * (eCo - eNi) * (TAU_CO / (TAU_CO - TAU_NI)));
}

/** Bolometric luminosity (W) at time t (s) since core collapse. */
export function luminosityAt(p, t) {
  if (t < p.tBreakout) {
    // Surface still unaware; only a tiny pre-collapse brightening from the last burning stages.
    return p.Lstar;
  }
  const te = t - p.tBreakout; // time since breakout
  // 1) shock breakout flash and cooling envelope
  let L;
  if (te < p.tBoDur) L = p.LBreakout * smoothstep(0, p.tBoDur * 0.35, te);
  else L = p.LBreakout * Math.pow(te / p.tBoDur, -1.7); // shock-cooling decline (SN 1987A: 10⁴⁵ → 10⁴² erg/s in ~1 day)
  // 2) hydrogen recombination plateau (II-P)
  if (p.LPlateau > 0) {
    const ramp = 1 - Math.exp(-te / p.tRise);
    const end = 1 / (1 + Math.exp((te - p.tPlateau) / (6 * DAY_S)));
    L += p.LPlateau * ramp * end;
  }
  // 3) radioactive decay, diffused and with gamma-ray leakage at late times
  const diffusion = 1 - Math.exp(-Math.pow(te / p.tDiff, 2)); // Arnett-style rise
  const trapping = 1 - Math.exp(-Math.pow(p.tGamma / Math.max(te, 1), 2)); // gamma rays leak out late
  L += decayPower(p.MNi * SOLAR_MASS_KG, te) * diffusion * trapping;
  // 4) pulsar wind nebula / compact object at very late times
  L += p.pulsarLum / Math.pow(1 + te / (1000 * YEAR_S), 2);
  return Math.max(L, 1e20);
}

/** Optical peak: the maximum after the breakout flash has faded (from 1.5 days to 2 years). */
function findPeak(p) {
  let best = { t: p.tBreakout, L: 0 };
  const tStart = Math.max(1.5 * DAY_S, p.tBoDur * 8);
  for (let i = 0; i <= 300; i++) {
    const t = p.tBreakout + tStart * Math.pow(10, (i / 300) * Math.log10((YEAR_S * 2) / tStart));
    const L = luminosityAt(p, t);
    if (L > best.L) best = { t, L };
  }
  return best;
}

/** Cumulative radiated energy on a log grid so ∫L dt can be sampled at any time. */
function buildRadiatedEnergyTable(p) {
  const N = 900;
  const t0 = 1e-2;
  const t1 = 1e14;
  const ts = new Float64Array(N);
  const Es = new Float64Array(N);
  let acc = 0;
  let prevT = 0;
  let prevL = luminosityAt(p, 0);
  for (let i = 0; i < N; i++) {
    const t = t0 * Math.pow(t1 / t0, i / (N - 1));
    const L = luminosityAt(p, t);
    acc += 0.5 * (L + prevL) * (t - prevT);
    ts[i] = t; Es[i] = acc; prevT = t; prevL = L;
  }
  return (t) => {
    if (t <= ts[0]) return 0;
    if (t >= ts[N - 1]) return Es[N - 1];
    const f = (Math.log(t / t0) / Math.log(t1 / t0)) * (N - 1);
    const i = Math.floor(f);
    const a = f - i;
    return Es[i] + (Es[Math.min(i + 1, N - 1)] - Es[i]) * a;
  };
}

// Proto-neutron-star / remnant core temperature anchors (K) vs time after bounce (s)
const CORE_T_COOLING = [[0.25, 3e11], [10, 5e10], [YEAR_S, 1e9], [1e3 * YEAR_S, 3e8], [1e5 * YEAR_S, 1e8], [1e7 * YEAR_S, 5e7]];

/** Full state at time t (s) since collapse. Pure function of t. */
function stateAt(model, t) {
  const p = model.params;
  const s = {
    t,
    L: luminosityAt(p, t),
    Rstar: p.Rstar,
    remnantMass: p.remnantMass,
    remnantRadius: p.remnantRadius,
    Erad: model.eradTable(t),
    Enu: p.hasCollapse && t > T_BOUNCE ? p.Eneutrino * (1 - Math.exp(-(t - T_BOUNCE) / NEUTRINO_BURST_TIMESCALE_S)) : 0,
    Ekin: 0,
    flash: 0,
    instability: 0,
    ejectaVisible: false,
    ejectaAge: 0,
    remnantVisible: false,
    breakoutProgress: 0,
    coreR: 3e6, coreT: 4.5e9, coreRho: 1e9,
    Rshock: 0, vShock: 0, Rphot: p.Rstar, Tcolor: p.Tstar, Mbound: p.Mtotal,
    Rej: 0,
  };

  // ---- Core ----
  if (p.hasCollapse) {
    if (t < 0) {
      s.instability = clamp(1 + t / DAY_S, 0, 1) * 0.6;
    } else if (t < T_BOUNCE) {
      const f = t / T_BOUNCE; // infall: radius falls roughly as free fall
      const ff = 1 - Math.pow(f, 2.5);
      s.coreR = Math.max(NEUTRON_STAR_RADIUS_M * 2, 3e6 * ff);
      s.coreT = 4.5e9 * Math.pow(3e6 / s.coreR, 1.2);
      s.coreRho = 1e9 * Math.pow(3e6 / s.coreR, 3);
      s.instability = 0.6 + 0.4 * f;
    } else {
      const tb = t - T_BOUNCE;
      s.coreR = p.remnant.type === 'black-hole'
        ? (t < 5 ? NEUTRON_STAR_RADIUS_M * 1.5 : p.remnantRadius)
        : NEUTRON_STAR_RADIUS_M * (1 + 1.5 * Math.exp(-tb / 2)); // proto-NS shrinks as it cools
      s.coreT = p.remnant.type === 'black-hole' && t >= 5 ? NaN : logLogInterp(CORE_T_COOLING, Math.max(t, 0.25));
      s.coreRho = p.remnant.type === 'black-hole' && t >= 5 ? Infinity : 4e14 * (t < 2 ? 0.5 + 0.5 * Math.min(1, tb / 2) : 1);
      s.instability = t < 2 ? 1 : 0;
      s.remnantVisible = t > (p.remnant.type === 'black-hole' ? 5 : 2);
    }
  } else {
    // Thermonuclear / pair instability: no compact core; a detonation wave sweeps the star.
    if (t < 0) s.instability = clamp(1 + t / (HOUR_S * 2), 0, 1) * 0.6;
    else { s.coreT = t < 3 ? 6e9 : 1e9; s.coreRho = t < 3 ? 2e9 : 1e6; s.instability = t < 3 ? 1 : 0; }
    s.coreR = t < 3 ? 5e6 : 0;
  }

  // ---- Shock / ejecta ----
  const tLaunch = p.hasCollapse ? T_SHOCK_REVIVAL : 0;
  if (t > tLaunch && t < p.tBreakout) {
    const frac = (t - tLaunch) / (p.tBreakout - tLaunch);
    s.Rshock = frac * p.Rstar;
    s.vShock = INTERNAL_SHOCK_SPEED;
    s.breakoutProgress = frac;
    s.Ekin = p.E * Math.pow(frac, 1.2);
    s.Mbound = p.Mtotal - (p.Mej) * Math.pow(frac, 1.5);
    s.instability = Math.max(s.instability, 0.3 + 0.7 * Math.pow(frac, 3)); // surface shudders only as the shock nears it
  } else if (t >= p.tBreakout) {
    const te = t - p.tBreakout;
    s.ejectaVisible = true;
    s.ejectaAge = te;
    s.Ekin = p.E;
    s.Mbound = p.remnantMass;
    s.breakoutProgress = 1;
    if (t < p.tSedov) {
      s.Rshock = p.Rstar + p.vMax * te;
      s.vShock = p.vMax;
    } else {
      const tS = p.tSedov - p.tBreakout;
      s.Rshock = p.RSedov * Math.pow(te / tS, 0.4);
      s.vShock = 0.4 * s.Rshock / te;
    }
    s.Rej = s.Rshock;
    s.flash = te < p.tBoDur * 4 ? Math.exp(-te / (p.tBoDur * 1.2)) * smoothstep(0, p.tBoDur * 0.3, te) : 0;
    // Photosphere: expands with the inner ejecta, then recedes in mass coordinate after the plateau/peak
    const tRecede = p.LPlateau > 0 ? p.tPlateau : p.tDiff * 3;
    const recede = 1 / (1 + Math.pow(te / (tRecede * 1.5), 3));
    // After ~3 years the ejecta are transparent: there is no photosphere any more.
    s.Rphot = te > 3 * YEAR_S ? 0 : Math.min(p.Rstar + p.vPhot * te * Math.max(recede, 0.15), s.Rshock);
    // Colour temperature: hot flash cooling toward the hydrogen-recombination temperature
    const Tcool = p.TBreakout * Math.pow(Math.max(te, p.tBoDur) / p.tBoDur, -0.5);
    s.Tcolor = clamp(Tcool, te > tRecede ? 3500 : 5200, p.TBreakout);
  } else {
    s.Tcolor = p.Tstar;
  }
  s.remnantVisible = s.remnantVisible && s.ejectaVisible ? true : s.remnantVisible;

  // ---- Phase label ----
  s.phase = phaseAt(p, t);
  return s;
}

const PHASES = {
  'pre-collapse': 'Final burning stage',
  collapse: 'Core collapse',
  bounce: 'Core bounce & shock formation',
  'shock-propagation': 'Shock crossing the envelope',
  breakout: 'Shock breakout',
  rise: 'Envelope expansion & rise to peak',
  plateau: 'Plateau (hydrogen recombination)',
  peak: 'Peak luminosity',
  decline: 'Radioactive decline',
  nebular: 'Nebular phase — free expansion',
  sedov: 'Sedov–Taylor phase — sweeping the ISM',
  fading: 'Remnant fading into the interstellar medium',
  detonation: 'Detonation wave crossing the star',
};

function phaseAt(p, t) {
  const key = phaseKey(p, t);
  return { key, name: PHASES[key] };
}

function phaseKey(p, t) {
  if (t < 0) return 'pre-collapse';
  if (!p.hasCollapse) {
    if (t < p.tBreakout) return 'detonation';
  } else {
    if (t < T_BOUNCE) return 'collapse';
    if (t < T_SHOCK_REVIVAL) return 'bounce';
    if (t < p.tBreakout) return 'shock-propagation';
  }
  const te = t - p.tBreakout;
  if (te < p.tBoDur * 4) return 'breakout';
  if (p.LPlateau > 0) {
    if (te < p.tRise * 3) return 'rise';
    if (te < p.tPlateau) return 'plateau';
  } else {
    if (te < p.tDiff * 1.2) return 'rise';
    if (te < p.tDiff * 1.8) return 'peak';
  }
  if (te < YEAR_S) return 'decline';
  if (t < p.tSedov) return 'nebular';
  if (t < 1e5 * YEAR_S) return 'sedov';
  return 'fading';
}

// ----------------------------------------------------------------------------

function buildTimeline(p) {
  const ev = [];
  const add = (t, title, detail) => ev.push({ t, title, detail });
  const bo = p.tBreakout;
  if (p.hasCollapse) {
    add(-DAY_S, 'Silicon burning — iron core near the Chandrasekhar mass', 'The last fusion stage lasts about a day; the iron core cannot generate energy.');
    add(0, 'Core instability detected', 'Electron capture and photodisintegration remove pressure support from the iron core.');
    add(T_INFALL, 'Core collapse begins', 'The inner core falls inward at up to a quarter of the speed of light.');
    add(T_BOUNCE, 'Core bounce at nuclear density', 'The core stiffens at ~3×10¹⁴ g/cm³ and rebounds, launching a shock.');
    add(T_SHOCK_STALL, 'Shock forms and stalls', 'Photodisintegration of infalling iron drains the shock energy.');
    add(T_SHOCK_REVIVAL, 'Neutrino heating revives the shock', 'A fraction of the 10⁵³ erg neutrino burst is absorbed behind the shock.');
    add(10, 'Neutrino burst complete', `~${(p.Eneutrino / 1e-7).toExponential(1)} erg carried away by neutrinos.`);
    if (p.remnant.type === 'black-hole') add(5, 'Proto-neutron star collapses into a black hole', 'Fallback pushes the core past the maximum neutron-star mass.');
    else add(2, 'Proto-neutron star forms', `A ${p.remnant.mass.toFixed(2)} M☉ neutron star begins to cool.`);
  } else if (p.scenario === 'pisn') {
    add(-HOUR_S * 2, 'Pair production softens the core', 'Photons convert into electron–positron pairs, removing pressure.');
    add(0, 'Runaway collapse triggers explosive oxygen burning', 'The whole core burns in seconds; the star is completely unbound.');
  } else {
    add(-HOUR_S, 'Thermonuclear runaway ignites', 'Degenerate matter cannot expand to regulate burning: a detonation begins.');
    add(0, 'Detonation wave launched', 'The burning front races outward through the star.');
  }
  if (bo > 60) add(bo * 0.5, 'Shock halfway through the envelope', 'The surface still shows no sign of what has happened deep inside.');
  add(bo, 'Shock breakout — first light', `The shock reaches the surface: a ${(p.TBreakout / 1e3).toFixed(0)},000 K flash lasting ~${Math.round(p.tBoDur / 60)} min.`);
  add(bo + p.tBoDur * 4, 'Breakout flash fades', 'The outer layers cool and expand at thousands of km/s.');
  if (p.LPlateau > 0) {
    add(bo + p.tRise * 2, 'Approaching peak brightness', 'The expanding photosphere grows while cooling toward 6,000 K.');
    add(bo + p.tPlateau, 'Plateau ends', 'The hydrogen recombination front reaches the inner ejecta; brightness drops sharply.');
    add(bo + p.tPlateau + 30 * DAY_S, 'Radioactive tail', 'Light is now powered by ⁵⁶Co decay (half-life 77 days).');
  } else {
    add(bo + p.tDiff * 1.3, 'Peak luminosity', 'Photons diffuse out of the ejecta; power comes from ⁵⁶Ni decay.');
    add(bo + p.tDiff * 5, 'Radioactive tail', 'The light curve settles onto the ⁵⁶Co decay slope.');
  }
  add(bo + YEAR_S, 'Nebular phase', 'The ejecta become transparent; emission lines reveal freshly made elements.');
  if (p.remnant.type === 'pulsar' || p.remnant.type === 'magnetar') {
    add(bo + 3 * YEAR_S, 'Pulsar wind nebula forms', 'The spinning neutron star blows a bubble of relativistic particles inside the ejecta.');
  }
  add(p.tSedov, 'Sedov–Taylor phase begins', `Swept-up interstellar gas now outweighs the ejecta (R ≈ ${(p.RSedov / 3.086e16).toFixed(1)} pc).`);
  add(3e4 * YEAR_S, 'Radiative phase', 'The shock slows below ~200 km/s and the shell cools and fragments.');
  add(2e5 * YEAR_S, 'Remnant merges with the interstellar medium', 'Only the compact object and a diffuse, chemically enriched cloud remain.');
  ev.sort((a, b) => a.t - b.t);
  return ev;
}

/** Summary numbers for comparison mode and the library cards. */
export function summarizeSupernova(model) {
  const p = model.params;
  return {
    label: p.label,
    natural: p.natural,
    peakLuminosityW: model.peak.L,
    peakTime: model.peak.t,
    explosionEnergyJ: p.E,
    ejectaMass: p.Mej,
    nickelMass: p.MNi,
    ejectaVelocity: p.vMax,
    breakoutTime: p.tBreakout,
    plateauDuration: p.tPlateau,
    remnant: p.remnant,
    sedovTime: p.tSedov,
    neutrinoEnergyJ: p.Eneutrino,
  };
}
