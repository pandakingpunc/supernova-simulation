/**
 * Minimal observable state container. `set()` merges a patch and notifies
 * listeners of every key that changed; `on(key, fn)` subscribes to one key
 * ('*' for everything).
 */
export function createStore(initial) {
  const state = { ...initial };
  const listeners = new Map();

  function on(key, fn) {
    if (!listeners.has(key)) listeners.set(key, new Set());
    listeners.get(key).add(fn);
    return () => listeners.get(key).delete(fn);
  }

  function emit(key, value, prev) {
    listeners.get(key)?.forEach((fn) => fn(value, prev));
    listeners.get('*')?.forEach((fn) => fn(key, value, prev));
  }

  function set(patch) {
    const changed = [];
    for (const [k, v] of Object.entries(patch)) {
      if (state[k] !== v) {
        changed.push([k, v, state[k]]);
        state[k] = v;
      }
    }
    for (const [k, v, prev] of changed) emit(k, v, prev);
  }

  return { state, set, on };
}
