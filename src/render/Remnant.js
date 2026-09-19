/**
 * Compact remnants rendered at true scale (a neutron star is ~1.7e-5 R☉ in
 * scene units; the camera's Remnant View zooms accordingly).
 *  - neutron star: hot proto-NS cooling to a blue-white pinpoint
 *  - pulsar: + rotating radiation cones and dipole field lines
 *  - magnetar: + dense purple field lines and random X-ray flares
 *  - black hole: horizon, tilted fallback accretion disk, photon ring
 *  - white dwarf: small white sphere (the planetary nebula lives in Ejecta)
 * Rotation of pulsars is slowed to ~1 rev/s for visibility (real: 10–100/s).
 */
import * as THREE from 'three';
import { makeGlowMaterial } from './StarBody.js';
import { BEAM_VERT, BEAM_FRAG, DISK_VERT, DISK_FRAG } from './shaders.js';
import { SOLAR_RADIUS_M, YEAR_S } from '../core/constants.js';
import { spinPeriodAt } from '../physics/remnants.js';
import { clamp, DEG } from '../core/math.js';

const NS_TYPES = new Set(['neutron-star', 'pulsar', 'magnetar']);

function buildFieldLines() {
  const pts = [];
  for (const L of [2.4, 3.6, 5.2]) {
    for (let k = 0; k < 8; k++) {
      const phi = (k * Math.PI) / 4;
      let prev = null;
      for (let i = 0; i <= 48; i++) {
        const theta = 0.1 + (i / 48) * (Math.PI - 0.2);
        const r = L * Math.sin(theta) ** 2; // dipole field line r = L sin²θ
        if (r < 1.02) { prev = null; continue; }
        const p = [r * Math.sin(theta) * Math.cos(phi), r * Math.cos(theta), r * Math.sin(theta) * Math.sin(phi)];
        if (prev) pts.push(...prev, ...p);
        prev = p;
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const m = new THREE.LineBasicMaterial({ color: 0x9a7dff, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false });
  return new THREE.LineSegments(g, m);
}

export class Remnant {
  constructor() {
    this.group = new THREE.Group();
    this.group.visible = false;
    this.type = null;
    this.currentRadius = 0;
    this.flare = 0;

    this.bodyMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 1.5, 1.9) });
    this.body = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), this.bodyMat);
    this.glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), makeGlowMaterial(1.2, 2.8));
    this.glow.renderOrder = 8;

    // Pulsar / magnetar: spin axis = Y, magnetic axis tilted 35°
    this.spin = new THREE.Group();
    this.magnetic = new THREE.Group();
    this.magnetic.rotation.z = 35 * DEG;
    this.spin.add(this.magnetic);
    this.beamMat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(0.6, 0.8, 1) }, uIntensity: { value: 0.8 } },
      vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    });
    const cone = new THREE.ConeGeometry(0.11, 1, 24, 1, true);
    cone.translate(0, -0.5, 0); // apex at the origin, opening toward −Y
    this.beamA = new THREE.Mesh(cone, this.beamMat);
    this.beamB = new THREE.Mesh(cone, this.beamMat);
    this.beamB.rotation.z = Math.PI;
    this.fieldLines = buildFieldLines();
    this.magnetic.add(this.beamA, this.beamB, this.fieldLines);

    // Black hole
    this.bhGroup = new THREE.Group();
    this.horizon = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    this.tilt = new THREE.Group();
    this.tilt.rotation.x = 65 * DEG;
    this.diskMat = new THREE.ShaderMaterial({
      uniforms: { uInner: { value: 3 }, uOuter: { value: 14 }, uTime: { value: 0 }, uIntensity: { value: 1 } },
      vertexShader: DISK_VERT, fragmentShader: DISK_FRAG,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    });
    this.disk = new THREE.Mesh(new THREE.RingGeometry(3, 14, 96, 1), this.diskMat);
    this.photonRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.5, 0.06, 8, 96),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.7, 1.1), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.tilt.add(this.disk, this.photonRing);
    this.bhGroup.add(this.horizon, this.tilt);

    this.group.add(this.body, this.glow, this.spin, this.bhGroup);
  }

  update(snap, dt, camera) {
    let type = null; let radius = 0; let age = 0; let remnant = null;
    if (snap.phase === 'supernova' && snap.sn.remnantVisible && snap.remnant && snap.remnant.type !== 'none') {
      remnant = snap.remnant; type = remnant.type; radius = snap.model.params.remnantRadius / SOLAR_RADIUS_M; age = snap.tExp;
    } else if (snap.phase === 'ended' && snap.remnant) {
      remnant = snap.remnant; type = remnant.type; radius = remnant.radiusM / SOLAR_RADIUS_M; age = snap.postAgeS;
    }
    this.type = type;
    this.currentRadius = radius;
    if (!type || radius <= 0) { this.group.visible = false; return; }
    this.group.visible = true;

    const isNS = NS_TYPES.has(type);
    const isBH = type === 'black-hole';
    this.body.visible = !isBH;
    this.glow.visible = !isBH;
    this.spin.visible = isNS;
    this.bhGroup.visible = isBH;
    this.glow.quaternion.copy(camera.quaternion);
    const gu = this.glow.material.uniforms;

    if (isNS) {
      const hot = clamp(1 - age / 30, 0, 1); // proto-neutron star: bloated and red-hot for ~30 s
      this.bodyMat.color.setRGB(1.4 + 0.6 * hot, 1.5 - 0.5 * hot, 1.9 - 1.3 * hot);
      this.body.scale.setScalar(radius * (1 + 1.5 * hot));
      if (type === 'magnetar' && Math.random() < dt * 0.5) this.flare = 1 + Math.random() * 2;
      this.flare *= Math.exp(-dt / 0.35);
      gu.uIntensity.value = 1 + 0.8 * hot + this.flare;
      gu.uColor.value.setRGB(0.75 + 0.25 * hot, 0.82, 1);
      this.glow.scale.setScalar(radius * (7 + 2 * hot + 3 * this.flare));

      const P = spinPeriodAt(remnant, age) ?? 1;
      const omegaVisual = clamp((2 * Math.PI) / P, 0.5, 2 * Math.PI * 1.2);
      this.spin.rotation.y += omegaVisual * dt;
      const showBeams = type !== 'neutron-star';
      this.beamA.visible = this.beamB.visible = this.fieldLines.visible = showBeams;
      if (showBeams) {
        const spinDown = 1 / Math.sqrt(1 + age / (remnant.spinDownYr * YEAR_S));
        const beamLen = radius * 70;
        this.beamA.scale.setScalar(beamLen);
        this.beamB.scale.setScalar(beamLen);
        const magnetar = type === 'magnetar';
        this.beamMat.uniforms.uIntensity.value = (magnetar ? 0.8 : 1.4) * spinDown + this.flare * 0.3;
        this.beamMat.uniforms.uColor.value.setRGB(magnetar ? 0.85 : 0.6, magnetar ? 0.5 : 0.8, 1);
        this.fieldLines.scale.setScalar(radius);
        this.fieldLines.material.color.setRGB(magnetar ? 0.85 : 0.45, magnetar ? 0.4 : 0.65, 1);
        this.fieldLines.material.opacity = (magnetar ? 0.6 : 0.3) * spinDown + this.flare * 0.2;
      }
    } else if (isBH) {
      this.horizon.scale.setScalar(radius);
      this.tilt.scale.setScalar(radius);
      this.diskMat.uniforms.uTime.value += dt;
      // Fallback accretion fades roughly as t^(-5/3); keep a faint disk for visibility
      this.diskMat.uniforms.uIntensity.value = clamp(Math.pow(YEAR_S / Math.max(age, 1), 0.3), 0.12, 1);
    } else {
      // white dwarf
      this.bodyMat.color.setRGB(1.6, 1.65, 1.9);
      this.body.scale.setScalar(radius);
      gu.uIntensity.value = 1;
      gu.uColor.value.setRGB(0.8, 0.9, 1);
      this.glow.scale.setScalar(radius * 6);
    }
  }
}
