/**
 * Owns the WebGL renderer, scene graph, post-processing and the camera rig.
 * Scene units are solar radii (1 unit = R☉). Quality presets control
 * pixel ratio, bloom resolution, particle counts and mesh detail; an FPS
 * meter lets the app auto-downgrade on slow machines.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { StarBody } from './StarBody.js';
import { Ejecta } from './Ejecta.js';
import { ShockFront } from './ShockFront.js';
import { Remnant } from './Remnant.js';
import { Starfield } from './Starfield.js';
import { CameraRig } from './CameraRig.js';
import { QUALITY_PRESETS, DEFAULT_QUALITY } from './quality.js';
import { clamp } from '../core/math.js';

export class SceneManager {
  constructor(canvas, qualityName = DEFAULT_QUALITY) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false, stencil: false });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x02040a, 1);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(48, 1, 0.01, 1e13);
    this.rig = new CameraRig(this.camera, canvas);

    const q = QUALITY_PRESETS[qualityName] ?? QUALITY_PRESETS[DEFAULT_QUALITY];
    this.quality = q;
    this.qualityName = qualityName;
    this.starfield = new Starfield(q.starfield, q.milkyWay);
    this.star = new StarBody(q.sphereSegments);
    this.ejecta = new Ejecta(q.particles);
    this.shock = new ShockFront();
    this.remnant = new Remnant();
    this.scene.add(this.starfield.group, this.star.group, this.ejecta.group, this.shock.mesh, this.remnant.group);

    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.45, 0.95);
    this.outputPass = new OutputPass();
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(this.outputPass);

    this.fps = 60;
    this.fpsAcc = 0;
    this.fpsFrames = 0;
    this.applyQuality(q);
    this.resize();
  }

  setQuality(name) {
    const q = QUALITY_PRESETS[name];
    if (!q || name === this.qualityName) return;
    this.qualityName = name;
    this.quality = q;
    this.ejecta.build(q.particles);
    this.star.setSegments(q.sphereSegments);
    this.starfield.build(q.starfield, q.milkyWay);
    this.applyQuality(q);
    this.resize();
  }

  applyQuality(q) {
    this.bloomPass.enabled = q.bloom;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, q.pixelRatio);
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(this.pixelRatio);
    this.composer.setSize(w, h);
    this.bloomPass.resolution.set(Math.round(w * this.quality.bloomScale), Math.round(h * this.quality.bloomScale));
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.width = w;
    this.height = h;
  }

  setCameraPreset(name, snap) {
    this.rig.setPreset(name, snap);
  }

  render(snap, dt) {
    if (!snap) return;
    // Object updates (they only read the snapshot; order matters for radii the rig needs)
    this.remnant.update(snap, dt, this.camera);
    const nebulaRadius = this.ejecta.update(snap, this.camera, this.renderer.domElement.height);
    this.rig.setContext({ remnantRadius: this.remnant.currentRadius, nebulaRadius: snap.nebulaAgeS > 0 ? nebulaRadius : 0 });
    this.rig.update(snap, dt);
    this.star.update(snap, dt, this.camera);
    this.shock.update(snap, dt, this.camera);
    this.starfield.update(this.camera.position);

    // Bloom strength follows the flash so breakout really blows out the frame
    const flash = snap.sn ? snap.sn.flash : 0;
    this.bloomPass.strength = 0.5 + 1.4 * flash;
    this.starfield.setBrightness(clamp(1 - flash * 0.8, 0.2, 1));

    if (this.quality.bloom) this.composer.render();
    else this.renderer.render(this.scene, this.camera);

    // FPS meter (1 s window)
    this.fpsAcc += dt;
    this.fpsFrames++;
    if (this.fpsAcc >= 1) {
      this.fps = this.fpsFrames / this.fpsAcc;
      this.fpsAcc = 0;
      this.fpsFrames = 0;
    }
  }

  viewWidthMeters() {
    return this.rig.viewWidthMeters(this.camera.aspect);
  }

  dispose() {
    this.rig.dispose();
    this.star.dispose();
    this.ejecta.dispose();
    this.shock.dispose();
    this.starfield.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }
}
