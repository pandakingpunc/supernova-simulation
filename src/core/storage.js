/**
 * localStorage persistence for small user data only: settings and saved
 * custom stars. Everything is namespaced and guarded so a blocked or full
 * storage never breaks the app. Total footprint stays in the kilobytes.
 */
const PREFIX = 'supernova-sim:';
const MAX_SAVED_STARS = 24;

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage unavailable or full: ignore, the app works without it */
  }
}

export const loadSettings = () => read('settings', {});
export const saveSettings = (settings) => write('settings', settings);

export const loadSavedStars = () => read('stars', []);
export function saveStar(star) {
  const list = loadSavedStars().filter((s) => s.id !== star.id);
  list.unshift(star);
  write('stars', list.slice(0, MAX_SAVED_STARS));
  return list;
}
export function deleteStar(id) {
  const list = loadSavedStars().filter((s) => s.id !== id);
  write('stars', list);
  return list;
}
