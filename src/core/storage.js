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

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
// Fields the library, compare and simulation code dereference without checks.
const isStar = (s) => isObj(s) && typeof s.id === 'string' && typeof s.name === 'string'
  && s.mass > 0 && s.radius > 0 && s.temperature > 0 && s.luminosity > 0
  && ['mass', 'radius', 'temperature', 'luminosity', 'ageYr', 'distanceLy', 'ra', 'dec'].every((k) => isNum(s[k]));

export const loadSettings = () => {
  const v = read('settings', {});
  return isObj(v) ? v : {};
};
export const saveSettings = (settings) => write('settings', settings);

export const loadSavedStars = () => {
  const v = read('stars', []);
  return Array.isArray(v) ? v.filter(isStar) : [];
};
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
