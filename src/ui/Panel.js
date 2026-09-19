import { h, setChildren } from './dom.js';

/**
 * Tabbed floating panel. `tabs` = [{ id, label, content: HTMLElement }].
 * Returns { el, show(id), activeId, setTabVisible(id, bool) }.
 */
export function tabbedPanel({ title, tabs, cls = '', collapsible = true }) {
  const body = h('div', { class: 'panel-body' });
  const tabButtons = new Map();
  const tabEls = new Map();
  let activeId = tabs[0].id;
  const tabBar = h('div', { class: 'tabs' });
  const api = { el: null, activeId, show, setTabVisible, onChange: null };

  for (const t of tabs) {
    const btn = h('button', { class: 'tab', type: 'button', onClick: () => show(t.id) }, t.label);
    tabButtons.set(t.id, btn);
    tabEls.set(t.id, t.content);
    tabBar.append(btn);
  }

  function show(id) {
    if (!tabEls.has(id)) return;
    activeId = id;
    api.activeId = id;
    for (const [tid, btn] of tabButtons) btn.classList.toggle('active', tid === id);
    setChildren(body, tabEls.get(id));
    api.onChange?.(id);
  }

  function setTabVisible(id, visible) {
    const btn = tabButtons.get(id);
    if (btn) btn.style.display = visible ? '' : 'none';
    if (!visible && activeId === id) show(tabs[0].id);
  }

  const collapseBtn = collapsible
    ? h('button', { class: 'icon-btn', type: 'button', title: 'Collapse panel', onClick: () => { api.el.classList.toggle('collapsed'); collapseBtn.textContent = api.el.classList.contains('collapsed') ? '+' : '–'; } }, '–')
    : null;
  const header = h('div', { class: 'panel-header' }, h('h2', {}, title), collapseBtn);
  api.el = h('div', { class: `panel ${cls}` }, header, tabBar, body);
  show(activeId);
  return api;
}
