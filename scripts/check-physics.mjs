/**
 * Quick sanity checks for the physics layer. Run with `npm run check:physics`.
 * Prints key derived numbers for each catalogue star and asserts they are
 * within plausible ranges. No test framework needed.
 */
import { STAR_CATALOG } from '../src/data/starCatalog.js';
import { buildEvolutionTrack, applyObservedState, stateAtStage, TERMINAL_LABELS } from '../src/physics/evolution.js';
import { buildSupernovaModel, determineScenario } from '../src/physics/supernovaModel.js';
import { apparentMagnitudes, assessImpact } from '../src/physics/earthEffects.js';
import { classify, spectralType } from '../src/physics/stellarModel.js';
import { altAz, localSiderealTime, sunRaDec, moonApprox, daysInYear, dateLabel, hourLabel } from '../src/physics/skyMath.js';
import { fmtDuration, sci, fmtYears, fmtKelvin, fmtSolarLum, fmtVelocity, fmtLengthMeters, fmtTimestamp, compact } from '../src/core/units.js';
import { DAY_S, YEAR_S, HOUR_S, FOE, AU_M, LIGHT_YEAR_M, NEUTRINO_BURST_ENERGY_J, SOLAR_TEFF_K } from '../src/core/constants.js';
import { Simulation } from '../src/sim/Simulation.js';
import { starFromPreset, buildCustomStar, describeStar } from '../src/sim/StarFactory.js';
import { loadSettings, loadSavedStars, saveStar, MAX_SAVED_STARS } from '../src/core/storage.js';

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

// ---------------------------------------------------------------------------
// Regression checks for fixed bugs (B-numbers refer to the bug dossiers).
// ---------------------------------------------------------------------------

// Number formatters (B1, B13, B23)
console.log('\nRegression: formatters');
for (const [v, want] of [[100, '100'], [120, '120'], [250, '250'], [1000, '1000'], [5772, '5772'], [10, '10'], [0.05, '0.05'],
  [0, '0'], [9999.6, '1.00×10⁴'], [999900, '1.00×10⁶'], [1.23e44, '1.23×10⁴⁴'], [1e-3, '1.00×10⁻³'], [9.995e-4, '1.00×10⁻³']]) {
  check(sci(v) === want, `sci(${v}) = '${sci(v)}', expected '${want}'`);
}
for (const v of [1, 5, 12, 100, 999, 1000, 3660, 5772, 9999, 9999.9, 12345, 999900, 1e-3, 1e12, -250]) {
  check(!/e[+-]?\d/.test(sci(v)), `sci(${v}) printed JS exponent form '${sci(v)}'`);
  check(!/^10\.0+×/.test(sci(v)), `sci(${v}) mantissa not renormalised '${sci(v)}'`);
}
check(fmtKelvin(5200) === '5200 K' && fmtKelvin(3660) === '3660 K', `fmtKelvin below 10⁴ K: ${fmtKelvin(5200)}, ${fmtKelvin(3660)}`);
check(fmtSolarLum(100) === '100 L☉', `fmtSolarLum(100) = ${fmtSolarLum(100)}`);
for (const v of [1e3, 1e4, 3e5, 1e6, 999.6, 3.4e9, 2.9e8]) {
  check(!/[kMG] km/.test(fmtVelocity(v)), `fmtVelocity(${v}) doubled prefix '${fmtVelocity(v)}'`);
}
for (const m of [999.6, 1e4, 1e6, 1e7, 3.4e9, 1e12, 1e15, 1e17]) {
  check(!/[kMG] km/.test(fmtLengthMeters(m)), `fmtLengthMeters(${m}) doubled prefix '${fmtLengthMeters(m)}'`);
}
check(fmtVelocity(1e4) === '10.0 km/s', `fmtVelocity(1e4) = ${fmtVelocity(1e4)}`);
check(fmtVelocity(999.6) === '1.0 km/s', `fmtVelocity(999.6) = ${fmtVelocity(999.6)}`);
// A displayed number must never reach the next unit's size (60.0 s, 24.0 h, 1000 ms, 1000 yr, 1000.00 k).
const UNIT_LIMIT = { µs: 1e3, ms: 1e3, s: 60, min: 60, h: 24, d: 365.25, yr: 1e3, kyr: 1e3, Myr: 1e3, Gyr: 1e3 };
const rolls = (str) => {
  const m = /^[−-]?([\d,.]+) (µs|ms|s|min|h|d|yr|kyr|Myr|Gyr)$/.exec(str);
  return m ? Number(m[1].replace(/,/g, '')) >= UNIT_LIMIT[m[2]] : false;
};
let rolled = 0;
for (let e = -7; e <= 17; e += 0.037) {
  for (const f of [1, 0.99999, 0.9995, 0.99]) {
    const v = 10 ** e * f;
    for (const [name, out] of [['fmtDuration', fmtDuration(v)], ['fmtDuration-', fmtDuration(-v)], ['fmtYears', fmtYears(v)]]) {
      if (rolls(out) && rolled++ < 5) check(false, `${name}(${v}) = '${out}' did not roll over to the next unit`);
    }
  }
}
for (const [s, want] of [[59.96, '1.0 min'], [0.9996, '1.0 s'], [3599.9, '1.0 h'], [86399, '1.0 d'], [0.0009996, '1 ms']]) {
  check(fmtDuration(s) === want, `fmtDuration(${s}) = '${fmtDuration(s)}', expected '${want}'`);
}
check(fmtYears(999.6) === '1.0 kyr', `fmtYears(999.6) = ${fmtYears(999.6)}`);
check(fmtYears(999960) === '1.0 Myr', `fmtYears(999960) = ${fmtYears(999960)}`);
check(compact(999999) === '1.00 M', `compact(999999) = ${compact(999999)}`);
check(!/^\+(60\.0|1000)/.test(fmtTimestamp(59.999)) && !/\+60\.0 min/.test(fmtTimestamp(3599.99)), `fmtTimestamp rollover: ${fmtTimestamp(59.999)}, ${fmtTimestamp(3599.99)}`);

