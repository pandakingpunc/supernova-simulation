import { h, button, select } from './dom.js';
import { CAMERA_PRESETS } from '../render/CameraRig.js';
import { QUALITY_PRESETS, QUALITY_ORDER } from '../render/quality.js';

export function createTopBar(ctx) {
  const { store, actions } = ctx;
  const views = [['close', 'Close Observation'], ['earth', 'Earth View'], ['compare', 'Compare']];
  const viewButtons = new Map();
  const viewSwitch = h('div', { class: 'view-switch' });
  for (const [id, label] of views) {
    const b = button(label, () => actions.setView(id));
    viewButtons.set(id, b);
    viewSwitch.append(b);
  }

  const camSelect = select(Object.entries(CAMERA_PRESETS).map(([k, v]) => [k, v.label]), store.state.cameraPreset, (v) => actions.setCameraPreset(v));
  const camHint = h('span', { class: 'hint muted', style: { fontSize: '11px' } });
  const qualitySelect = select(QUALITY_ORDER.map((k) => [k, `${QUALITY_PRESETS[k].label} quality`]), store.state.quality, (v) => actions.setQuality(v, true));
  const lightToggle = h('input', { type: 'checkbox', checked: store.state.respectLightTravel, onChange: (e) => actions.setLightTravel(e.target.checked) });
  const hideBtn = h('button', { class: 'icon-btn', type: 'button', title: 'Hide interface (H)', onClick: () => actions.toggleUI() }, 'Hide UI');
  const helpBtn = h('button', { class: 'icon-btn', type: 'button', title: 'Help', onClick: () => actions.showIntro() }, '?');

  const camGroup = h('div', { class: 'group cam-group' }, h('span', { class: 'muted', style: { fontSize: '11px' } }, 'Camera'), camSelect, camHint);

  const el = h('div', { class: 'panel topbar' },
    h('div', { class: 'brand' }, h('span', { class: 'brand-title' }, 'SUPERNOVA'), h('span', { class: 'brand-sub' }, 'stellar death simulator')),
    viewSwitch,
    camGroup,
    h('span', { class: 'spacer' }),
    h('label', { class: 'toggle', title: 'When on, Earth View shows the light only after it has travelled the distance to Earth' }, lightToggle, 'Respect light travel time'),
    h('div', { class: 'group' }, qualitySelect),
    hideBtn,
    helpBtn,
  );

  function refresh() {
    const view = store.state.view;
    for (const [id, b] of viewButtons) b.classList.toggle('active', id === view);
    camGroup.style.display = view === 'close' ? '' : 'none';
    camSelect.value = store.state.cameraPreset;
    camHint.textContent = CAMERA_PRESETS[store.state.cameraPreset]?.hint ?? '';
    qualitySelect.value = store.state.quality;
    lightToggle.checked = store.state.respectLightTravel;
  }
  store.on('view', refresh);
  store.on('cameraPreset', refresh);
  store.on('quality', refresh);
  store.on('respectLightTravel', refresh);
  refresh();
  return { el, update() {} };
}
