// Scene 6 — "Two maps of the moon"
// Night, her window seat. Around the real moon, two maps draw themselves:
//   cyan — what it is (orbit, distance, 1.3 s old light, why it's a crescent)
//   gold — what it means (Leo the lion, a card turning over: 32 · The Moon)
// They pass through each other without merging, then settle on two pages of her notebook:
// "keep both. know which is which."
import { W, H, TAU, clamp, lerp, seg, win, E, track, hash, noise, rgba, mixc, PAL, frac } from '../engine/core.js';
import { glow, circle, ring, line, rrect, text, revealText, tag, vgrad, FONTS, crescent, drawMoon, typed } from '../engine/draw.js';
import { drawHer, STYLE_NIGHT, SIDE_STAND, poseTrack, hairLag, sideHand } from '../engine/figure.js';
import { drawCat, CAT_NIGHT } from '../engine/cat.js';
import { post } from '../engine/post.js';

const T = {
  pull: [0, 3.0], phys: [3.0, 8.4], lightPulse: [5.6, 6.9], sym: [8.0, 13.4], leo: [8.0, 10.4], lion: [10.0, 11.2], card: [11.0, 12.2],
  merge: [13.4, 15.4], fly: [15.4, 16.8], book: [16.8, 20.6], note: [17.8, 19.4], close: [20.0, 20.6], phone: [20.8, 22.0], end: 22.0,
};
export const cues = { ...T };
export const subs = [
  [3.4, 8.4, '它是什么：地月距离 384,400 公里 · 月光是 1.3 秒前的 · 太阳从侧面照亮半个月球 → 月牙', ''],
  [8.4, 13.4, '它意味着什么：狮子座 · 雷诺曼卡 32 · 月亮 —— 感受 · 直觉 · 被看见', ''],
  [17.8, 20.6, '证据 / 意义 —— 两个都留着，并且知道哪个是哪个。', ''],
];

export const MOON = { x: 1350, y: 330, r: 92 };
// final framing (camera pull-back starts zoomed on the moon, matching scene 5's last frame)
function camZoom(t) { const u = E.inOutCubic(seg(t, T.pull[0], T.pull[1])); return { k: lerp(300 / MOON.r, 1, u), cx: lerp(MOON.x, 960, u), cy: lerp(MOON.y, 540, u) }; }

export function room(ctx, t) {
  vgrad(ctx, '#0b1230', '#060914');
  // window
  const wx = 860, wy = 90, ww = 980, wh = 640;
  const g = ctx.createLinearGradient(0, wy, 0, wy + wh); g.addColorStop(0, '#0a1440'); g.addColorStop(1, '#1c2a60');
  ctx.fillStyle = g; ctx.fillRect(wx, wy, ww, wh);
  ctx.save(); ctx.beginPath(); ctx.rect(wx, wy, ww, wh); ctx.clip();
  for (let k = 0; k < 160; k++) circle(ctx, wx + hash(k) * ww, wy + hash(k + 40) * wh * 0.8, 0.8 + hash(k + 80) * 1.4, '#e6ecff', 0.35 + 0.5 * Math.abs(Math.sin(t * (0.4 + hash(k)) + k)));
  glow(ctx, MOON.x, MOON.y, 360, '#b8c8ff', 0.35);
  drawMoon(ctx, MOON.x, MOON.y, MOON.r, 0.42, 1);
  // city below
  for (let i = 0; i < 24; i++) { const bh = 50 + hash(i + 900) * 160; ctx.fillStyle = '#0a1028'; ctx.fillRect(wx + i * 42, wy + wh - bh, 40, bh); for (let k = 0; k < 6; k++) if (hash(i * 7 + k) > 0.55) { ctx.fillStyle = 'rgba(255,210,140,0.8)'; ctx.fillRect(wx + i * 42 + 6 + (k % 3) * 11, wy + wh - bh + 14 + Math.floor(k / 3) * 22, 5, 7); } }
  ctx.restore();
  ctx.strokeStyle = '#1a2246'; ctx.lineWidth = 18; ctx.strokeRect(wx, wy, ww, wh);
  line(ctx, wx + ww * 0.24, wy, wx + ww * 0.24, wy + wh, '#1a2246', 10);
  // moonlight patch on the seat + floor
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(110,140,255,0.08)';
  ctx.beginPath(); ctx.moveTo(wx, wy + wh); ctx.lineTo(wx + ww, wy + wh); ctx.lineTo(wx + ww - 200, 1080); ctx.lineTo(wx - 300, 1080); ctx.closePath(); ctx.fill(); ctx.restore();
  // window seat + cushions
  ctx.fillStyle = '#1a2044'; rrect(ctx, 300, 760, 1600, 60, 14); ctx.fill();
  ctx.fillStyle = '#121734'; ctx.fillRect(320, 820, 1560, 260);
  ctx.fillStyle = '#2a3266'; ctx.beginPath(); ctx.ellipse(470, 700, 110, 70, -0.25, 0, TAU); ctx.fill();
  // small warm lamp on the left (a warm place)
  glow(ctx, 230, 560, 340, '#ffb35c', 0.35);
  ctx.fillStyle = '#3a2a2a'; ctx.fillRect(222, 600, 16, 160); ctx.fillStyle = '#e8b880'; ctx.beginPath(); ctx.moveTo(180, 600); ctx.lineTo(280, 600); ctx.lineTo(260, 530); ctx.lineTo(200, 530); ctx.closePath(); ctx.fill();
}