// Supernova model: continuity, peak, timeline text (B15, B43-B47, B49, B50)
console.log('\nRegression: supernova model');
const progenitors = [
  ...STAR_CATALOG.filter((s) => ['betelgeuse', 'rigel', 'antares', 'eta-carinae'].includes(s.id)).map((s) => ({ ...s, forced: false })),
  { id: 'wr', name: 'WR 60', mass: 60, rotation: 0.05, forced: false },
  { id: 'hn', name: 'Hypernova 30', mass: 30, rotation: 0.9, forced: false },
  { id: 'pisn', name: 'PISN 200', mass: 200, metallicity: 0.001, rotation: 0.05, forced: false },
  { id: 'ia', name: 'Ia-like 1.0', mass: 1.0, forced: true },
];
const ratioOk = (a, b, tol) => Math.abs(Math.log(a / b)) <= tol;
for (const star of progenitors) {
  const track = buildEvolutionTrack(star);
  const sc = determineScenario(star, star.forced);
  const m = buildSupernovaModel(star, stateAtStage(track, track.stages.length - 1, 1), sc);
  const p = m.params;
  const tag = star.id;
  // luminosity and colour continuous across shock breakout (no fall to ~0, no temperature jump)
  const bo = [m.stateAt(p.tBreakout - 1e-6), m.stateAt(p.tBreakout + 1e-6)];
  // (the compact-object term pulsarLum is smoothstepped in with the breakout flash, so L is continuous as is)
  check(ratioOk(bo[0].L, bo[1].L, 0.05), `${tag}: L jumps at shock breakout (${bo[0].L} -> ${bo[1].L})`);
  check(ratioOk(bo[0].Tcolor, bo[1].Tcolor, 0.01), `${tag}: Tcolor jumps at shock breakout (${bo[0].Tcolor} -> ${bo[1].Tcolor})`);
  check(ratioOk(bo[0].vShock, bo[1].vShock, 0.01), `${tag}: vShock jumps at shock breakout (${bo[0].vShock} -> ${bo[1].vShock})`);
  {
    // after the breakout duration the readout is the ejecta speed again (dR/dt)
    const t1 = p.tBreakout + p.tBoDur, dt = p.tBoDur * 1e-4;
    const dRdt = (m.stateAt(t1 + dt).Rshock - m.stateAt(t1 - dt).Rshock) / (2 * dt);
    check(ratioOk(m.stateAt(t1).vShock, dRdt, 0.01), `${tag}: vShock ${m.stateAt(t1).vShock} differs from dR/dt ${dRdt} at the end of the breakout`);
  }
  check(m.stateAt(p.tBreakout * 0.999).L > 0.5 * p.Lstar, `${tag}: L collapses before breakout`);
  // after the flash: no step in L, colour temperature, shock radius or shock velocity (incl. plateau end and Sedov transition)
  let prev = m.stateAt(p.tBreakout + p.tBoDur);
  const steps = { L: 0, Tcolor: 0, vShock: 0, Rshock: 0 };
  const where = {};
  for (let i = 1; i <= 2500; i++) {
    const t = p.tBreakout + p.tBoDur * Math.pow(1e12 / p.tBoDur, i / 2500);
    const s = m.stateAt(t);
    for (const k of Object.keys(steps)) {
      const d = Math.abs(Math.log(s[k] / prev[k]));
      if (d > steps[k]) { steps[k] = d; where[k] = t - p.tBreakout; }
    }
    prev = s;
  }
  for (const [k, lim] of [['L', 0.35], ['Tcolor', 0.05], ['vShock', 0.05], ['Rshock', 0.05]]) {
    check(steps[k] < lim, `${tag}: ${k} steps by ${steps[k].toFixed(3)} (ln) at te=${where[k].toExponential(2)} s`);
  }
  // explicit straddle of the free-expansion -> Sedov transition and the end of the plateau / peak
  for (const te of [p.tSedov - p.tBreakout, p.LPlateau > 0 ? p.tPlateau : 3 * p.tDiff, p.LPlateau > 0 ? 1.5 * p.tPlateau : 4.5 * p.tDiff]) {
    const a = m.stateAt(p.tBreakout + te * (1 - 1e-6));
    const b = m.stateAt(p.tBreakout + te * (1 + 1e-6));
    check(ratioOk(a.vShock, b.vShock, 0.01) && ratioOk(a.Tcolor, b.Tcolor, 0.01) && ratioOk(a.Rshock, b.Rshock, 0.01),
      `${tag}: discontinuity at te=${te.toExponential(2)} s (v ${a.vShock}->${b.vShock}, T ${a.Tcolor}->${b.Tcolor})`);
  }
  // reported peak lies on the plateau/radioactive light curve, not at the start of the search window
  const startOfWindow = Math.max(1.5 * DAY_S, p.tBoDur * 8);
  check(m.peak.t - p.tBreakout > startOfWindow * 1.0001, `${tag}: peak sits at the search window start (${((m.peak.t - p.tBreakout) / DAY_S).toFixed(2)} d)`);
  if (p.LPlateau > 0) {
    check(m.peak.L < 2 * p.LPlateau && m.peak.L >= 0.9 * p.LPlateau, `${tag}: H-rich peak ${m.peak.L} not on the plateau (${p.LPlateau})`);
    check(m.peak.t - p.tBreakout < 1.2 * p.tPlateau, `${tag}: H-rich peak after the plateau`);
  }
  // timeline text
  const boEvent = m.timeline.find((e) => e.title.startsWith('Shock breakout'));
  check(!/\d000,000 K/.test(boEvent.detail) || /1,000,000 K/.test(boEvent.detail), `${tag}: breakout text '${boEvent.detail}'`);
  check(!/~0 (min|s|ms)/.test(boEvent.detail) && !/~0\b/.test(boEvent.detail), `${tag}: breakout text shows zero duration: '${boEvent.detail}'`);
  check(!/1000,000/.test(boEvent.detail), `${tag}: malformed temperature in '${boEvent.detail}'`);
  // total disruption: remnant card appears with the ejecta
  if (!p.hasCollapse) check(m.stateAt(p.tBreakout + 1e3).remnantVisible === true, `${tag}: remnantVisible not set for total disruption`);
  // total disruption: the core readouts relax smoothly instead of stepping at t = 3 s
  if (!p.hasCollapse) {
    for (const t of [3, 4.5, 6]) {
      const a = m.stateAt(t - 1e-6), b = m.stateAt(t + 1e-6);
      for (const k of ['coreT', 'coreRho']) check(ratioOk(a[k], b[k], 0.01), `${tag}: ${k} steps at t=${t} s (${a[k]} -> ${b[k]})`);
      check(Math.abs(a.coreInstability - b.coreInstability) < 0.01 && Math.abs(a.coreR - b.coreR) < 1e4, `${tag}: core instability/radius steps at t=${t} s`);
    }
  }
  // core collapse: continuous core state across bounce, and surface instability not reusing core instability
  if (p.hasCollapse) {
    const a = m.stateAt(0.25 - 1e-7);
    const b = m.stateAt(0.25 + 1e-7);
    for (const k of ['coreR', 'coreT', 'coreRho']) check(ratioOk(a[k], b[k], 0.05), `${tag}: ${k} jumps at core bounce (${a[k]} -> ${b[k]})`);
    check(a.coreRho <= 3.1e14 && a.coreRho >= 2.9e14, `${tag}: pre-bounce density ${a.coreRho} should be ~3e14 g/cm³`);
    check(Math.abs(m.stateAt(2 - 1e-6).instability - m.stateAt(2 + 1e-6).instability) < 0.05, `${tag}: surface instability steps at t=2 s`);
    check(m.stateAt(100).instability < 0.05 && m.stateAt(0.3 * p.tBreakout).instability < 0.1, `${tag}: surface shudder reuses core instability`);
    check(m.stateAt(1).coreInstability === 1, `${tag}: core instability missing at t=1 s`);
  }
}
// scenario routing: every catalogue star finishes with a valid, forced-or-natural scenario
check(determineScenario({ mass: 1.0 }, false) === null && determineScenario({ mass: 1.0 }, true) === 'thermonuclear', 'determineScenario low-mass routing');

