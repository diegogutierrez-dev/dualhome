import * as THREE from 'three';
import { woodTexture, fabricTexture, shadowTexture } from './textures.js';

const W = 1; // base width / depth
const H = 0.62; // base height
const ARCH_W = 0.5;
const ARCH_H = 0.44;
const LIP = 0.035;

function baseGeometry() {
  const s = new THREE.Shape();
  s.moveTo(-W / 2, 0);
  s.lineTo(W / 2, 0);
  s.lineTo(W / 2, H);
  s.lineTo(-W / 2, H);
  s.closePath();

  const r = ARCH_W / 2;
  const hole = new THREE.Path();
  hole.moveTo(-r, LIP);
  hole.lineTo(r, LIP);
  hole.lineTo(r, ARCH_H - r);
  hole.absarc(0, ARCH_H - r, r, 0, Math.PI, false);
  hole.lineTo(-r, LIP);
  s.holes.push(hole);

  const g = new THREE.ExtrudeGeometry(s, {
    depth: W - 0.04,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.018,
    bevelSegments: 4,
    curveSegments: 48,
  });
  g.translate(0, 0, -(W - 0.04) / 2);
  return g;
}

// Rounded-cube cushion from a p-norm sphere, with a soft crowned top.
function cushionGeometry() {
  const g = new THREE.SphereGeometry(1, 128, 96);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  const P = 7;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = Math.pow(Math.pow(Math.abs(v.x), P) + Math.pow(Math.abs(v.y), P * 0.55) + Math.pow(Math.abs(v.z), P), 1 / P);
    v.divideScalar(n);
    let x = v.x * 0.53;
    let z = v.z * 0.53;
    let y = v.y * 0.13;
    const crown = Math.max(0, 1 - (x * x) / 0.3) * Math.max(0, 1 - (z * z) / 0.3);
    if (y > 0) y += crown * 0.05;
    else y -= crown * 0.012;
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}

export class Puf {
  constructor(dogTexture) {
    this.root = new THREE.Group(); // positioned/scaled by the world
    this.spin = new THREE.Group(); // rotation
    this.root.add(this.spin);
    this.model = new THREE.Group();
    this.model.position.y = -0.42;
    this.spin.add(this.model);

    this.woodMap = woodTexture();
    this.fabricMap = fabricTexture();

    this.wood = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#a87a4c'),
      map: this.woodMap,
      roughness: 0.7,
      metalness: 0,
      bumpMap: this.woodMap,
      bumpScale: 0.6,
    });
    this.fabric = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#cbbfa8'),
      map: this.fabricMap,
      bumpMap: this.fabricMap,
      bumpScale: 2.2,
      roughness: 0.92,
      sheen: 1,
      sheenRoughness: 0.6,
      sheenColor: new THREE.Color('#fff4e6'),
    });
    this.inner = new THREE.MeshStandardMaterial({ color: '#3a2618', roughness: 0.9 });

    // base
    const base = new THREE.Mesh(baseGeometry(), this.wood);
    base.castShadow = base.receiveShadow = true;
    this.model.add(base);

    // closed back panel (so the arch reads as a cave, not a tunnel)
    this.back = new THREE.Mesh(new THREE.BoxGeometry(W + 0.036, H + 0.036, 0.03), this.wood);
    this.back.position.set(0, H / 2, -(W - 0.04) / 2 - 0.035);
    this.back.castShadow = this.back.receiveShadow = true;
    this.model.add(this.back);
    // dark interior floor, reads as depth
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(ARCH_W, W - 0.08), this.inner);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = LIP + 0.002;
    floor.receiveShadow = true;
    this.model.add(floor);

    // pet bed inside
    this.bed = new THREE.Group();
    const bedBase = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.21, 0.05, 48), this.fabric);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.045, 20, 64), this.fabric);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.04;
    bedBase.position.y = 0.025;
    [bedBase, rim].forEach((m) => { m.castShadow = m.receiveShadow = true; this.bed.add(m); });
    this.bed.scale.set(1, 1, 1.1);
    this.bed.position.set(0, LIP, 0.02);
    this.model.add(this.bed);

    // dog billboard inside the cave
    const aspect = dogTexture.image ? dogTexture.image.width / dogTexture.image.height : 0.75;
    const dh = 0.36;
    this.dogMat = new THREE.MeshBasicMaterial({
      map: dogTexture,
      alphaTest: 0.5,
      toneMapped: false,
      color: new THREE.Color('#6b5a4c'),
    });
    this.dog = new THREE.Mesh(new THREE.PlaneGeometry(dh * aspect, dh), this.dogMat);
    this.dog.position.set(0, LIP + 0.03 + dh / 2, -0.2);
    this.dog.scale.setScalar(0.001);
    this.dog.renderOrder = 2;
    this.bed.add(this.dog);
    this.dog.position.y -= LIP;

    // cushion
    this.cushion = new THREE.Mesh(cushionGeometry(), this.fabric);
    this.cushion.position.y = H + 0.12;
    this.cushion.castShadow = this.cushion.receiveShadow = true;
    this.model.add(this.cushion);

    // warm light inside the refuge
    this.glowLight = new THREE.PointLight('#ffb070', 0, 1.4, 1.6);
    this.glowLight.position.set(0, 0.28, 0.25);
    this.model.add(this.glowLight);

    // soft contact shadow
    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 2.2),
      new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, toneMapped: false })
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.002;
    this.shadow.renderOrder = -1;
    // lives in the model so it tilts with the piece and stays under the base
    this.model.add(this.shadow);

    this.state = { explode: 0, glow: 0, dog: 0 };
  }

  setFabric(hex) { return this.fabric.color.set(hex); }
  setWood(hex) { return this.wood.color.set(hex); }

  update(s, time) {
    const e = s.explode;
    this.cushion.position.y = H + 0.12 + e * 0.36 + Math.sin(time * 1.6) * 0.006 * e;
    this.cushion.rotation.x = -e * 0.18;
    this.cushion.rotation.z = e * 0.06;
    this.back.position.z = -(W - 0.04) / 2 - 0.035 - e * 0.35;
    this.bed.position.z = 0.02 + e * 0.72;
    this.bed.position.y = LIP + e * 0.02;

    this.glowLight.intensity = s.glow * 2.6;
    const lit = 0.42 + s.glow * 0.58;
    this.dogMat.color.setRGB(lit, lit * 0.94, lit * 0.86);

    const d = THREE.MathUtils.clamp(s.dog, 0, 1);
    this.dog.scale.setScalar(Math.max(0.001, d * 1.5));
    this.dog.position.z = -0.2 + d * 0.46;
    this.dog.visible = d > 0.01;
    this.shadow.material.opacity = 1 - e * 0.25;
  }
}
