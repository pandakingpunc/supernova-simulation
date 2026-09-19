/**
 * Simulation clock and state. Owns the star, its evolution track, the
 * supernova model once triggered, the time-control mode and the sampled
 * history used by the charts. Renderers and UI only read snapshots.
 *
 * Two clocks:
 *  - evolution: position on the evolution track (stage index + progress)
 *  - supernova: tExp, seconds since core collapse (negative before)
 *
 * "Cinematic" time compression advances tExp logarithmically so that each
 * decade of time (0.1 s → 1 s → 10 s ... → 1000 yr) takes the same number
 * of wall-clock seconds. That is what makes a 0.25 s collapse and a
 * 100-day plateau both watchable in one sitting.
 */
import { buildEvolutionTrack, applyObservedState, stateAtStage, stageForAge } from '../physics/evolution.js';
import { buildSupernovaModel, determineScenario } from '../physics/supernovaModel.js';
import { predictRemnant } from '../physics/remnants.js';
import { blackbodyRGB } from '../physics/blackbody.js';
import { YEAR_S, SOLAR_RADIUS_M, SOLAR_LUMINOSITY_W, PN_STAGE_DURATION_YR } from '../core/constants.js';
import { clamp } from '../core/math.js';

export const TIME_MODES = {
  pause: { label: 'Pause', short: '❚❚', rate: 0 },
  real: { label: 'Real Time', short: '1×', rate: 1 },
  x10: { label: '10×', short: '10×', rate: 10 },
  x1000: { label: '1,000×', short: '10³×', rate: 1e3 },
  x1M: { label: '1 Million×', short: '10⁶×', rate: 1e6 },
  evolution: { label: 'Stellar Evolution', short: 'EVO', rate: null },
  cinematic: { label: 'Cinematic', short: 'CINE', rate: null },
};

const SECONDS_PER_DECADE = 5; // wall-clock seconds per decade of explosion time in cinematic mode
const T_EXP_START = -3; // s before collapse where the explosion clock starts
const T_EXP_LOG_START = 0.02; // s: below this the cinematic clock runs in real time
const T_EXP_MAX = 3e13; // ~1 Myr: the remnant has merged with the ISM
const HISTORY_INTERVAL = 0.12; // s of wall-clock between chart samples
const HISTORY_MAX = 800;

export class Simulation {
  constructor() {
    this.listeners = new Map();
    this.star = null;
    this.phase = 'idle';
    this.timeMode = 'pause';
    this.speed = 1;
    this.tExp = T_EXP_START;
    this.cinematicOrigin = 0;
    this.model = null;
    this.evolved = false;
    this.postAgeS = 0; // seconds since the end of evolution (white-dwarf phase nebula expansion)
    this.history = null;
    this.historyTimer = 0;
    this.eventLog = [];
    this.timeRate = 0;
  }

