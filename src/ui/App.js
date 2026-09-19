/**
 * Application wiring: store + simulation + renderers + panels, the main
 * loop, keyboard shortcuts, persistence and adaptive quality.
 */
import { createStore } from '../core/store.js';
import { loadSettings, saveSettings, saveStar, deleteStar } from '../core/storage.js';
import { Simulation } from '../sim/Simulation.js';
import { SceneManager } from '../render/SceneManager.js';
import { EarthView } from '../earth/EarthView.js';
import { QUALITY_ORDER, DEFAULT_QUALITY, QUALITY_PRESETS } from '../render/quality.js';
import { STAR_CATALOG } from '../data/starCatalog.js';
import { starFromPreset } from '../sim/StarFactory.js';
import { tabbedPanel } from './Panel.js';
import { createTopBar } from './TopBar.js';
import { createLibraryPanel } from './LibraryPanel.js';
import { createBuilderPanel } from './BuilderPanel.js';
import { createEarthPanel } from './EarthPanel.js';
import { createSciencePanel } from './SciencePanel.js';
import { createTimelinePanel } from './TimelinePanel.js';
import { createImpactPanel } from './ImpactPanel.js';
import { createBottomBar } from './BottomBar.js';
import { createOverlay } from './Overlay.js';
import { createComparePanel } from './ComparePanel.js';
import { createIntro } from './Intro.js';
import { toast } from './Toast.js';
import { YEAR_S } from '../core/constants.js';

const UI_UPDATE_INTERVAL = 0.1; // s
const LOW_FPS_THRESHOLD = 26;
const LOW_FPS_SECONDS = 5;

