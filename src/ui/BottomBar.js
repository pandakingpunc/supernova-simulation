/**
 * Bottom bar: time controls (phase dependent), the simulation clock and
 * the primary actions (trigger supernova / reset).
 */
import { h, button, setChildren } from './dom.js';
import { TIME_MODES } from '../sim/Simulation.js';
import { fmtDuration, fmtYears, sci } from '../core/units.js';

export function createBottomBar(ctx) {
  const { sim, actions, store } = ctx;
  const controls = h('div', { class: 'time-controls' });
  const big = h('div', { class: 'big' });
  const small = h('div', { class: 'small' });
  const rate = h('div', { class: 'rate' });
  const clock = h('div', { class: 'clock' }, big, small, rate);
  const triggerBtn = button('Trigger Supernova', () => actions.triggerSupernova(false), 'danger');
  const resetBtn = button('Reset star', () => actions.resetStar());
  const el = h('div', { class: 'panel bottombar' }, controls, clock, h('div', { class: 'actions' }, triggerBtn, resetBtn));

  const modeButtons = new Map();
  function buildControls() {
    setChildren(controls);
    modeButtons.clear();
    const phase = sim.phase;
    const modes = phase === 'supernova'
      ? ['pause', 'cinematic', 'real', 'x10', 'x1000', 'x1M']
      : phase === 'ended' ? ['pause', 'real', 'x10', 'x1000', 'x1M'] : ['pause', 'real', 'x10', 'x1000', 'x1M', 'evolution'];
    for (const m of modes) {
      const b = button(TIME_MODES[m].label, () => actions.setTimeMode(m), m === 'evolution' || m === 'cinematic' ? 'primary' : '');
      b.title = m === 'evolution' ? 'Compress the rest of the star\'s life into about a minute' : m === 'cinematic' ? 'Logarithmic time: every decade of explosion time takes ~5 s' : '';
      modeButtons.set(m, b);
      controls.append(b);
    }
    refreshActive();
  }
  function refreshActive() {
    for (const [m, b] of modeButtons) b.classList.toggle('active', sim.timeMode === m);
  }

  sim.on('phase', buildControls);
  sim.on('star', buildControls);
  sim.on('timeMode', refreshActive);

  function update(snap) {
    if (!snap) return;
    const natural = !!sim.star && ['core-collapse', 'wr-collapse', 'pisn'].includes(sim.track.terminal);
    if (snap.phase === 'supernova') {
      triggerBtn.style.display = 'none';
      big.textContent = fmtDuration(snap.tExp, 2);
      small.textContent = `since core collapse · ${snap.sn.phase.name}`;
    } else {
      triggerBtn.style.display = '';
      triggerBtn.textContent = natural ? 'Trigger Supernova' : 'Trigger Experimental Supernova';
      triggerBtn.className = `btn ${natural ? 'danger' : 'warn'}`;
      triggerBtn.onclick = () => actions.triggerSupernova(!natural);
      big.textContent = fmtYears(snap.ageYr, 2);
      small.textContent = snap.phase === 'ended' ? `${snap.remnant.name} · nebula age ${fmtDuration(snap.nebulaAgeS)}` : `stellar age · ${snap.stage.name}`;
    }
    const r = snap.timeRate;
    rate.textContent = r > 0 ? `time acceleration ≈ ${sci(r, 1)}×` : 'paused';
  }

  buildControls();
  return { el, update };
}
