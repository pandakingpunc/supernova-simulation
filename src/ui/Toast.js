import { h } from './dom.js';

let container = null;

/** Non-blocking notification in the lower centre of the screen. */
export function toast(message, { kind = 'info', duration = 4200 } = {}) {
  if (!container) {
    container = h('div', { class: 'toast-container' });
    document.body.append(container);
  }
  const el = h('div', { class: `toast toast-${kind}` }, message);
  container.append(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 350);
  }, duration);
}