export function createApp({ sceneCanvas, earthCanvas, uiRoot }) {
  const settings = loadSettings();
  const store = createStore({
    view: 'close',
    cameraPreset: 'orbit',
    quality: QUALITY_PRESETS[settings.quality] ? settings.quality : DEFAULT_QUALITY,
    qualityLocked: !!settings.qualityLocked,
    respectLightTravel: settings.respectLightTravel ?? true,
    activeStarId: null,
    savedStarsVersion: 0,
    uiHidden: false,
  });

  const sim = new Simulation();
  let scene;
  try {
    scene = new SceneManager(sceneCanvas, store.state.quality);
  } catch (err) {
    console.error(err);
    uiRoot.append(createFatal('WebGL could not be initialised. This simulation needs a browser with WebGL 2 and hardware acceleration enabled.'));
    return null;
  }
  const earth = new EarthView(earthCanvas);

  const persist = () => saveSettings({ quality: store.state.quality, qualityLocked: store.state.qualityLocked, respectLightTravel: store.state.respectLightTravel, introSeen: true });

  const actions = {
    loadStar(star) {
      sim.loadStar(star);
      store.set({ activeStarId: star.id });
      scene.setCameraPreset(store.state.cameraPreset === 'remnant' ? 'orbit' : store.state.cameraPreset, sim.snapshot());
      if (store.state.cameraPreset === 'remnant') store.set({ cameraPreset: 'orbit' });
      toast(`${star.name} loaded — ${star.observed ? 'observed state' : 'model state'}`);
    },
    evolve() {
      if (sim.phase === 'supernova') return;
      if (sim.phase === 'ended') { actions.resetStar(); }
      sim.setTimeMode('evolution');
      toast('Stellar Evolution Mode: the rest of the star\'s life, compressed to about a minute.');
    },
    triggerSupernova(forced) {
      const scenario = sim.triggerSupernova({ forced });
      if (!scenario) { toast('This star cannot explode naturally. Use "Trigger Experimental Supernova".', 'warn'); return; }
      const label = sim.model.params.label;
      toast(sim.forced ? `Experimental scenario: ${label}. Not an astronomical prediction.` : `${label} — core collapse begins.`, sim.forced ? 'warn' : 'info');
      if (store.state.view === 'compare') actions.setView('close');
    },
    resetStar() {
      const s = sim.star;
      if (s) actions.loadStar(s);
    },
    setTimeMode(mode) { sim.setTimeMode(mode); },
    setView(view) {
      store.set({ view });
      document.body.dataset.view = view;
      if (view === 'earth') resizeEarth();
    },
    setCameraPreset(name) {
      store.set({ cameraPreset: name });
      scene.setCameraPreset(name, sim.snapshot());
    },
    setQuality(name, locked = false) {
      if (!QUALITY_PRESETS[name]) return;
      scene.setQuality(name);
      store.set({ quality: name, qualityLocked: locked || store.state.qualityLocked });
      persist();
    },
    setLightTravel(v) { store.set({ respectLightTravel: v }); persist(); },
    jumpToLightArrival() {
      if (sim.phase !== 'supernova') return;
      // Restart the log clock from the moment of arrival so Earth watches the explosion unfold.
      sim.cinematicOrigin = sim.lightDelaySeconds();
      sim.seek(sim.cinematicOrigin - 3); // 3 s of the old star, then Earth sees the collapse unfold
      sim.setTimeMode('cinematic');
      toast(`Jumped ${(sim.star.distanceLy).toFixed(0)} years ahead: the light has just reached Earth. Near the star, the remnant is already that old.`);
    },
    seek(t) { sim.seek(t); if (sim.timeMode === 'pause') sim.setTimeMode('cinematic'); },
    seekStage(i) { sim.seekStage(i); },
    saveCustomStar(star) {
      saveStar(star);
      store.set({ savedStarsVersion: store.state.savedStarsVersion + 1 });
      toast(`${star.name} saved to your library (stored locally in this browser).`);
    },
    deleteSavedStar(id) {
      deleteStar(id);
      store.set({ savedStarsVersion: store.state.savedStarsVersion + 1 });
    },
    toggleUI() {
      const hidden = !store.state.uiHidden;
      store.set({ uiHidden: hidden });
      document.body.classList.toggle('ui-hidden', hidden);
      if (hidden) toast('Interface hidden — press H to bring it back', { duration: 2500 });
    },
    showIntro() { document.body.append(createIntro()); },
    toast(msg, kind = 'info') { toast(msg, { kind }); },
  };

  const ctx = { store, sim, scene, earth, actions };

  // ---- panels ----
  const topBar = createTopBar(ctx);
  const library = createLibraryPanel(ctx);
  const builder = createBuilderPanel(ctx);
  const earthPanel = createEarthPanel(ctx);
  const leftPanel = tabbedPanel({ title: 'Stars', cls: 'left-panel', tabs: [
    { id: 'library', label: 'Star Library', content: library.el },
    { id: 'builder', label: 'Build Your Own', content: builder.el },
    { id: 'earth', label: 'Earth View', content: earthPanel.el },
  ] });
  const science = createSciencePanel(ctx);
  const timeline = createTimelinePanel(ctx);
  const impact = createImpactPanel(ctx);
  const rightPanel = tabbedPanel({ title: 'Science', cls: 'right-panel', tabs: [
    { id: 'data', label: 'Live Data', content: science.el },
    { id: 'timeline', label: 'Timeline', content: timeline.el },
    { id: 'impact', label: 'Earth Impact', content: impact.el },
  ] });
  const bottomBar = createBottomBar(ctx);
  const overlay = createOverlay(ctx);
  const compare = createComparePanel(ctx);
  compare.el.style.display = 'none';
  uiRoot.append(topBar.el, leftPanel.el, overlay.el, compare.el, rightPanel.el, bottomBar.el);

  store.on('view', (v) => {
    compare.el.style.display = v === 'compare' ? '' : 'none';
    overlay.el.style.display = v === 'compare' ? 'none' : '';
    if (v === 'earth') leftPanel.show('earth');
    else if (leftPanel.activeId === 'earth') leftPanel.show('library');
  });

  // ---- keyboard ----
  window.addEventListener('keydown', (e) => {
    if (e.target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
    const presets = ['orbit', 'surface', 'wide', 'front', 'remnant'];
    if (e.code === 'Space') {
      e.preventDefault();
      if (sim.timeMode === 'pause') sim.setTimeMode(sim.phase === 'supernova' ? 'cinematic' : sim.lastPlayMode ?? 'evolution');
      else { sim.lastPlayMode = sim.timeMode; sim.setTimeMode('pause'); }
    } else if (e.key >= '1' && e.key <= '5') actions.setCameraPreset(presets[+e.key - 1]);
    else if (e.key === 'h' || e.key === 'H') actions.toggleUI();
    else if (e.key === 'e' || e.key === 'E') actions.setView('earth');
    else if (e.key === 'c' || e.key === 'C') actions.setView('close');
    else if (e.key === 'Escape') document.querySelector('.intro')?.remove();
  });

  // ---- sizing ----
  function resizeEarth() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    earth.setSize(earthCanvas.clientWidth || window.innerWidth, earthCanvas.clientHeight || window.innerHeight, dpr);
  }
  window.addEventListener('resize', () => { scene.resize(); resizeEarth(); });
  resizeEarth();

  // ---- main loop ----
  let last = performance.now();
  let uiTimer = 0;
  let lowFpsTimer = 0;
  let snap = null;
  function tick(now) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    snap = sim.update(dt);
    const view = store.state.view;
    let earthInfo = null; let earthSnap = null;
    if (view === 'close') {
      scene.render(snap, dt);
      adaptQuality(dt);
    } else if (view === 'earth') {
      earthSnap = sim.earthSnapshot(store.state.respectLightTravel);
      earthInfo = earth.render(earthSnap, dt);
    }
    uiTimer += dt;
    if (uiTimer >= UI_UPDATE_INTERVAL) {
      uiTimer = 0;
      if (rightPanel.activeId === 'data') science.update(snap);
      else if (rightPanel.activeId === 'timeline') timeline.update(snap);
      else impact.update(snap);
      if (leftPanel.activeId === 'earth') earthPanel.update(snap);
      bottomBar.update(snap);
      overlay.update(snap, earthInfo, earthSnap);
    }
    requestAnimationFrame(tick);
  }

  function adaptQuality(dt) {
    if (store.state.qualityLocked) return;
    if (scene.fps < LOW_FPS_THRESHOLD) lowFpsTimer += dt; else lowFpsTimer = 0;
    if (lowFpsTimer > LOW_FPS_SECONDS) {
      lowFpsTimer = 0;
      const i = QUALITY_ORDER.indexOf(store.state.quality);
      if (i > 0) {
        const next = QUALITY_ORDER[i - 1];
        actions.setQuality(next, false);
        toast(`Frame rate is low — graphics quality reduced to ${QUALITY_PRESETS[next].label}. Choose a level in the top bar to lock it.`, { kind: 'warn' });
      }
    }
  }

  // ---- start ----
  actions.loadStar(starFromPreset(STAR_CATALOG[0]));
  if (!settings.introSeen) document.body.append(createIntro(persist));
  requestAnimationFrame((now) => { last = now; tick(now); });

  return { store, sim, scene, earth, actions };
}

function createFatal(message) {
  const el = document.createElement('div');
  el.className = 'intro';
  el.innerHTML = `<div class="intro-card"><h1>Cannot start</h1><p>${message}</p></div>`;
  return el;
}

export { YEAR_S };
