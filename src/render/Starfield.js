/**
 * Background star field: procedural points on a sphere far outside the
 * scene, re-centred on the camera every frame so it behaves like a sky box.
 * A second, fainter population is concentrated along the galactic plane to
 * suggest the Milky Way.
 */
import * as THREE from 'three';
import { STARFIELD_VERT, STARFIELD_FRAG } from './shaders.js';
import { makeRng, randomDirection, DEG } from '../core/math.js';
import { blackbodyRGB } from '../physics/blackbody.js';

export const STARFIELD_RADIUS = 1e12;

// Galactic north pole (J2000) and the direction of the galactic centre, used to orient the band.
const GAL_POLE = new THREE.Vector3(Math.cos(27.13 * DEG) * Math.cos(192.86 * DEG), Math.sin(27.13 * DEG), -Math.cos(27.13 * DEG) * Math.sin(192.86 * DEG)).normalize();
const GAL_CENTRE = new THREE.Vector3(Math.cos(-28.94 * DEG) * Math.cos(266.4 * DEG), Math.sin(-28.94 * DEG), -Math.cos(-28.94 * DEG) * Math.sin(266.4 * DEG)).normalize();

export class Starfield {
  constructor(count = 3500, milkyWay = 3000) {
    this.group = new THREE.Group();
    this.material = new THREE.ShaderMaterial({
      uniforms: { uBrightness: { value: 1 } },
      vertexShader: STARFIELD_VERT,
      fragmentShader: STARFIELD_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.build(count, milkyWay);
  }

  build(count, milkyWay) {
    this.dispose(false);
    const rng = makeRng(7);
    const total = count + milkyWay;
    const pos = new Float32Array(total * 3);
    const size = new Float32Array(total);
    const tint = new Float32Array(total * 3);
    const d = [0, 0, 0];
    let i = 0;
    const put = (x, y, z, s, T, dim) => {
      pos[i * 3] = x * STARFIELD_RADIUS; pos[i * 3 + 1] = y * STARFIELD_RADIUS; pos[i * 3 + 2] = z * STARFIELD_RADIUS;
      size[i] = s;
      const [r, g, b] = blackbodyRGB(T);
      tint[i * 3] = (0.35 + 0.65 * r) * dim; tint[i * 3 + 1] = (0.35 + 0.65 * g) * dim; tint[i * 3 + 2] = (0.35 + 0.65 * b) * dim;
      i++;
    };
    for (let k = 0; k < count; k++) {
      randomDirection(rng, d);
      // Magnitude distribution N(<m) ∝ 10^(0.5 m): most stars faint, a few bright
      const m = Math.log10(rng() * (10 ** 3.25 - 10 ** 0.5) + 10 ** 0.5) / 0.5; // 1 .. 6.5
      const s = Math.max(1, 4.2 - 0.5 * m);
      const T = Math.exp(Math.log(3000) + rng() * (Math.log(30000) - Math.log(3000)));
      put(d[0], d[1], d[2], s, T, m < 2 ? 1.4 : 1);
    }
    // Milky Way band
    const u = new THREE.Vector3().crossVectors(GAL_POLE, GAL_CENTRE).normalize();
    const v = new THREE.Vector3().crossVectors(u, GAL_POLE).normalize(); // points toward the galactic centre
    const tmp = new THREE.Vector3();
    for (let k = 0; k < milkyWay; k++) {
      let l;
      do { l = (rng() * 2 - 1) * Math.PI; } while (rng() > 0.3 + 0.7 * 0.5 * (1 + Math.cos(l)));
      const b = (Math.sqrt(-2 * Math.log(rng() + 1e-9)) * Math.cos(2 * Math.PI * rng())) * 6 * DEG;
      tmp.copy(v).multiplyScalar(Math.cos(l) * Math.cos(b)).addScaledVector(u, Math.sin(l) * Math.cos(b)).addScaledVector(GAL_POLE, Math.sin(b));
      put(tmp.x, tmp.y, tmp.z, 1 + rng() * 1.2, 4500 + rng() * 3000, 0.35);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('size', new THREE.BufferAttribute(size, 1));
    g.setAttribute('tint', new THREE.BufferAttribute(tint, 3));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), STARFIELD_RADIUS * 2);
    this.points = new THREE.Points(g, this.material);
    this.points.renderOrder = -10;
    this.group.add(this.points);
  }

  update(cameraPosition) {
    this.group.position.copy(cameraPosition);
  }

  setBrightness(b) {
    this.material.uniforms.uBrightness.value = b;
  }

  dispose(material = true) {
    if (this.points) { this.group.remove(this.points); this.points.geometry.dispose(); this.points = null; }
    if (material) this.material.dispose();
  }
}
