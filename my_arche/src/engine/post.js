// post.js — cheap, deterministic post-processing on the output canvas (device pixels).
// Bloom via progressive down-sampling (avoids ctx.filter which is slow in headless Chromium).
import { mkCanvas } from './draw.js';
import { hash } from './core.js';

let cache = null;
function setup(w, h) {
  if (cache && cache.w === w && cache.h === h) return cache;
  const d1 = mkCanvas(Math.ceil(w / 4), Math.ceil(h / 4));
  const d2 = mkCanvas(Math.ceil(w / 8), Math.ceil(h / 8));
  const d3 = mkCanvas(Math.ceil(w / 16), Math.ceil(h / 16));
  // vignette
  const vig = mkCanvas(w, h); const vg = vig.getContext('2d');
  const g = vg.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, h * 0.95);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)');
  vg.fillStyle = g; vg.fillRect(0, 0, w, h);
  // grain tiles (deterministic)
  const tiles = [];
  const TS = 256;
  for (let k = 0; k < 6; k++) {
    const c = mkCanvas(TS, TS); const cg = c.getContext('2d');
    const img = cg.createImageData(TS, TS);
    for (let i = 0; i < TS * TS; i++) {
      const v = (hash(i * 7 + k * 100003) * 255) | 0;
      img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
    }
    cg.putImageData(img, 0, 0);
    tiles.push(c);
  }
  cache = { w, h, d1, d2, d3, vig, tiles };
  return cache;
}

// o: {bloom: strength 0..1.5, threshold-ish via 'lift', vignette: 0..1, grain: 0..0.2, frame}
export function post(ctx, o = {}) {
  const c = ctx.canvas, w = c.width, h = c.height;
  const S = setup(w, h);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (o.bloom > 0) {
    const g1 = S.d1.getContext('2d'), g2 = S.d2.getContext('2d'), g3 = S.d3.getContext('2d');
    g1.globalCompositeOperation = 'copy'; g1.imageSmoothingQuality = 'medium';
    g1.drawImage(c, 0, 0, S.d1.width, S.d1.height);
    // crude threshold: darken with multiply of itself (squares the values -> emphasizes brights)
    g1.globalCompositeOperation = 'multiply'; g1.drawImage(S.d1, 0, 0);
    g2.globalCompositeOperation = 'copy'; g2.drawImage(S.d1, 0, 0, S.d2.width, S.d2.height);
    g3.globalCompositeOperation = 'copy'; g3.drawImage(S.d2, 0, 0, S.d3.width, S.d3.height);
    ctx.globalCompositeOperation = 'lighter';
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'medium';
    ctx.globalAlpha = Math.min(1, o.bloom * 0.55); ctx.drawImage(S.d2, 0, 0, w, h);
    ctx.globalAlpha = Math.min(1, o.bloom * 0.65); ctx.drawImage(S.d3, 0, 0, w, h);
    ctx.globalAlpha = 1;
  }
  if (o.vignette > 0) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = o.vignette; ctx.drawImage(S.vig, 0, 0); ctx.globalAlpha = 1;
  }
  if (o.grain > 0) {
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = o.grain;
    const tile = S.tiles[(o.frame || 0) % S.tiles.length];
    const ox = ((o.frame || 0) * 37) % 256, oy = ((o.frame || 0) * 91) % 256;
    const pat = ctx.createPattern(tile, 'repeat');
    ctx.translate(-ox, -oy);
    ctx.fillStyle = pat; ctx.fillRect(0, 0, w + 256, h + 256);
    ctx.globalAlpha = 1;
  }
  if (o.fade !== undefined && o.fade < 1) {   // fade to black (o.fade = visible fraction)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(0,0,0,${1 - Math.max(0, o.fade)})`; ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
}
