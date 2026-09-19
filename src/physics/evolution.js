/**
 * Stellar evolution tracks.
 *
 * Each star gets a list of stages (main sequence, giant branches, late
 * burning...) with a physical duration, a "display" duration used by
 * Stellar Evolution Mode, and start/end values of radius, luminosity,
 * effective temperature, core temperature and core density. Values within a
 * stage are interpolated logarithmically. The numbers are representative of
 * detailed models (e.g. Woosley, Heger & Weaver 2002; Iben 1991), not fits
 * to them: the aim is the right order of magnitude and the right sequence.
 */
import {
  HELIUM_WD_MASS_LIMIT, MIN_CORE_COLLAPSE_MASS, WOLF_RAYET_MASS, PISN_MIN_MASS, PISN_MAX_MASS,
  SOLAR_METALLICITY, SOLAR_TEFF_K,
} from '../core/constants.js';
import { mainSequenceLuminosity, mainSequenceRadius, effectiveTemperature, mainSequenceLifetime } from './stellarModel.js';
import { clamp, logLerp, lerp } from '../core/math.js';

/** Radius (R☉) from luminosity and temperature via Stefan–Boltzmann. */
const radiusFromLT = (L, T) => Math.sqrt(L) / Math.pow(T / SOLAR_TEFF_K, 2);

/** Build a state {R, L, T, Tc, rhoc} — provide either R or T with L. */
function st({ R, L, T, Tc, rhoc }) {
  if (R == null) R = radiusFromLT(L, T);
  if (T == null) T = effectiveTemperature(L, R);
  return { R, L, T, Tc, rhoc };
}

const stage = (key, name, fusion, description, durationYr, displaySec, start, end, extra = {}) => ({
  key, name, fusion, description, durationYr, displaySec, start, end, ...extra,
});

/**
 * Returns the evolution track for a star description.
 * @param {{mass:number, metallicity?:number, rotation?:number}} star
 */
