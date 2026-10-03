// Scene 8 — "Warm places"
// One continuous pull-back: her lit window -> the dark building -> the city at 3 a.m. (another window across town
// pulses in the same rhythm as the typing dots) -> the lit windows become a warm network (scene 1's graph, now
// made of homes) -> Earth's night side, and the crescent moon.
// "The universe guarantees no paradise. Warm places are something we build."
import { W, H, TAU, clamp, lerp, seg, win, E, track, hash, noise, rgba, mixc, PAL, frac, rng } from '../engine/core.js';
import { glow, circle, ring, line, rrect, text, revealText, vgrad, FONTS, crescent, drawMoon } from '../engine/draw.js';
import { drawHer, STYLE_NIGHT, SIDE_STAND } from '../engine/figure.js';
import { post } from '../engine/post.js';

const T = { exit: [0, 1.4], facade: [0.6, 7.0], other: 9.2, city: [5.6, 13.6], net: [8.2, 12.0], line1: [8.6, 13.4], earth: [12.4, 22.0], line2: [14.2, 20.4], end: 22.0 };
export const cues = { ...T };
export const subs = [[8.6, 13.4, '', 'The universe guarantees no paradise.'], [14.2, 20.4, '', 'Warm places are something we build.']];

// altitude 0..1 (log zoom)
const A = t => E.inOutSine(seg(t, 0.3, 21.6));
const pulse = t => 0.5 + 0.5 * Math.sin(t * 5);         // the shared rhythm (typing dots)

function facade(ctx, t, a) {
  const z = 4.2 * Math.pow(0.012, a / 0.42);             // window fills the frame -> tiny
  vgrad(ctx, '#070b24', '#0c1238');
  for (let k = 0; k < 160; k++) circle(ctx, hash(k) * W, hash(k + 9) * H * 0.7, 1 + hash(k + 19) * 1.2, '#dfe6ff', 0.5);
  drawMoon(ctx, 1600, 180, 60, 0.42, 1);
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(z, z);
  // her window is at (0,0); building grid around it
  const cw = 420, chh = 380, cols = 41, rows = 61;
  const bx0 = -20.5 * cw, by0 = -30.5 * chh;
  ctx.fillStyle = '#141a3c'; ctx.fillRect(bx0 - 200, by0 - 200, cols * cw + 400, rows * chh + 4000);
  // moonlight gradient on the facade
  const g = ctx.createLinearGradient(bx0, by0, bx0 + cols * cw, by0); g.addColorStop(0, 'rgba(120,140,255,0.02)'); g.addColorStop(1, 'rgba(160,180,255,0.10)');
  ctx.fillStyle = g; ctx.fillRect(bx0 - 200, by0 - 200, cols * cw + 400, rows * chh + 4000);
  const lod = z * cw;   // window size in px
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const x = bx0 + i * cw, y = by0 + j * chh;
    const sx = W / 2 + (x + cw / 2) * z, sy = H / 2 + (y + chh / 2) * z;
    if (sx < -cw * z || sx > W + cw * z || sy < -chh * z || sy > H + chh * z) continue;
    const her = i === 20 && j === 30;
    const h = hash(i * 131 + j * 7);
    const lit = her ? 1 : (h > 0.955 ? 0.6 : 0);
    const tv = !her && h > 0.94 && h <= 0.955;
    ctx.fillStyle = her ? '#ffcf8a' : (lit ? '#ffd9a0' : tv ? '#5a6aff' : '#0a0e26');
    ctx.globalAlpha = her ? 1 : (lit ? 0.75 : tv ? 0.35 + 0.15 * Math.sin(t * 7 + i) : 1);
    ctx.fillRect(x + 50, y + 50, cw - 100, chh - 110);
    ctx.globalAlpha = 1;
    if (her && lod > 30) {
      // inside her window: silhouette, the cat, the phone's glow, the dots
      ctx.save(); ctx.beginPath(); ctx.rect(x + 50, y + 50, cw - 100, chh - 110); ctx.clip();
      const gg = ctx.createLinearGradient(x, y, x + cw, y); gg.addColorStop(0, '#ffb45c'); gg.addColorStop(1, '#3a3a7a'); ctx.fillStyle = gg; ctx.fillRect(x + 50, y + 50, cw - 100, chh - 110);
      drawHer(ctx, x + 150, y + 250, 170, { ...SIDE_STAND, torso: 0.15, head: 0.45, thF: 2.3, knF: 2.7, thB: 2.25, knB: 2.75, shF: 1.25, elF: 1.5, shB: 1.2, elB: 1.6 }, { style: STYLE_NIGHT });
      glow(ctx, x + 205, y + 200, 50, '#9fc8ff', 0.9);
      ctx.fillStyle = '#c98a4e'; ctx.beginPath(); ctx.ellipse(x + 270, y + 262, 28, 16, 0, 0, TAU); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = '#2a305a'; ctx.lineWidth = 10; ctx.strokeRect(x + 50, y + 50, cw - 100, chh - 110);
    }
    if (her) glow(ctx, x + cw / 2, y + chh / 2, 260 + 900 * a, '#ffb45c', 0.5 + 0.2 * pulse(t));
  }
  ctx.restore();
}

