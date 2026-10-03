// Scene 3 — "Dinner, as an algorithm"
// Evening kitchen. Cooking scheduled like a deploy plan; chopping is the rhythm section; the cat steals a shrimp.
// The burner flame opens into fusion plasma and a round future city. Its "fastest route" runs through a person —
// 人是目的，不是手段 — and the route bends around her. The bright disc of the city becomes the pot of curry:
// all that power, for a meal. Meal-prep boxes: MON–FRI, and one with a moon drawn on the lid.
import { W, H, TAU, clamp, lerp, seg, win, E, track, hash, noise, rgba, mixc, PAL, frac, rng } from '../engine/core.js';
import { glow, circle, ring, line, rrect, text, revealText, tag, vgrad, FONTS, crescent } from '../engine/draw.js';
import { camera } from '../engine/cam3d.js';
import { drawHer, STYLE_DAY, SIDE_STAND, poseTrack, hairLag, sideHand, walkPose, walkBob } from '../engine/figure.js';
import { drawCat } from '../engine/cat.js';
import { post } from '../engine/post.js';

const T = {
  open: [0, 1.2], walkIn: [0.4, 2.6], planCard: 1.2, rice: 3.1, chop: [4.3, 6.9], sweep: 7.3, sizzle: 7.6,
  over: [9.0, 13.0], stirTxt: 9.6, taste: [11.2, 11.6, 12.0], steal: 12.2, minusShrimp: 12.45, notice: 13.6,
  flameDive: [15.4, 17.4], plasma: [17.4, 21.2], plasmaTxt: 18.0, city: [20.4, 29.6], cityLights: 21.0, route: 23.2, routeCost: 24.0,
  reroute: 25.6, principle: 25.9, cityUp: [28.2, 30.0], potMatch: 30.0, plate: [31.2, 34.6], forThis: 32.4,
  boxes: [35.0, 39.6], moonLid: 40.2, lightsOff: 42.6, end: 44.0,
};
const BPM = 92, BEAT = 60 / BPM;
const CHOPS = Array.from({ length: 16 }, (_, i) => T.chop[0] + i * BEAT / 2);
export const cues = { ...T, bpm: BPM, chops: CHOPS };
export const subs = [
  [1.4, 8.8, '晚餐计划：米饭 ▸ 电饭煲 40 分钟（后台）· 洋葱 ▸ 炒到金黄 · 咖喱 ▸ 小火 20 分钟 · 虾 ▸ 最后 3 分钟 · 备餐 ▸ 5 盒', ''],
  [9.6, 12.0, '当（还没金黄）继续搅；尝一尝，调一调，再尝一尝', ''],
  [12.45, 14.6, '虾 −1', ''],
  [18.0, 21.0, '如果能源几乎免费，会怎样？', ''],
  [24.0, 25.6, '最快路线 · 代价：1 个人', ''],
  [32.4, 34.6, '所有这些能量——都是为了这个。', ''],
  [35.0, 41.5, '周一 · 周二 · 周三 · 周四 · 周五', ''],
];

// ---------------------------------------------------------------------------- kitchen (side section)
const FLOOR = 1000, COUNTER = 640;
const POT = { x: 880, y: COUNTER, w: 200, h: 118 };
const BOARD = { x: 1150, w: 290 };
const SHRIMP = { x: 1500 };
const COOKER = { x: 1640, w: 170 };
const STATIONS = { door: 300, stove: 735, board: 1080, cooker: 1500, boxes: 1180 };

function herX(t) {
  return track([
    [0, -120], [T.walkIn[1], STATIONS.cooker - 40, E.inOutSine],
    [T.rice + 0.5, STATIONS.cooker - 40], [T.chop[0] - 0.2, STATIONS.board, E.inOutSine],
    [T.sweep - 0.5, STATIONS.board], [T.sweep + 0.2, STATIONS.stove + 60, E.inOutSine],
    [14.5, STATIONS.stove + 60], [15.2, 520, E.inOutSine], [30.6, 520], [31.6, STATIONS.stove + 120, E.inOutSine],
    [T.boxes[0] - 0.4, STATIONS.stove + 120], [T.boxes[0], STATIONS.boxes - 40, E.inOutSine],
  ])(t);
}
const STAND = { ...SIDE_STAND, shF: 0.7, elF: 1.1, shB: 0.6, elB: 1.0, head: 0.18 };
const ARM_POSES = poseTrack([
  [0, { ...SIDE_STAND, head: 0.05 }],
  [2.4, { ...SIDE_STAND, head: 0.1 }],
  [2.9, { ...STAND, shF: 1.2, elF: 0.4, head: 0.2 }],    // reach to rice cooker button
  [3.1, { ...STAND, shF: 1.3, elF: 0.2, wrF: 0.4, head: 0.25 }, E.outCubic],
  [3.5, { ...STAND, head: 0.25 }],
  [4.3, { ...STAND, head: 0.35, torso: 0.1 }],
]);
function herPose(t) {
  let p = ARM_POSES(t);
  // walking phases
  const moving = [[0, T.walkIn[1]], [T.chop[0] - 1.1, T.chop[0] - 0.2], [T.sweep - 0.5, T.sweep + 0.2], [14.5, 15.2], [30.6, 31.6], [T.boxes[0] - 0.4, T.boxes[0]]];
  let wph = null;
  for (const [a, b] of moving) if (t > a && t < b) wph = (t - a) * 1.6;
  // chopping: knife hand up/down on each chop
  if (t >= T.chop[0] - 0.2 && t < T.chop[1] + 0.2) {
    let lift = 0;
    for (const c of CHOPS) { const d = t - c; if (d > -BEAT / 2 && d <= 0) lift = Math.max(lift, Math.sin((d + BEAT / 2) / (BEAT / 2) * Math.PI / 2)); if (d > 0 && d < 0.08) lift = Math.max(lift, 1 - d / 0.08); }
    p = { ...STAND, torso: 0.14, head: 0.45, shF: 0.9 + 0.25 * lift, elF: 1.25 - 0.55 * lift, wrF: 0.2, shB: 0.75, elB: 1.0 };
  }
  // sweep into the pot
  if (t >= T.sweep - 0.5 && t < T.sweep + 0.6) { const u = seg(t, T.sweep - 0.1, T.sweep + 0.4); p = { ...STAND, torso: 0.1, head: 0.3, shF: 0.7 + 0.6 * Math.sin(u * Math.PI), elF: 0.8 }; }
  // stirring / tasting (circular arm motion) during the overhead + notice
  if (t >= 14.5 && t < 31.6) { p = { ...STAND, torso: 0.05, head: 0.35, shF: 0.25, elF: 0.4, shB: 0.15, elB: 0.3 }; }
  if (t >= T.sweep + 0.6 && t < 14.5) {
    const st = Math.sin(t * 6.2), ct = Math.cos(t * 6.2);
    p = { ...STAND, torso: 0.08, head: 0.3, shF: 0.85 + 0.12 * st, elF: 0.9 + 0.15 * ct, shB: 0.4, elB: 0.6 };
    for (const ta of T.taste) { const u = seg(t, ta - 0.15, ta + 0.25); if (u > 0 && u < 1) p = { ...p, shF: lerp(p.shF, 0.3, Math.sin(u * Math.PI)), elF: lerp(p.elF, 2.4, Math.sin(u * Math.PI)), head: lerp(0.3, -0.05, Math.sin(u * Math.PI)) }; }
    // notice the thief: look right, then a fond head shake
    const nu = seg(t, T.notice - 0.2, T.notice + 1.6);
    if (nu > 0 && nu < 1) p = { ...p, head: lerp(0.3, -0.1, Math.sin(nu * Math.PI)) + 0.08 * Math.sin(nu * 30) * Math.sin(nu * Math.PI), torso: 0.02 };
  }
  // plating (ladle) and boxes
  if (t >= 31.8 && t < T.boxes[0] - 0.4) { const u = frac((t - 31.8) / 1.1); p = { ...STAND, torso: 0.12, head: 0.4, shF: 1.0 + 0.3 * Math.sin(u * Math.PI), elF: 0.7, shB: 0.7, elB: 1.0 }; }
  if (t >= T.boxes[0]) {
    const bu = frac((t - T.boxes[0]) / 0.92);
    p = { ...STAND, torso: 0.12, head: 0.42, shF: 0.9 + 0.25 * Math.sin(bu * Math.PI), elF: 0.9, shB: 0.8, elB: 1.0 };
    if (t > T.moonLid - 0.3 && t < T.moonLid + 1.3) { const u = seg(t, T.moonLid, T.moonLid + 1.0); p = { ...p, shF: 1.0 + 0.06 * Math.sin(u * 20), elF: 0.75 + 0.05 * Math.cos(u * 20), head: 0.5 }; }
    if (t > T.lightsOff - 0.6) { const u = seg(t, T.lightsOff - 0.6, T.lightsOff); p = { ...p, shF: lerp(p.shF, -0.6, u), elF: lerp(p.elF, 1.8, u), head: lerp(p.head, -0.1, u), torso: lerp(0.12, -0.02, u) }; }
  }
  if (wph != null) p = walkPose({ ...p, thF: 0, thB: 0, knF: 0.02, knB: 0.04 }, wph, 0.9);
  p.hairSwing = (p.hairSwing || 0) + 0.15 * Math.sin(t * 1.7);
  return { p, wph };
}

