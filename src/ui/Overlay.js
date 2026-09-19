/**
 * Centre overlay: HUD (camera hint, forced-scenario banner, light-travel
 * banner), scale bar, FPS and the Earth View status block.
 */
import { h, button, setChildren } from './dom.js';
import { fmtLengthMeters, fmtDuration, fmtYears, sci } from '../core/units.js';
import { CAMERA_PRESETS } from '../render/CameraRig.js';
import { YEAR_S } from '../core/constants.js';

export function createOverlay(ctx) {
  const { store, scene, earth, actions } = ctx;
  const camInfo = h('div', { class: 'cam-info' });
  const forcedBanner = h('div', { class: 'forced-banner', style: { display: 'none' } }, 'Experimental scenario — not an astronomical prediction');
  const lightBanner = h('div', { class: 'light-banner', style: { display: 'none' } });
  const hud = h('div', { class: 'hud' }, camInfo, h('div', { style: { display: 'flex', gap: '8px', flexDirection: 'column', alignItems: 'flex-end' } }, forcedBanner, lightBanner));
  const scaleLabel = h('span');
  const scaleBar = h('div', { class: 'scale-bar' }, h('i'), scaleLabel);
  const fps = h('div', { class: 'fps' });
  const earthStatus = h('div', { class: 'earth-status' });
  const el = h('div', { class: 'center-overlay' }, hud, scaleBar, fps, earthStatus);

  function update(snap, earthInfo, earthSnap) {
    if (!snap) return;
    const view = store.state.view;
    forcedBanner.style.display = snap.phase === 'supernova' && snap.forced ? '' : 'none';
    if (view === 'close') {
      const preset = CAMERA_PRESETS[store.state.cameraPreset];
      camInfo.textContent = `${preset.label} · drag to orbit · scroll to zoom`;
      const width = scene.viewWidthMeters();
      scaleLabel.textContent = `view width ≈ ${fmtLengthMeters(width)}`;
      scaleBar.style.display = '';
      fps.textContent = `${scene.fps.toFixed(0)} fps · ${store.state.quality}`;
      setChildren(earthStatus);
      lightBanner.style.display = 'none';
    } else if (view === 'earth') {
      camInfo.textContent = 'Earth View · drag to look around · scroll to change field of view';
      scaleBar.style.display = 'none';
      fps.textContent = '';
      const lines = [];
      if (earthInfo && earthSnap) {
        lines.push(h('div', { class: 'line big' }, `${snap.star.name} · ${earthInfo.timeLabel} · lat ${earth.state.latitude.toFixed(0)}°`));
        if (earthInfo.mV != null) {
          lines.push(h('div', { class: 'line' }, `Apparent magnitude ${earthInfo.mV.toFixed(1)}  ·  ${sci(earthInfo.lux)} lux`));
          lines.push(h('div', { class: 'line dim' }, earthInfo.comparison?.label ?? ''));
        }
        if (earthInfo.starAlt != null) lines.push(h('div', { class: 'line dim' }, `altitude ${earthInfo.starAlt.toFixed(1)}°, azimuth ${earthInfo.starAz.toFixed(0)}° · sky: ${earthInfo.sunAlt > 0 ? 'day' : earthInfo.sunAlt > -18 ? 'twilight' : 'night'} · limiting mag ${earthInfo.mLim.toFixed(1)}`));
        if (earthSnap.phase === 'supernova') {
          const t = earthSnap.retardedT;
          lines.push(h('div', { class: 'line' }, `Earth sees: ${earthSnap.sn.phase.name} (light emitted ${fmtDuration(t)} after collapse)`));
        } else if (earthSnap.lightArrived === false) {
          lines.push(h('div', { class: 'line' }, `Earth still sees the pre-explosion star — light arrives in ${fmtYears(earthSnap.arrivalIn / YEAR_S)}`));
        }
      }
      setChildren(earthStatus, ...lines);
      // light-travel banner
      if (snap.phase === 'supernova' && store.state.respectLightTravel && earthSnap && earthSnap.lightArrived === false) {
        setChildren(lightBanner, 
          `Light from the explosion has not reached Earth yet (${fmtYears(snap.star.distanceLy)} away). `,
          button('Jump to light arrival', () => actions.jumpToLightArrival(), 'small primary'),
        );
        lightBanner.style.display = '';
      } else lightBanner.style.display = 'none';
    } else {
      camInfo.textContent = '';
      scaleBar.style.display = 'none';
      fps.textContent = '';
      setChildren(earthStatus);
      lightBanner.style.display = 'none';
    }
  }

  return { el, update };
}