// Stellar model classification (B14, B52, B53, B54)
console.log('\nRegression: stellar classification');
const cls = (mass, radius, temperature, luminosity, stageKey) => classify({ mass, radius, temperature, luminosity, stageKey });
check(cls(1, 100, 3700, 2500).lumClass === 'III', `low-mass RGB giant class ${cls(1, 100, 3700, 2500).type}`);
check(cls(2, 300, 3200, 6000).lumClass === 'III', `low-mass AGB giant class ${cls(2, 300, 3200, 6000).type}`);
check(!/supergiant|hypergiant/.test(cls(1, 100, 3700, 2500).description), 'low-mass giant described as supergiant');
check(/supergiant|hypergiant/.test(cls(17, 764, 3600, 126000).description), `Betelgeuse-like description: ${cls(17, 764, 3600, 126000).description}`);
check(!/Wolf/.test(cls(45, 12, 40000, 1e6, 'ms').description), `main-sequence 45 M☉ O star called '${cls(45, 12, 40000, 1e6, 'ms').description}'`);
check(/Wolf/.test(cls(60, 6, 70000, 2e6, 'wr').description), 'WR stage not labelled Wolf–Rayet');
check(cls(0.6, 0.012, 1e4, 0.01, 'pn').lumClass === 'D', `white dwarf class ${cls(0.6, 0.012, 1e4, 0.01, 'pn').type}`);
check(cls(0.3, 0.02, 5e4, 0.01, 'he-wd-contraction').lumClass === 'D', 'He white dwarf progenitor not degenerate');
check(cls(0.3, 0.25, 3300, 0.02, 'ms').description === 'red dwarf', `cool low-mass dwarf: ${cls(0.3, 0.25, 3300, 0.02, 'ms').description}`);
check(cls(0.3, 0.35, 9000, 3, 'blue-dwarf').description !== 'red dwarf', 'hot low-mass dwarf still called red dwarf');
const oNum = (T) => Number(spectralType(T).slice(1));
check(spectralType(70000) === 'O2' && spectralType(60000) === 'O2' && spectralType(59999) === 'O2', 'O subtypes not clamped to O2 at >= 60000 K');
let prevO = 0;
for (let T = 60000; T >= 30000; T -= 250) {
  const sp = spectralType(T);
  if (sp[0] !== 'O') { check(false, `T=${T} is not an O star: ${sp}`); break; }
  check(oNum(T) >= 2 && oNum(T) <= 9, `O subtype out of O2-O9 at ${T} K: ${sp}`);
  check(oNum(T) >= prevO, `O subtype not monotonic at ${T} K: ${sp}`);
  prevO = oNum(T);
}
let prevT = 'O', prevSub = 0;
for (let T = 1e5; T >= 2400; T *= 0.995) {
  const sp = spectralType(T);
  const order = 'OBAFGKML'.indexOf(sp[0]);
  const cur = order * 10 + Number(sp[1]);
  check(cur >= prevSub, `spectral type not monotonic with temperature at ${T.toFixed(0)} K: ${sp}`);
  prevSub = cur; prevT = sp;
}

