/**
 * Event log / timeline. During evolution it lists the stages of the track
 * (click to jump); during a supernova it lists the model's computed events
 * (click to seek the explosion clock).
 */
import { h, clear, focusedByPointer } from './dom.js';
import { fmtTimestamp, fmtYears, fmtSpanYears } from '../core/units.js';
import { T_EXP_START } from '../sim/Simulation.js';

function setCurrent(li, on) {
  if (on) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
}

function activateOnKey(e, fn) {
  if (e.key === ' ' && focusedByPointer()) return; // mouse-focused row: Space stays the global pause hotkey
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); }
}

export function createTimelinePanel(ctx) {
  const { sim, actions } = ctx;
  const list = h('ul', { class: 'timeline' });
  const note = h('p', { class: 'note' });
  const el = h('div', {}, note, list);
  let builtFor = null;
  let builtRef = null; // model / track the list was built from (a new trigger or star load makes a new object)
  let items = [];

  function rebuild(snap) {
    clear(list);
    items = [];
    if (snap.phase === 'supernova') {
      note.textContent = 'Times are since core collapse in the star\'s frame. Click an event to jump to it. Cinematic mode compresses each decade of time into a few seconds.';
      for (const ev of snap.model.timeline) {
        const pre = ev.t < T_EXP_START; // progenitor history: context only, the clock cannot reach it
        const seek = () => actions.seek(ev.t);
        const li = h('li', {
          class: pre ? 'pre' : null,
          title: pre ? 'Before the simulated explosion clock starts (−3 s)' : null,
          role: pre ? null : 'button',
          tabindex: pre ? null : '0',
          onClick: pre ? null : seek,
          onKeydown: pre ? null : (e) => activateOnKey(e, seek),
        },
          h('span', { class: 't' }, fmtTimestamp(ev.t)),
          h('div', {}, h('div', { class: 'title' }, ev.title), h('div', { class: 'detail' }, ev.detail)),
        );
        items.push({ li, t: ev.t, pre });
        list.append(li);
      }
      builtFor = 'supernova';
      builtRef = snap.model;
    } else {
      note.textContent = 'Stages of the model evolution track. Click a stage to jump the star to it (marked as simulation, not observation).';
      snap.track.stages.forEach((s, i) => {
        const seek = () => actions.seekStage(i);
        const li = h('li', { role: 'button', tabindex: '0', onClick: seek, onKeydown: (e) => activateOnKey(e, seek) },
          h('span', { class: 't' }, fmtYears(s.startYr)),
          h('div', {}, h('div', { class: 'title' }, s.name), h('div', { class: 'detail' }, `${s.fusion} · lasts ${fmtSpanYears(s.durationYr)}`)),
        );
        items.push({ li, index: i });
        list.append(li);
      });
      builtFor = `evo-${snap.star.id}`;
      builtRef = snap.track;
    }
  }

  function update(snap) {
    if (!snap) return;
    const key = snap.phase === 'supernova' ? 'supernova' : `evo-${snap.star.id}`;
    if (key !== builtFor || (snap.phase === 'supernova' ? snap.model : snap.track) !== builtRef) rebuild(snap);
    if (snap.phase === 'supernova') {
      let currentIdx = -1;
      items.forEach((it, i) => { if (!it.pre && it.t <= snap.tExp) currentIdx = i; });
      items.forEach((it, i) => { it.li.classList.toggle('reached', !it.pre && it.t <= snap.tExp); it.li.classList.toggle('current', i === currentIdx); setCurrent(it.li, i === currentIdx); });
    } else {
      items.forEach((it) => {
        it.li.classList.toggle('reached', it.index <= snap.stageIndex);
        it.li.classList.toggle('current', it.index === snap.stageIndex);
        setCurrent(it.li, it.index === snap.stageIndex);
      });
    }
  }

  return { el, update };
}