let CITYPTS = null;
function cityPts() {
  if (CITYPTS) return CITYPTS;
  const r = rng(77);
  const P = [];
  for (let k = 0; k < 2200; k++) { const ang = r() * TAU, rad = Math.pow(r(), 1.5) * 1.0; P.push([Math.cos(ang) * rad * 1.5 + (r() - 0.5) * 0.1, Math.sin(ang) * rad + (r() - 0.5) * 0.1, r()]); }
  P[0] = [0, 0, 1];          // her
  P[1] = [0.13, -0.075, 1];  // the other window, across town
  const E2 = [];
  for (let i = 0; i < P.length; i++) { if (P[i][2] < 0.55 && i > 1) continue; let best = [], bd = []; for (let j = 0; j < P.length; j++) { if (j === i || (P[j][2] < 0.55 && j > 1)) continue; const d = Math.hypot(P[i][0] - P[j][0], P[i][1] - P[j][1]); if (d < 0.07) best.push([d, j]); } best.sort((a, b) => a[0] - b[0]); for (const [d, j] of best.slice(0, 2)) if (i < j) E2.push([i, j]); }
  CITYPTS = { P, E: E2 };
  return CITYPTS;
}
function city(ctx, t, a, alpha) {
  if (alpha <= 0.01) return;
  const { P, E: EE } = cityPts();
  const s = lerp(9000, 520, E.inOutSine(seg(a, 0.3, 0.72)));     // px per unit
  ctx.save(); ctx.globalAlpha = alpha;
  vgrad(ctx, '#05071a', '#0a0e2a');
  const cx = W / 2, cy = H / 2;
  // street grid
  const step = 0.06 * s;
  if (step > 5) {
    let k = 0;
    for (let x = cx - Math.floor(cx / step) * step; x < W; x += step, k++) { const major = ((Math.round((x - cx) / step) % 5) + 5) % 5 === 0; line(ctx, x, 0, x, H, major ? 'rgba(255,190,110,0.22)' : 'rgba(110,130,220,0.14)', major ? 2 : 1); }
    for (let y = cy - Math.floor(cy / step) * step; y < H; y += step) { const major = ((Math.round((y - cy) / step) % 5) + 5) % 5 === 0; line(ctx, 0, y, W, y, major ? 'rgba(255,190,110,0.22)' : 'rgba(110,130,220,0.14)', major ? 2 : 1); }
  }
  // network edges between lit homes (warm)
  const na = seg(t, T.net[0], T.net[1]);
  if (na > 0) {
    ctx.strokeStyle = rgba('#ffc87a', 0.28 * na); ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (const [i, j] of EE) { const x0 = cx + P[i][0] * s, y0 = cy + P[i][1] * s, x1 = cx + P[j][0] * s, y1 = cy + P[j][1] * s; if ((x0 < -50 && x1 < -50) || (x0 > W + 50 && x1 > W + 50)) continue; ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); }
    ctx.stroke();
  }
  // lit windows
  for (let k = 2; k < P.length; k++) {
    const [x, y, l] = P[k]; if (l < 0.55) continue;
    const sx = cx + x * s, sy = cy + y * s; if (sx < -10 || sx > W + 10 || sy < -10 || sy > H + 10) continue;
    circle(ctx, sx, sy, Math.min(4, 1.2 + 0.0006 * s), '#ffd9a0', 0.55 + 0.3 * l);
  }
  // her and the other window, pulsing together
  const ot = seg(t, T.other, T.other + 0.6);
  for (const [k, on] of [[0, 1], [1, ot]]) {
    if (on <= 0) continue;
    const sx = cx + P[k][0] * s, sy = cy + P[k][1] * s;
    glow(ctx, sx, sy, (50 + 40 * pulse(t)) * on, '#ffb45c', on);
    circle(ctx, sx, sy, 5, '#fff0d0', on);
  }
  ctx.restore();
}

