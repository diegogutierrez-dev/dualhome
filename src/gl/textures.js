import * as THREE from 'three';

// Procedural textures so the product needs no 3D asset pipeline.

function rand(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function woodTexture(size = 1024) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const r = rand(7);
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, size, size);

  // long grain lines running along x, with slow waves
  for (let i = 0; i < 260; i++) {
    const y0 = r() * size;
    const amp = 4 + r() * 18;
    const freq = 0.002 + r() * 0.006;
    const phase = r() * Math.PI * 2;
    const shade = 150 + r() * 80;
    g.strokeStyle = `rgba(${shade - 30},${shade - 50},${shade - 70},${0.08 + r() * 0.22})`;
    g.lineWidth = 0.6 + r() * 2.4;
    g.beginPath();
    for (let x = -10; x <= size + 10; x += 8) {
      const y = y0 + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 3.1 + phase) * amp * 0.25;
      x < 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.stroke();
  }
  // pores
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = `rgba(90,60,40,${r() * 0.12})`;
    g.fillRect(r() * size, r() * size, 1 + r() * 3, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

export function fabricTexture(size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const r = rand(11);
  g.fillStyle = '#f2f2f2';
  g.fillRect(0, 0, size, size);
  // bouclé loops
  for (let i = 0; i < 5200; i++) {
    const x = r() * size;
    const y = r() * size;
    const rad = 1.5 + r() * 3.5;
    const v = 200 + r() * 55;
    g.strokeStyle = `rgba(${v},${v},${v},0.9)`;
    g.lineWidth = 0.8 + r();
    g.beginPath();
    g.arc(x, y, rad, 0, Math.PI * 2);
    g.stroke();
    if (r() > 0.6) {
      g.fillStyle = `rgba(150,150,150,${0.15 + r() * 0.2})`;
      g.beginPath();
      g.arc(x, y, rad * 0.5, 0, Math.PI * 2);
      g.fill();
    }
  }
  // fine weave
  g.globalAlpha = 0.08;
  for (let y = 0; y < size; y += 3) {
    g.fillStyle = y % 6 ? '#000' : '#fff';
    g.fillRect(0, y, size, 1);
  }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  t.anisotropy = 8;
  return t;
}

export function shadowTexture(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, 'rgba(40,28,18,0.55)');
  grd.addColorStop(0.45, 'rgba(40,28,18,0.28)');
  grd.addColorStop(1, 'rgba(40,28,18,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}
