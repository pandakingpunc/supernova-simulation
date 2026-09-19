/**
 * Compare Supernovae: two stars side by side, evaluated with the same
 * model (peak luminosity, energy, ejecta velocity, Earth brightness,
 * remnant, key timeline moments).
 */
import { h, select, dataRow, chip, setChildren } from './dom.js';
import { STAR_CATALOG } from '../data/starCatalog.js';
import { starFromPreset, buildCustomStar } from '../sim/StarFactory.js';
import { loadSavedStars } from '../core/storage.js';
import { buildEvolutionTrack, stateAtStage } from '../physics/evolution.js';
import { buildSupernovaModel, determineScenario, summarizeSupernova } from '../physics/supernovaModel.js';
import { apparentMagnitudes, assessImpact } from '../physics/earthEffects.js';
import { sci, fmtSolarMass, fmtVelocity, fmtEnergy, fmtDuration, fmtDistanceLy, fmtYears } from '../core/units.js';
import { clamp } from '../core/math.js';

function evaluate(star) {
  const scenario = determineScenario(star, true);
  const track = buildEvolutionTrack(star);
  const collapse = ['core-collapse', 'wr-collapse', 'pisn'].includes(track.terminal)
    ? stateAtStage(track, track.stages.length - 1, 1)
    : { R: star.radius, L: star.luminosity, T: star.temperature };
  const model = buildSupernovaModel(star, collapse, scenario);
  const s = summarizeSupernova(model);
  const mag = apparentMagnitudes(s.peakLuminosityW, star.distanceLy, 6000);
  const impact = assessImpact(model.params, s.peakLuminosityW, star.distanceLy);
  return { star, model, s, mag, impact };
}

export function createComparePanel(ctx) {
  const { store } = ctx;
  const grid = h('div', {});
  const selA = h('select', { class: 'select' });
  const selB = h('select', { class: 'select' });
  const customBox = h('div', { class: 'note' }, 'Tip: save a star in "Build Your Own" to compare it here — e.g. Betelgeuse vs. a custom 25 M☉ star.');
  const el = h('div', { class: 'panel compare-panel' },
    h('div', { class: 'panel-header' }, h('h2', {}, 'Compare supernovae')),
    h('div', { class: 'panel-body' },
      h('div', { class: 'compare-grid', style: { marginBottom: '12px' } }, selA, selB),
      grid,
      customBox,
    ),
  );

  function options() {
    const list = [...STAR_CATALOG.map(starFromPreset), ...loadSavedStars()];
    list.push(buildCustomStar({ id: 'ref-25', name: 'Reference 25 M☉ star', mass: 25, ageFraction: 0.9, distanceLy: 500, ra: 6, dec: 0 }));
    list.push(buildCustomStar({ id: 'ref-60-lowz', name: 'Reference 60 M☉ (Z = 0.1 Z☉, fast rotator)', mass: 60, ageFraction: 0.9, distanceLy: 2000, metallicity: 0.0013, rotation: 0.85, ra: 12, dec: 0 }));
    list.push(buildCustomStar({ id: 'ref-180-pisn', name: 'Reference 180 M☉ (Z = 0.05 Z☉, pair instability)', mass: 180, ageFraction: 0.9, distanceLy: 5000, metallicity: 0.0007, ra: 3, dec: 20 }));
    return list;
  }

  let stars = [];
  function fillSelects() {
    stars = options();
    const prevA = selA.value; const prevB = selB.value;
    for (const sel of [selA, selB]) {
      setChildren(sel, ...stars.map((s) => h('option', { value: s.id }, `${s.name}${s.custom ? ' (custom)' : ''}`)));
    }
    selA.value = stars.some((s) => s.id === prevA) ? prevA : 'betelgeuse';
    selB.value = stars.some((s) => s.id === prevB) ? prevB : 'ref-25';
  }

  function render() {
    const a = stars.find((s) => s.id === selA.value);
    const b = stars.find((s) => s.id === selB.value);
    if (!a || !b) return;
    const A = evaluate(a); const B = evaluate(b);
    const rows = [
      ['Scenario', (x) => `${x.s.label}${x.s.natural ? '' : ' (forced)'}`],
      ['Initial mass', (x) => fmtSolarMass(x.star.mass)],
      ['Pre-supernova mass', (x) => fmtSolarMass(x.model.params.Mtotal)],
      ['Explosion energy', (x) => fmtEnergy(x.s.explosionEnergyJ)],
      ['Peak luminosity', (x) => `${sci(x.s.peakLuminosityW)} W`],
      ['Time of peak', (x) => fmtDuration(x.s.peakTime)],
      ['Ejecta mass', (x) => fmtSolarMass(x.s.ejectaMass)],
      ['⁵⁶Ni mass', (x) => fmtSolarMass(x.s.nickelMass)],
      ['Max ejecta velocity', (x) => fmtVelocity(x.s.ejectaVelocity)],
      ['Shock breakout after', (x) => fmtDuration(x.s.breakoutTime)],
      ['Plateau duration', (x) => (x.s.plateauDuration > 0 ? fmtDuration(x.s.plateauDuration) : 'no plateau')],
      ['Remnant', (x) => `${x.s.remnant.name}${x.s.remnant.mass > 0 ? ` (${fmtSolarMass(x.s.remnant.mass)})` : ''}`],
      ['Sedov phase begins', (x) => fmtDuration(x.s.sedovTime)],
      ['Distance', (x) => fmtDistanceLy(x.star.distanceLy)],
      ['Peak apparent magnitude', (x) => x.mag.mV.toFixed(1)],
      ['Earth impact', (x) => x.impact.title],
    ];
    const barRows = [
      ['Energy', (x) => x.s.explosionEnergyJ, 1e43, 1e46],
      ['Peak luminosity', (x) => x.s.peakLuminosityW, 1e33, 1e38],
      ['Ejecta velocity', (x) => x.s.ejectaVelocity, 1e6, 3e7],
      ['Earth brightness (lux)', (x) => Math.pow(10, (-14.18 - x.mag.mV) / 2.5), 1e-6, 1e5],
    ];
    const bar = (v, lo, hi, colour) => h('div', { class: 'bar' }, h('i', { style: { width: `${clamp((Math.log10(v) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo)), 0.02, 1) * 100}%`, background: colour } }));
    setChildren(grid, 
      h('table', { class: 'compare-table' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Quantity'), h('th', {}, a.name), h('th', {}, b.name))),
        h('tbody', {}, ...rows.map(([label, f]) => h('tr', {}, h('td', {}, label), h('td', { class: 'num' }, f(A)), h('td', { class: 'num' }, f(B))))),
      ),
      h('h3', { class: 'section-title', style: { marginTop: '14px' } }, 'Log-scale comparison'),
      ...barRows.map(([label, f, lo, hi]) => h('div', { class: 'compare-grid' },
        h('div', {}, h('div', { class: 'note' }, `${label} — ${a.name}`), bar(f(A), lo, hi, '#7cc7ff')),
        h('div', {}, h('div', { class: 'note' }, `${label} — ${b.name}`), bar(f(B), lo, hi, '#ffb454')),
      )),
      h('p', { class: 'note' }, 'All values are from the same approximate model; forced scenarios for low-mass stars are experiments, not predictions.'),
    );
  }

  selA.addEventListener('change', render);
  selB.addEventListener('change', render);
  store.on('savedStarsVersion', () => { fillSelects(); render(); });
  store.on('view', (v) => { if (v === 'compare') { fillSelects(); render(); } });
  fillSelects();
  render();
  return { el, update() {} };
}