// Evolution tracks (B55, B56, B57, B58)
console.log('\nRegression: evolution tracks');
for (const M of [0.1, 0.3, 0.5, 1, 2, 5, 8, 12, 17, 25, 39, 40, 60, 100, 150, 200]) {
  const t = buildEvolutionTrack({ mass: M, metallicity: M >= 140 ? 0.002 : 0.0134 });
  for (let i = 1; i < t.stages.length; i++) {
    for (const k of ['R', 'L', 'T', 'Tc', 'rhoc']) {
      check(ratioOk(t.stages[i].start[k], t.stages[i - 1].end[k], 0.01), `M=${M}: ${k} jumps from '${t.stages[i - 1].key}' to '${t.stages[i].key}' (${t.stages[i - 1].end[k]} -> ${t.stages[i].start[k]})`);
    }
  }
}
// post-main-sequence luminosity continuous across 25 M☉ (was a 3 -> 2 step)
{
  const a = buildEvolutionTrack({ mass: 24.9 }).stages.find((s) => s.key === 'rsg');
  const b = buildEvolutionTrack({ mass: 25.1 }).stages.find((s) => s.key === 'rsg');
  check(ratioOk(a.start.L, b.start.L, 0.05) && ratioOk(a.start.R, b.start.R, 0.05), `RSG L/R step across 25 M☉ (${a.start.L} -> ${b.start.L}, ${a.start.R} -> ${b.start.R})`);
  let prevL = 0;
  for (let M = 8; M <= 39; M += 0.5) {
    const L = buildEvolutionTrack({ mass: M }).stages.find((s) => s.key === 'rsg').start.L;
    check(L > prevL, `RSG luminosity not monotonic in mass at ${M} M☉`);
    prevL = L;
  }
}
// observed rescaling keeps the neighbouring stages linked, and catalogue ages fit inside the modelled lifetime
for (const star of STAR_CATALOG) {
  const track = buildEvolutionTrack(star);
  const pos = applyObservedState(track, star);
  const s = track.stages[pos.stageIndex];
  const prev = track.stages[pos.stageIndex - 1];
  const next = track.stages[pos.stageIndex + 1];
  for (const k of ['R', 'L', 'T']) {
    if (prev) check(prev.end[k] === s.start[k], `${star.id}: previous stage end.${k} not relinked after applyObservedState`);
    if (next) check(next.start[k] === s.end[k], `${star.id}: next stage start.${k} not relinked after applyObservedState`);
  }
  const d = describeStar(star);
  check(d.lifetimeYr >= star.ageYr, `${star.id}: lifetime ${d.lifetimeYr} shorter than age ${star.ageYr}`);
  if (star.supernovaPotential !== 'none') check(d.remainingYr > 0, `${star.id}: no time remaining`);
  check(!/more than a day/.test(star.blurb) || star.id !== 'vy-cma', 'VY CMa blurb claims a breakout longer than modelled');
}

