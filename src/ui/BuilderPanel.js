/**
 * Create Your Own Star: sliders → live model prediction → load into the
 * simulation. Basic mode exposes mass, age, distance and sky position;
 * Advanced adds metallicity, rotation and radius/temperature overrides.
 */
import { h, slider, button, dataRow, chip, setChildren } from './dom.js';
import { buildCustomStar, describeStar } from '../sim/StarFactory.js';
import { blackbodyRGB, rgbToCss } from '../physics/blackbody.js';
import { fmtSolarMass, fmtSolarRadius, fmtSolarLum, fmtKelvin, fmtYears, fmtDistanceLy } from '../core/units.js';
import { SOLAR_METALLICITY } from '../core/constants.js';

export function createBuilderPanel(ctx) {
  const { actions } = ctx;
  const params = {
    name: '', mass: 25, ageFraction: 0.5, distanceLy: 500, ra: 6, dec: 10,
    metallicity: SOLAR_METALLICITY, rotation: 0.05, radiusOverride: 0, temperatureOverride: 0,
  };
  let advanced = false;
  let preview = null;

  const nameInput = h('input', { type: 'text', placeholder: 'Star name (optional)', onInput: (e) => { params.name = e.target.value; } });
  const massS = slider({ label: 'Mass', min: 0.1, max: 150, log: true, value: params.mass, format: (v) => fmtSolarMass(v), onInput: (v) => { params.mass = v; refresh(); } });
  const ageS = slider({ label: 'Age (fraction of lifetime)', min: 0, max: 99.5, step: 0.5, value: params.ageFraction * 100, format: (v) => `${v.toFixed(1)} %`, onInput: (v) => { params.ageFraction = v / 100; refresh(); } });
  const distS = slider({ label: 'Distance from Earth', min: 1e-4, max: 1e5, log: true, value: params.distanceLy, format: (v) => fmtDistanceLy(v), onInput: (v) => { params.distanceLy = v; refresh(); } });
  const raS = slider({ label: 'Right ascension', min: 0, max: 24, step: 0.1, value: params.ra, format: (v) => `${v.toFixed(1)} h`, onInput: (v) => { params.ra = v; refresh(); } });
  const decS = slider({ label: 'Declination', min: -90, max: 90, step: 1, value: params.dec, format: (v) => `${v.toFixed(0)}°`, onInput: (v) => { params.dec = v; refresh(); } });
  const zS = slider({ label: 'Metallicity Z', min: 1e-4, max: 0.04, log: true, value: params.metallicity, format: (v) => `${v.toPrecision(2)} (${(v / SOLAR_METALLICITY).toFixed(2)} Z☉)`, onInput: (v) => { params.metallicity = v; refresh(); } });
  const rotS = slider({ label: 'Rotation (fraction of break-up)', min: 0, max: 0.98, step: 0.01, value: params.rotation, format: (v) => v.toFixed(2), onInput: (v) => { params.rotation = v; refresh(); } });
  const radS = slider({ label: 'Radius override (0 = model)', min: 0, max: 3000, step: 1, value: 0, format: (v) => (v > 0 ? fmtSolarRadius(v) : 'auto'), onInput: (v) => { params.radiusOverride = v; refresh(); } });
  const tempS = slider({ label: 'Temperature override (0 = model)', min: 0, max: 60000, step: 100, value: 0, format: (v) => (v > 0 ? fmtKelvin(v) : 'auto'), onInput: (v) => { params.temperatureOverride = v; refresh(); } });

  const advancedBox = h('div', { style: { display: 'none' } }, zS, rotS, radS, tempS);
  const modeBtnBasic = button('Basic', () => setMode(false), 'small active');
  const modeBtnAdv = button('Advanced', () => setMode(true), 'small');
  function setMode(adv) {
    advanced = adv;
    advancedBox.style.display = adv ? '' : 'none';
    modeBtnBasic.classList.toggle('active', !adv);
    modeBtnAdv.classList.toggle('active', adv);
  }

  const previewBox = h('div', { class: 'star-detail' });
  const evolveBtn = button('Evolve Star', () => { actions.loadStar(build()); actions.evolve(); }, 'primary');
  const snBtn = button('Trigger Supernova', () => { const s = build(); actions.loadStar(s); actions.triggerSupernova(!preview.isSupernovaProgenitor); }, 'danger');
  const loadBtn = button('Load only', () => actions.loadStar(build()));
  const saveBtn = button('Save preset', () => actions.saveCustomStar(build()));

  const el = h('div', {},
    h('h3', { class: 'section-title' }, 'Create your own star'),
    h('p', { class: 'note' }, 'Every value below is a model prediction, not an observation. Change the distance and sky position to see how the Earth View responds.'),
    nameInput,
    h('div', { class: 'btn-row', style: { marginBottom: '6px' } }, modeBtnBasic, modeBtnAdv),
    massS, ageS, distS, raS, decS,
    advancedBox,
    previewBox,
    h('div', { class: 'btn-row' }, evolveBtn, snBtn, loadBtn, saveBtn),
  );

  function build() {
    return buildCustomStar({ ...params, radiusOverride: advanced ? params.radiusOverride : 0, temperatureOverride: advanced ? params.temperatureOverride : 0 });
  }

  function refresh() {
    const star = build();
    preview = describeStar(star);
    const rgb = blackbodyRGB(star.temperature);
    const natural = preview.isSupernovaProgenitor;
    snBtn.textContent = natural ? 'Trigger Supernova' : 'Trigger Experimental Supernova';
    snBtn.className = `btn ${natural ? 'danger' : 'warn'}`;
    setChildren(previewBox, 
      h('h3', { class: 'section-title' }, 'Model prediction'),
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', margin: '4px 0 8px' } },
        h('div', { class: 'star-dot', style: { '--dot': rgbToCss(rgb) } }),
        h('div', {}, h('div', { style: { fontWeight: 600 } }, preview.classification.type), h('div', { class: 'muted', style: { fontSize: '11px' } }, preview.classification.description)),
      ),
      dataRow('Radius', fmtSolarRadius(star.radius), 'Simulation'),
      dataRow('Temperature', fmtKelvin(star.temperature), 'Simulation'),
      dataRow('Luminosity', fmtSolarLum(star.luminosity), 'Simulation'),
      dataRow('Current stage', preview.currentStage.name, 'Simulation'),
      dataRow('Total lifetime', fmtYears(preview.lifetimeYr), 'Estimated'),
      dataRow('Time remaining', fmtYears(preview.remainingYr), 'Estimated'),
      dataRow('Apparent magnitude', preview.apparentMagnitude.toFixed(1), 'Estimated'),
      dataRow('Fate', preview.terminal, 'Estimated'),
      dataRow('Final state', preview.remnant.name, 'Estimated'),
      h('p', { class: `note ${natural ? 'danger' : 'ok'}` }, natural ? `Massive enough for core collapse: ${preview.naturalLabel}.` : `Too light for a natural supernova. "Trigger Experimental Supernova" will run: ${preview.forcedLabel}.`),
    );
  }

  refresh();
  return { el, update() {} };
}
