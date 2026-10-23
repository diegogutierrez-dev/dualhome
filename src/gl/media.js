import * as THREE from 'three';

const NOISE = /* glsl */ `
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1,0)), u.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y);
  }
  float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
`;

const vertex = /* glsl */ `
  uniform float uVel;
  uniform float uHover;
  uniform vec2 uMouse;
  uniform float uTime;
  varying vec2 vUv;
  void main(){
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    // scroll-velocity bend, like a canvas flexing
    wp.y += sin(uv.x * 3.14159) * uVel * 0.9;
    float d = distance(uv, uMouse);
    wp.z += uHover * 40.0 * exp(-d * d * 10.0);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const fragment = /* glsl */ `
  uniform sampler2D uTex;
  uniform float uReveal;
  uniform float uHover;
  uniform vec2 uMouse;
  uniform float uTime;
  uniform float uVel;
  uniform float uSeed;
  varying vec2 vUv;
  ${NOISE}
  void main(){
    vec2 uv = vUv;
    float d = distance(uv, uMouse);
    uv += normalize(uv - uMouse + 1e-4) * sin(d * 28.0 - uTime * 5.0) * 0.006 * uHover * exp(-d * 5.0);

    float shift = clamp(abs(uVel), 0.0, 40.0) * 0.00025;
    vec4 tex = texture2D(uTex, uv);
    tex.r = texture2D(uTex, uv + vec2(0.0, shift)).r;
    tex.b = texture2D(uTex, uv - vec2(0.0, shift)).b;

    // brush-stroke reveal: paints in from bottom with ragged, bristly edges
    float n = fbm(vec2(uv.x * 3.0, uv.y * 7.0) + uSeed);
    float bristle = noise(vec2(uv.x * 60.0, uv.y * 4.0) + uSeed) * 0.12;
    float edge = (1.0 - uv.y) * 0.55 + n * 0.45 + bristle;
    float r = uReveal * 1.25;
    float m = 1.0 - smoothstep(r - 0.1, r, edge);
    float band = smoothstep(r - 0.22, r - 0.02, edge) * m;
    vec3 col = mix(tex.rgb, tex.rgb * vec3(0.72, 0.62, 0.52), band * 0.9);
    gl_FragColor = vec4(col, tex.a * m);
  }
`;

export class MediaPlanes {
  constructor(scene, loader) {
    this.scene = scene;
    this.items = [];
    this.geo = new THREE.PlaneGeometry(1, 1, 24, 24);
    this.loader = loader;
  }

  add(img) {
    const tex = this.loader.load(img.currentSrc || img.src);
    tex.colorSpace = THREE.NoColorSpace;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    const mat = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uTex: { value: tex },
        uReveal: { value: 0 },
        uHover: { value: 0 },
        uMouse: { value: new THREE.Vector2(0.5, 0.5) },
        uTime: { value: 0 },
        uVel: { value: 0 },
        uSeed: { value: Math.random() * 10 },
      },
    });
    const mesh = new THREE.Mesh(this.geo, mat);
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    const item = { img, mesh, mat };
    this.items.push(item);

    return item;
  }

  update(time, vel, vw, vh) {
    for (const it of this.items) {
      const r = it.img.getBoundingClientRect();
      const visible = r.bottom > -200 && r.top < vh + 200 && r.width > 0;
      it.mesh.visible = visible;
      if (!visible) continue;
      it.mesh.scale.set(r.width, r.height, 1);
      it.mesh.position.set(r.left + r.width / 2 - vw / 2, -(r.top + r.height / 2) + vh / 2, 0);
      const u = it.mat.uniforms;
      u.uTime.value = time;
      u.uVel.value += (vel - u.uVel.value) * 0.1;
    }
  }
}