const SIT = { ...SIDE_STAND, torso: -0.12, head: -0.1, thF: 2.05, knF: 2.3, thB: 2.0, knB: 2.35, shF: 1.05, elF: 1.25, shB: 0.95, elB: 1.35 };
const POSE = poseTrack([
  [0, SIT],
  [3.0, { ...SIT, head: -0.25 }],      // looking up at the moon
  [13.4, { ...SIT, head: -0.22 }],
  [16.6, { ...SIT, head: 0.35, torso: 0.0, shF: 0.7, elF: 0.9, shB: 0.6, elB: 0.95 }],   // looking down at the notebook
  [20.6, { ...SIT, head: 0.35, torso: 0.0, shF: 0.7, elF: 0.9, shB: 0.6, elB: 0.95 }],
  [21.4, { ...SIT, head: 0.2, torso: 0.05, shF: 1.25, elF: 0.9 }],                         // reach for the phone
  [22.0, { ...SIT, head: 0.3, torso: 0.02, shF: 1.0, elF: 1.4 }],
]);

// --------------------------------------------------------------------------- overlays
function physMap(ctx, t, a, ox = 0, oy = 0, sc = 1) {
  if (a <= 0.01) return;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(MOON.x + ox, MOON.y + oy); ctx.scale(sc, sc); ctx.translate(-MOON.x, -MOON.y);
  const C = '#6fe8ff';
  const p = seg(t, T.phys[0], T.phys[0] + 1.6);
  // heading
  text(ctx, 'what it is', MOON.x - 470, MOON.y - 190, { size: 30, family: FONTS.mono, color: C, spacing: 2 });
  // earth + orbit
  const ex = MOON.x - 330, ey = MOON.y + 270;
  circle(ctx, ex, ey, 26, '#2a6aff'); circle(ctx, ex - 6, ey - 6, 10, '#6ad48a', 0.8);
  text(ctx, 'Earth', ex, ey + 56, { size: 22, family: FONTS.mono, color: C, align: 'center' });
  ctx.strokeStyle = rgba(C, 0.75); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(ex, ey, 420, 260, -0.55, -Math.PI * 0.95, -Math.PI * 0.95 + Math.PI * 1.3 * p); ctx.stroke();
  // distance line + counter
  const d = seg(t, T.phys[0] + 0.8, T.phys[0] + 2.4);
  ctx.setLineDash([8, 8]); line(ctx, ex, ey, lerp(ex, MOON.x, d), lerp(ey, MOON.y, d), rgba(C, 0.9), 2); ctx.setLineDash([]);
  const km = Math.round(384400 * E.outCubic(d));
  text(ctx, `${km.toLocaleString('en-US')} km`, (ex + MOON.x) / 2 - 230, (ey + MOON.y) / 2 - 10, { size: 28, family: FONTS.mono, color: '#ffffff', alpha: seg(t, T.phys[0] + 0.8, T.phys[0] + 1.1) });
  // light pulse moon -> earth taking (really) 1.3 seconds
  const lp = seg(t, T.lightPulse[0], T.lightPulse[1]);
  if (lp > 0 && lp < 1) { const x = lerp(MOON.x, ex, lp), y = lerp(MOON.y, ey, lp); glow(ctx, x, y, 40, '#ffffff', 1); circle(ctx, x, y, 5, '#fff'); }
  const la = seg(t, T.lightPulse[0], T.lightPulse[0] + 0.3);
  text(ctx, 'moonlight here is 1.3 s old', MOON.x - 470, MOON.y + 370, { size: 26, family: FONTS.mono, color: C, alpha: la });
  // why it's a crescent: sun from the lower left lights half the moon; we see it from the side
  const sa = seg(t, T.phys[0] + 3.4, T.phys[0] + 4.4);
  if (sa > 0) {
    const dx = MOON.x - 440, dy = MOON.y - 90;
    glow(ctx, dx, dy, 30, '#ffe08a', sa); circle(ctx, dx, dy, 9, '#fff2b0', sa);
    line(ctx, dx + 16, dy, dx + 70, dy, rgba('#ffe08a', sa), 3);
    circle(ctx, dx + 100, dy, 20, rgba('#33405a'), sa);
    ctx.save(); ctx.globalAlpha = sa; ctx.beginPath(); ctx.arc(dx + 100, dy, 20, Math.PI / 2, -Math.PI / 2); ctx.fillStyle = '#f2ecdc'; ctx.fill(); ctx.restore();
    line(ctx, dx + 100, dy + 26, dx + 100, dy + 60, rgba(C, sa), 2);
    text(ctx, 'you', dx + 100, dy + 82, { size: 20, family: FONTS.mono, color: C, align: 'center', alpha: sa });
    ring(ctx, MOON.x, MOON.y, MOON.r + 14, rgba(C, 0.6), 2, sa);
    text(ctx, 'half lit, seen from the side → crescent', MOON.x - 470, MOON.y - 150, { size: 22, family: FONTS.mono, color: C, alpha: seg(t, T.phys[0] + 4.0, T.phys[0] + 4.6) });
  }
  ctx.restore();
}

