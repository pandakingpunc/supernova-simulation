import { h, button } from './dom.js';

/** First-run overlay: what this is, how to use it, what it is not. */
export function createIntro(onClose) {
  const el = h('div', { class: 'intro' },
    h('div', { class: 'intro-card' },
      h('h1', {}, 'Supernova Simulation'),
      h('p', {}, 'An interactive, physically-motivated model of how massive stars die: stellar evolution, core collapse, shock breakout, the expanding ejecta and what remains — seen from next to the star and from Earth.'),
      h('ol', {},
        h('li', {}, 'Pick a star from the library (Betelgeuse is loaded).'),
        h('li', {}, 'Press ', h('kbd', {}, 'Stellar Evolution'), ' to fast-forward its life, or ', h('kbd', {}, 'Trigger Supernova'), ' to skip straight to the collapse.'),
        h('li', {}, 'Watch the live data, then switch to ', h('kbd', {}, 'Earth View'), ' to see it from the ground — with the light-travel delay if you like.'),
        h('li', {}, 'Build your own star and try scenarios nature never would.'),
      ),
      h('p', {}, h('kbd', {}, 'Space'), ' pause/play · ', h('kbd', {}, '1–5'), ' camera presets · ', h('kbd', {}, 'E'), ' Earth View · ', h('kbd', {}, 'C'), ' Close Observation · ', h('kbd', {}, 'H'), ' hide UI'),
      h('p', { class: 'muted', style: { fontSize: '11.5px' } }, 'Scientific honesty: values are tagged Observed / Estimated / Simulation. The explosion uses analytic approximations, not a hydrodynamic code, and nobody knows when any real star will explode.'),
      h('div', { class: 'btn-row', style: { marginTop: '14px' } }, button('Start exploring', () => { el.remove(); onClose?.(); }, 'primary')),
    ),
  );
  el.addEventListener('click', (e) => { if (e.target === el) { el.remove(); onClose?.(); } });
  return el;
}
