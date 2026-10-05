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
  const tabBar = h('div', { class: 'tabs', role: 'tablist' });
  const api = { el: null, activeId, show, setTabVisible, onChange: null };

  for (const t of tabs) {
    const btn = h('button', { class: 'tab', type: 'button', role: 'tab', 'aria-selected': 'false', onClick: () => show(t.id) }, t.label);
    tabButtons.set(t.id, btn);
    tabEls.set(t.id, t.content);
    tabBar.append(btn);
  }

  function show(id) {
    if (!tabEls.has(id)) return;
    activeId = id;
    api.activeId = id;
    for (const [tid, btn] of tabButtons) {
      btn.classList.toggle('active', tid === id);
      btn.setAttribute('aria-selected', String(tid === id));
    }
    setChildren(body, tabEls.get(id));
    api.onChange?.(id);
  }

  function setTabVisible(id, visible) {
    const btn = tabButtons.get(id);
    if (btn) btn.style.display = visible ? '' : 'none';
    if (!visible && activeId === id) show(tabs[0].id);
  }

  const collapseBtn = collapsible
    ? h('button', { class: 'icon-btn', type: 'button', title: 'Collapse panel', 'aria-label': 'Collapse panel', 'aria-expanded': 'true', onClick: () => {
      api.el.classList.toggle('collapsed');
      const collapsed = api.el.classList.contains('collapsed');
      collapseBtn.textContent = collapsed ? '+' : '–';
      collapseBtn.setAttribute('aria-expanded', String(!collapsed));
      const label = collapsed ? 'Expand panel' : 'Collapse panel';
      collapseBtn.title = label;
      collapseBtn.setAttribute('aria-label', label);
    } }, '–')
    : null;
  const header = h('div', { class: 'panel-header' }, h('h2', {}, title), collapseBtn);
  api.el = h('div', { class: `panel ${cls}` }, header, tabBar, body);
  show(activeId);
  return api;
}
