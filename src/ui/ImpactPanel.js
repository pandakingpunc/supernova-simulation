/**
 * Earth Impact tab: what the explosion would look like and do from Earth,
 * at the star's distance. Uses the peak of the light-curve model, so it is
 * available as soon as a star is selected (as a forecast) and stays fixed
 * during the explosion.
 */
import { h, dataRow, chip, setChildren } from './dom.js';
import { assessImpact, apparentMagnitudes, brightnessComparison, illuminanceLux } from '../physics/earthEffects.js';
import { buildSupernovaModel, determineScenario } from '../physics/supernovaModel.js';
import { buildEvolutionTrack, stateAtStage } from '../physics/evolution.js';
import { sci, fmtDistanceLy, fmtYears, fmtDuration, fmtVelocity } from '../core/units.js';
import { MAG_FULL_MOON, MAG_SUN, YEAR_S } from '../core/constants.js';
import { clamp } from '../core/math.js';

export function createImpactPanel(ctx) {
  const { sim } = ctx;
  const el = h('div', {});
  let builtFor = null;

  function modelFor(snap) {
    if (snap.phase === 'supernova') return snap.model;
    const star = snap.star;
    const scenario = determineScenario(star, true);
    const track = buildEvolutionTrack(star);
    const collapse = ['core-collapse', 'wr-collapse', 'pisn'].includes(track.terminal)
      ? stateAtStage(track, track.stages.length - 1, 1)
      : { R: star.radius, L: star.luminosity, T: star.temperature };
    return buildSupernovaModel(star, collapse, scenario);
  }

  function build(snap) {
    const star = snap.star;
    const model = modelFor(snap);
    const p = model.params;
    const peakMag = apparentMagnitudes(model.peak.L, star.distanceLy, 6000);
    const cmp = brightnessComparison(peakMag.mV);
    const impact = assessImpact(p, model.peak.L, star.distanceLy);
    const lux = illuminanceLux(peakMag.mV);
    const bar = (frac, colour) => h('div', { class: 'bar' }, h('i', { style: { width: `${clamp(frac, 0, 1) * 100}%`, background: colour } }));
    const magPos = clamp((6 - peakMag.mV) / (6 - MAG_SUN), 0, 1);
    setChildren(el, 
      h('p', { class: 'note' }, `Forecast for ${star.name} at ${fmtDistanceLy(star.distanceLy)} using ${p.natural ? 'its natural' : 'the experimental'} scenario: ${p.label}.`),
      h('h3', { class: 'section-title' }, 'Appearance from Earth'),
      dataRow('Peak apparent magnitude', peakMag.mV.toFixed(1), 'Estimated'),
      dataRow('Peak illuminance', `${sci(lux)} lux`, 'Estimated'),
      dataRow('vs. Sirius', `${sci(cmp.vsSirius, 1)}×`, 'Estimated'),
      dataRow('vs. full Moon', `${sci(cmp.vsFullMoon, 1)}×`, 'Estimated'),
      dataRow('vs. Sun', `${sci(cmp.vsSun, 1)}×`, 'Estimated'),
      h('div', { class: 'note' }, 'Brightness scale (naked-eye limit → Sun):'),
      bar(magPos, 'linear-gradient(90deg,#7cc7ff,#ffb454,#fff)'),
      h('p', { class: 'note' }, cmp.label + (cmp.visibleDaytime ? ' Visible in daylight.' : '') + (cmp.castsShadows ? ' Bright enough to cast shadows.' : '')),
      dataRow('Light travel time', fmtDuration(star.distanceLy * YEAR_S), 'Observed'),
      dataRow('Bright phase lasts', p.LPlateau > 0 ? `~${fmtDuration(p.tPlateau)} plateau` : `~${fmtDuration(p.tDiff * 4)} around peak`, 'Estimated'),

      h('h3', { class: 'section-title', style: { marginTop: '12px' } }, 'Physical effects on Earth'),
      h('div', { class: 'impact-tier', style: { color: impact.colour, borderColor: impact.colour } }, impact.title),
      h('p', { class: 'note' }, impact.summary),
      dataRow('Peak irradiance at Earth', `${sci(impact.irradiance)} W/m² (${sci(impact.vsSolar)} × sunlight)`, 'Estimated'),
      dataRow('Ozone column depletion', `${(impact.ozoneDepletion * 100).toFixed(impact.ozoneDepletion < 0.01 ? 3 : 1)} %`, 'Estimated'),
      bar(impact.ozoneDepletion, '#ffb454'),
      dataRow('UV-B increase', `+${(impact.uvbIncrease * 100).toFixed(impact.uvbIncrease < 0.01 ? 3 : 1)} %`, 'Estimated'),
      dataRow('Cosmic-ray flux (after shell arrival)', `${sci(impact.cosmicRayFactor, 1)}× today`, 'Estimated'),
      dataRow('Shell arrival at Earth', fmtYears(impact.ejectaArrivalYr), 'Estimated'),
      p.hasCollapse ? dataRow('Neutrino dose at Earth', `${sci(impact.neutrinoDoseSv)} Sv`, 'Estimated') : null,
      h('p', { class: 'note' }, 'Order-of-magnitude scalings anchored to published estimates (Gehrels et al. 2003; Fields et al. 2020). Real outcomes depend on the explosion\'s gamma-ray yield, the local interstellar medium and the state of the atmosphere. Educational, not predictive.'),
    );
  }

  function update(snap) {
    if (!snap) return;
    const key = `${snap.star.id}-${snap.phase === 'supernova' ? snap.model.scenario : 'pre'}-${snap.star.distanceLy}`;
    if (key !== builtFor) { builtFor = key; build(snap); }
  }

  return { el, update };
}
