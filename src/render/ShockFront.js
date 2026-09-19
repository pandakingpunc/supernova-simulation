/**
 * The forward shock: a fresnel-lit sphere that starts as a sharp blue-white
 * rim at breakout and turns into a faint filamentary shell by the Sedov phase.
 */
import * as THREE from 'three';
import { makeShellMaterial } from './StarBody.js';
import { SOLAR_RADIUS_M, DAY_S, YEAR_S, PN_EXPANSION_SPEED } from '../core/constants.js';
import { clamp } from '../core/math.js';

const EARLY = new THREE.Color(0.8, 0.88, 1.0);
const LATE = new THREE.Color(0.45, 0.7, 1.0);

export class ShockFront {
  constructor() {
    this.geometry = new THREE.SphereGeometry(1, 64, 40);
    this.material = makeShellMaterial(1, 2.5);
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.renderOrder = 6;
    this.mesh.visible = false;
    this.time = 0;
  }

  update(snap, dt, camera) {
    const u = this.material.uniforms;
    this.time += dt;
    u.uTime.value = this.time;
    u.uCamPos.value.copy(camera.position);
    if (snap.phase === 'supernova' && snap.sn.ejectaVisible) {
      const sn = snap.sn;
      const age = sn.ejectaAge;
      const R = sn.Rshock / SOLAR_RADIUS_M;
      this.mesh.scale.setScalar(R);
      const strength = clamp(0.75 * Math.pow(DAY_S / Math.max(age, 60), 0.12), 0.1, 0.75);
      const fil = clamp(Math.log10(Math.max(age, 1) / DAY_S) / 3, 0, 1);
      u.uStrength.value = strength;
      u.uFilament.value = fil;
      u.uColor.value.copy(EARLY).lerp(LATE, fil);
      this.mesh.visible = true;
    } else if (snap.nebulaAgeS > 0) {
      const R = (snap.pnRadius ?? 300) + (PN_EXPANSION_SPEED / SOLAR_RADIUS_M) * snap.nebulaAgeS;
      this.mesh.scale.setScalar(R);
      u.uStrength.value = clamp(0.35 - snap.nebulaAgeS / (3e5 * YEAR_S), 0.03, 0.35);
      u.uFilament.value = 1;
      u.uColor.value.setRGB(0.4, 0.9, 0.85);
      this.mesh.visible = true;
    } else {
      this.mesh.visible = false;
    }
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
