/**
 * The star itself: a procedural photosphere (granulation, convection cells,
 * limb darkening), a fresnel chromosphere rim and a billboard corona glow.
 * During a supernova the same mesh becomes the expanding photosphere and
 * fades out as the ejecta turn transparent.
 */
import * as THREE from 'three';
import { STAR_VERT, STAR_FRAG, GLOW_VERT, GLOW_FRAG, SHELL_VERT, SHELL_FRAG } from './shaders.js';
import { clamp } from '../core/math.js';

export function makeGlowMaterial(intensity = 1, falloff = 3) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(1, 1, 1) }, uIntensity: { value: intensity }, uFalloff: { value: falloff } },
    vertexShader: GLOW_VERT,
    fragmentShader: GLOW_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

export function makeShellMaterial(strength = 0.5, power = 3) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(1, 1, 1) }, uStrength: { value: strength }, uTime: { value: 0 },
      uFilament: { value: 0 }, uPower: { value: power }, uCamPos: { value: new THREE.Vector3() },
    },
    vertexShader: SHELL_VERT,
    fragmentShader: SHELL_FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
}

export class StarBody {
  constructor(segments = 96) {
    this.group = new THREE.Group();
    this.time = 0;
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(1, 0.8, 0.6) },
        uTime: { value: 0 },
        uGranuleScale: { value: 20 },
        uTurbulence: { value: 0 },
        uInstability: { value: 0 },
        uBrightness: { value: 1 },
        uFlash: { value: 0 },
        uOpacity: { value: 1 },
        uCamPos: { value: new THREE.Vector3() },
      },
      vertexShader: STAR_VERT,
      fragmentShader: STAR_FRAG,
      transparent: true,
    });
    this.geometry = new THREE.SphereGeometry(1, segments, Math.round(segments / 2));
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.renderOrder = 1;
    this.chromo = new THREE.Mesh(this.geometry, makeShellMaterial(0.45, 3.2));
    this.chromo.renderOrder = 2;
    this.corona = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), makeGlowMaterial(0.5, 3.5));
    this.corona.renderOrder = 3;
    this.group.add(this.mesh, this.chromo, this.corona);
    this.radius = 1;
  }

  setSegments(segments) {
    const g = new THREE.SphereGeometry(1, segments, Math.round(segments / 2));
    this.mesh.geometry = g;
    this.chromo.geometry = g;
    this.geometry.dispose();
    this.geometry = g;
  }

  update(snap, dt, camera) {
    let R = snap.R;
    let opacity = 1;
    let flash = 0;
    let brightness = 1;
    let instability = snap.instability ?? 0;
    if (snap.phase === 'supernova') {
      const sn = snap.sn;
      const p = snap.model.params;
      flash = sn.flash;
      if (sn.ejectaVisible) {
        const tRecede = p.LPlateau > 0 ? p.tPlateau : p.tDiff * 3;
        opacity = clamp(1 - (sn.ejectaAge - tRecede) / (2.5 * tRecede), 0, 1);
        brightness = clamp(Math.pow(sn.L / p.Lstar, 0.12), 1, 1.6) * (0.35 + 0.65 * opacity);
        instability = 0.15;
      } else {
        R = snap.collapseState.R;
      }
    }
    const visible = opacity > 0.01 && R > 0;
    this.group.visible = visible;
    if (!visible) return;
    this.radius = R;
    this.time += dt * (1 + 5 * instability);

    const u = this.material.uniforms;
    // Tone mapping desaturates bright colours; pre-saturate so a 3,600 K star still reads orange-red.
    const sat = snap.phase === 'ended' ? 1 : snap.T < 4000 ? 3.0 : snap.T < 5000 ? 2.2 : 1.5;
    const [r, g, b] = snap.color.map((c) => Math.pow(c, sat));
    u.uColor.value.setRGB(r, g, b);
    u.uTime.value = this.time;
    u.uGranuleScale.value = clamp(28 / Math.pow(Math.max(R, 1e-3), 0.55), 2.5, 28);
    const turbulence = clamp(Math.log10(Math.max(R, 1)) / 2.5, 0, 1);
    u.uTurbulence.value = turbulence;
    u.uInstability.value = instability;
    u.uBrightness.value = brightness * (snap.phase === 'ended' ? 1.8 : 1);
    u.uFlash.value = flash;
    u.uOpacity.value = opacity;
    u.uCamPos.value.copy(camera.position);
    this.mesh.scale.setScalar(R);

    const cu = this.chromo.material.uniforms;
    cu.uColor.value.setRGB(r * 1.15, g * 1.1, b * 1.05);
    cu.uStrength.value = (0.4 + 0.5 * flash) * opacity;
    cu.uTime.value = this.time;
    cu.uCamPos.value.copy(camera.position);
    this.chromo.scale.setScalar(R * 1.035);

    // Inside the photosphere (remnant view during the fireball) the glow layers would just wash the frame.
    const inside = camera.position.length() < R * 1.1;
    this.corona.visible = !inside;
    this.chromo.visible = !inside;
    const gu = this.corona.material.uniforms;
    gu.uColor.value.setRGB(r, g, b);
    gu.uIntensity.value = (0.45 + 1.4 * flash) * Math.sqrt(brightness) * opacity;
    this.corona.scale.setScalar(R * (2.4 + 1.4 * turbulence) * (1 + 1.5 * flash));
    this.corona.quaternion.copy(camera.quaternion);
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.chromo.material.dispose();
    this.corona.geometry.dispose();
    this.corona.material.dispose();
  }
}