function earth(ctx, t, a, alpha) {
  if (alpha <= 0.01) return;
  ctx.save(); ctx.globalAlpha = alpha;
  vgrad(ctx, '#05071c', '#0a0e28');
  for (let k = 0; k < 260; k++) circle(ctx, hash(k + 3000) * W, hash(k + 3100) * H, 0.8 + hash(k + 3200) * 1.4, '#e6ecff', 0.35 + 0.5 * Math.abs(Math.sin(t * 0.7 + k)));
  const u = E.inOutSine(seg(a, 0.62, 1));
  const R = lerp(5200, 330, u), ex = 960 + 30 * Math.sin(t * 0.2), ey = 540 + R * lerp(0.85, 0.15, u);
  // the moon
  drawMoon(ctx, 1560, 220, lerp(30, 70, u), 0.42, 1);
  glow(ctx, 1560, 220, 220, '#c8d4ff', 0.25);
  // atmosphere + globe (night side)
  glow(ctx, ex, ey, R * 1.25, '#3a6aff', 0.35);
  circle(ctx, ex, ey, R * 1.02, '#3a5ac8', 0.35);
  circle(ctx, ex, ey, R, '#0c1430');
  const ng = ctx.createRadialGradient(ex, ey - R, R * 0.05, ex, ey - R * 0.6, R * 0.9); ng.addColorStop(0, 'rgba(255,170,90,0.14)'); ng.addColorStop(1, 'rgba(255,170,90,0)'); circle(ctx, ex, ey, R, ng);
  // day-side rim (sun far left)
  ctx.save(); ctx.beginPath(); ctx.arc(ex, ey, R, 0, TAU); ctx.clip();
  const dg = ctx.createLinearGradient(ex - R, 0, ex - R * 0.55, 0); dg.addColorStop(0, 'rgba(110,170,255,0.55)'); dg.addColorStop(1, 'rgba(110,170,255,0)');
  ctx.fillStyle = dg; ctx.fillRect(ex - R, ey - R, R, 2 * R);
  // city lights clusters on the night side
  for (let k = 0; k < 420; k++) {
    const an = hash(k + 4000) * TAU, rr = Math.sqrt(hash(k + 4100)) * R * 0.95;
    const px = ex + Math.cos(an) * rr, py = ey + Math.sin(an) * rr;
    if (px < ex - R * 0.45) continue;
    circle(ctx, px, py, Math.min(2.2, Math.max(0.7, R * 0.0006 * (1 + hash(k + 4200)))), '#ffcf8a', 0.35 + 0.4 * hash(k + 4300));
  }
  ctx.restore();
  // her city as a bright patch on the night side
  const hx0 = ex, hy0 = ey - R * lerp(0.85, 0.15, u);
  for (let k = 0; k < 360; k++) {
    const an = hash(k + 5000) * TAU, rr = Math.pow(hash(k + 5100), 1.6) * R * 0.06;
    circle(ctx, hx0 + Math.cos(an) * rr * 1.5, hy0 + Math.sin(an) * rr, Math.min(2.2, Math.max(0.7, R * 0.0005)), '#ffd9a0', 0.5 + 0.4 * hash(k + 5200));
  }
  // her city: the point under us, still pulsing with the other
  const hx = ex, hy = ey - R * lerp(0.85, 0.15, u) * 1.0;
  glow(ctx, hx, hy, 40 + 20 * pulse(t), '#ffb45c', 0.9);
  glow(ctx, hx + 6 + R * 0.0004, hy - 3, 30 + 15 * pulse(t), '#ffb45c', 0.7);
  ctx.restore();
}

export default {
  duration: T.end, cues, subs,
  render(ctx, t, info) {
    const frame = info?.frame || 0;
    const a = A(t);
    // layers by altitude, crossfading
    const fA = 1 - seg(a, 0.3, 0.42), cA = seg(a, 0.3, 0.42) * (1 - seg(a, 0.7, 0.84)), eA = seg(a, 0.6, 0.72);
    if (fA > 0) facade(ctx, t, a);
    if (cA > 0) city(ctx, t, a, cA);
    if (eA > 0) earth(ctx, t, a, eA);
    // arrival from scene 7: through the glass
    const ex = 1 - seg(t, 0, 0.8);
    if (ex > 0) { ctx.fillStyle = rgba('#0a1238', ex * 0.9); ctx.fillRect(0, 0, W, H); }
    // the two lines
    const l1 = win(t, T.line1[0], T.line1[1], 0.01, 0.9);
    if (l1 > 0) {
      revealText(ctx, '宇宙不保证天堂。', 960, 150, seg(t, T.line1[0], T.line1[0] + 1.2), { size: 70, align: 'center', color: '#fff2dc', alpha: l1, spacing: 10, glow: 'rgba(255,190,110,0.6)' });
      text(ctx, 'The universe guarantees no paradise.', 960, 215, { size: 38, family: FONTS.serif, style: 'italic', align: 'center', color: '#ffe8c8', alpha: l1 * seg(t, T.line1[0] + 0.9, T.line1[0] + 1.7) });
    }
    const l2 = win(t, T.line2[0], T.line2[1], 0.01, 1.0);
    if (l2 > 0) {
      revealText(ctx, '温暖的地方，是我们自己建的。', 960, 880, seg(t, T.line2[0], T.line2[0] + 1.4), { size: 66, align: 'center', color: '#fff2dc', alpha: l2, spacing: 8, glow: 'rgba(255,190,110,0.7)' });
      text(ctx, 'Warm places are something we build.', 960, 945, { size: 38, family: FONTS.serif, style: 'italic', align: 'center', color: '#ffe8c8', alpha: l2 * seg(t, T.line2[0] + 1.0, T.line2[0] + 1.8) });
    }
    post(ctx, { bloom: 0.75, vignette: 0.5, grain: 0.05, frame });
  },
};