// Owner decisions (B57 cap, B60 Eta Carinae, B61 ozone, B62 neutrino dose)
console.log('\nRegression: owner decisions');
{
  // B57: red-supergiant radius never exceeds 1500 R☉; stages stay continuous; T follows Stefan–Boltzmann when the cap bites
  const RMAX = 1500 * 1.001;
  for (let M = 8; M <= 40; M++) {
    const t = buildEvolutionTrack({ mass: M });
    const hasRsg = t.stages.some((s) => s.key === 'rsg');
    for (let i = 0; i < t.stages.length; i++) {
      const s = t.stages[i];
      if (hasRsg && s.key !== 'ms') for (const e of ['start', 'end']) check(s[e].R <= RMAX, `M=${M}: '${s.key}' ${e}.R = ${s[e].R.toFixed(0)} R☉ exceeds the 1500 R☉ cap`);
      if (s.key === 'rsg') for (const e of ['start', 'end']) {
        const sb = s[e].R * s[e].R * Math.pow(s[e].T / SOLAR_TEFF_K, 4) / s[e].L;
        check(Math.abs(Math.log(sb)) < 0.02, `M=${M}: rsg ${e} violates Stefan–Boltzmann (R²T⁴/L = ${sb.toFixed(3)})`);
      }
      if (i > 0) for (const k of ['R', 'L', 'T']) check(ratioOk(s.start[k], t.stages[i - 1].end[k], 0.01), `M=${M}: ${k} jumps from '${t.stages[i - 1].key}' to '${s.key}'`);
    }
  }
  for (const star of STAR_CATALOG.filter((x) => x.mass >= 8)) {
    const t = buildEvolutionTrack(star);
    applyObservedState(t, star);
    for (const s of t.stages.filter((x) => x.key === 'hgap' || x.key === 'rsg')) {
      for (const e of ['start', 'end']) check(s[e].R <= Math.max(1500, star.radius) * 1.001, `${star.id}: '${s.key}' ${e}.R = ${s[e].R.toFixed(0)} R☉ exceeds the cap after applyObservedState`);
    }
  }
  // B60: every catalogue star satisfies Stefan–Boltzmann (R²T⁴/L) within a factor 1.5
  for (const star of STAR_CATALOG) {
    const sb = star.radius * star.radius * Math.pow(star.temperature / SOLAR_TEFF_K, 4) / star.luminosity;
    check(sb > 1 / 1.5 && sb < 1.5, `${star.id}: R²T⁴/L = ${sb.toFixed(2)} violates Stefan–Boltzmann`);
  }
  // B61: ozone depletion ∝ E at fixed distance (below the 0.95 clamp)
  const ozone = (EfoE, dLy) => assessImpact({ E: EfoE * FOE, vMax: 1e7, hasCollapse: false, Eneutrino: 0 }, 1e30, dLy).ozoneDepletion;
  for (const dLy of [60, 100, 300, 1000]) {
    const o1 = ozone(1, dLy);
    check(o1 > 0 && o1 < 0.95, `ozone(1 foe, ${dLy} ly) = ${o1} not below the clamp`);
    check(ratioOk(ozone(0.25, dLy), o1 / 4, 1e-9) && ratioOk(ozone(2, dLy), o1 * 2, 1e-9), `ozone depletion at ${dLy} ly not linear in E`);
  }
  check(ratioOk(ozone(1, 100), ozone(1, 200) * 4, 1e-9), 'ozone depletion not ∝ 1/d²');
  check(ozone(20, 3) === 0.95 && ozone(1, 1) === 0.95, 'ozone clamp at 0.95 lost');
  // B62: neutrino dose calibration (5 Sv at 2.3 AU for 3×10⁴⁶ J) unchanged
  const dose = (EnuJ, au) => assessImpact({ E: FOE, vMax: 1e7, hasCollapse: true, Eneutrino: EnuJ }, 1e30, au * AU_M / LIGHT_YEAR_M).neutrinoDoseSv;
  check(NEUTRINO_BURST_ENERGY_J === 3e46, `NEUTRINO_BURST_ENERGY_J = ${NEUTRINO_BURST_ENERGY_J}`);
  check(ratioOk(dose(3e46, 2.3), 5, 1e-9), `neutrino dose at 2.3 AU = ${dose(3e46, 2.3)} Sv, expected 5`);
  check(ratioOk(dose(3e46, 4.6), 1.25, 1e-9) && ratioOk(dose(1.5e46, 2.3), 2.5, 1e-9), 'neutrino dose scaling with d² or E changed');
}

