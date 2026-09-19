/**
 * Expanding ejecta as two GPU point systems (fast outer envelope, slower
 * inner metal-rich material). Positions are computed entirely in the vertex
 * shader from a direction, a speed fraction and the elapsed time, so the CPU
 * cost per frame is a handful of uniform updates regardless of particle count.
 * Also renders the slow planetary-nebula shell for low-mass endpoints.
 */
import * as THREE from 'three';
import { EJECTA_VERT, EJECTA_FRAG } from './shaders.js';
import { SOLAR_RADIUS_M, DAY_S, YEAR_S, PN_EXPANSION_SPEED } from '../core/constants.js';
import { makeRng, randomDirection, clamp } from '../core/math.js';
import { blackbodyRGB } from '../physics/blackbody.js';

function makeLayer(count, speedMin, speedMax, layer, seed) {
  const rng = makeRng(seed);
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3); // unused by the shader but required
  const dirs = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  const seeds = new Float32Array(count);
  const layers = new Float32Array(count);
  const d = [0, 0, 0];
  for (let i = 0; i < count; i++) {
    randomDirection(rng, d);
    dirs[i * 3] = d[0]; dirs[i * 3 + 1] = d[1]; dirs[i * 3 + 2] = d[2];
    // weight toward the fast end so the outer shell reads as a thin bright rim
    const u = rng();
    speeds[i] = speedMin + (speedMax - speedMin) * Math.pow(u, layer === 0 ? 0.5 : 1.2);
    seeds[i] = rng() * 100;
    layers[i] = layer;
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('dir', new THREE.BufferAttribute(dirs, 3));
  geometry.setAttribute('speed', new THREE.BufferAttribute(speeds, 1));
  geometry.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute('layer', new THREE.BufferAttribute(layers, 1));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e14); // never frustum-culled
  return geometry;
}

export class Ejecta {
  constructor(count = 14000) {
    this.group = new THREE.Group();
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uT: { value: 0 }, uR0: { value: 1 }, uVmax: { value: 0 }, uRadiusScale: { value: 1 }, uClump: { value: 0 },
        uScreenH: { value: 1000 }, uFovFactor: { value: 1 }, uSizeFactor: { value: 1 },
        // Nebular colours: Hα-pink outer filaments, [O III]-teal inner ejecta (HDR so bloom catches them)
        uHotColor: { value: new THREE.Color(1, 1, 1) }, uOuterColor: { value: new THREE.Color(1.6, 0.6, 0.7) },
        uInnerColor: { value: new THREE.Color(0.5, 1.5, 1.2) }, uNebular: { value: 0 }, uGlow: { value: 1 },
      },
      vertexShader: EJECTA_VERT,
      fragmentShader: EJECTA_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.build(count);
    this.group.visible = false;
  }

  build(count) {
    this.disposeGeometry();
    const outerN = Math.round(count * 0.6);
    const innerN = count - outerN;
    this.outer = new THREE.Points(makeLayer(outerN, 0.72, 1.0, 0, 11), this.material);
    this.inner = new THREE.Points(makeLayer(innerN, 0.18, 0.72, 1, 23), this.material);
    this.outer.renderOrder = 5;
    this.inner.renderOrder = 4;
    this.group.add(this.outer, this.inner);
    this.count = count;
    // Additive particles pile up: with N particles each covering ~0.4% of the projected
    // shell, every pixel sees ~0.004·N layers. Normalise so total brightness is count-independent.
    this.glowNorm = 1.2 / Math.max(1, count * 0.004);
  }

  disposeGeometry() {
    if (this.outer) { this.group.remove(this.outer); this.outer.geometry.dispose(); }
    if (this.inner) { this.group.remove(this.inner); this.inner.geometry.dispose(); }
  }

  /** @returns {number} current outer radius in scene units (R☉), 0 if inactive */
  update(snap, camera, screenHeight) {
    const u = this.material.uniforms;
    u.uScreenH.value = screenHeight;
    u.uFovFactor.value = 0.5 / Math.tan((camera.fov * Math.PI) / 360);
    let radius = 0;

    if (snap.phase === 'supernova' && snap.sn.ejectaVisible) {
      const sn = snap.sn;
      const p = snap.model.params;
      const t = sn.ejectaAge;
      const R0 = snap.collapseState.R;
      const vMax = p.vMax / SOLAR_RADIUS_M;
      const free = R0 + vMax * t;
      const Rshock = sn.Rshock / SOLAR_RADIUS_M;
      u.uT.value = t;
      u.uR0.value = R0;
      u.uVmax.value = vMax;
      u.uRadiusScale.value = Rshock / free;
      u.uClump.value = clamp(Math.log10(Math.max(t, 1) / DAY_S) / 3, 0, 1);
      u.uNebular.value = clamp(Math.log10(Math.max(t, 1) / (100 * DAY_S)) / 1.5, 0, 1);
      const Lref = Math.max(p.LPlateau, snap.model.peak.L);
      // Early on the glow follows the bolometric light curve; in the nebular phase the shell is
      // seen by line emission and synchrotron light, so it stays visible long after L has dropped.
      const lum = clamp(Math.pow(sn.L / Lref, 0.3), 0.35, 1.6);
      const nebular = u.uNebular.value;
      u.uGlow.value = (lum * (1 - nebular) + 1.0 * nebular) * this.glowNorm;
      const [r, g, b] = blackbodyRGB(sn.Tcolor).map((c) => Math.pow(c, 1.8));
      u.uHotColor.value.setRGB(r * 1.25, g * 0.85, b * 0.6); // warm: the fireball reads orange, the shock rim stays blue
      u.uSizeFactor.value = 0.8;
      radius = Rshock;
      this.group.visible = true;
    } else if (snap.nebulaAgeS > 0) {
      // Planetary nebula: slow (25 km/s) shell blown off an AGB star.
      const t = snap.nebulaAgeS;
      const R0 = snap.pnRadius ?? 300;
      const vMax = PN_EXPANSION_SPEED / SOLAR_RADIUS_M;
      u.uT.value = t;
      u.uR0.value = R0;
      u.uVmax.value = vMax;
      u.uRadiusScale.value = 1;
      u.uClump.value = clamp(Math.log10(Math.max(t, 1) / (300 * YEAR_S)) / 1.5, 0, 1);
      u.uNebular.value = 1;
      u.uGlow.value = clamp(1.1 - t / (1e5 * YEAR_S), 0.1, 1.1) * this.glowNorm;
      u.uHotColor.value.setRGB(0.6, 0.9, 1);
      u.uSizeFactor.value = 1.6;
      radius = R0 + vMax * t;
      this.group.visible = true;
    } else {
      this.group.visible = false;
    }
    return radius;
  }

  dispose() {
    this.disposeGeometry();
    this.material.dispose();
  }
}