function drawKitchen(ctx, t, o = {}) {
  const night = seg(t, T.lightsOff, T.lightsOff + 0.3);
  // wall
  vgrad(ctx, rgba(mixc('#f3cfa1', '#2a2244', night)), rgba(mixc('#d99a6a', '#1b1630', night)), -2000, -2000, 6000, 2000 + FLOOR);
  // doorway on the left (where she enters)
  ctx.fillStyle = rgba(mixc('#c4855a', '#16122a', night)); rrect(ctx, 120, 330, 300, FLOOR - 330, 6); ctx.fill();
  ctx.fillStyle = rgba(mixc('#6a4a8a', '#0a0818', night), 0.35); ctx.fillRect(140, 350, 260, FLOOR - 350);
  // window with dusk
  const wx = 1080, wy = 150, ww = 430, wh = 290;
  const g = ctx.createLinearGradient(0, wy, 0, wy + wh);
  g.addColorStop(0, rgba(mixc('#5b4a9a', '#0d1438', seg(t, 20, 44)))); g.addColorStop(1, rgba(mixc('#ff9a6a', '#2a2050', seg(t, 20, 44))));
  ctx.fillStyle = g; ctx.fillRect(wx, wy, ww, wh);
  ctx.fillStyle = '#3a2d55'; for (let i = 0; i < 12; i++) { const bh = 30 + hash(i + 300) * 90; ctx.fillRect(wx + i * 36, wy + wh - bh, 32, bh); }
  ctx.fillStyle = '#ffd38a'; for (let i = 0; i < 30; i++) if (hash(i + 7) > 0.4) ctx.fillRect(wx + hash(i + 70) * ww, wy + wh - hash(i + 99) * 80, 3, 4);
  ctx.strokeStyle = '#9a6a48'; ctx.lineWidth = 12; ctx.strokeRect(wx, wy, ww, wh); line(ctx, wx + ww / 2, wy, wx + ww / 2, wy + wh, '#9a6a48', 8);
  // upper cabinets + shelf with jars
  ctx.fillStyle = '#c98a5a'; rrect(ctx, 640, 110, 400, 220, 8); ctx.fill(); rrect(ctx, 1560, 110, 420, 220, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(90,50,30,0.35)'; ctx.lineWidth = 3; ctx.strokeRect(660, 130, 175, 180); ctx.strokeRect(845, 130, 175, 180); ctx.strokeRect(1580, 130, 185, 180); ctx.strokeRect(1775, 130, 185, 180);
  ctx.fillStyle = '#8a5a3a'; ctx.fillRect(640, 420, 400, 12);
  const jars = ['#e85a3a', '#f2b33d', '#6aa84f', '#c84a8a', '#4a7ac8'];
  jars.forEach((c, i) => { ctx.fillStyle = 'rgba(255,255,255,0.5)'; rrect(ctx, 660 + i * 74, 360, 50, 60, 8); ctx.fill(); ctx.fillStyle = c; rrect(ctx, 664 + i * 74, 382, 42, 34, 6); ctx.fill(); ctx.fillStyle = '#5a3a2a'; ctx.fillRect(662 + i * 74, 352, 46, 10); });
  // pendant lamp
  line(ctx, 1300, -50, 1300, 120, '#3a2a2a', 3);
  ctx.fillStyle = '#2f2a3a'; ctx.beginPath(); ctx.moveTo(1250, 150); ctx.lineTo(1350, 150); ctx.lineTo(1325, 115); ctx.lineTo(1275, 115); ctx.closePath(); ctx.fill();
  glow(ctx, 1300, 160, 420, '#ffcf8a', 0.45 * (1 - night));
  // counter
  ctx.fillStyle = rgba(mixc('#e9e1d6', '#3a3450', night)); ctx.fillRect(560, COUNTER, 1500, 22);
  ctx.fillStyle = rgba(mixc('#b5734a', '#2a2238', night)); ctx.fillRect(570, COUNTER + 22, 1480, FLOOR - COUNTER - 22);
  ctx.strokeStyle = 'rgba(60,30,20,0.35)'; ctx.lineWidth = 3;
  for (let k = 0; k < 6; k++) { ctx.strokeRect(600 + k * 240, COUNTER + 50, 220, 300); circle(ctx, 600 + k * 240 + 200, COUNTER + 200, 6, 'rgba(60,30,20,0.4)'); }
  // floor
  ctx.fillStyle = rgba(mixc('#8a5a3c', '#1a1428', night)); ctx.fillRect(-2000, FLOOR, 6000, 400);
  // stove knobs
  for (let k = 0; k < 3; k++) circle(ctx, 800 + k * 70, COUNTER + 30, 10, '#3a3a44');
  // burner + flame
  const fl = 0.85 + 0.15 * noise(t * 8, 2);
  ctx.fillStyle = '#2a2a33'; ctx.fillRect(POT.x - 120, COUNTER - 10, 240, 10);
  for (let k = -5; k <= 5; k++) {
    const fx = POT.x + k * 17, fh = (19 + 7 * noise(t * 10 + k, 4)) * fl;
    glow(ctx, fx, COUNTER - 14, 18, '#6fa8ff', 0.6);
    ctx.fillStyle = 'rgba(120,170,255,0.85)'; ctx.beginPath(); ctx.moveTo(fx - 5, COUNTER - 10); ctx.quadraticCurveTo(fx, COUNTER - 10 - fh * 1.6, fx + 5, COUNTER - 10); ctx.fill();
  }
  // pot
  const px = POT.x - POT.w / 2, py = COUNTER - 44 - POT.h;
  // grate under the pot
  ctx.fillStyle = '#1e1e26'; ctx.fillRect(POT.x - 115, COUNTER - 46, 230, 8); ctx.fillRect(POT.x - 110, COUNTER - 46, 10, 36); ctx.fillRect(POT.x + 100, COUNTER - 46, 10, 36);
  ctx.fillStyle = '#40404c'; rrect(ctx, px, py, POT.w, POT.h, 14); ctx.fill();
  ctx.fillStyle = '#55556a'; ctx.fillRect(px - 6, py, POT.w + 12, 12);
  ctx.fillStyle = '#2a2a34'; rrect(ctx, px - 34, py + 26, 34, 12, 5); ctx.fill(); rrect(ctx, px + POT.w, py + 26, 34, 12, 5); ctx.fill();
  // steam
  const steamA = 0.25 + 0.5 * seg(t, T.sizzle, T.sizzle + 1.2);
  for (let k = 0; k < 7; k++) {
    const u = frac(t * 0.35 + k / 7);
    const sx = POT.x + (hash(k) - 0.5) * 120 + Math.sin(u * 6 + k) * 25, sy = py - u * 260;
    ctx.fillStyle = rgba('#ffffff', steamA * 0.22 * Math.sin(u * Math.PI)); ctx.beginPath(); ctx.arc(sx, sy, 22 + u * 50, 0, TAU); ctx.fill();
  }
  // cutting board + veggies (pieces accumulate with chops)
  ctx.fillStyle = '#d9a46a'; rrect(ctx, BOARD.x, COUNTER - 14, BOARD.w, 14, 4); ctx.fill();
  let nChop = 0; for (const c of CHOPS) if (t >= c) nChop++;
  const swept = seg(t, T.sweep, T.sweep + 0.4);
  if (swept < 1) {
    // whole onion shrinks as pieces accumulate
    const onion = 1 - nChop / 16;
    if (onion > 0) { circle(ctx, BOARD.x + 210, COUNTER - 14 - 34 * onion, 36 * onion, '#e9c48a'); ctx.strokeStyle = 'rgba(150,100,50,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(BOARD.x + 210, COUNTER - 14 - 34 * onion, 26 * onion, 0, TAU); ctx.stroke(); }
    for (let k = 0; k < nChop * 2; k++) {
      const bx = BOARD.x + 40 + (k % 8) * 16 + (hash(k) - 0.5) * 6 - swept * 300, by = COUNTER - 18 - Math.floor(k / 8) * 9;
      ctx.fillStyle = k % 3 ? '#f1d9a8' : '#f08a3a'; rrect(ctx, bx, by, 13, 8, 2); ctx.fill();
    }
  }
  // shrimp bowl
  ctx.fillStyle = '#e8eef6'; ctx.beginPath(); ctx.ellipse(SHRIMP.x, COUNTER - 22, 60, 26, 0, 0, Math.PI); ctx.fill(); ctx.fillRect(SHRIMP.x - 60, COUNTER - 30, 120, 8);
  const nShrimp = t < T.steal ? 6 : 5;
  for (let k = 0; k < nShrimp; k++) { ctx.strokeStyle = '#ff8a6a'; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(SHRIMP.x - 36 + k * 15, COUNTER - 36, 9, 0.3, 2.6); ctx.stroke(); }
  // rice cooker
  const cx0 = COOKER.x;
  ctx.fillStyle = '#f3f1ee'; rrect(ctx, cx0, COUNTER - 150, COOKER.w, 150, 30); ctx.fill();
  ctx.fillStyle = '#d8d4cf'; rrect(ctx, cx0 + 10, COUNTER - 168, COOKER.w - 20, 30, 14); ctx.fill();
  const on = t > T.rice;
  circle(ctx, cx0 + 120, COUNTER - 70, 9, on ? '#ff6a3a' : '#bbb'); if (on) glow(ctx, cx0 + 120, COUNTER - 70, 30, '#ff6a3a', 0.6);
  if (on) for (let k = 0; k < 4; k++) { const u = frac(t * 0.5 + k / 4); ctx.fillStyle = rgba('#ffffff', 0.25 * Math.sin(u * Math.PI)); ctx.beginPath(); ctx.arc(cx0 + 85 + Math.sin(u * 5) * 10, COUNTER - 175 - u * 120, 12 + u * 26, 0, TAU); ctx.fill(); }
  // pet stairs (the cat cannot jump)
  ctx.fillStyle = rgba(mixc('#a06a44', '#2a2034', night));
  for (let k = 0; k < 4; k++) { const sx = 1985 + k * 45; ctx.fillRect(sx, COUNTER + k * 90, 140 - k * 0, FLOOR - COUNTER - k * 90); }
  ctx.fillStyle = rgba(mixc('#c98e60', '#3a2c44', night)); for (let k = 0; k < 4; k++) ctx.fillRect(1985 + k * 45, COUNTER + k * 90, 140, 10);
  return { nChop };
}

// ---------------------------------------------------------------------------- overhead pot (top-down)
function drawPotTop(ctx, t, o = {}) {
  const cx = 960, cy = 560, R = 420;
  vgrad(ctx, '#3a2a2a', '#241818');
  // stove grate
  ctx.strokeStyle = '#141014'; ctx.lineWidth = 26;
  for (const a of [0, Math.PI / 2]) { line(ctx, cx + Math.cos(a) * 560, cy + Math.sin(a) * 560, cx - Math.cos(a) * 560, cy - Math.sin(a) * 560, '#141014', 26); }
  circle(ctx, cx, cy, R + 40, '#55556a'); circle(ctx, cx, cy, R + 18, '#3a3a48');
  // curry
  const golden = seg(t, T.over[0], T.over[1] - 1);
  const g = ctx.createRadialGradient(cx - 80, cy - 90, 40, cx, cy, R);
  g.addColorStop(0, rgba(mixc('#e9b45a', '#d08a2a', golden))); g.addColorStop(1, rgba(mixc('#b8762e', '#7a4316', golden)));
  circle(ctx, cx, cy, R, g);
  // stir swirl + chunks
  const sp = t * 2.4;
  for (let k = 0; k < 28; k++) {
    const rr = R * (0.15 + 0.8 * hash(k)), a = hash(k + 50) * TAU + sp * (1.2 - rr / R);
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    ctx.fillStyle = ['#f08a3a', '#f5d58a', '#8a4a22', '#ff9a7a'][k % 4];
    rrect(ctx, x - 14, y - 10, 28, 20, 6); ctx.fill();
  }
  // spiral highlight of the spoon path
  ctx.strokeStyle = rgba('#fff2c8', 0.35); ctx.lineWidth = 6; ctx.beginPath();
  for (let k = 0; k <= 80; k++) { const u = k / 80, a = sp + u * 9, rr = R * 0.75 * (1 - u * 0.85); const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  ctx.stroke();
  // spoon
  const sa = sp + 0.4, sx = cx + Math.cos(sa) * R * 0.45, sy = cy + Math.sin(sa) * R * 0.45;
  ctx.fillStyle = '#c9a07a'; ctx.beginPath(); ctx.ellipse(sx, sy, 46, 30, sa, 0, TAU); ctx.fill();
  line(ctx, sx, sy, sx + Math.cos(sa + 0.5) * 520, sy + Math.sin(sa + 0.5) * 520, '#c9a07a', 22);
  // bubbles
  for (let k = 0; k < 12; k++) { const u = frac(t * 0.8 + hash(k + 9)); const a = hash(k + 3) * TAU, rr = R * 0.8 * hash(k + 4); ring(ctx, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 6 + u * 16, 'rgba(255,240,200,0.6)', 2, Math.sin(u * Math.PI)); }
  // a paw steals a shrimp
  const pu = seg(t, T.steal - 0.5, T.steal + 0.7);
  if (pu > 0 && pu < 1) {
    const reach = Math.sin(pu * Math.PI);
    const px = W + 60 - reach * 380, py = 180 + reach * 40;
    ctx.fillStyle = '#f0a352'; ctx.beginPath(); ctx.ellipse(px + 200, py, 230, 60, -0.2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(px, py + 10, 62, 52, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#f6b9a4'; for (const [dx, dy] of [[-30, -20], [-38, 6], [-26, 30]]) circle(ctx, px + dx, py + 10 + dy, 9, '#f6b9a4');
    if (pu > 0.5) { ctx.strokeStyle = '#ff8a6a'; ctx.lineWidth = 14; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(px - 44, py + 16, 14, 0.3, 2.6); ctx.stroke(); }
  }
}

// ---------------------------------------------------------------------------- plasma torus
function drawPlasma(ctx, t, a, expand) {
  vgrad(ctx, '#0a0418', '#12042a');
  const cx = 960, cy = 560;
  const spin = t * 1.6;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const R = 360 * (1 + expand * 1.4), r = 120 * (1 + expand * 0.4);
  for (let k = 0; k < 520; k++) {
    const u = hash(k) * TAU + spin * (0.6 + hash(k + 1) * 0.6), v = hash(k + 2) * TAU + spin * 3.2 * (hash(k + 3) > 0.5 ? 1 : -1);
    const x = (R + r * Math.cos(v)) * Math.cos(u), z = (R + r * Math.cos(v)) * Math.sin(u), y = r * Math.sin(v);
    const tilt = 0.42;
    const sy = y * Math.cos(tilt) + z * Math.sin(tilt), sz = -y * Math.sin(tilt) + z * Math.cos(tilt);
    const per = 900 / (900 - sz * 0.3);
    const px = cx + x * per, py = cy + sy * per * 0.9;
    const c = hash(k + 5) > 0.5 ? '#ff4fd8' : '#8a6cff';
    glow(ctx, px, py, (10 + 14 * hash(k + 6)) * per, c, 0.35 * a);
  }
  // core glow ring
  ctx.restore();
  ctx.save(); ctx.translate(cx, cy); ctx.scale(1, 0.42);
  for (let k = 0; k < 5; k++) { ctx.strokeStyle = rgba(k % 2 ? '#ff7ae6' : '#a58aff', 0.55 * a); ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, R + (k - 2) * r * 0.45, 0, TAU); ctx.stroke(); }
  ctx.restore();
  glow(ctx, cx, cy, R * 1.2, '#b06cff', 0.35 * a);
  // expansion wave
  if (expand > 0) ring(ctx, cx, cy, 300 + expand * 1600, rgba('#ffd27a', 1 - expand), 8 * (1 - expand), (1 - expand) * a);
}

// ---------------------------------------------------------------------------- the round city (3D boxes)
let CITY = null;
function buildCity() {
  if (CITY) return CITY;
  const r = rng(2026);
  const B = [];
  const N = 15, S = 160;
  for (let i = -N; i <= N; i++) for (let j = -N; j <= N; j++) {
    const x = i * S, z = j * S, d = Math.hypot(x, z);
    if (d > N * S || d < 330) continue;
    const nb = 1 + Math.floor(r() * 3);
    for (let k = 0; k < nb; k++) {
      const w = 40 + r() * 50, dd = 40 + r() * 50;
      const bx = x + (r() - 0.5) * (S - w - 30), bz = z + (r() - 0.5) * (S - dd - 30);
      const h = (40 + Math.pow(r(), 2.2) * 420) * (1.2 - d / (N * S) * 0.7);
      B.push({ x: bx, z: bz, w, d: dd, h, dist: d, farm: r() < 0.08, seed: r() });
    }
  }
  CITY = { B, N, S };
  return CITY;
}
// intersections for the route
const ROUTE_A = [-6, -4], ROUTE_B = [6, 5], PERSON = [1, 1];
function routePts(re) {
  const S = buildCity().S;
  const pts = [];
  // straight-ish path along streets through the person, or the bent one around
  const path = re < 0.5 ? [[-6, -4], [-6, 1], [1, 1], [6, 1], [6, 5]] : [[-6, -4], [-6, 1], [0, 1], [0, 2], [2, 2], [2, 1], [6, 1], [6, 5]];
  return path.map(([i, j]) => [i * S - S / 2, 0, j * S - S / 2]);
}
function drawCity(ctx, t, o) {
  const C = buildCity();
  vgrad(ctx, '#05030f', '#140a2a');
  const fly = seg(t, T.city[0], T.city[1]);
  const up = E.inOutCubic(seg(t, T.cityUp[0], T.cityUp[1]));
  const cam = camera({
    yaw: 0.4 + fly * 0.9, pitch: -(lerp(0.62, 1.5, up) - (1 - E.outCubic(seg(t, T.city[0], T.city[0] + 2))) * 0.25),
    dist: lerp(2600, 3600, E.inOutSine(fly)) + up * 4200, fov: 45, target: [lerp(0, 120, fly), 0, lerp(0, 160, fly)], cx: 960, cy: 560,
  });
  const lightR = 330 + E.inOutSine(seg(t, T.cityLights, T.cityLights + 2.6)) * C.N * C.S;
  // ground disc
  const gp = [];
  for (let k = 0; k <= 48; k++) { const a = k / 48 * TAU; gp.push(cam.project([Math.cos(a) * C.N * C.S * 1.08, 0, Math.sin(a) * C.N * C.S * 1.08])); }
  ctx.beginPath(); gp.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); ctx.fillStyle = '#0c0820'; ctx.fill();
  // streets (glowing grid) inside the lit radius
  ctx.lineWidth = 2;
  for (let i = -C.N; i <= C.N; i++) {
    for (const axis of [0, 1]) {
      const a = i * C.S - C.S / 2, L = Math.sqrt(Math.max(0, (C.N * C.S) ** 2 - a * a));
      if (L <= 0) continue;
      const p0 = cam.project(axis ? [a, 0, -L] : [-L, 0, a]), p1 = cam.project(axis ? [a, 0, L] : [L, 0, a]);
      const lit = clamp((lightR - Math.abs(a)) / 400);
      line(ctx, p0.x, p0.y, p1.x, p1.y, rgba(mixc('#2a2050', '#ffb84a', lit * 0.8)), 1.5, 0.35 + 0.35 * lit);
    }
  }
  // buildings (painter's order)
  const vis = C.B.map(b => ({ b, z: cam.project([b.x, -b.h / 2, b.z]).z })).sort((p, q) => q.z - p.z);
  for (const { b } of vis) {
    const lit = clamp((lightR - b.dist) / 300);
    const x0 = b.x - b.w / 2, x1 = b.x + b.w / 2, z0 = b.z - b.d / 2, z1 = b.z + b.d / 2;
    const P = [[x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1], [x0, -b.h, z0], [x1, -b.h, z0], [x1, -b.h, z1], [x0, -b.h, z1]].map(p => cam.project(p));
    if (P.some(p => p.s <= 0)) continue;
    const faces = [[4, 5, 6, 7, 'top'], [0, 1, 5, 4, 's'], [1, 2, 6, 5, 'e'], [2, 3, 7, 6, 'n'], [3, 0, 4, 7, 'w']];
    for (const f of faces) {
      const [a, bb, c, d, kind] = f;
      const cross = (P[bb].x - P[a].x) * (P[c].y - P[a].y) - (P[bb].y - P[a].y) * (P[c].x - P[a].x);
      if (cross >= 0) continue;   // back-face cull (screen winding)
      const base = b.farm ? '#1e5a3a' : '#1c1838';
      const litC = b.farm ? '#5affa0' : (kind === 'top' ? '#ffd58a' : '#d98a4a');
      ctx.fillStyle = rgba(mixc(base, litC, lit * (kind === 'top' ? 0.85 : 0.35 + 0.25 * b.seed)));
      ctx.beginPath(); ctx.moveTo(P[a].x, P[a].y); ctx.lineTo(P[bb].x, P[bb].y); ctx.lineTo(P[c].x, P[c].y); ctx.lineTo(P[d].x, P[d].y); ctx.closePath(); ctx.fill();
    }
    if (lit > 0.5 && b.h > 250) { const tp = cam.project([b.x, -b.h - 6, b.z]); glow(ctx, tp.x, tp.y, 30 * tp.s * 2, '#ff6a5a', lit * 0.6 * (0.5 + 0.5 * Math.sin(t * 3 + b.seed * 9))); }
  }
  // reactor ring at the centre (the torus, now a building)
  const rc = []; for (let k = 0; k <= 40; k++) { const a = k / 40 * TAU; rc.push(cam.project([Math.cos(a) * 230, -60, Math.sin(a) * 230])); }
  ctx.strokeStyle = '#ff7ae6'; ctx.lineWidth = 10 * rc[0].s * 3; ctx.beginPath(); rc.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
  const cc = cam.project([0, -60, 0]); glow(ctx, cc.x, cc.y, 360 * cc.s * 3, '#d06cff', 0.55);
  // the route through a person
  const ra = seg(t, T.route, T.route + 1.4);
  const re = E.inOutCubic(seg(t, T.reroute, T.reroute + 1.2));
  const person = cam.project([PERSON[0] * C.S - C.S / 2, -10, PERSON[1] * C.S - C.S / 2]);
  if (ra > 0) {
    const draw = (pts, col, wdt, prog, alpha) => {
      const PP = pts.map(p => cam.project([p[0], -8, p[2]]));
      const tot = PP.length - 1, pp = prog * tot;
      ctx.strokeStyle = col; ctx.lineWidth = wdt; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.globalAlpha = alpha;
      ctx.beginPath(); ctx.moveTo(PP[0].x, PP[0].y);
      let head = PP[0];
      for (let k = 0; k < tot; k++) { const u = clamp(pp - k); if (u <= 0) break; const x = lerp(PP[k].x, PP[k + 1].x, u), y = lerp(PP[k].y, PP[k + 1].y, u); ctx.lineTo(x, y); head = { x, y }; }
      ctx.stroke(); ctx.globalAlpha = 1;
      return head;
    };
    const hd = draw(routePts(0), '#5fd8ff', 7, E.inOutSine(ra), 1 - re);
    if (re < 1) glow(ctx, hd.x, hd.y, 50, '#5fd8ff', 1 - re);
    if (re > 0) { const h2 = draw(routePts(1), PAL.gold, 9, 1, re); }
  }
  // the person (tiny human at the intersection)
  const pa = seg(t, T.route - 0.6, T.route);
  if (pa > 0) {
    const ps = Math.max(1.3, person.s * 6);
    const threatened = seg(t, T.routeCost, T.routeCost + 0.4) * (1 - re);
    glow(ctx, person.x, person.y - 30 * ps, 120 * ps, re > 0.3 ? '#ffc857' : (threatened > 0 ? '#ff5a4a' : '#9fd8ff'), 0.9 * pa);
    ring(ctx, person.x, person.y - 28 * ps, 36 * ps + 8 * Math.sin(t * 4), re > 0.3 ? '#ffc857' : '#ffffff', 3, 0.7 * pa);
    ctx.fillStyle = '#ffffff'; ctx.globalAlpha = pa;
    ctx.beginPath(); ctx.arc(person.x, person.y - 46 * ps, 9 * ps, 0, TAU); ctx.fill();
    rrect(ctx, person.x - 9 * ps, person.y - 36 * ps, 18 * ps, 30 * ps, 8 * ps); ctx.fill();
    ctx.globalAlpha = 1;
    if (threatened > 0.01) tag(ctx, person.x + 30, person.y - 90 * ps, 'fastest route · cost: 1 person', { size: 26, alpha: threatened, dot: '#ff5a4a', border: 'rgba(255,90,74,0.6)' });
  }
  return cam;
}

// ---------------------------------------------------------------------------- plan card (scheduler)
function planCard(ctx, t, a) {
  if (a <= 0.01) return;
  ctx.save(); ctx.globalAlpha = a;
  const x = 70, y = 70, w = 600;
  rrect(ctx, x, y, w, 320, 22); ctx.fillStyle = 'rgba(255,250,240,0.9)'; ctx.fill(); ctx.strokeStyle = 'rgba(120,70,40,0.25)'; ctx.lineWidth = 2; ctx.stroke();
  text(ctx, 'dinner.plan()', x + 28, y + 46, { size: 28, family: FONTS.mono, weight: 700, color: '#6a3a1a' });
  const rows = [
    ['rice', 'cooker · 40 min · background', [T.rice, T.boxes[0]], '#e9e2d0'],
    ['onions', 'chop → pan · until golden', [T.chop[0], T.over[1]], '#f2c56a'],
    ['curry', 'pot · simmer 20 min', [T.sizzle, T.plate[0]], '#c8803a'],
    ['shrimp', 'last 3 min', [T.over[1] - 1, T.plate[0]], '#ff9a7a'],
    ['meal prep', '5 boxes', [T.boxes[0], T.boxes[1]], '#9ad0a0'],
  ];
  rows.forEach(([name, d, [a0, a1], col], i) => {
    const yy = y + 92 + i * 46;
    text(ctx, name, x + 28, yy, { size: 22, family: FONTS.mono, weight: 700, color: '#4a2a1a' });
    text(ctx, d, x + 160, yy, { size: 19, family: FONTS.mono, color: '#8a6a5a' });
    const bx = x + 28, bw = w - 56, by = yy + 10;
    rrect(ctx, bx, by, bw, 8, 4); ctx.fillStyle = 'rgba(120,70,40,0.12)'; ctx.fill();
    const s0 = (a0 - 0) / T.end, s1 = (a1 - 0) / T.end, pr = clamp((t - a0) / (a1 - a0));
    rrect(ctx, bx + bw * s0, by, Math.max(8, bw * (s1 - s0) * pr), 8, 4); ctx.fillStyle = col; ctx.fill();
    if (pr >= 1) text(ctx, '✓', x + w - 34, yy, { size: 22, color: '#2a8a5a', weight: 700 });
  });
  // now-line
  const nx = x + 28 + (w - 56) * (t / T.end);
  line(ctx, nx, y + 70, nx, y + 310, 'rgba(255,80,60,0.6)', 2);
  ctx.restore();
}

// ---------------------------------------------------------------------------- meal-prep boxes
function drawBoxes(ctx, t) {
  const labels = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
  const x0 = 1100, y = COUNTER;
  for (let k = 0; k < 6; k++) {
    const tk = T.boxes[0] + k * 0.92;
    const a = seg(t, tk - 0.2, tk);
    if (a <= 0) continue;
    const fill = seg(t, tk, tk + 0.45);
    const bx = x0 + k * 124 + (k === 5 ? 34 : 0), drop = (1 - E.outBounce(a)) * 60;
    ctx.fillStyle = 'rgba(235,245,255,0.9)'; rrect(ctx, bx, y - 70 - drop, 116, 70, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(120,150,180,0.6)'; ctx.lineWidth = 2; ctx.stroke();
    if (fill > 0) {
      ctx.save(); ctx.beginPath(); rrect(ctx, bx + 4, y - 66 - drop, 108, 62, 8); ctx.clip();
      ctx.fillStyle = '#f5f0e2'; ctx.fillRect(bx + 4, y - 4 - drop - 30 * fill, 54, 30 * fill);
      ctx.fillStyle = '#b8702a'; ctx.fillRect(bx + 58, y - 4 - drop - 36 * fill, 54, 36 * fill);
      ctx.restore();
    }
    const lid = seg(t, tk + 0.5, tk + 0.75);
    if (lid > 0) {
      ctx.fillStyle = k === 5 ? '#2a3060' : '#5a8ac8'; rrect(ctx, bx - 4, y - 82 - drop - (1 - lid) * 40, 124, 16, 6); ctx.fill();
      if (k < 5) text(ctx, labels[k], bx + 58, y - 96 - drop, { size: 26, family: FONTS.mono, weight: 700, color: '#2a3a5a', align: 'center', alpha: seg(t, tk + 0.7, tk + 0.9) });
      if (k === 5) {
        const m = seg(t, T.moonLid, T.moonLid + 1.0);
        if (m > 0) { crescent(ctx, bx + 58, y - 74 - drop, 20 * E.outBack(m), { color: PAL.gold, k: 0.5, inner: 0.82, angle: -0.6 }); glow(ctx, bx + 58, y - 74, 70, PAL.gold, 0.5 * m); }
      }
    }
  }
}

// ---------------------------------------------------------------------------- render
export default {
  duration: T.end, cues, subs,
  render(ctx, t, info) {
    const frame = info?.frame || 0;
    const po = { bloom: 0.18, vignette: 0.4, grain: 0.05, frame };
    const inOver = t >= T.over[0] && t < T.over[1];
    const inCosmos = t >= T.flameDive[1] && t < T.potMatch;
    if (inOver) {
      drawPotTop(ctx, t);
      const ta = win(t, T.stirTxt, T.over[1], 0.3, 0.3);
      text(ctx, 'while (!golden) stir();', 960, 120, { size: 44, family: FONTS.mono, color: '#fff3d6', align: 'center', alpha: ta, shadow: 'rgba(0,0,0,0.6)' });
      const tt = T.taste.filter(x => t > x).length;
      if (tt) text(ctx, ['taste();', 'taste(); adjust();', 'taste(); adjust(); taste(); ✓'][tt - 1], 960, 1000, { size: 36, family: FONTS.mono, color: '#ffe0a8', align: 'center', alpha: ta, shadow: 'rgba(0,0,0,0.6)' });
      const sa = win(t, T.minusShrimp, T.over[1] + 0.5, 0.15, 0.3);
      if (sa > 0) tag(ctx, 1500, 320, '−1 shrimp', { size: 34, align: 'center', alpha: sa, dot: '#ff8a6a', bg: 'rgba(40,20,10,0.8)' });
      po.vignette = 0.6; po.bloom = 0.2;
      planCard(ctx, t, 0.0);
      post(ctx, po); return;
    }
    if (inCosmos) {
      if (t < T.city[0] + 0.8) {
        const ex = E.inCubic(seg(t, T.city[0] - 1.0, T.city[0] + 0.8));
        drawPlasma(ctx, t, 1 - seg(t, T.city[0] + 0.3, T.city[0] + 0.8), ex);
        // flame-dive arrival: blue fades into plasma
        const fa = 1 - seg(t, T.flameDive[1], T.flameDive[1] + 0.6);
        if (fa > 0) { ctx.fillStyle = rgba('#7ab0ff', fa * 0.8); ctx.fillRect(0, 0, W, H); }
        const qa = win(t, T.plasmaTxt, T.city[0] + 0.6, 0.4, 0.5);
        text(ctx, 'what if energy were almost free?', 960, 960, { size: 44, family: FONTS.serif, style: 'italic', color: '#ffe6ff', align: 'center', alpha: qa, shadow: 'rgba(200,80,255,0.8)' });
        if (t > T.city[0] - 0.2) { ctx.globalAlpha = seg(t, T.city[0] - 0.2, T.city[0] + 0.8); drawCity(ctx, t); ctx.globalAlpha = 1; }
      } else {
        drawCity(ctx, t);
      }
      // the principle
      const pr = win(t, T.principle, T.cityUp[1], 0.01, 0.8);
      if (pr > 0) {
        const bg = ctx.createLinearGradient(0, 0, 0, 300); bg.addColorStop(0, `rgba(5,3,15,${0.85 * pr})`); bg.addColorStop(1, 'rgba(5,3,15,0)'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, 300);
        revealText(ctx, '人是目的，不是手段。', 960, 140, seg(t, T.principle, T.principle + 1.2), { size: 80, align: 'center', color: '#fff4dc', glow: 'rgba(255,200,87,0.8)', alpha: pr, spacing: 10 });
        text(ctx, 'A person is an end — never merely a means.', 960, 205, { size: 36, family: FONTS.serif, style: 'italic', align: 'center', color: '#ffe8c0', alpha: pr * seg(t, T.principle + 0.9, T.principle + 1.6) });
      }
      // city disc collapses toward the pot (match cut)
      const mc = seg(t, T.potMatch - 0.5, T.potMatch);
      if (mc > 0) { ctx.fillStyle = rgba('#d08a2a', mc * 0.85); ctx.fillRect(0, 0, W, H); }
      po.bloom = 0.9; po.vignette = 0.5;
      post(ctx, po); return;
    }
    // ---------------- kitchen side view (with camera) ----------------
    const cam = track([
      [0, [1.0, 1000, 560]], [2.4, [1.0, 1100, 560]], [3.0, [1.3, 1560, 540]], [3.8, [1.3, 1560, 540]], [4.2, [2.1, 1290, 600]], [6.9, [2.2, 1290, 600]],
      [7.3, [1.55, 980, 560]], [9.0, [1.6, 960, 560]],
      [13.0, [1.35, 1100, 560]], [14.8, [1.3, 1080, 560]], [15.4, [1.6, POT.x, COUNTER - 30]], [T.flameDive[1], [16, POT.x, COUNTER - 16], E.inExpo],
      [T.potMatch + 0.75, [2.4, POT.x, COUNTER - 70]], [T.plate[0] + 0.2, [1.45, 1000, 570], E.outCubic], [T.plate[1], [1.4, 1050, 570]],
      [T.boxes[0], [1.3, 1350, 560]], [T.boxes[1], [1.35, 1420, 560]], [T.end, [1.15, 1250, 560]],
    ])(t);
    // the return from the city: top-down pot crossfade handled by drawing the pot top first
    if (t >= T.potMatch && t < T.potMatch + 1.2) {
      drawPotTop(ctx, t);
      // city lights still glittering on the curry surface
      for (let k = 0; k < 60; k++) { const a = hash(k) * TAU, rr = 400 * Math.sqrt(hash(k + 1)); glow(ctx, 960 + Math.cos(a) * rr, 560 + Math.sin(a) * rr, 18, '#ffe08a', 0.7 * (1 - seg(t, T.potMatch, T.potMatch + 0.8))); }
      ctx.globalAlpha = E.inOutSine(seg(t, T.potMatch + 0.75, T.potMatch + 1.2));
    }
    ctx.save();
    ctx.translate(W / 2, H / 2); ctx.scale(cam[0], cam[0]); ctx.translate(-cam[1], -cam[2]);
    drawKitchen(ctx, t);
    // her
    const { p, wph } = herPose(t);
    const hx = herX(t);
    const bob = wph != null ? walkBob(wph, 0.9) : 0;
    const S = 600, hy = FLOOR - 0.47 * S + bob * S;
    // cat: follows in, sits on the counter edge, steals, guards the moon box
    // cat: waddles in behind her, climbs the pet stairs (step by step), sits on the counter
    const climb = seg(t, 2.35, 3.25);
    let catX, catY;
    if (t < 2.35) { catX = lerp(-300, 2180, E.inOutSine(seg(t, 0, 2.35))); catY = FLOOR; }
    else if (climb < 1) { const step = Math.min(3, Math.floor(climb * 4)); const sub = climb * 4 - step; catX = lerp(2180, 1930, climb); catY = FLOOR - 90 * step - 90 * E.inOutSine(clamp(sub * 1.6)) * (step < 3 ? 1 : (sub < 0.6 ? 1 : 1)); catY = Math.max(COUNTER, catY); }
    else { catX = track([[3.25, 1930], [T.boxes[0], 1930], [T.boxes[1], 1950]])(t); catY = COUNTER; }
    const catOnCounter = t >= 3.25;
    let cs = { t, face: -1, eye: 1 };
    if (t < 2.35) { cs.walk = t * 2.2; cs.face = 1; }
    if (t >= 2.35 && t < 3.25) { cs.walk = t * 3; cs.face = -1; }
    if (t > T.minusShrimp && t < 15.5) { cs.mouth = 'none'; cs.look = [-1, 0]; }
    if (t > T.moonLid + 0.5) { cs.eye = 0.12; }
    drawCat(ctx, catX, catY, 150, cs);
    if (t > T.minusShrimp && t < 15.5) { ctx.strokeStyle = '#ff8a6a'; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(catX - 60, COUNTER - 170, 10, 0.3, 2.6); ctx.stroke(); }
    drawHer(ctx, hx, hy, S, p, { style: STYLE_DAY });
    // knife in hand while chopping
    if (t >= T.chop[0] - 0.2 && t < T.chop[1] + 0.2) {
      const hd = sideHand(p, hx, hy, S);
      ctx.save(); ctx.translate(hd[0], hd[1]); ctx.rotate(0.15);
      ctx.fillStyle = '#2a2a33'; rrect(ctx, -8, -10, 40, 16, 5); ctx.fill();
      ctx.fillStyle = '#dfe6ee'; ctx.beginPath(); ctx.moveTo(30, -12); ctx.lineTo(120, -8); ctx.lineTo(118, 10); ctx.lineTo(30, 8); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    // ladle / plate
    if (t >= T.plate[0]) {
      const pa = seg(t, T.plate[0], T.plate[0] + 0.4);
      const plx = 1080, ply = COUNTER;
      ctx.globalAlpha *= pa;
      ctx.fillStyle = '#f6f2ea'; ctx.beginPath(); ctx.ellipse(plx, ply - 8, 120, 18, 0, 0, TAU); ctx.fill();
      const fill = seg(t, T.plate[0] + 0.5, T.plate[0] + 2.4);
      ctx.fillStyle = '#fbf8f0'; ctx.beginPath(); ctx.ellipse(plx - 30, ply - 18, 60 * Math.min(1, fill * 2), 26 * Math.min(1, fill * 2), 0, Math.PI, 0); ctx.fill();
      if (fill > 0.5) { ctx.fillStyle = '#b8702a'; ctx.beginPath(); ctx.ellipse(plx + 30, ply - 16, 70 * (fill - 0.5) * 2, 22 * (fill - 0.5) * 2, 0, Math.PI, 0); ctx.fill(); }
      for (let k = 0; k < 3; k++) { const u = frac(t * 0.5 + k / 3); ctx.fillStyle = rgba('#ffffff', 0.25 * Math.sin(u * Math.PI) * fill); ctx.beginPath(); ctx.arc(plx + (k - 1) * 30 + Math.sin(u * 5) * 8, ply - 50 - u * 110, 12 + u * 20, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    drawBoxes(ctx, t);
    ctx.restore();
    ctx.globalAlpha = 1;
    // overlays
    planCard(ctx, t, win(t, T.planCard, T.over[0], 0.4, 0.3) + win(t, T.boxes[0], T.moonLid - 0.2, 0.3, 0.4) * 0.0);
    // chop counter
    const ca = win(t, T.chop[0], T.sweep + 0.2, 0.2, 0.3);
    if (ca > 0) {
      let n = 0; for (const c of CHOPS) if (t >= c) n++;
      tag(ctx, 1400, 860, `onion → ${n * 2} pieces · 6 mm ✓`, { size: 28, align: 'center', alpha: ca, dot: '#f2c56a', bg: 'rgba(40,20,10,0.75)' });
    }
    const ra = win(t, T.rice, T.rice + 1.2, 0.1, 0.3);
    if (ra > 0) tag(ctx, 1560, 300, 'rice.start()  ✓', { size: 30, align: 'center', alpha: ra, dot: '#ff6a3a', bg: 'rgba(40,20,10,0.75)' });
    const ft = win(t, T.forThis, T.plate[1] + 0.2, 0.4, 0.5);
    if (ft > 0) text(ctx, 'All that power — for this.', 960, 160, { size: 52, family: FONTS.serif, style: 'italic', color: '#5a2a10', align: 'center', alpha: ft, shadow: 'rgba(255,240,220,0.9)', shadowBlur: 14 });
    // fade in from amber; lights off at the end
    if (t < T.open[1]) { ctx.fillStyle = rgba('#ffb35c', 0.92 * (1 - E.outCubic(seg(t, 0, T.open[1])))); ctx.fillRect(0, 0, W, H); }
    const off = seg(t, T.lightsOff, T.lightsOff + 0.25);
    if (off > 0) { ctx.fillStyle = rgba('#0a0618', 0.75 * off); ctx.fillRect(0, 0, W, H); glow(ctx, -100, 600, 900, '#7a5cff', 0.5 * off * (0.85 + 0.15 * Math.sin(t * 7))); }
    post(ctx, po);
  },
};