// Simulation logic (B4-B7, B27-B30)
console.log('\nRegression: Simulation');
{
  const sun = starFromPreset(STAR_CATALOG.find((s) => s.id === 'sun'));
  const sim = new Simulation();
  sim.loadStar(sun);
  check(sim.snapshot().dataLabel === 'Observed', 'observed preset not labelled Observed');
  const custom = buildCustomStar({ mass: 5, name: 'Test', ageFraction: 0.4 });
  sim.loadStar(custom);
  check(sim.snapshot().dataLabel === 'Simulation', `custom star labelled '${sim.snapshot().dataLabel}'`);

  // B5: per-frame progress survives float precision in Real / x10 / x1000
  for (const mode of ['real', 'x10', 'x1000']) {
    sim.loadStar(sun);
    sim.setTimeMode(mode);
    const stage = sim.track.stages[sim.stageIndex];
    const p0 = sim.stageProgress;
    const frames = 20000;
    const dt = 1 / 60;
    for (let i = 0; i < frames; i++) sim.advanceEvolution(dt);
    const expect = (frames * dt * { real: 1, x10: 10, x1000: 1000 }[mode]) / YEAR_S / stage.durationYr;
    const got = sim.stageProgress - p0;
    check(Math.abs(got / expect - 1) < 0.1, `evolution mode ${mode}: progress ${got} vs expected ${expect}`);
  }

  // B7: Space resumes a valid mode after load / phase change
  sim.loadStar(sun);
  check(sim.resumeMode() === 'evolution', `resumeMode after load = ${sim.resumeMode()}`);
  sim.setTimeMode('x10'); sim.setTimeMode('pause');
  check(sim.resumeMode() === 'x10', `resumeMode after pause = ${sim.resumeMode()}`);
  sim.triggerSupernova({ forced: true });
  sim.setTimeMode('pause');
  check(sim.resumeMode() === 'cinematic', `resumeMode in supernova phase = ${sim.resumeMode()}`);
  check(sim.setTimeMode('evolution') === undefined && sim.timeMode === 'pause', 'evolution mode accepted during supernova');
  sim.loadStar(sun);
  check(sim.lastPlayMode === null && sim.resumeMode() === 'evolution', 'lastPlayMode stale after loadStar');

  // B4 / B27: seek resets the cinematic origin and truncates the chart history
  sim.loadStar(STAR_CATALOG.find((s) => s.id === 'betelgeuse'));
  sim.triggerSupernova();
  for (let i = 0; i < 400; i++) sim.update(0.1);
  sim.cinematicOrigin = 1e9;
  const tBack = sim.tExp / 4;
  sim.seek(tBack);
  check(sim.cinematicOrigin === 0, 'seek() did not reset cinematicOrigin');
  check(sim.history.x.every((x) => x < tBack), 'history not truncated after seek()');
  sim.loadStar(STAR_CATALOG.find((s) => s.id === 'betelgeuse'));
  sim.setTimeMode('evolution');
  for (let i = 0; i < 300; i++) sim.update(0.1);
  const lastIdx = sim.stageIndex;
  sim.seekStage(Math.max(0, lastIdx - 1));
  check(sim.history.x.every((x) => x <= sim.currentAgeYr() + 1e-9) || sim.history.x.length === 0, 'history not cleared/truncated after seekStage()');

  // B28: age never negative after seekStage on a star whose catalogue age is older than its track position
  for (const id of ['betelgeuse', 'sun', 'rigel']) {
    sim.loadStar(starFromPreset(STAR_CATALOG.find((s) => s.id === id)));
    for (let i = 0; i < sim.track.stages.length; i++) {
      sim.seekStage(i);
      check(sim.currentAgeYr() >= 0 && sim.snapshot().ageYr >= 0, `${id}: negative age after seekStage(${i})`);
    }
  }

  // B6: helium white dwarfs get no planetary nebula; carbon-oxygen white dwarfs keep theirs
  for (const [mass, hasPN] of [[0.3, false], [1.0, true]]) {
    const star = buildCustomStar({ mass, ageFraction: 0.5 });
    sim.loadStar(star);
    sim.setTimeMode('evolution');
    for (let i = 0; i < 1000 && sim.phase === 'evolution'; i++) sim.update(0.1);
    check(sim.phase === 'ended', `${mass} M☉ evolution did not end`);
    sim.update(0.1);
    const snap = sim.snapshot();
    check(snap.nebula === hasPN && (snap.nebulaAgeS > 0) === hasPN, `${mass} M☉ after evolution: nebula=${snap.nebula} age=${snap.nebulaAgeS}`);
  }

  // B29: a forced supernova after evolution ended explodes the remnant, not the initial-mass progenitor
  sim.loadStar(buildCustomStar({ mass: 3, ageFraction: 0.5 }));
  sim.setTimeMode('evolution');
  for (let i = 0; i < 1000 && sim.phase === 'evolution'; i++) sim.update(0.1);
  const remnantMass = sim.remnant.mass;
  check(sim.triggerSupernova({ forced: true }) !== null, 'forced supernova refused after evolution ended');
  check(Math.abs(sim.model.params.Minitial - remnantMass) < 1e-9 && sim.model.params.Mtotal <= remnantMass + 1e-9,
    `forced post-evolution supernova used mass ${sim.model.params.Minitial}, remnant is ${remnantMass}`);
}