  on(event, fn) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(fn);
    return () => this.listeners.get(event).delete(fn);
  }

  emit(event, payload) {
    this.listeners.get(event)?.forEach((fn) => fn(payload));
  }

  // ---------------------------------------------------------------- loading

  loadStar(star) {
    this.star = star;
    this.track = buildEvolutionTrack(star);
    const pos = applyObservedState(this.track, star);
    this.stageIndex = pos.stageIndex;
    this.stageProgress = pos.progress;
    this.trackAgeAtLoad = this.track.stages[pos.stageIndex].startYr + this.track.stages[pos.stageIndex].durationYr * pos.progress;
    this.phase = 'evolution';
    this.model = null;
    this.forced = false;
    this.tExp = T_EXP_START;
    this.evolved = false;
    this.postAgeS = 0;
    this.timeMode = 'pause';
    this.resetHistory('evolution');
    this.eventLog = [{
      ageYr: star.ageYr, key: 'load', title: `${star.name} loaded`, stageIndex: pos.stageIndex,
      detail: `${this.track.stages[pos.stageIndex].name} (${star.observed ? 'observed state' : 'model state'})`,
    }];
    this.emit('star', star);
    this.emit('phase', this.phase);
  }

  setTimeMode(mode) {
    if (!TIME_MODES[mode]) return;
    if (mode === 'evolution' && this.phase !== 'evolution') return;
    if (mode === 'cinematic' && this.phase !== 'supernova') return;
    this.timeMode = mode;
    this.emit('timeMode', mode);
  }

  setSpeed(s) { this.speed = clamp(s, 0.25, 4); }

  isCollapseTerminal() {
    return ['core-collapse', 'wr-collapse', 'pisn'].includes(this.track.terminal);
  }

  /** Seconds of light-travel delay to Earth. */
  lightDelaySeconds() {
    return this.star.distanceLy * YEAR_S;
  }

  // ------------------------------------------------------------ supernova

  /**
   * Start the explosion. Natural progenitors collapse from the end of their
   * track; other stars need `forced` and explode "as they are now".
   * @returns {string|null} scenario key, or null if not allowed
   */
  triggerSupernova({ forced = false } = {}) {
    if (!this.star || this.phase === 'supernova') return null;
    const scenario = determineScenario(this.star, forced);
    if (!scenario) return null;
    const lastIdx = this.track.stages.length - 1;
    const collapseState = this.isCollapseTerminal()
      ? stateAtStage(this.track, lastIdx, 1)
      : this.currentEvolutionState();
    this.collapseState = collapseState;
    this.model = buildSupernovaModel(this.star, collapseState, scenario);
    this.forced = !this.model.params.natural;
    this.phase = 'supernova';
    this.tExp = T_EXP_START;
    this.cinematicOrigin = 0;
    this.timeMode = 'cinematic';
    this.resetHistory('supernova');
    this.emit('supernova', this.model);
    this.emit('phase', this.phase);
    this.emit('timeMode', this.timeMode);
    return scenario;
  }

  seek(t) {
    if (this.phase !== 'supernova') return;
    this.tExp = clamp(t, T_EXP_START, T_EXP_MAX);
    this.emit('seek', this.tExp);
  }

  seekStage(index) {
    if (this.phase === 'supernova') return;
    this.phase = 'evolution';
    this.stageIndex = clamp(index, 0, this.track.stages.length - 1);
    this.stageProgress = 0;
    this.evolved = true;
    this.emit('stage', this.stageIndex);
    this.emit('phase', this.phase);
  }

  // --------------------------------------------------------------- update

  update(dt) {
    if (!this.star) return null;
    dt = Math.min(dt, 0.1);
    if (this.phase === 'evolution') this.advanceEvolution(dt);
    else if (this.phase === 'supernova') this.advanceSupernova(dt);
    else if (this.phase === 'ended') this.advanceEnded(dt);
    const snap = this.snapshot();
    this.sampleHistory(dt, snap);
    return snap;
  }

  advanceEvolution(dt) {
    const mode = TIME_MODES[this.timeMode];
    const stage = this.track.stages[this.stageIndex];
    if (this.timeMode === 'evolution') {
      const before = this.stageIndex;
      this.stageProgress += (dt / stage.displaySec) * this.speed;
      this.timeRate = (stage.durationYr * YEAR_S) / stage.displaySec * this.speed;
      this.evolved = true;
      while (this.stageProgress >= 1) {
        if (this.stageIndex >= this.track.stages.length - 1) {
          this.stageProgress = 1;
          this.finishEvolution();
          return;
        }
        this.stageProgress -= 1;
        this.stageIndex++;
        const s = this.track.stages[this.stageIndex];
        this.eventLog.push({ ageYr: this.currentAgeYr(), key: s.key, title: s.name, detail: s.fusion, stageIndex: this.stageIndex });
      }
      if (before !== this.stageIndex) this.emit('stage', this.stageIndex);
    } else if (mode.rate > 0) {
      const trackAge = stage.startYr + stage.durationYr * this.stageProgress + (dt * mode.rate) / YEAR_S;
      const pos = stageForAge(this.track, trackAge);
      if (pos.stageIndex !== this.stageIndex) {
        this.stageIndex = pos.stageIndex;
        const s = this.track.stages[this.stageIndex];
        this.eventLog.push({ ageYr: this.currentAgeYr(), key: s.key, title: s.name, detail: s.fusion, stageIndex: this.stageIndex });
        this.emit('stage', this.stageIndex);
      }
      this.stageProgress = pos.progress;
      this.timeRate = mode.rate;
      if (mode.rate > 1) this.evolved = true;
      if (trackAge >= this.track.totalLifetimeYr) this.finishEvolution();
    } else {
      this.timeRate = 0;
    }
  }

  finishEvolution() {
    if (this.isCollapseTerminal()) {
      this.triggerSupernova({ forced: false });
    } else {
      this.phase = 'ended';
      this.remnant = predictRemnant({ mass: this.star.mass, metallicity: this.star.metallicity, rotation: this.star.rotation });
      this.postAgeS = 0;
      this.timeMode = 'x1000';
      this.eventLog.push({ ageYr: this.currentAgeYr(), key: 'end', title: `${this.remnant.name} formed`, detail: 'The star has reached the end of its life without a supernova.' });
      this.emit('ended', this.remnant);
      this.emit('phase', this.phase);
      this.emit('timeMode', this.timeMode);
    }
  }

  advanceEnded(dt) {
    const mode = TIME_MODES[this.timeMode];
    const rate = mode.rate ?? 1e6;
    this.postAgeS += dt * rate;
    this.timeRate = rate;
  }

  advanceSupernova(dt) {
    const mode = TIME_MODES[this.timeMode];
    let dtSim = 0;
    if (this.timeMode === 'cinematic') {
      // Log clock measured from `cinematicOrigin` (0, or the light-travel delay when the
      // user has jumped to the moment the light reaches Earth).
      const tRef = this.tExp - this.cinematicOrigin;
      if (tRef < T_EXP_LOG_START) dtSim = dt * this.speed;
      else dtSim = tRef * (Math.LN10 / SECONDS_PER_DECADE) * dt * this.speed;
    } else if (mode.rate > 0) {
      dtSim = dt * mode.rate;
    }
    this.timeRate = dt > 0 ? dtSim / dt : 0;
    this.tExp = Math.min(this.tExp + dtSim, T_EXP_MAX);
  }

  // ------------------------------------------------------------ snapshots

  currentAgeYr() {
    const s = this.track.stages[this.stageIndex];
    const trackAge = s.startYr + s.durationYr * this.stageProgress;
    return this.star.ageYr + (trackAge - this.trackAgeAtLoad);
  }

  currentEvolutionState() {
    return stateAtStage(this.track, this.stageIndex, this.stageProgress);
  }

  snapshot() {
    if (this.phase === 'supernova') return this.supernovaSnapshot(this.tExp);
    const st = this.currentEvolutionState();
    const ended = this.phase === 'ended';
    // Planetary nebula age: grows through the 'pn' stage and keeps growing after the star has ended.
    let nebulaAgeS = 0;
    if (ended) nebulaAgeS = PN_STAGE_DURATION_YR * YEAR_S + this.postAgeS;
    else if (st.stage.nebula) nebulaAgeS = st.progress * PN_STAGE_DURATION_YR * YEAR_S;
    const pnStage = this.track.stages.find((s) => s.key === 'agb');
    return {
      nebulaAgeS,
      pnRadius: pnStage ? pnStage.end.R : 300,
      phase: this.phase,
      star: this.star,
      track: this.track,
      stageIndex: this.stageIndex,
      stage: st.stage,
      stageProgress: st.progress,
      ageYr: this.currentAgeYr(),
      R: st.R, L: st.L, T: st.T, Tc: st.Tc, rhoc: st.rhoc,
      mass: this.star.mass,
      instability: st.instability,
      remnantForming: st.remnantForming,
      nebula: !!st.stage.nebula || ended,
      color: blackbodyRGB(st.T),
      timeRate: this.timeRate,
      dataLabel: this.evolved ? 'Simulation' : 'Observed',
      remnant: ended ? this.remnant : null,
      postAgeS: this.postAgeS,
      model: null,
      sn: null,
      tExp: null,
    };
  }

  supernovaSnapshot(t) {
    const sn = this.model.stateAt(t);
    return {
      phase: 'supernova',
      star: this.star,
      track: this.track,
      model: this.model,
      scenario: this.model.scenario,
      forced: this.forced,
      tExp: t,
      sn,
      stage: null,
      ageYr: this.star.ageYr,
      R: sn.Rphot / SOLAR_RADIUS_M,
      L: sn.L / SOLAR_LUMINOSITY_W,
      T: sn.Tcolor,
      Tc: sn.coreT,
      rhoc: sn.coreRho,
      mass: sn.Mbound,
      instability: sn.instability,
      color: blackbodyRGB(sn.Tcolor),
      collapseState: this.collapseState,
      timeRate: this.timeRate,
      dataLabel: 'Simulation',
      remnant: this.model.remnant,
    };
  }

  /**
   * What Earth sees now. With light-travel time respected the explosion is
   * sampled at tExp − d/c; before the light arrives Earth still sees the
   * pre-collapse star.
   */
  earthSnapshot(respectLightTravel) {
    if (this.phase !== 'supernova') return { ...this.snapshot(), lightArrived: true, retardedT: null };
    const delay = respectLightTravel ? this.lightDelaySeconds() : 0;
    const tRet = this.tExp - delay;
    if (tRet < T_EXP_START) {
      const cs = this.collapseState;
      return {
        phase: 'evolution', star: this.star, tExp: null, retardedT: tRet, lightArrived: false,
        R: cs.R, L: cs.L, T: cs.T, color: blackbodyRGB(cs.T), sn: null, model: this.model,
        arrivalIn: -tRet,
      };
    }
    return { ...this.supernovaSnapshot(tRet), retardedT: tRet, lightArrived: true };
  }

  // -------------------------------------------------------------- history

  resetHistory(kind) {
    this.history = { kind, x: [], L: [], R: [], Tc: [], Rs: [] };
    this.historyTimer = HISTORY_INTERVAL;
  }

  sampleHistory(dt, snap) {
    this.historyTimer += dt;
    if (this.historyTimer < HISTORY_INTERVAL) return;
    this.historyTimer = 0;
    const h = this.history;
    const x = snap.phase === 'supernova' ? snap.tExp : snap.ageYr;
    if (h.x.length && h.x[h.x.length - 1] === x) return;
    h.x.push(x);
    h.L.push(snap.L);
    h.R.push(snap.R);
    h.Tc.push(snap.Tc);
    h.Rs.push(snap.sn ? snap.sn.Rshock : 0);
    if (h.x.length > HISTORY_MAX) {
      // decimate: keep every other sample
      for (const k of ['x', 'L', 'R', 'Tc', 'Rs']) h[k] = h[k].filter((_, i) => i % 2 === 0);
    }
  }
}
