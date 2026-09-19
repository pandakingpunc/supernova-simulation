/**
 * Star Library tab: catalogue cards, saved custom stars and the detail card
 * for the selected star (observed data, expected fate, actions).
 */
import { h, chip, dataRow, button, clear } from './dom.js';
import { STAR_CATALOG, POTENTIAL_LABELS } from '../data/starCatalog.js';
import { starFromPreset, describeStar } from '../sim/StarFactory.js';
import { blackbodyRGB, rgbToCss } from '../physics/blackbody.js';
import { fmtSolarMass, fmtSolarRadius, fmtSolarLum, fmtKelvin, fmtYears, fmtDistanceLy } from '../core/units.js';
import { loadSavedStars } from '../core/storage.js';

export function createLibraryPanel(ctx) {
  const { store, actions } = ctx;
  const list = h('div', { class: 'star-list' });
  const savedList = h('div', { class: 'star-list' });
  const savedSection = h('div', {}, h('h3', { class: 'section-title' }, 'Your saved stars'), savedList);
  const detail = h('div', { class: 'star-detail' });
  const el = h('div', {},
    h('h3', { class: 'section-title' }, 'Catalogue'),
    h('p', { class: 'note' }, 'A small, curated set of real stars. Observed values are literature estimates; ranges show real uncertainty.'),
    list,
    savedSection,
    detail,
  );

  function card(star, isSaved) {
    const rgb = blackbodyRGB(star.temperature);
    const pot = POTENTIAL_LABELS[star.supernovaPotential] ?? (star.mass >= 8 ? POTENTIAL_LABELS.high : POTENTIAL_LABELS.none);
    const c = h('div', { class: 'star-card', style: { '--dot': rgbToCss(rgb) }, onClick: () => actions.loadStar(star) },
      h('div', { class: 'star-dot' }),
      h('div', {},
        h('div', { class: 'name' }, star.name, chip(pot.text, pot.cls)),
        h('div', { class: 'meta' }, `${star.type}  ·  ${fmtSolarMass(star.mass)}  ·  ${fmtDistanceLy(star.distanceLy)}`),
      ),
    );
    if (isSaved) {
      c.append(h('button', { class: 'btn small', style: { gridColumn: '1 / -1', justifySelf: 'end' }, onClick: (e) => { e.stopPropagation(); actions.deleteSavedStar(star.id); } }, 'Delete'));
    }
    c.dataset.id = star.id;
    return c;
  }

  function renderLists() {
    clear(list);
    for (const preset of STAR_CATALOG) list.append(card(starFromPreset(preset), false));
    const saved = loadSavedStars();
    clear(savedList);
    savedSection.style.display = saved.length ? '' : 'none';
    for (const s of saved) savedList.append(card(s, true));
    highlight();
  }

  function highlight() {
    const id = store.state.activeStarId;
    for (const c of [...list.children, ...savedList.children]) c.classList.toggle('active', c.dataset.id === id);
  }

  function renderDetail(star) {
    clear(detail);
    if (!star) return;
    const d = describeStar(star);
    const tag = star.observed ? 'Observed' : 'Simulation';
    const rng = (v) => (v ? h('span', { class: 'muted' }, ` (${v})`) : null);
    const rows = [
      dataRow('Spectral type', star.type ?? d.classification.type, tag),
      dataRow('Mass', h('span', { class: 'value' }, fmtSolarMass(star.mass), rng(star.massRange)), tag),
      dataRow('Radius', h('span', { class: 'value' }, fmtSolarRadius(star.radius), rng(star.radiusRange)), tag),
      dataRow('Surface temperature', fmtKelvin(star.temperature), tag),
      dataRow('Luminosity', h('span', { class: 'value' }, fmtSolarLum(star.luminosity), rng(star.luminosityRange)), tag),
      dataRow('Age', h('span', { class: 'value' }, fmtYears(star.ageYr), rng(star.ageRange)), star.observed ? 'Estimated' : 'Simulation'),
      dataRow('Distance from Earth', h('span', { class: 'value' }, fmtDistanceLy(star.distanceLy), rng(star.distanceRange)), tag),
      dataRow('Apparent magnitude', d.apparentMagnitude.toFixed(2), 'Estimated'),
      dataRow('Current stage (model)', d.currentStage.name, 'Estimated'),
      dataRow('Model lifetime', fmtYears(d.lifetimeYr), 'Estimated'),
      dataRow('Evolutionary path', d.terminal, 'Estimated'),
      dataRow('Likely remnant', d.remnant.name, 'Estimated'),
    ];
    const natural = d.isSupernovaProgenitor;
    const actionsRow = h('div', { class: 'btn-row' },
      button('Evolve Star', () => actions.evolve(), 'primary'),
      natural
        ? button('Trigger Supernova', () => actions.triggerSupernova(false), 'danger')
        : button('Trigger Experimental Supernova', () => actions.triggerSupernova(true), 'warn'),
    );
    detail.append(
      h('h3', { class: 'section-title' }, 'Selected star'),
      h('h4', {}, star.name, ' ', star.designation ? h('span', { class: 'designation' }, star.designation) : null),
      star.constellation && star.constellation !== '—' ? h('div', { class: 'designation' }, `${star.constellation}`) : null,
      h('p', { class: 'note' }, star.blurb),
      ...rows,
      h('p', { class: `note ${natural ? 'danger' : 'ok'}` }, natural
        ? `Natural supernova progenitor — ${d.naturalLabel}. ${star.supernovaWindow ? `Timing: ${star.supernovaWindow}.` : ''} Nobody can predict the exact moment; this simulation lets you skip ahead.`
        : `${star.supernovaWindow ? star.supernovaWindow + '. ' : ''}Forcing an explosion runs an experimental scenario (${d.forcedLabel}) that is not an astronomical prediction.`),
      actionsRow,
    );
  }

  store.on('activeStarId', () => { highlight(); });
  store.on('savedStarsVersion', renderLists);
  ctx.sim.on('star', renderDetail);
  renderLists();
  return { el, update() {}, renderDetail };
}
