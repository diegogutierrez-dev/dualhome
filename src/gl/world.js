import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Puf } from './puf.js';
import { MediaPlanes } from './media.js';

const damp = (a, b, k) => a + (b - a) * k;

export class World {
  constructor({ canvas, isMobile, reduced, manager }) {
    this.isMobile = isMobile;
    this.reduced = reduced;
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.autoClear = false;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.loader = new THREE.TextureLoader(manager);

    // --- 3D product scene
    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.45;
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    this.camera.position.set(0, 0, 6);

    this.scene.add(new THREE.HemisphereLight('#fff6ea', '#7d6e60', 1.1));
    this.key = new THREE.DirectionalLight('#fff0dc', 2.6);
    this.key.castShadow = true;
    const sm = isMobile ? 1024 : 2048;
    this.key.shadow.mapSize.set(sm, sm);
    this.key.shadow.bias = -0.0004;
    this.key.shadow.normalBias = 0.02;
    this.key.shadow.radius = 6;
    this.scene.add(this.key, this.key.target);
    const rim = new THREE.DirectionalLight('#dfe8ff', 0.8);
    rim.position.set(-3, 2, -3);
    this.scene.add(rim);

    const dogTex = this.loader.load('/assets/dog-acdc.webp', (t) => this.puf && this.puf.dog && this.fitDog(t));
    dogTex.colorSpace = THREE.SRGBColorSpace;
    this.puf = new Puf(dogTex);
    this.scene.add(this.puf.root);

    // --- 2D overlay scene in pixel space (painted images)
    this.overlay = new THREE.Scene();
    this.ocam = new THREE.PerspectiveCamera(45, 1, 1, 4000);
    this.ocam.position.z = 800;
    this.media = new MediaPlanes(this.overlay, this.loader);

    // --- product state
    this.anchors = [];
    this.story = { rotY: Math.PI - 0.5, tilt: 0.3, explode: 0, glow: 0, dog: 0 };
    this.user = { rotY: -0.55, tilt: 0.28, explode: 0, glow: 0, dog: 0 };
    this.cur = { x: 0, y: 0, s: 0, rotY: Math.PI - 0.5, tilt: 0.3, explode: 0, glow: 0, dog: 0 };
    this.intro = 0; // 0..1 entrance
    this.drag = 0;
    this.dragVel = 0;
    this.dragging = false;
    this.scroll = 0;
    this.vel = 0;
    this.time = 0;

    this.resize();
  }

  fitDog(t) {
    const a = t.image.width / t.image.height;
    this.puf.dog.geometry.dispose();
    this.puf.dog.geometry = new THREE.PlaneGeometry(0.36 * a, 0.36);
  }

  addAnchor(el, name) { this.anchors.push({ el, name }); }

  bindDrag(el) {
    let lastX = 0;
    el.style.touchAction = 'pan-y';
    el.addEventListener('pointerdown', (e) => {
      this.dragging = true;
      lastX = e.clientX;
      el.setPointerCapture?.(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      this.dragVel = dx * 0.012;
      this.drag += this.dragVel;
    });
    const up = () => (this.dragging = false);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.vw = w;
    this.vh = h;
    const dpr = Math.min(window.devicePixelRatio || 1, this.isMobile ? 1.5 : 1.75);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.worldPerPx = (2 * this.camera.position.z * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))) / h;
    this.ocam.aspect = w / h;
    this.ocam.fov = THREE.MathUtils.radToDeg(2 * Math.atan(h / 2 / this.ocam.position.z));
    this.ocam.updateProjectionMatrix();
  }

  pickAnchor() {
    let best = null;
    let bestScore = 0;
    for (const a of this.anchors) {
      const r = a.el.getBoundingClientRect();
      if (r.height === 0) continue;
      const vis = Math.max(0, Math.min(r.bottom, this.vh) - Math.max(r.top, 0)) / Math.min(r.height, this.vh);
      if (vis > bestScore) { bestScore = vis; best = { ...a, r }; }
    }
    return bestScore > 0.28 ? best : null;
  }

  targetFor(a) {
    if (a.name === 'hero') {
      return { rotY: Math.PI - 0.55 + Math.sin(this.time * 0.35) * 0.25, tilt: 0.3, explode: 0, glow: 0, dog: 0, fit: this.isMobile ? 0.6 : 0.6 };
    }
    if (a.name === 'product') return { ...this.story, fit: this.isMobile ? 0.66 : 0.66 };
    return { ...this.user, fit: this.isMobile ? 0.58 : 0.62 };
  }

  update(dt) {
    this.time += dt;
    const k = 1 - Math.pow(0.0008, dt); // frame-rate independent damping
    const a = this.pickAnchor();
    const c = this.cur;

    if (!this.dragging) {
      this.dragVel *= 0.92;
      this.drag += this.dragVel;
      // in the guided story the piece settles back; elsewhere it keeps the user's angle
      if (a && a.name !== 'config') this.drag = damp(this.drag, 0, k * 0.35);
    }

    if (a) {
      const t = this.targetFor(a);
      const r = a.r;
      const px = Math.min(r.width * t.fit, r.height * t.fit * 1.05);
      const sTarget = px * this.worldPerPx * this.intro / 1.25;
      const cx = (r.left + r.width / 2 - this.vw / 2) * this.worldPerPx;
      const cy = -(r.top + r.height / 2 - this.vh / 2) * this.worldPerPx;
      c.x = damp(c.x, cx, Math.min(1, k * 1.6));
      c.y = damp(c.y, cy, Math.min(1, k * 1.6));
      c.s = damp(c.s, sTarget, k);
      for (const key of ['rotY', 'tilt', 'explode', 'glow', 'dog']) c[key] = damp(c[key], t[key], k);
    } else {
      c.s = damp(c.s, 0, k * 1.4);
    }

    const root = this.puf.root;
    root.visible = c.s > 0.002;
    root.position.set(c.x, c.y, 0);
    root.scale.setScalar(Math.max(c.s, 0.0001));
    this.puf.spin.rotation.set(c.tilt, c.rotY + this.drag, 0);
    this.puf.update(c, this.time);

    // keep the key light and its shadow framed on the piece
    this.key.position.set(c.x + 2.2 * c.s, c.y + 3.2 * c.s, 2.6 * c.s);
    this.key.target.position.set(c.x, c.y, 0);
    const sc = this.key.shadow.camera;
    const ext = 1.6 * Math.max(c.s, 0.1);
    if (Math.abs(sc.right - ext) > 0.01) {
      sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext;
      sc.near = 0.1; sc.far = 10 * Math.max(c.s, 0.3);
      sc.updateProjectionMatrix();
    }

    this.media.update(this.time, this.vel, this.vw, this.vh);

    const r = this.renderer;
    r.clear();
    r.render(this.scene, this.camera);
    r.clearDepth();
    r.render(this.overlay, this.ocam);
  }
}
