/**
 * Creates normalised star objects from catalogue presets or user input and
 * derives the descriptive summary shown in the library and the builder.
 */
import { buildEvolutionTrack, stageForAge, stateAtStage, TERMINAL_LABELS } from '../physics/evolution.js';
import { classify, luminosityFrom, validMass } from '../physics/stellarModel.js';
import { predictRemnant } from '../physics/remnants.js';
import { determineScenario, SCENARIO_INFO } from '../physics/supernovaModel.js';
import { quiescentMagnitude } from '../physics/earthEffects.js';
import { SOLAR_METALLICITY } from '../core/constants.js';
import { clamp } from '../core/math.js';

let customCounter = 0;

export function starFromPreset(preset) {
  return { ...preset, custom: false, observed: true };
}

/**
 * Build a custom star. Radius/temperature default to the evolution model at
 * the requested age; overrides are treated as "observed" values for that stage.
 */
export function buildCustomStar(params) {
  const mass = validMass(params.mass ?? 1);
  const metallicity = clamp(params.metallicity ?? SOLAR_METALLICITY, 1e-4, 0.05);
  const rotation = clamp(params.rotation ?? 0.05, 0, 0.98);
  const track = buildEvolutionTrack({ mass, metallicity, rotation });
  const ageFraction = clamp(params.ageFraction ?? 0.5, 0, 0.995);
  const ageYr = ageFraction * track.totalLifetimeYr;
  const { stageIndex, progress } = stageForAge(track, ageYr);
  const state = stateAtStage(track, stageIndex, progress);
  const radius = params.radiusOverride > 0 ? params.radiusOverride : state.R;
  const temperature = params.temperatureOverride > 0 ? params.temperatureOverride : state.T;
  const luminosity = luminosityFrom(radius, temperature);
  customCounter++;
  return {
    id: params.id ?? `custom-${Date.now().toString(36)}-${customCounter}`,
    name: params.name?.trim() || `Custom ${mass.toFixed(1)} M☉ star`,
    custom: true,
    observed: false,
    mass, metallicity, rotation, radius, temperature, luminosity, ageYr,
    ageFraction,
    distanceLy: clamp(params.distanceLy ?? 500, 1e-5, 1e7),
    ra: ((params.ra ?? 6) % 24 + 24) % 24,
    dec: clamp(params.dec ?? 0, -90, 90),
    currentStageKey: track.stages[stageIndex].key,
    stageProgress: progress,
    radiusOverride: params.radiusOverride || 0,
    temperatureOverride: params.temperatureOverride || 0,
    type: classify({ mass, radius, temperature, luminosity }).type,
    blurb: 'A user-defined star. All values are model predictions, not observations.',
  };
}

/** Derived, human-readable properties for any star (preset or custom). */
export function describeStar(star) {
  const track = buildEvolutionTrack(star);
  const cls = classify({ mass: star.mass, radius: star.radius, temperature: star.temperature, luminosity: star.luminosity });
  const remnant = predictRemnant({ mass: star.mass, metallicity: star.metallicity, rotation: star.rotation });
  const scenario = determineScenario(star, false);
  const forcedScenario = determineScenario(star, true);
  const stageIdx = Math.max(0, track.stages.findIndex((s) => s.key === (star.currentStageKey ?? 'ms')));
  const path = track.stages.map((s) => s.name);
  const mag = quiescentMagnitude(star);
  return {
    track,
    classification: cls,
    remnant,
    naturalScenario: scenario,
    naturalLabel: scenario ? SCENARIO_INFO[scenario].label : 'No supernova (too low in mass)',
    forcedScenario,
    forcedLabel: forcedScenario ? SCENARIO_INFO[forcedScenario].label : null,
    terminal: TERMINAL_LABELS[track.terminal],
    lifetimeYr: track.totalLifetimeYr,
    mainSequenceYr: track.mainSequenceYr,
    remainingYr: Math.max(0, track.totalLifetimeYr - (star.ageYr ?? 0)),
    currentStage: track.stages[stageIdx],
    path,
    apparentMagnitude: mag.mV,
    isSupernovaProgenitor: !!scenario,
  };
}
