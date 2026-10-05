/**
 * Earth View controls: observer latitude, date, local time, auto-advance,
 * plus the light-travel-time readout with "jump to light arrival".
 */
import { h, slider, button, dataRow, setChildren } from './dom.js';
import { dateLabel, hourLabel, daysInYear } from '../physics/skyMath.js';
import { fmtYears, fmtDuration } from '../core/units.js';
import { YEAR_S } from '../core/constants.js';
import { T_EXP_START } from '../sim/Simulation.js';

export function createEarthPanel(ctx) {
  const { earth, sim, store, actions } = ctx;
  const s = earth.state;
  const latS = slider({ label: 'Observer latitude', min: -90, max: 90, step: 1, value: s.latitude, format: (v) => `${Math.abs(v).toFixed(0)}° ${v >= 0 ? 'N' : 'S'}`, onInput: (v) => { s.latitude = v; } });
  const dayS = slider({ label: 'Date', min: 1, max: daysInYear(s.year), step: 1, value: s.dayOfYear, format: (v) => dateLabel(v, s.year), onInput: (v) => { s.dayOfYear = v; } });
  const hourS = slider({ label: 'Local time', min: 0, max: 23.99, step: 0.05, value: s.hour, format: (v) => hourLabel(v), onInput: (v) => { s.hour = v; } });
  const fovS = slider({ label: 'Field of view', min: 45, max: 160, step: 1, value: s.fovDeg, format: (v) => `${v.toFixed(0)}°`, onInput: (v) => { s.fovDeg = v; } });
  const speedS = slider({ label: 'Clock speed (auto-advance)', min: 0.05, max: 4, step: 0.05, value: s.hoursPerSecond, format: (v) => `${v.toFixed(2)} h/s`, onInput: (v) => { s.hoursPerSecond = v; } });
  const autoBtn = button('Auto-advance: off', () => { s.autoAdvance = !s.autoAdvance; autoBtn.textContent = `Auto-advance: ${s.autoAdvance ? 'on' : 'off'}`; autoBtn.classList.toggle('active', s.autoAdvance); });
  const lookBtn = button('Look at star', () => earth.lookAtStar());
  const riseBtn = button('Jump to star rise', () => {
    const res = earth.jumpToStarRise();
    if (res === 'up') actions.toast('The star is already above the horizon.', 'info');
    else if (!res) actions.toast('The star never rises above the horizon at this latitude.', 'warn');
  });

  // rows/note are rebuilt each tick; the jump button is persistent so clicks and focus survive
  const rowsBox = h('div', {});
  const noteBox = h('div', {});
  const jumpRow = h('div', { class: 'btn-row', style: { display: 'none' } }, button('Jump to light arrival', () => actions.jumpToLightArrival(), 'primary'));
  const lightBox = h('div', {}, rowsBox, noteBox, jumpRow);
  const el = h('div', {},
    h('h3', { class: 'section-title' }, 'Observer'),
    latS, dayS, hourS, fovS,
    h('div', { class: 'btn-row' }, autoBtn, lookBtn, riseBtn),
    speedS,
    h('h3', { class: 'section-title', style: { marginTop: '14px' } }, 'Light travel time'),
    lightBox,
    h('p', { class: 'note' }, 'Educational simulation. The sky is rendered from real bright-star positions and a simplified atmosphere; the supernova\'s brightness comes from the light-curve model.'),
  );

  function update(snap) {
    // keep sliders in sync when the clock auto-advances
    hourS.setValue(s.hour); dayS.setValue(s.dayOfYear); fovS.setValue(s.fovDeg); latS.setValue(s.latitude);
    if (!snap) return;
    const star = snap.star;
    const delay = star.distanceLy; // years
    const respect = store.state.respectLightTravel;
    const rows = [dataRow('Distance', `${fmtDuration(delay * YEAR_S)} of light travel`, star.observed ? 'Observed' : 'Simulation')];
    if (snap.phase === 'supernova') {
      // light from the collapse reaches Earth when the star-frame clock hits delay + T_EXP_START (same rule as Simulation.earthSnapshot)
      const arrivalT = delay * YEAR_S + T_EXP_START;
      const arrived = !respect || snap.tExp >= arrivalT;
      const remaining = Math.max(0, arrivalT - snap.tExp);
      rows.push(snap.tExp < 0
        ? dataRow('Collapse in', fmtDuration(-snap.tExp) + ' (star frame)', 'Simulation')
        : dataRow('Event occurred', fmtDuration(snap.tExp) + ' ago (star frame)', 'Simulation'));
      rows.push(dataRow('Light reaches Earth', arrived ? 'now visible' : `in ${fmtDuration(remaining)}`, 'Simulation'));
      setChildren(rowsBox, ...rows);
      setChildren(noteBox,
        h('p', { class: `note ${arrived ? 'ok' : 'warn'}` }, arrived
          ? (respect ? `Earth is seeing light that left the star ${fmtDuration(delay * YEAR_S)} ago. Near the star, the remnant is already that old.` : 'Light-travel delay is ignored: Earth sees the explosion instantly (not physical).')
          : `${snap.tExp < 0 ? 'The star is about to collapse, and' : 'The explosion has happened, but'} its light is still ${fmtDuration(remaining)} away. Earth still sees the old star.`),
      );
      jumpRow.style.display = arrived ? 'none' : '';
    } else {
      setChildren(rowsBox, ...rows);
      setChildren(noteBox, h('p', { class: 'note' }, `Whatever happens to ${star.name} now, Earth would only learn about it ${fmtDuration(delay * YEAR_S)} later.`));
      jumpRow.style.display = 'none';
    }
  }

  return { el, update };
}
