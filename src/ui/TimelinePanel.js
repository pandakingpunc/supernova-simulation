/**
 * Event log / timeline. During evolution it lists the stages of the track
 * (click to jump); during a supernova it lists the model's computed events
 * (click to seek the explosion clock).
 */
import { h, clear } from './dom.js';
import { fmtTimestamp, fmtYears } from '../core/units.js';

export function createTimelinePanel(ctx) {
  const { sim, actions } = ctx;
  const list = h('ul', { class: 'timeline' });
  const note = h('p', { class: 'note' });
  const el = h('div', {}, note, list);
  let builtFor = null;
  let items = [];

  function rebuild(snap) {
    clear(list);
    items = [];
    if (snap.phase === 'supernova') {
      note.textContent = 'Times are since core collapse in the star\'s frame. Click an event to jump to it. Cinematic mode compresses each decade of time into a few seconds.';
      for (const ev of snap.model.timeline) {
        const li = h('li', { onClick: () => actions.seek(ev.t) },
          h('span', { class: 't' }, fmtTimestamp(ev.t)),
          h('div', {}, h('div', { class: 'title' }, ev.title), h('div', { class: 'detail' }, ev.detail)),
        );
        items.push({ li, t: ev.t });
        list.append(li);
      }
      builtFor = 'supernova';
    } else {
      note.textContent = 'Stages of the model evolution track. Click a stage to jump the star to it (marked as simulation, not observation).';
      snap.track.stages.forEach((s, i) => {
        const li = h('li', { onClick: () => actions.seekStage(i) },
          h('span', { class: 't' }, fmtYears(s.startYr)),
          h('div', {}, h('div', { class: 'title' }, s.name), h('div', { class: 'detail' }, `${s.fusion} · lasts ${fmtYears(s.durationYr)}`)),
        );
        items.push({ li, index: i });
        list.append(li);
      });
      builtFor = `evo-${snap.star.id}`;
    }
  }

  function update(snap) {
    if (!snap) return;
    const key = snap.phase === 'supernova' ? 'supernova' : `evo-${snap.star.id}`;
    if (key !== builtFor) rebuild(snap);
    if (snap.phase === 'supernova') {
      let currentIdx = -1;
      items.forEach((it, i) => { if (it.t <= snap.tExp) currentIdx = i; });
      items.forEach((it, i) => { it.li.classList.toggle('reached', it.t <= snap.tExp); it.li.classList.toggle('current', i === currentIdx); });
    } else {
      items.forEach((it) => {
        it.li.classList.toggle('reached', it.index <= snap.stageIndex);
        it.li.classList.toggle('current', it.index === snap.stageIndex);
      });
    }
  }

  return { el, update };
}