export function buildEvolutionTrack(star) {
  const M = star.mass;
  const Z = star.metallicity ?? SOLAR_METALLICITY;
  const zRel = Z / SOLAR_METALLICITY;
  const tauMS = mainSequenceLifetime(M, Z);
  const Lms = mainSequenceLuminosity(M);
  const Rms = mainSequenceRadius(M);
  const stages = [];
  let terminal;

  if (M < HELIUM_WD_MASS_LIMIT) {
    // ---- Red dwarf: fully convective, burns all its hydrogen, never ignites helium ----
    stages.push(stage('ms', 'Main sequence', 'H → He (core, fully convective)',
      'A fully convective red dwarf mixes its whole interior, so it can burn almost all of its hydrogen. Lifetimes run to trillions of years.',
      tauMS, 10,
      st({ R: Rms, L: Lms, Tc: 8e6, rhoc: 100 }),
      st({ R: Rms * 1.1, L: Lms * 3, Tc: 1.2e7, rhoc: 500 })));
    stages.push(stage('blue-dwarf', 'Blue dwarf phase', 'H → He (last hydrogen)',
      'As hydrogen runs out the star heats up and turns bluer instead of expanding — a "blue dwarf" phase no star has yet reached in the real Universe.',
      tauMS * 0.05, 6,
      st({ R: Rms * 1.1, L: Lms * 3, Tc: 1.2e7, rhoc: 500 }),
      st({ R: Rms * 0.6, L: Lms * 4, Tc: 1e7, rhoc: 5e3 })));
    stages.push(stage('he-wd-contraction', 'Contraction to helium white dwarf', 'none (degenerate helium core)',
      'Without helium ignition the star simply contracts under gravity until electron degeneracy pressure halts the collapse.',
      tauMS * 0.01, 6,
      st({ R: Rms * 0.6, L: Lms * 4, Tc: 1e7, rhoc: 5e3 }),
      st({ R: 0.02, L: 0.01, Tc: 5e6, rhoc: 1e6 }), { remnantForming: true }));
    terminal = 'helium-white-dwarf';
  } else if (M < MIN_CORE_COLLAPSE_MASS) {
    // ---- Low / intermediate mass: giant branches, planetary nebula, white dwarf ----
    const Lrgb = Math.max(2500, 4 * Lms);
    const Lagb = Lrgb * 2.5;
    const heL = M < 2 ? 60 : Lrgb * 0.5;
    stages.push(stage('ms', 'Main sequence', 'H → He (core)',
      'Core hydrogen fusion. The star brightens slowly as helium ash accumulates and the core contracts.',
      tauMS, 10,
      st({ R: Rms, L: Lms, Tc: 1.4e7 * Math.pow(M, 0.2), rhoc: 100 }),
      st({ R: Rms * 1.4, L: Lms * 1.8, Tc: 2e7 * Math.pow(M, 0.2), rhoc: 200 })));
    stages.push(stage('subgiant', 'Subgiant — hydrogen shell burning', 'H → He (shell)',
      'The core is now inert helium. Hydrogen burns in a shell around it while the core contracts and the envelope begins to expand.',
      tauMS * 0.03, 5,
      st({ R: Rms * 1.4, L: Lms * 1.8, Tc: 2e7, rhoc: 200 }),
      st({ R: Rms * 3.5, L: Lms * 2.5, Tc: 5e7, rhoc: 1e4 })));
    stages.push(stage('rgb', 'Red giant branch', 'H → He (shell)',
      'The envelope swells to over a hundred solar radii and cools to ~3,700 K while the helium core keeps contracting.',
      tauMS * 0.06, 8,
      st({ R: Rms * 3.5, L: Lms * 2.5, Tc: 5e7, rhoc: 1e4 }),
      st({ L: Lrgb, T: 3700, Tc: 1e8, rhoc: 1e5 })));
    stages.push(stage('he-core', M < 2 ? 'Helium flash & horizontal branch' : 'Core helium burning (blue loop)', 'He → C, O (core)',
      M < 2
        ? 'Helium ignites explosively in the degenerate core (the helium flash). The star then settles onto the horizontal branch, smaller and hotter.'
        : 'Helium ignites gently in the non-degenerate core; the star contracts and heats in a "blue loop" before expanding again.',
      tauMS * 0.12, 7,
      st({ L: Lrgb, T: 3700, Tc: 1e8, rhoc: 1e5 }),
      st({ L: heL, T: M < 2 ? 5000 : 7000, Tc: 1.5e8, rhoc: 2e4 })));
    stages.push(stage('agb', 'Asymptotic giant branch', 'H and He (double shell)',
      'Helium and hydrogen burn in thin shells around a degenerate carbon–oxygen core. Thermal pulses and a slow, dense wind strip the envelope.',
      tauMS * 0.02, 8,
      st({ L: heL, T: M < 2 ? 5000 : 7000, Tc: 1.5e8, rhoc: 2e4 }),
      st({ L: Lagb, T: 3200, Tc: 3e8, rhoc: 1e6 })));
    stages.push(stage('pn', 'Planetary nebula ejection', 'H, He (shells, dying out)',
      'The last of the envelope drifts away as a glowing planetary nebula, exposing the hot degenerate core.',
      2e4, 7,
      st({ L: Lagb, T: 3200, Tc: 3e8, rhoc: 1e6 }),
      st({ R: 0.015, L: 100, Tc: 1e8, rhoc: 2e6 }), { remnantForming: true, nebula: true }));
    terminal = 'white-dwarf';
  } else {
    // ---- Massive stars: core collapse ----
    const isWR = M >= WOLF_RAYET_MASS;
    const isPISN = M >= PISN_MIN_MASS && M <= PISN_MAX_MASS && zRel < 0.3;
    const Tc0 = 3.5e7 * Math.pow(M / 15, 0.1);
    const Lpost = Lms * (M > 25 ? 2 : 3);
    stages.push(stage('ms', 'Main sequence', 'H → He (core, CNO cycle)',
      'Hydrogen burns through the CNO cycle in a large convective core. Even at this stage the star is tens of thousands of times more luminous than the Sun.',
      tauMS, 9,
      st({ R: Rms, L: Lms, Tc: Tc0, rhoc: 5 }),
      st({ R: Rms * 1.6, L: Lms * 1.7, Tc: Tc0 * 1.4, rhoc: 30 })));

    if (isWR) {
      stages.push(stage('lbv', 'Luminous blue variable', 'H → He (shell)',
        'Near the Eddington limit the star becomes unstable and throws off solar masses of gas in giant eruptions.',
        tauMS * 0.02, 6,
        st({ R: Rms * 1.6, L: Lms * 1.7, Tc: Tc0 * 1.4, rhoc: 30 }),
        st({ L: Lms * 2, T: 15000, Tc: 8e7, rhoc: 300 })));
      stages.push(stage('wr', 'Wolf–Rayet star', 'He → C, O (core)',
        'Winds have stripped the hydrogen envelope. The bare helium core burns at over 50,000 K and drives a wind at thousands of km/s.',
        tauMS * 0.08, 8,
        st({ L: Lms * 2, T: 15000, Tc: 8e7, rhoc: 300 }),
        st({ L: Lms * 1.5, T: 70000, Tc: 2.5e8, rhoc: 5e3 })));
    } else {
      stages.push(stage('hgap', 'Core contraction & expansion to supergiant', 'H → He (shell)',
        'The exhausted core contracts while a hydrogen-burning shell drives the envelope outward. The star crosses the Hertzsprung gap in a few thousand years.',
        tauMS * 0.006, 6,
        st({ R: Rms * 1.6, L: Lms * 1.7, Tc: Tc0 * 1.4, rhoc: 30 }),
        st({ L: Lpost, T: 3800, Tc: 1.2e8, rhoc: 1e3 })));
      stages.push(stage('rsg', 'Red supergiant — core helium burning', 'He → C, O (core)',
        'Helium fuses to carbon and oxygen in the core while the envelope, now hundreds of solar radii across, churns with enormous convection cells.',
        tauMS * 0.1, 9,
        st({ L: Lpost, T: 3800, Tc: 1.2e8, rhoc: 1e3 }),
        st({ L: Lpost * 1.4, T: 3550, Tc: 2.5e8, rhoc: 1e4 })));
    }

    const late = stages[stages.length - 1].end;
    const keepR = { L: late.L, T: late.T };
    stages.push(stage('carbon', 'Carbon burning', 'C → Ne, Na, Mg',
      'Carbon ignites in the core. From here on neutrino losses carry away most of the energy, so each stage is dramatically shorter than the last.',
      clamp(1200 * Math.pow(15 / M, 1.5), 50, 3000), 5,
      st({ ...keepR, Tc: 6e8, rhoc: 1e5 }), st({ ...keepR, Tc: 9e8, rhoc: 1e6 })));
    if (isPISN) {
      stages.push(stage('pair-instability', 'Pair instability', 'O → Si (runaway)',
        'In the 140–260 M☉ window the core becomes so hot that photons turn into electron–positron pairs, removing pressure support and triggering a runaway collapse and explosive oxygen burning.',
        1, 5,
        st({ ...keepR, Tc: 9e8, rhoc: 1e6 }), st({ ...keepR, Tc: 3e9, rhoc: 1e7 }), { instability: true }));
      terminal = 'pisn';
    } else {
      stages.push(stage('neon', 'Neon burning', 'Ne → O, Mg',
        'Neon photodisintegrates and burns in a phase lasting about a year.',
        1.2, 4,
        st({ ...keepR, Tc: 1.2e9, rhoc: 4e6 }), st({ ...keepR, Tc: 1.6e9, rhoc: 8e6 })));
      stages.push(stage('oxygen', 'Oxygen burning', 'O → Si, S',
        'Oxygen fuses to silicon and sulphur, building the last layer before the iron core.',
        0.5, 4,
        st({ ...keepR, Tc: 1.8e9, rhoc: 1e7 }), st({ ...keepR, Tc: 2.3e9, rhoc: 3e7 })));
      stages.push(stage('silicon', 'Silicon burning — iron core grows', 'Si → Fe, Ni (nuclear statistical equilibrium)',
        'In about a day silicon burns to iron-group nuclei. Iron cannot release energy by fusion: the core has no fuel left and grows toward the Chandrasekhar mass.',
        1 / 365, 6,
        st({ ...keepR, Tc: 3e9, rhoc: 1e8 }), st({ ...keepR, Tc: 4.5e9, rhoc: 1e9 }), { instability: true }));
      terminal = isWR ? 'wr-collapse' : 'core-collapse';
    }
  }

  let total = 0;
  for (const s of stages) { s.startYr = total; total += s.durationYr; s.endYr = total; }
  return { stages, totalLifetimeYr: total, mainSequenceYr: tauMS, terminal };
}

