import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
const [raw, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const files = fs.readdirSync(raw).filter(f => f.endsWith('.png')).sort();
const seen = new Map();
const tiles = [];
for (let i = 0; i < files.length; i++) {
  const f = files[i];
  const meta = await sharp(path.join(raw, f)).metadata();
  if (meta.channels === 1) continue; // smask handled with its image
  const next = files[i + 1];
  let img = sharp(path.join(raw, f)).removeAlpha();
  let hasMask = false;
  if (next) {
    const m = await sharp(path.join(raw, next)).metadata();
    if (m.channels === 1 && m.width === meta.width && m.height === meta.height) {
      const mask = await sharp(path.join(raw, next)).extractChannel(0).raw().toBuffer();
      const rgb = await sharp(path.join(raw, f)).removeAlpha().raw().toBuffer();
      const n = m.width * m.height, rgba = Buffer.alloc(n * 4);
      for (let p = 0; p < n; p++) { rgba[p*4]=rgb[p*3]; rgba[p*4+1]=rgb[p*3+1]; rgba[p*4+2]=rgb[p*3+2]; rgba[p*4+3]=mask[p]; }
      img = sharp(rgba, { raw: { width: m.width, height: m.height, channels: 4 } });
      hasMask = true;
    }
  }
  const buf = await img.webp({ quality: 86, alphaQuality: 90 }).toBuffer();
  const key = `${meta.width}x${meta.height}-${buf.length}`;
  if (seen.has(key)) continue;
  seen.set(key, f);
  const name = f.replace('.png', '.webp');
  fs.writeFileSync(path.join(out, name), buf);
  tiles.push({ name, buf });
}
// contact sheet
const T = 220, cols = 8, rows = Math.ceil(tiles.length / cols);
const comps = await Promise.all(tiles.map(async (t, k) => ({
  input: await sharp(t.buf).resize(T, T, { fit: 'contain', background: '#c8c0b8' }).flatten({ background: '#c8c0b8' }).png().toBuffer(),
  left: (k % cols) * T, top: Math.floor(k / cols) * (T + 20),
})));
const labels = tiles.map((t, k) => `<text x="${(k % cols) * T + 4}" y="${Math.floor(k / cols) * (T + 20) + T + 15}" font-size="14" font-family="Arial">${t.name}</text>`).join('');
comps.push({ input: Buffer.from(`<svg width="${cols*T}" height="${rows*(T+20)}">${labels}</svg>`), left: 0, top: 0 });
await sharp({ create: { width: cols * T, height: rows * (T + 20), channels: 3, background: '#fff' } }).composite(comps).jpeg({ quality: 70 }).toFile(path.join(out, '..', 'sheet.jpg'));
console.log(tiles.length, 'unique');
