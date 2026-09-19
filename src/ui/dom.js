/** Tiny DOM helpers so the UI code stays declarative without a framework. */

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') {
      for (const [prop, val] of Object.entries(v)) {
        if (prop.startsWith('--')) el.style.setProperty(prop, val);
        else el.style[prop] = val;
      }
    }
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && k !== 'list' && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}

export function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

/** Replace all children, skipping null/false entries (unlike Node.replaceChildren). */
export function setChildren(el, ...children) {
  clear(el);
  return append(el, children);
}

/** Label chip: "Observed", "Estimated", "Simulation", ... */
export function chip(text, cls = '') {
  return h('span', { class: `chip ${cls}` }, text);
}

/** Key–value row for data panels. `tag` is an optional provenance chip class. */
export function dataRow(label, valueEl, tagText) {
  const value = valueEl instanceof Node ? valueEl : h('span', { class: 'value' }, valueEl);
  return h('div', { class: 'data-row' }, h('span', { class: 'label' }, label), value, tagText ? chip(tagText, chipClass(tagText)) : null);
}

export function chipClass(text) {
  const t = String(text).toLowerCase();
  if (t.startsWith('obs')) return 'chip-observed';
  if (t.startsWith('est')) return 'chip-estimated';
  if (t.startsWith('sim')) return 'chip-simulation';
  if (t.startsWith('forc') || t.startsWith('exp')) return 'chip-forced';
  return '';
}

export function button(label, onClick, cls = '') {
  return h('button', { class: `btn ${cls}`, type: 'button', onClick }, label);
}

export function slider({ label, min, max, step, value, format, onInput, log = false }) {
  const out = h('span', { class: 'slider-value' });
  const input = h('input', { type: 'range', min: log ? Math.log10(min) : min, max: log ? Math.log10(max) : max, step: step ?? (log ? 0.01 : 1) });
  const toVal = (v) => (log ? Math.pow(10, Number(v)) : Number(v));
  const toPos = (v) => (log ? Math.log10(v) : v);
  input.value = toPos(value);
  const render = () => { out.textContent = format ? format(toVal(input.value)) : String(toVal(input.value)); };
  render();
  input.addEventListener('input', () => { render(); onInput?.(toVal(input.value)); });
  const wrap = h('label', { class: 'slider' }, h('span', { class: 'slider-label' }, label, out), input);
  wrap.setValue = (v) => { input.value = toPos(v); render(); };
  wrap.getValue = () => toVal(input.value);
  return wrap;
}

export function select(options, value, onChange, cls = '') {
  const sel = h('select', { class: `select ${cls}` });
  for (const [v, label] of options) sel.append(h('option', { value: v }, label));
  sel.value = value;
  sel.addEventListener('change', () => onChange(sel.value));
  return sel;
}

export function section(title, ...children) {
  return h('section', { class: 'panel-section' }, h('h3', { class: 'section-title' }, title), ...children);
}