/**
 * Apply observed values to the star's current stage so the simulation starts
 * from the star as we see it, then blends toward model values.
 */
export function applyObservedState(track, star) {
  const key = star.currentStageKey ?? 'ms';
  const idx = Math.max(0, track.stages.findIndex((s) => s.key === key));
  const s = track.stages[idx];
  const p = clamp(star.stageProgress ?? 0.3, 0, 0.98);
  const observed = st({ R: star.radius, L: star.luminosity, T: star.temperature, Tc: 0, rhoc: 0 });
  // The model value at progress p should equal the observed value: rescale both ends.
  for (const q of ['R', 'L', 'T']) {
    const modelAtP = logLerp(s.start[q], s.end[q], p);
    const ratio = observed[q] / modelAtP;
    s.start[q] *= ratio;
    s.end[q] *= ratio;
  }
  // Keep the stage after continuous with the adjusted end (only for R/L/T).
  const next = track.stages[idx + 1];
  if (next) for (const q of ['R', 'L', 'T']) next.start[q] = s.end[q];
  return { stageIndex: idx, progress: p };
}

/** Interpolated state inside a stage. */
export function stateAtStage(track, stageIndex, progress) {
  const s = track.stages[clamp(stageIndex, 0, track.stages.length - 1)];
  const p = clamp(progress, 0, 1);
  const q = (k) => logLerp(Math.max(s.start[k], 1e-30), Math.max(s.end[k], 1e-30), p);
  return {
    stage: s,
    stageIndex,
    progress: p,
    R: q('R'),
    L: q('L'),
    T: q('T'),
    Tc: q('Tc'),
    rhoc: q('rhoc'),
    ageYr: s.startYr + s.durationYr * p,
    instability: s.instability ? p : 0,
    remnantForming: !!s.remnantForming,
  };
}

/** Stage index and progress for a given age in years. */
export function stageForAge(track, ageYr) {
  const stages = track.stages;
  if (ageYr >= track.totalLifetimeYr) return { stageIndex: stages.length - 1, progress: 1 };
  for (let i = 0; i < stages.length; i++) {
    const s = stages[i];
    if (ageYr < s.endYr) return { stageIndex: i, progress: (ageYr - s.startYr) / s.durationYr };
  }
  return { stageIndex: stages.length - 1, progress: 1 };
}

export const TERMINAL_LABELS = {
  'helium-white-dwarf': 'Fades into a helium white dwarf (no supernova)',
  'white-dwarf': 'Planetary nebula, then a white dwarf (no supernova)',
  'core-collapse': 'Iron core collapse → Type II supernova',
  'wr-collapse': 'Stripped-envelope core collapse → Type Ib/c supernova',
  pisn: 'Pair-instability supernova (complete disruption)',
};

export { lerp };