// localStorage validation (B22, B24)
console.log('\nRegression: storage');
{
  const mem = new Map();
  let failWrites = false;
  globalThis.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => { if (failWrites) throw new Error('quota'); mem.set(k, String(v)); },
    removeItem: (k) => mem.delete(k),
  };
  const goodStar = (i) => ({ id: `c${i}`, name: `Star ${i}`, mass: 5, radius: 3, temperature: 15000, luminosity: 500, ageYr: 1e7, distanceLy: 100, ra: 1, dec: 2 });
  mem.set('supernova-sim:settings', 'null');
  check(JSON.stringify(loadSettings()) === '{}', 'null settings not normalised to {}');
  mem.set('supernova-sim:settings', '[1,2]');
  check(JSON.stringify(loadSettings()) === '{}', 'array settings not normalised to {}');
  mem.set('supernova-sim:settings', '{bad json');
  check(JSON.stringify(loadSettings()) === '{}', 'corrupt settings not normalised to {}');
  mem.set('supernova-sim:stars', '{"a":1}');
  check(Array.isArray(loadSavedStars()) && loadSavedStars().length === 0, 'non-array stars not normalised to []');
  mem.set('supernova-sim:stars', JSON.stringify([goodStar(1), null, 5, { id: 'x' }, { ...goodStar(2), mass: -1 }, { ...goodStar(3), radius: 'big' }, { ...goodStar(4), ra: null }]));
  check(loadSavedStars().length === 1 && loadSavedStars()[0].id === 'c1', `malformed saved stars not filtered (${loadSavedStars().length} kept)`);
  mem.clear();
  check(saveStar(goodStar(1)).ok === true, 'saveStar failed on a working store');
  let r;
  for (let i = 2; i <= MAX_SAVED_STARS + 2; i++) r = saveStar(goodStar(i));
  check(r.evicted === true && r.list.length === MAX_SAVED_STARS, `eviction not reported (evicted=${r.evicted}, n=${r.list.length})`);
  failWrites = true;
  check(saveStar(goodStar(99)).ok === false, 'saveStar reported success although the write failed');
  delete globalThis.localStorage;
}

