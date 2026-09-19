/**
 * Live Data tab: phase banner, physical quantities with provenance chips,
 * four time-series charts and the Core Monitor cutaway. Values update at
 * ~10 Hz to keep DOM work negligible.
 */
import { h, dataRow, chip, setChildren } from './dom.js';
import { Chart } from './Chart.js';
import { CoreMonitor } from './CoreMonitor.js';
import { sci, fmtSolarMass, fmtSolarRadius, fmtSolarLum, fmtKelvin, fmtDensity, fmtDuration, fmtYears, fmtVelocity, fmtEnergy, fmtLengthMeters, fmtDistanceLy } from '../core/units.js';
import { SOLAR_RADIUS_M, SOLAR_LUMINOSITY_W, YEAR_S } from '../core/constants.js';
import { REMNANT_INFO, spinPeriodAt } from '../physics/remnants.js';

export function createSciencePanel(ctx) {
  const { sim, scene, store } = ctx;
  const banner = h('div', { class: 'phase-banner' });
  const rows = h('div', {});
  const charts = {
    L: new Chart({ title: 'Luminosity vs time', unit: 'L☉', color: '#ffb454' }),
    R: new Chart({ title: 'Radius vs time', unit: 'R☉', color: '#7cc7ff' }),
    Tc: new Chart({ title: 'Core temperature vs time', unit: 'K', color: '#ff6f8a' }),
    Rs: new Chart({ title: 'Shockwave expansion', unit: 'm', color: '#5fd3a6' }),
  };
  const core = new CoreMonitor();
  const remnantBox = h('div', {});
  const el = h('div', {},
    banner,
    rows,
    h('h3', { class: 'section-title', style: { marginTop: '12px' } }, 'Charts'),
    h('div', { class: 'charts' }, charts.L.el, charts.R.el, charts.Tc.el, charts.Rs.el),
    h('h3', { class: 'section-title', style: { marginTop: '12px' } }, 'Core monitor'),
    h('p', { class: 'note' }, 'The collapse happens deep inside: the surface knows nothing until the shock arrives.'),
    core.el,
    remnantBox,
  );

  let lastRemnantKey = null;

  function update(snap) {
    if (!snap) return;
    const star = snap.star;
    const sn = snap.sn;
    const chips = [];
    // --- banner ---
    let title; let sub;
    if (snap.phase === 'supernova') {
      title = sn.phase.name;
      sub = `${snap.model.params.label}${snap.forced ? ' · experimental scenario' : ''}`;
    } else if (snap.phase === 'ended') {
      title = `${snap.remnant.name}`;
      sub = 'Evolution complete — no supernova';
    } else {
      title = snap.stage.name;
      sub = `Fusion: ${snap.stage.fusion} · ${Math.round(snap.stageProgress * 100)}% through this stage`;
    }
    setChildren(banner, h('div', {}, h('div', {}, title), h('div', { class: 'sub' }, sub)));

    // --- data rows ---
    const tag = snap.dataLabel;
    const list = [];
    const distToObserver = scene.rig.distance() * SOLAR_RADIUS_M;
    if (snap.phase === 'supernova') {
      const p = snap.model.params;
      list.push(dataRow('Time since collapse', fmtDuration(snap.tExp), 'Simulation'));
      list.push(dataRow('Bolometric luminosity', `${sci(sn.L)} W  (${fmtSolarLum(sn.L / SOLAR_LUMINOSITY_W)})`, 'Simulation'));
      list.push(dataRow('Photosphere radius', sn.Rphot > 0 ? fmtLengthMeters(sn.Rphot) : '— (ejecta transparent)', 'Simulation'));
      list.push(dataRow('Colour temperature', fmtKelvin(sn.Tcolor), 'Estimated'));
      list.push(dataRow('Core temperature', isFinite(sn.coreT) ? fmtKelvin(sn.coreT) : 'inside horizon', 'Estimated'));
      list.push(dataRow('Core density', isFinite(sn.coreRho) ? fmtDensity(sn.coreRho) : '∞ (singularity)', 'Estimated'));
      list.push(dataRow('Core radius', sn.coreR > 0 ? fmtLengthMeters(sn.coreR) : '—', 'Estimated'));
      list.push(dataRow('Shock radius', sn.Rshock > 0 ? fmtLengthMeters(sn.Rshock) : 'not yet launched', 'Simulation'));
      list.push(dataRow('Shock / ejecta velocity', sn.vShock > 0 ? fmtVelocity(sn.vShock) : '—', 'Simulation'));
      list.push(dataRow('Max ejecta velocity', fmtVelocity(p.vMax), 'Estimated'));
      list.push(dataRow('Kinetic energy released', fmtEnergy(sn.Ekin), 'Estimated'));
      list.push(dataRow('Radiated so far', fmtEnergy(sn.Erad), 'Simulation'));
      if (p.hasCollapse) list.push(dataRow('Neutrino energy', fmtEnergy(sn.Enu), 'Estimated'));
      list.push(dataRow('Bound stellar mass', fmtSolarMass(sn.Mbound), 'Simulation'));
      list.push(dataRow('Ejecta mass', fmtSolarMass(p.Mej), 'Estimated'));
      list.push(dataRow('⁵⁶Ni synthesised', fmtSolarMass(p.MNi), 'Estimated'));
      list.push(dataRow('Remnant', `${p.remnant.short} · ${fmtSolarMass(p.remnantMass)}`, 'Estimated'));
    } else {
      list.push(dataRow('Stellar age', fmtYears(snap.ageYr), snap.phase === 'evolution' && !sim.evolved ? 'Observed' : 'Simulation'));
      list.push(dataRow('Radius', fmtSolarRadius(snap.R), tag));
      list.push(dataRow('Luminosity', fmtSolarLum(snap.L), tag));
      list.push(dataRow('Surface temperature', fmtKelvin(snap.T), tag));
      list.push(dataRow('Core temperature', fmtKelvin(snap.Tc), 'Estimated'));
      list.push(dataRow('Core density', fmtDensity(snap.rhoc), 'Estimated'));
      list.push(dataRow('Mass', fmtSolarMass(snap.mass), star.observed ? 'Observed' : 'Simulation'));
      if (snap.phase === 'evolution') {
        list.push(dataRow('Stage duration', fmtYears(snap.stage.durationYr), 'Estimated'));
        list.push(dataRow('Time to end of life', fmtYears(Math.max(0, snap.track.totalLifetimeYr - (snap.stage.startYr + snap.stage.durationYr * snap.stageProgress))), 'Estimated'));
      }
      if (snap.nebulaAgeS > 0) list.push(dataRow('Nebula age', fmtDuration(snap.nebulaAgeS), 'Simulation'));
    }
    list.push(dataRow('Distance from observer', store.state.view === 'earth' ? fmtDistanceLy(star.distanceLy) : fmtLengthMeters(distToObserver), store.state.view === 'earth' ? 'Observed' : 'Simulation'));
    setChildren(rows, ...list);

    // --- charts ---
    const hist = sim.history;
    const mode = hist.kind === 'supernova' ? 'time' : 'age';
    for (const c of Object.values(charts)) c.setXMode(mode);
    charts.L.update(hist.x, hist.L);
    charts.R.update(hist.x, hist.R);
    charts.Tc.update(hist.x, hist.Tc);
    charts.Rs.update(hist.x, hist.Rs);
    core.update(snap);

    // --- remnant card ---
    const remnantVisible = (snap.phase === 'supernova' && sn.remnantVisible) || snap.phase === 'ended';
    const key = remnantVisible ? `${snap.remnant?.type}-${snap.phase}` : null;
    if (key !== lastRemnantKey) {
      lastRemnantKey = key;
      setChildren(remnantBox);
      if (remnantVisible && snap.remnant) {
        const r = snap.remnant;
        const info = REMNANT_INFO[r.type];
        const extra = [];
        if (r.spinPeriod0) extra.push(dataRow('Spin period (birth)', `${(r.spinPeriod0 * 1e3).toFixed(0)} ms`, 'Estimated'));
        if (r.bField) extra.push(dataRow('Magnetic field', `${sci(r.bField, 0)} G`, 'Estimated'));
        remnantBox.append(
          h('h3', { class: 'section-title', style: { marginTop: '12px' } }, 'Stellar remnant'),
          h('div', { class: 'phase-banner' }, h('div', {}, h('div', {}, info.name), h('div', { class: 'sub' }, `${r.mass > 0 ? fmtSolarMass(r.mass) + ' · ' : ''}${r.radiusM > 0 ? 'radius ' + fmtLengthMeters(r.radiusM) : 'nothing left behind'}`))),
          h('p', { class: 'note' }, info.description),
          ...extra,
          r.type !== 'none' && r.type !== 'white-dwarf' && r.type !== 'helium-white-dwarf' ? h('p', { class: 'note' }, 'Use the Remnant View camera to inspect it. Rotation is slowed for visibility; real pulsars spin 10–100 times per second.') : null,
        );
      }
    }
    if (remnantVisible && snap.remnant?.spinPeriod0) {
      const P = spinPeriodAt(snap.remnant, snap.phase === 'supernova' ? snap.tExp : snap.postAgeS);
      let live = remnantBox.querySelector('.live-spin');
      if (!live) { live = h('div', { class: 'live-spin' }); remnantBox.append(live); }
      setChildren(live, dataRow('Spin period now', P < 1 ? `${(P * 1e3).toFixed(1)} ms` : `${P.toFixed(2)} s`, 'Estimated'));
    }
  }

  return { el, update };
}