const LEO = [[1500, 150], [1560, 120], [1620, 150], [1610, 210], [1560, 240], [1700, 290], [1780, 260], [1800, 330], [1690, 360]];
const LEO_EDGES = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 5]];
function symMap(ctx, t, a, ox = 0, oy = 0, sc = 1) {
  if (a <= 0.01) return;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(MOON.x + ox, MOON.y + oy); ctx.scale(sc, sc); ctx.translate(-MOON.x, -MOON.y);
  const G = '#ffd27a';
  text(ctx, 'what it means', MOON.x + 150, MOON.y - 190, { size: 34, family: FONTS.serif, style: 'italic', color: G });
  // Leo
  const lp = seg(t, T.leo[0], T.leo[1]);
  LEO.forEach(([x, y], k) => { glow(ctx, x, y, 22, G, 0.8); circle(ctx, x, y, 4, '#fff8e0'); });
  LEO_EDGES.forEach(([i, j], k) => { const u = clamp(lp * LEO_EDGES.length - k); if (u <= 0) return; line(ctx, LEO[i][0], LEO[i][1], lerp(LEO[i][0], LEO[j][0], u), lerp(LEO[i][1], LEO[j][1], u), rgba(G, 0.85), 2.5); });
  text(ctx, 'Leo · the lion', 1700, 410, { size: 22, family: FONTS.serif, style: 'italic', color: G, alpha: seg(t, T.leo[1] - 0.4, T.leo[1]) });
  // lion figure glows (a wink at the Starmane)
  const lg = Math.sin(seg(t, T.lion[0], T.lion[1]) * Math.PI);
  if (lg > 0.01) { ctx.save(); ctx.globalAlpha = a * lg * 0.6; ctx.strokeStyle = '#ffb0d8'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(1590, 180, 80, 70, 0, 0, TAU); ctx.moveTo(1660, 230); ctx.quadraticCurveTo(1760, 230, 1800, 330); ctx.stroke(); for (let k = 0; k < 12; k++) { const an = k / 12 * TAU; line(ctx, 1590 + Math.cos(an) * 80, 180 + Math.sin(an) * 70, 1590 + Math.cos(an) * 115, 180 + Math.sin(an) * 100, '#ffb0d8', 3); } ctx.restore(); }
  // the card turns over
  const cf = seg(t, T.card[0], T.card[1]);
  if (cf > 0) {
    const cx = 1660, cy = 560, cw = 170, ch = 270;
    const flip = Math.cos(cf * Math.PI);           // 1 back -> -1 front
    const sx = Math.abs(flip);
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.08); ctx.scale(Math.max(0.02, sx), 1);
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 20;
    rrect(ctx, -cw / 2, -ch / 2, cw, ch, 12); ctx.fillStyle = flip > 0 ? '#3a2a6a' : '#f6ecd8'; ctx.fill(); ctx.shadowColor = 'transparent';
    if (flip > 0) { ctx.strokeStyle = G; ctx.lineWidth = 3; rrect(ctx, -cw / 2 + 10, -ch / 2 + 10, cw - 20, ch - 20, 8); ctx.stroke(); for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.arc(0, 0, 14 + k * 12, 0, TAU); ctx.stroke(); } }
    else {
      ctx.strokeStyle = '#b8342a'; ctx.lineWidth = 3; rrect(ctx, -cw / 2 + 10, -ch / 2 + 10, cw - 20, ch - 20, 8); ctx.stroke();
      text(ctx, '32', 0, -ch / 2 + 46, { size: 28, family: FONTS.serif, color: '#8a2a20', align: 'center', weight: 700 });
      crescent(ctx, 0, -6, 44, { color: '#d9a43a', k: 0.45, inner: 0.85 });
      for (let k = 0; k < 5; k++) circle(ctx, -50 + k * 25, 50 + (k % 2) * 10, 3, '#8a2a20');
      text(ctx, 'THE MOON', 0, ch / 2 - 46, { size: 22, family: FONTS.serif, color: '#8a2a20', align: 'center', weight: 700, spacing: 3 });
    }
    ctx.restore();
    const ka = seg(t, T.card[1], T.card[1] + 0.6);
    text(ctx, 'feelings · intuition · recognition', 1640, 740, { size: 24, family: FONTS.serif, style: 'italic', color: G, align: 'center', alpha: ka });
  }
  ctx.restore();
}

