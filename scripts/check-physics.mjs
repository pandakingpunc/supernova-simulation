/**
 * Quick sanity checks for the physics layer. Run with `npm run check:physics`.
 * Prints key derived numbers for each catalogue star and asserts they are
 * within plausible ranges. No test framework needed.
 */
import { STAR_CATALOG } from '../src/data/starCatalog.js';
import { buildEvolutionTrack, applyObservedState, stateAtStage, TERMINAL_LABELS } from '../src/physics/evolution.js';
import { buildSupernovaModel, determineScenario } from '../src/physics/supernovaModel.js';
import { apparentMagnitudes, assessImpact } from '../src/physics/earthEffects.js';
import { classify } from '../src/physics/stellarModel.js';
import { altAz, localSiderealTime, sunRaDec, moonApprox } from '../src/physics/skyMath.js';
import { fmtDuration, sci, fmtYears } from '../src/core/units.js';
import { DAY_S, YEAR_S } from '../src/core/constants.js';

let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; console.log('  ✗', msg); } };

for (const star of STAR_CATALOG) {
  const track = buildEvolutionTrack(star);
  const pos = applyObservedState(track, star);
  const now = stateAtStage(track, pos.stageIndex, pos.progress);
  const cls = classify({ mass: star.mass, radius: now.R, temperature: now.T, luminosity: now.L });
  console.log(`\n${star.name}  (${cls.type}, ${cls.description})`);
  console.log(`  lifetime ${fmtYears(track.totalLifetimeYr)}  MS ${fmtYears(track.mainSequenceYr)}  → ${TERMINAL_LABELS[track.terminal]}`);
  console.log(`  now: R=${now.R.toFixed(2)} L=${sci(now.L)} T=${now.T.toFixed(0)} Tc=${sci(now.Tc)} ρc=${sci(now.rhoc)} stage=${now.stage.key}`);
  check(Math.abs(now.R / star.radius - 1) < 0.02, `observed radius not reproduced (${now.R} vs ${star.radius})`);
  check(Math.abs(now.T / star.temperature - 1) < 0.02, `observed temperature not reproduced`);

  const scenario = determineScenario(star, true);
  const last = track.stages[track.stages.length - 1];
  const collapse = stateAtStage(track, track.stages.length - 1, 1);
  const model = buildSupernovaModel(star, collapse, scenario);
  const p = model.params;
  const peakMag = apparentMagnitudes(model.peak.L, star.distanceLy, 6000);
  const impact = assessImpact(p, model.peak.L, star.distanceLy);
  console.log(`  SN: ${p.label}${p.natural ? '' : ' [FORCED]'}  E=${sci(p.E / 1e-7)} erg  Mej=${p.Mej.toFixed(2)}  MNi=${p.MNi.toFixed(3)}  vMax=${(p.vMax / 1e3).toFixed(0)} km/s`);
  console.log(`  breakout after ${fmtDuration(p.tBreakout)}  L_bo=${sci(p.LBreakout)} W  plateau ${fmtDuration(p.tPlateau)} @ ${sci(p.LPlateau)} W  peak ${sci(model.peak.L)} W at ${fmtDuration(model.peak.t)}`);
  console.log(`  remnant: ${p.remnant.name} ${p.remnant.mass.toFixed(2)} M☉  Sedov at ${fmtDuration(p.tSedov)} (R=${(p.RSedov / 3.086e16).toFixed(1)} pc)`);
  console.log(`  Earth: peak m_V ≈ ${peakMag.mV.toFixed(1)}  tier=${impact.tier}  ozone=${(impact.ozoneDepletion * 100).toFixed(2)}%  irradiance=${sci(impact.irradiance)} W/m²`);
  const L1 = model.luminosity(p.tBreakout + 30 * DAY_S);
  const L2 = model.luminosity(p.tBreakout + 300 * DAY_S);
  const L3 = model.luminosity(p.tBreakout + 10 * YEAR_S);
  console.log(`  L(30d)=${sci(L1)}  L(300d)=${sci(L2)}  L(10yr)=${sci(L3)}  Erad(1yr)=${sci(model.eradTable(YEAR_S) / 1e-7)} erg`);
  check(model.peak.L > 1e33 && model.peak.L < 1e40, `peak luminosity implausible ${model.peak.L}`);
  check(p.vMax > 1e6 && p.vMax < 1e8, `ejecta velocity implausible ${p.vMax}`);
  check(L1 > L3 && L2 > L3, 'light curve not declining');
  check(model.timeline.length > 8, 'timeline too short');
  for (const t of [-1, 0, 0.1, 0.3, 1, 100, p.tBreakout * 0.5, p.tBreakout, p.tBreakout + 3600, p.tBreakout + 30 * DAY_S, YEAR_S, 1e4 * YEAR_S]) {
    const s = model.stateAt(t);
    check(isFinite(s.L) && s.L > 0, `state L invalid at t=${t}`);
    check(isFinite(s.Rshock), `Rshock invalid at t=${t}`);
    check(s.phase && s.phase.name, `phase missing at t=${t}`);
  }
}

// Sky math: Betelgeuse from 41°N on a January night around 22:00 should be high in the south-east/south.
const lst = localSiderealTime(15, 22);
const b = altAz(5.9195, 7.407, lst, 41);
console.log(`\nBetelgeuse alt ${b.alt.toFixed(1)}° az ${b.az.toFixed(1)}° (Jan 15, 22:00, 41°N)`);
check(b.alt > 30 && b.alt < 60, 'Betelgeuse altitude unexpected');
const sunNoon = altAz(sunRaDec(172).raH, sunRaDec(172).decDeg, localSiderealTime(172, 12), 41);
console.log(`Sun at noon on Jun 21 from 41°N: alt ${sunNoon.alt.toFixed(1)}° (expect ~72°)`);
check(Math.abs(sunNoon.alt - 72.4) < 2, 'solstice noon sun wrong');
const moon = moonApprox(262);
console.log(`Moon on day 262: age ${moon.ageDays.toFixed(1)} d, illuminated ${(moon.illuminated * 100).toFixed(0)}%, mag ${moon.magnitude.toFixed(1)}`);

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll physics checks passed.');
process.exit(failures ? 1 : 0);