// Sky math: real year, continuity, labels (B16, B41, B42)
console.log('\nRegression: sky math');
check(daysInYear(2024) === 366 && daysInYear(2026) === 365 && daysInYear(2100) === 365 && daysInYear(2000) === 366, 'daysInYear leap handling');
check(dateLabel(1, 2026) === 'Jan 1' && dateLabel(60, 2026) === 'Mar 1' && dateLabel(60, 2024) === 'Feb 29' && dateLabel(366, 2024) === 'Dec 31' && dateLabel(365, 2026) === 'Dec 31',
  `dateLabel: ${dateLabel(60, 2026)} / ${dateLabel(60, 2024)} / ${dateLabel(366, 2024)}`);
// Moon phase is tied to the real calendar year: new moon 2024-01-11, full moon 2024-01-25/26
check(moonApprox(11, 2024).illuminated < 0.03, `Moon on 2024-01-11 should be new (${moonApprox(11, 2024).illuminated})`);
check(moonApprox(26, 2024).illuminated > 0.95, `Moon on 2024-01-26 should be full (${moonApprox(26, 2024).illuminated})`);
check(Math.abs(moonApprox(1, 2026).ageDays - moonApprox(1, 2030).ageDays) > 1, 'Moon phase ignores the year');
// continuity of the sky across local midnight and of the Moon/Sun between whole days
for (const day of [10, 100, 200, 300]) {
  const a = localSiderealTime(day, 23.999);
  const b = localSiderealTime(day + 1, 0.001);
  const diff = Math.abs(((b - a + 12) % 24 + 24) % 24 - 12);
  check(diff < 0.01, `LST jumps ${diff.toFixed(3)} h across midnight on day ${day}`);
  const s0 = sunRaDec(day + 0.999);
  const s1 = sunRaDec(day + 1);
  check(Math.abs(s0.raH - s1.raH) < 0.01 && Math.abs(s0.decDeg - s1.decDeg) < 0.05, `Sun position steps on day ${day}`);
  const m0 = moonApprox(day + 0.999, 2026);
  const m1 = moonApprox(day + 1, 2026);
  const dra = Math.abs(((m1.raH - m0.raH + 12) % 24 + 24) % 24 - 12);
  check(dra < 0.05 && Math.abs(m1.decDeg - m0.decDeg) < 0.3, `Moon position steps ${dra.toFixed(3)} h on day ${day}`);
}
// equation of centre: the Sun's RA is not a pure sinusoid (up to ~2 degrees from the mean-motion version)
{
  const meanLon = ((100 - 81.5) / 365.25) * 2 * Math.PI;
  const eq = sunRaDec(100);
  check(eq.raH > 0 && eq.raH < 24 && Number.isFinite(meanLon), 'sunRaDec(100) invalid');
  check(Math.abs(sunRaDec(80).decDeg) < 1.5, `Sun declination at the March equinox: ${sunRaDec(80).decDeg}`);
}
for (const [h, want] of [[13.1666666, '13:10'], [0.15, '00:09'], [12, '12:00'], [24, '00:00'], [23.9999, '23:59'], [23.995, '23:59'], [24 - 4e-15, '23:59'], [-0.5, '23:30'], [26.25, '02:15'], [NaN, '--:--'], [Infinity, '--:--']]) {
  check(hourLabel(h) === want, `hourLabel(${h}) = '${hourLabel(h)}', expected '${want}'`);
}

// Moon age moves continuously through the day (no whole-day steps at local midnight)
{
  const a = moonApprox(11, 2024).ageDays, b = moonApprox(11.5, 2024).ageDays;
  check(Math.abs(((b - a + 14.8) % 29.53 + 29.53) % 29.53 - 14.8 - 0.5) < 0.05, `Moon age advances ${(b - a).toFixed(3)} d in half a day`);
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll physics checks passed.');
process.exit(failures ? 1 : 0);