function notebook(ctx, t) {
  // top-down insert of the open notebook on her lap
  vgrad(ctx, '#141a3a', '#0a0e22');
  // her knees/sweater edges + the cat's tail in the corner
  ctx.fillStyle = '#22284a'; ctx.beginPath(); ctx.ellipse(960, 1150, 900, 260, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#c98a4e'; ctx.lineWidth = 50; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(1960, 820); ctx.quadraticCurveTo(1780, 760 + Math.sin(t * 2) * 30, 1700, 900); ctx.stroke();
  const close = E.inOutCubic(seg(t, T.close[0], T.close[1]));
  const bx = 960, by = 520, pw = 560, ph = 720;
  ctx.save(); ctx.translate(bx, by); ctx.rotate(-0.04);
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 40;
  // left page
  rrect(ctx, -pw, -ph / 2, pw, ph, 10); ctx.fillStyle = '#f3ecdc'; ctx.fill();
  ctx.shadowColor = 'transparent';
  // right page (folds over when closing)
  const rw = pw * Math.cos(close * Math.PI);
  ctx.save();
  rrect(ctx, Math.min(0, rw), -ph / 2, Math.abs(rw), ph, 10); ctx.fillStyle = rw > 0 ? '#f6efe0' : '#3a3060'; ctx.fill();
  ctx.restore();
  // ruled lines
  ctx.strokeStyle = 'rgba(80,90,140,0.15)'; ctx.lineWidth = 2;
  for (let k = 0; k < 14; k++) line(ctx, -pw + 30, -ph / 2 + 60 + k * 48, -30, -ph / 2 + 60 + k * 48, 'rgba(80,90,140,0.15)', 2);
  // left page: the cyan diagram (mini)
  const pa = seg(t, T.fly[1] - 0.3, T.fly[1] + 0.4);
  ctx.globalAlpha = pa;
  text(ctx, 'evidence', -pw + 50, -ph / 2 + 70, { size: 34, family: FONTS.mono, color: '#1a6a8a' });
  circle(ctx, -pw + 130, 80, 22, '#2a6aff'); ctx.setLineDash([6, 6]); line(ctx, -pw + 130, 80, -150, -120, '#1a6a8a', 2); ctx.setLineDash([]);
  crescent(ctx, -150, -120, 50, { color: '#8a8a8a', k: 0.42, inner: 0.9 });
  text(ctx, '384,400 km', -pw + 160, -40, { size: 24, family: FONTS.mono, color: '#1a6a8a' });
  text(ctx, 'light: 1.3 s', -pw + 160, 0, { size: 24, family: FONTS.mono, color: '#1a6a8a' });
  ctx.strokeStyle = '#1a6a8a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(-pw + 130, 80, 260, 160, -0.55, -2.8, -0.6); ctx.stroke();
  // right page: the card + Leo (only while open)
  if (close < 0.5) {
    ctx.save(); ctx.globalAlpha = pa * (1 - close * 2);
    text(ctx, 'meaning', 50, -ph / 2 + 74, { size: 38, family: FONTS.serif, style: 'italic', color: '#8a2a20' });
    rrect(ctx, 150, -170, 170, 270, 12); ctx.fillStyle = '#f6ecd8'; ctx.fill(); ctx.strokeStyle = '#b8342a'; ctx.lineWidth = 3; ctx.stroke();
    text(ctx, '32', 235, -125, { size: 26, family: FONTS.serif, color: '#8a2a20', align: 'center', weight: 700 });
    crescent(ctx, 235, -40, 40, { color: '#d9a43a', k: 0.45, inner: 0.85 });
    text(ctx, 'THE MOON', 235, 70, { size: 20, family: FONTS.serif, color: '#8a2a20', align: 'center', weight: 700, spacing: 2 });
    // washi tape
    ctx.fillStyle = 'rgba(255,150,170,0.55)'; ctx.save(); ctx.translate(235, -175); ctx.rotate(0.12); ctx.fillRect(-60, -14, 120, 28); ctx.restore();
    LEO.forEach(([x, y], k) => circle(ctx, 60 + (x - 1500) * 0.6, 170 + (y - 120) * 0.6, 4, '#c08a2a'));
    LEO_EDGES.forEach(([i, j]) => line(ctx, 60 + (LEO[i][0] - 1500) * 0.6, 170 + (LEO[i][1] - 120) * 0.6, 60 + (LEO[j][0] - 1500) * 0.6, 170 + (LEO[j][1] - 120) * 0.6, 'rgba(192,138,42,0.8)', 2));
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  // her handwritten note across the bottom of both pages
  const np = seg(t, T.note[0], T.note[1]);
  if (np > 0 && close < 0.4) text(ctx, typed('keep both. know which is which.', np), -pw + 60, ph / 2 - 70, { size: 40, family: FONTS.serif, style: 'italic', color: '#2a2440', alpha: 1 - close * 2.5 });
  // spine
  line(ctx, 0, -ph / 2, 0, ph / 2, 'rgba(60,40,80,0.35)', 4);
  ctx.restore();
  // pencil
  const pen = [lerp(500, 1300, np), 900 - Math.sin(np * 30) * 6];
  if (close < 0.2) { ctx.save(); ctx.translate(pen[0], pen[1]); ctx.rotate(-0.7); ctx.fillStyle = '#ffc857'; ctx.fillRect(-10, -200, 20, 200); ctx.fillStyle = '#e8c3a5'; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.lineTo(0, 28); ctx.closePath(); ctx.fill(); ctx.restore(); }
}

export default {
  duration: T.end, cues, subs,
  render(ctx, t, info) {
    const frame = info?.frame || 0;
    const po = { bloom: 0.6, vignette: 0.5, grain: 0.05, frame };
    if (t >= T.book[0] && t < T.book[1]) {
      notebook(ctx, t);
      post(ctx, { ...po, bloom: 0.2 }); return;
    }
    const c = camZoom(t);
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(c.k, c.k); ctx.translate(-c.cx, -c.cy);
    room(ctx, t);
    const pose = POSE(t); pose.hairSwing = hairLag(POSE, t, 'head', 2) + 0.1 * Math.sin(t * 1.2); pose.breath = 0.5 + 0.5 * Math.sin(t * 1.1);
    drawCat(ctx, 1240, 765, 140, { t, curl: 0.95, style: CAT_NIGHT });
    drawHer(ctx, 700, 715, 560, pose, { style: STYLE_NIGHT, rim: { color: '#b8c8ff', dx: 1, dy: -0.6, width: 4 }, hide: {}, halo: 0.2 });
    // mug with steam (in her hands) — set down later
    const hd = sideHand(pose, 700, 715, 560);
    if (t < T.phone[0]) {
      ctx.fillStyle = '#e8d8c8'; rrect(ctx, hd[0] - 6, hd[1] - 46, 40, 46, 8); ctx.fill();
      for (let k = 0; k < 3; k++) { const u = frac(t * 0.4 + k / 3); ctx.fillStyle = rgba('#ffffff', 0.18 * Math.sin(u * Math.PI)); ctx.beginPath(); ctx.arc(hd[0] + 14 + Math.sin(u * 6 + k) * 8, hd[1] - 60 - u * 90, 8 + u * 14, 0, TAU); ctx.fill(); }
    } else {
      // the phone lights up beside her
      const pa = seg(t, T.phone[0], T.phone[0] + 0.5);
      ctx.fillStyle = '#05060f'; rrect(ctx, 880, 744, 90, 14, 4); ctx.fill(); glow(ctx, 925, 740, 160, '#9fc8ff', 0.6 * pa);
    }
    ctx.restore();
    // overlays (screen space, after the pull-back)
    const m0 = E.inOutCubic(seg(t, T.merge[0], T.merge[0] + 1.0)), m1 = E.inOutCubic(seg(t, T.merge[0] + 1.0, T.merge[1]));
    const fl = E.inCubic(seg(t, T.fly[0], T.fly[1]));
    const phA = seg(t, T.phys[0], T.phys[0] + 0.5) * (1 - fl);
    const syA = seg(t, T.sym[0], T.sym[0] + 0.5) * (1 - fl);
    // merging: the maps slide over the moon, overlap (each keeps its colour), then part again
    const pox = lerp(0, 260, m0) * (1 - m1) + lerp(0, -80, m1), sox = lerp(0, -260, m0) * (1 - m1) + lerp(0, 80, m1);
    const fy = fl * 600, fs = 1 - fl * 0.7;
    physMap(ctx, t, phA, pox - fl * 500, fy, fs);
    symMap(ctx, t, syA, sox - fl * 200, fy, fs);
    const ma = Math.sin(m0 * Math.PI) * (1 - m1);
    if (ma > 0.01) text(ctx, 'same circles. different claims.', 960, 1000, { size: 30, family: FONTS.serif, style: 'italic', color: '#e6e0ff', align: 'center', alpha: ma });
    post(ctx, po);
  },
};
