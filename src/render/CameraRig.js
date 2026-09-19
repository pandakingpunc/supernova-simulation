/**
 * Camera framing. OrbitControls handles rotation; distance is driven by the
 * active cinematic preset (which follows the relevant physical radius —
 * star, photosphere, shock or remnant) multiplied by the user's zoom factor.
 * Distances are interpolated in log space because the scene spans 14
 * orders of magnitude (12 km neutron star to a 10 pc remnant).
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SOLAR_RADIUS_M } from '../core/constants.js';
import { clamp } from '../core/math.js';
import { STARFIELD_RADIUS } from './Starfield.js';

export const CAMERA_PRESETS = {
  orbit: { label: 'Orbit View', hint: 'Orbits the star at the scale of its photosphere', polar: 1.15, autoRotate: 0.3 },
  surface: { label: 'Surface Proximity', hint: 'Skims the photosphere; the shock will pass through you', polar: 1.35, autoRotate: 0.08 },
  wide: { label: 'Wide System View', hint: 'Frames the whole explosion as it grows', polar: 1.0, autoRotate: 0.12 },
  front: { label: 'Explosion Front', hint: 'Rides just outside the expanding shockwave', polar: 1.2, autoRotate: 0.2 },
  remnant: { label: 'Remnant View', hint: 'Zooms 10⁷× to the compact object', polar: 1.1, autoRotate: 0.4 },
  free: { label: 'Free Camera', hint: 'No automatic framing; scroll to zoom', polar: null, autoRotate: 0 },
};

export class CameraRig {
  constructor(camera, domElement) {
    this.camera = camera;
    this.controls = new OrbitControls(camera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.enableZoom = false; // zoom handled here (log-space, multiplicative)
    this.controls.rotateSpeed = 0.55;
    this.controls.minDistance = 1e-9;
    this.controls.maxDistance = 1e13;
    this.preset = 'orbit';
    this.userZoom = 1;
    this.logDist = Math.log(3.4);
    this.lastBase = 3.4;
    camera.position.set(0, 1.3, 3.2);
    domElement.addEventListener('wheel', (e) => {
      e.preventDefault();
      const f = Math.exp(clamp(e.deltaY, -120, 120) * 0.0016);
      if (this.preset === 'free') this.logDist += Math.log(f);
      else this.userZoom = clamp(this.userZoom * f, 0.04, 60);
    }, { passive: false });
  }

  setPreset(name, snap) {
    if (!CAMERA_PRESETS[name]) return;
    const prev = this.preset;
    this.preset = name;
    this.userZoom = 1;
    const p = CAMERA_PRESETS[name];
    this.controls.autoRotate = p.autoRotate > 0;
    this.controls.autoRotateSpeed = p.autoRotate;
    if (p.polar != null && name !== prev) {
      // Nudge the polar angle toward the preset's default without a hard cut
      this.targetPolar = p.polar;
    }
    if (snap) this.lastBase = this.baseDistance(snap);
  }

  /** Ideal camera distance (scene units = R☉) for the current preset. */
  baseDistance(snap) {
    const sn = snap.sn;
    const R0 = snap.phase === 'supernova' ? snap.collapseState.R : snap.phase === 'ended' ? (snap.pnRadius ?? 300) : snap.R;
    const Rphot = snap.phase === 'supernova' ? snap.R : R0;
    const Rshock = sn ? sn.Rshock / SOLAR_RADIUS_M : 0;
    const Rneb = snap.nebulaAgeS > 0 ? this.nebulaRadius : 0;
    const Rrem = this.remnantRadius > 0 ? this.remnantRadius : 0;
    switch (this.preset) {
      case 'surface': return 2.0 * R0; // horizon curvature stays visible at the edges of a 48° view
      case 'wide': return Math.max(45 * R0, 3.5 * Rshock, 3.5 * Rphot, 2.5 * Rneb);
      case 'front': return Math.max(2.8 * Rshock, 3 * R0, 2.2 * Rneb);
      case 'remnant': return Rrem > 0 ? 14 * Rrem : 3.4 * Math.max(R0, Rphot);
      case 'free': return Math.exp(this.logDist);
      default: return 3.4 * Math.max(R0, Rphot);
    }
  }

  /** Called by the scene manager with the radii it knows about. */
  setContext({ remnantRadius = 0, nebulaRadius = 0 }) {
    this.remnantRadius = remnantRadius;
    this.nebulaRadius = nebulaRadius;
  }

  update(snap, dt) {
    if (this.targetPolar != null) {
      const cur = this.controls.getPolarAngle();
      const next = cur + (this.targetPolar - cur) * (1 - Math.exp(-dt * 2));
      this.controls.minPolarAngle = next;
      this.controls.maxPolarAngle = next;
      if (Math.abs(next - this.targetPolar) < 0.01) {
        this.targetPolar = null;
        this.controls.minPolarAngle = 0;
        this.controls.maxPolarAngle = Math.PI;
      }
    }
    this.controls.update();
    if (snap) {
      const base = this.baseDistance(snap);
      this.lastBase = base;
      const target = Math.log(Math.max(base * (this.preset === 'free' ? 1 : this.userZoom), 1e-8));
      const k = 1 - Math.exp(-dt * 2.6);
      this.logDist += (target - this.logDist) * k;
    }
    const dist = Math.exp(this.logDist);
    this.camera.position.setLength(dist);
    this.camera.near = Math.max(dist * 4e-4, 1e-9);
    this.camera.far = STARFIELD_RADIUS * 3;
    this.camera.updateProjectionMatrix();
  }

  distance() { return Math.exp(this.logDist); }

  /** Width of the view at the origin, in metres — for the on-screen scale bar. */
  viewWidthMeters(aspect) {
    return 2 * this.distance() * Math.tan((this.camera.fov * Math.PI) / 360) * aspect * SOLAR_RADIUS_M;
  }

  dispose() { this.controls.dispose(); }
}

export { THREE };
