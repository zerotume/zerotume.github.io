// Scene 4 — "The raid"
// Headset on; through the monitor into an original fantasy arena. A colossal celestial lion.
// Orange danger telegraphs fill in time with the music; she (the archer with the moon clip) reads the pattern
// and dodges with absurd precision. Someone stands in the fire: "sorry lol". Final charged shot.
// The defeated boss sits down… and purrs. The round cat boops its nose. Victory emote: she draws her bow — hold —
import { W, H, TAU, clamp, lerp, seg, win, E, track, hash, noise, rgba, mixc, PAL, frac } from '../engine/core.js';
import { glow, circle, ring, line, rrect, text, revealText, tag, bubble, vgrad, FONTS, crescent } from '../engine/draw.js';
import { camera } from '../engine/cam3d.js';
import { drawHer, STYLE_NIGHT, STYLE_AVATAR, SIDE_STAND, poseTrack, hairLag, sideHead, archeryPose, drawBow } from '../engine/figure.js';
import { drawCat, CAT_NIGHT } from '../engine/cat.js';
import { post } from '../engine/post.js';

const BPM = 132, BEAT = 60 / BPM;
const T = {
  headset: [0.6, 1.6], ready: 1.8, dive: [2.6, 3.4], roar: 3.9,
  cone: [4.6, 6.0], spread: [6.3, 7.7], donut: [7.9, 9.2], lines: [9.4, 11.2], death: 11.2, sorry: 11.5, raise: [12.0, 12.8],
  enrage: [13.0, 15.6], stack: 13.6, meteor: 15.6, final: [16.2, 19.0], charge: [16.8, 18.4], release: 18.4, hit: 18.75,
  soften: [19.4, 21.8], boop: 22.4, purr: 21.6, victory: 23.6, loot: 24.4, chat2: [24.8, 25.6, 26.4],
  emote: [27.0, 29.0], hold: 29.0, end: 32.0,
};
export const cues = { ...T, bpm: BPM };
export const subs = [
  [3.9, 6.0, '星鬃 · 星落咆哮', ''],
  [11.5, 12.8, '抱歉哈哈', ''], [12.6, 13.4, '谢谢奶妈 🙏', ''],
  [13.0, 15.6, '狂暴：超新星 —— 集合分摊！', ''],
  [22.0, 23.6, '呼噜呼噜……', ''],
  [23.6, 27.0, '胜利 · 获得：星鬃玩偶 ×1 · gg · 这一箭 🏹 · 等等，BOSS 在……打呼噜？', ''],
];

// ---------------------------------------------------------------------------- arena geometry
const R = 600;                     // arena radius (world)
const BOSS = [0, 0, -R - 60];
// party slots: 0 = her (archer). roles: tank, tank, healer, healer, dps x4
const PARTY = [
  { role: 'her', col: '#ffc857' }, { role: 'tank', col: '#5a8cff' }, { role: 'tank', col: '#5a8cff' }, { role: 'heal', col: '#4ad48a' },
  { role: 'heal', col: '#4ad48a' }, { role: 'dps', col: '#ff6a5a' }, { role: 'dps', col: '#ff6a5a' }, { role: 'dps', col: '#ff6a5a' },
];
const P = (r, a) => [Math.cos(a) * r, 0, Math.sin(a) * r];
// formations (x,z in world); the arena centre is 0,0; boss is at -z
const FORM = {
  start: [[0, 250], [0, -260], [60, -240], [-120, 120], [120, 120], [-220, 60], [220, 60], [-80, 200]],
  cone: [[-360, 140], [-430, -60], [420, -60], [-300, 300], [330, 280], [-480, 200], [470, 170], [380, 330]],    // sides
  spread: [[-300, 340], [-120, -320], [200, -300], [-420, 40], [400, -40], [80, 420], [380, 260], [-180, 100]],
  donut: [[40, 30], [-20, -60], [40, -50], [-50, 40], [60, 60], [-60, -10], [10, 70], [-30, 80]],                 // centre
  lines: [[-200, 120], [-200, -150], [-200, -60], [180, 40], [180, 160], [180, -100], [-200, 250], [60, 200]],  // two safe lanes x=-200 / 180 (dps 7 wrong)
  stack: [[0, 160], [30, 120], [-30, 120], [40, 200], [-40, 200], [60, 160], [-60, 160], [0, 220]],
  final: [[0, 260], [-40, -200], [40, -200], [-160, 120], [160, 120], [-260, 60], [260, 60], [-100, 200]],
};
const MOVES = [
  [0, 'start'], [T.cone[0] + 0.55, 'cone'], [T.spread[0] + 0.5, 'spread'], [T.donut[0] + 0.5, 'donut'], [T.lines[0] + 0.6, 'lines'],
  [T.enrage[0] + 0.9, 'stack'], [T.final[0] + 0.5, 'final'],
];
function partyPos(i, t) {
  // her: moves later than everyone and lands exactly on time (perfect dodges)
  let prev = FORM.start[i], cur = FORM.start[i], u = 1;
  for (let k = 1; k < MOVES.length; k++) {
    const [tm, f] = MOVES[k];
    const late = i === 0 ? 0.35 : 0.0;
    if (t >= tm - 0.6 + late) {
      prev = FORM[MOVES[k - 1][1]][i]; cur = FORM[f][i];
      u = E.inOutCubic(seg(t, tm - 0.6 + late, tm + (i === 0 ? 0.05 : 0.0) + late * 0.4));
    }
  }
  let x = lerp(prev[0], cur[0], u), z = lerp(prev[1], cur[1], u);
  // the dead dps (7) gets launched off at T.death, raised at T.raise
  if (i === 7) {
    const d = seg(t, T.death, T.death + 0.7);
    if (d > 0 && t < T.raise[1]) { x += d * 380; z += d * 260; }
  }
  return [x, 0, z];
}

// ---------------------------------------------------------------------------- drawing helpers
function groundPoly(ctx, cam, pts) {
  const Q = pts.map(p => cam.project([p[0], 0, p[1]]));
  ctx.beginPath(); Q.forEach((q, k) => k ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); ctx.closePath();
}
function telegraph(ctx, cam, shape, prog, snapT, a = 1) {
  // prog: fill 0..1 ; snapT: time since snap (<0 before)
  const orange = '#ff8a1c';
  const flash = snapT >= 0 ? Math.exp(-snapT * 6) : 0;
  const alive = snapT < 0 ? 1 : Math.max(0, 1 - snapT * 3);
  if (alive <= 0 && flash <= 0.01) return;
  ctx.save();
  const draw = (fn) => { fn(); ctx.fillStyle = rgba(orange, (0.18 + 0.12 * prog) * a * alive); ctx.fill(); ctx.strokeStyle = rgba('#ffb35c', 0.9 * a * alive); ctx.lineWidth = 3; ctx.stroke(); };
  const fillTo = (fn) => { fn(); ctx.fillStyle = rgba('#ff6a00', 0.35 * a * alive); ctx.fill(); };
  if (shape.type === 'cone') {
    const { ang, half, len } = shape;
    const pts = (L) => { const o = [[BOSS[0], BOSS[2] + 120]]; for (let k = 0; k <= 16; k++) { const a2 = ang - half + (2 * half) * k / 16; o.push([BOSS[0] + Math.cos(a2) * L, BOSS[2] + 120 + Math.sin(a2) * L]); } return o; };
    draw(() => groundPoly(ctx, cam, pts(len)));
    fillTo(() => groundPoly(ctx, cam, pts(len * prog)));
  } else if (shape.type === 'circle') {
    const pts = (rr) => Array.from({ length: 28 }, (_, k) => [shape.x + Math.cos(k / 28 * TAU) * rr, shape.z + Math.sin(k / 28 * TAU) * rr]);
    draw(() => groundPoly(ctx, cam, pts(shape.r)));
    fillTo(() => groundPoly(ctx, cam, pts(shape.r * prog)));
  } else if (shape.type === 'donut') {
    const ring_ = (r0, r1) => { const o = []; for (let k = 0; k <= 40; k++) o.push([Math.cos(k / 40 * TAU) * r1, Math.sin(k / 40 * TAU) * r1]); for (let k = 40; k >= 0; k--) o.push([Math.cos(k / 40 * TAU) * r0, Math.sin(k / 40 * TAU) * r0]); return o; };
    draw(() => groundPoly(ctx, cam, ring_(shape.r0, shape.r1)));
    fillTo(() => groundPoly(ctx, cam, ring_(shape.r1 - (shape.r1 - shape.r0) * prog, shape.r1)));
  } else if (shape.type === 'line') {
    const { x0, w } = shape;
    draw(() => groundPoly(ctx, cam, [[x0 - w / 2, -R], [x0 + w / 2, -R], [x0 + w / 2, R], [x0 - w / 2, R]]));
    fillTo(() => groundPoly(ctx, cam, [[x0 - w / 2, -R], [x0 + w / 2, -R], [x0 + w / 2, -R + 2 * R * prog], [x0 - w / 2, -R + 2 * R * prog]]));
  }
  if (flash > 0.01) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rgba('#ffd27a', 0.6 * flash * a); ctx.fill();
  }
  ctx.restore();
}

function token(ctx, x, y, s, member, o = {}) {
  const a = o.alpha ?? 1; if (a <= 0.01) return;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.scale(s, s);
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(0, 0, 26, 9, 0, 0, TAU); ctx.fill();
  if (member.role === 'her') {
    ring(ctx, 0, 0, 34, PAL.gold, 3, 0.9);
    // her avatar: robe + long hair + moon clip + bow
    ctx.fillStyle = '#2a3266'; ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(16, 0); ctx.lineTo(10, -46); ctx.lineTo(-10, -46); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#1b1420'; ctx.beginPath(); ctx.ellipse(0, -48, 13, 26, 0, Math.PI, 0); ctx.fill(); ctx.fillRect(-13, -50, 26, 26);
    ctx.fillStyle = '#ebc7a8'; ctx.beginPath(); ctx.arc(0, -58, 11, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1b1420'; ctx.beginPath(); ctx.arc(0, -61, 12, Math.PI * 1.05, -0.05); ctx.fill();
    crescent(ctx, 8, -66, 5, { color: PAL.gold });
    ctx.strokeStyle = '#d9a46a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(18, -34, 22, -1.2, 1.2); ctx.stroke();
    line(ctx, 18 + Math.cos(-1.2) * 22, -34 + Math.sin(-1.2) * 22, 18 + Math.cos(1.2) * 22, -34 + Math.sin(1.2) * 22, '#fff', 1);
  } else {
    ctx.fillStyle = member.col; ctx.beginPath(); ctx.moveTo(-15, 0); ctx.lineTo(15, 0); ctx.lineTo(9, -40); ctx.lineTo(-9, -40); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ebd2b8'; ctx.beginPath(); ctx.arc(0, -50, 10, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.arc(0, -53, 11, Math.PI, 0); ctx.fill();
    if (member.role === 'tank') { ctx.fillStyle = '#c8d4ff'; rrect(ctx, 10, -34, 12, 22, 4); ctx.fill(); }
    if (member.role === 'heal') { ctx.strokeStyle = '#d0ffe0'; ctx.lineWidth = 3; line(ctx, 16, -10, 16, -54, '#d0ffe0', 3); circle(ctx, 16, -56, 5, '#aaffcc'); }
    if (member.role === 'dps') { line(ctx, 14, -8, 24, -44, '#ffe0d0', 3); }
  }
  ctx.restore();
}

// the celestial lion (raid boss); soft 0..1 morphs into a purring big kitty
function drawBoss(ctx, x, y, s, t, soft, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const roar = o.roar || 0, sit = o.sit || 0;
  const breathe = Math.sin(t * 1.4) * 4;
  // aura
  glow(ctx, 0, -380, 900, soft > 0.5 ? '#ffb0d8' : '#6a5cff', 0.35);
  // mane rays
  const nR = 26;
  for (let k = 0; k < nR; k++) {
    const a = -Math.PI / 2 + (k / nR - 0.5) * Math.PI * 1.7 + Math.sin(t * 2 + k) * 0.03 * (1 - soft);
    const l1 = lerp(330 + 90 * hash(k), 260 + 20 * hash(k), soft) + roar * 60, w = lerp(60, 120, soft);
    const cx = 0, cy = -420 + sit * 60;
    ctx.fillStyle = rgba(mixc('#3a2a8a', '#f0a8d0', soft), 0.9);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a - 0.12) * 120, cy + Math.sin(a - 0.12) * 120);
    if (soft < 0.5) ctx.lineTo(cx + Math.cos(a) * l1, cy + Math.sin(a) * l1);
    else ctx.quadraticCurveTo(cx + Math.cos(a) * l1 * 1.2, cy + Math.sin(a) * l1 * 1.2, cx + Math.cos(a + 0.12) * 120, cy + Math.sin(a + 0.12) * 120);
    ctx.lineTo(cx + Math.cos(a + 0.12) * 120, cy + Math.sin(a + 0.12) * 120); ctx.closePath(); ctx.fill();
    if (soft < 0.6) { circle(ctx, cx + Math.cos(a) * l1, cy + Math.sin(a) * l1, 5, '#e6ecff', 0.9 * (1 - soft)); }
  }
  // body (sphinx-like) + paws
  ctx.fillStyle = '#1e1a4e';
  ctx.beginPath(); ctx.ellipse(0, -140 + sit * 30, 420, 230 - sit * 20, 0, Math.PI, 0); ctx.fill();
  for (const sgn of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sgn * 190, -30, 90, 60, 0, 0, TAU); ctx.fill(); }
  // star field on the body
  for (let k = 0; k < 40; k++) circle(ctx, (hash(k + 400) - 0.5) * 760, -40 - hash(k + 500) * 300, 2 + hash(k) * 3, '#dfe6ff', 0.6 + 0.4 * Math.sin(t * 3 + k));
  // head
  const hy = -420 + sit * 60 + breathe;
  ctx.fillStyle = rgba(mixc('#272066', '#ffd6e8', soft * 0.25));
  ctx.beginPath(); ctx.ellipse(0, hy, 170, 150 + roar * 10, 0, 0, TAU); ctx.fill();
  // ears
  for (const sgn of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sgn * 90, hy - 110); ctx.lineTo(sgn * (150 + soft * 10), hy - 210 + soft * 20); ctx.lineTo(sgn * 160, hy - 80); ctx.closePath(); ctx.fill(); }
  // constellation lines across the face
  const st = [[-90, hy - 30], [-40, hy - 60], [0, hy + 10], [40, hy - 60], [90, hy - 30], [0, hy + 60]];
  ctx.strokeStyle = rgba('#9fb4ff', 0.6 * (1 - soft)); ctx.lineWidth = 2.5;
  ctx.beginPath(); [0, 1, 2, 3, 4].forEach((i, k) => k ? ctx.lineTo(st[i][0], st[i][1]) : ctx.moveTo(st[i][0], st[i][1])); ctx.moveTo(st[2][0], st[2][1]); ctx.lineTo(st[5][0], st[5][1]); ctx.stroke();
  // eyes: fierce glow -> happy ^ ^
  for (const sgn of [-1, 1]) {
    const ex = sgn * 62, ey = hy - 18;
    if (soft < 0.5) { glow(ctx, ex, ey, 70, '#ffe08a', 0.9 * (1 - soft * 2)); ctx.fillStyle = '#fff6c8'; ctx.beginPath(); ctx.ellipse(ex, ey, 26, 12 - roar * 4, sgn * 0.2, 0, TAU); ctx.fill(); }
    else { ctx.strokeStyle = '#3a2050'; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(ex, ey + 10, 24, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke(); }
  }
  // muzzle / mouth
  ctx.fillStyle = rgba(mixc('#3a3290', '#fff0f4', soft)); ctx.beginPath(); ctx.ellipse(0, hy + 60, 70, 46, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = soft > 0.5 ? '#ff9ab0' : '#c8b8ff'; ctx.beginPath(); ctx.moveTo(-18, hy + 36); ctx.lineTo(18, hy + 36); ctx.lineTo(0, hy + 54); ctx.closePath(); ctx.fill();
  if (roar > 0.05 && soft < 0.5) { ctx.fillStyle = '#120a2a'; ctx.beginPath(); ctx.ellipse(0, hy + 84, 46, 34 * roar, 0, 0, TAU); ctx.fill(); }
  else { ctx.strokeStyle = '#3a2050'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, hy + 54); ctx.quadraticCurveTo(-16, hy + 80, -34, hy + 66); ctx.moveTo(0, hy + 54); ctx.quadraticCurveTo(16, hy + 80, 34, hy + 66); ctx.stroke(); }
  if (soft > 0.5) { for (const sgn of [-1, 1]) circle(ctx, sgn * 110, hy + 40, 26, '#ff9ab0', 0.45 * (soft - 0.5) * 2); }
  // whiskers
  ctx.strokeStyle = rgba('#dfe6ff', 0.7); ctx.lineWidth = 3;
  for (const sgn of [-1, 1]) for (const k of [-1, 0, 1]) { ctx.beginPath(); ctx.moveTo(sgn * 50, hy + 60 + k * 10); ctx.lineTo(sgn * 190, hy + 40 + k * 26); ctx.stroke(); }
  ctx.restore();
}

// ---------------------------------------------------------------------------- the room (opening)
function drawRoom(ctx, t) {
  vgrad(ctx, '#0b0820', '#05040e');
  // monitor glow
  const mx = 1180, my = 470;
  glow(ctx, mx, my, 900, '#7a5cff', 0.4);
  ctx.fillStyle = '#0c0a18'; rrect(ctx, mx - 330, my - 200, 660, 380, 16); ctx.fill();
  ctx.fillStyle = '#16123a'; rrect(ctx, mx - 310, my - 182, 620, 344, 8); ctx.fill();
  // screen content: arena preview
  ctx.save(); ctx.beginPath(); rrect(ctx, mx - 310, my - 182, 620, 344, 8); ctx.clip();
  vgrad(ctx, '#1a1450', '#0a0820', mx - 310, my - 182, 620, 344);
  ctx.fillStyle = '#2a2470'; ctx.beginPath(); ctx.ellipse(mx, my + 90, 240, 70, 0, 0, TAU); ctx.fill();
  drawBoss(ctx, mx, my + 20, 0.22, t, 0);
  const rd = seg(t, T.ready, T.ready + 0.4);
  if (rd > 0) { text(ctx, 'READY CHECK  ✓✓✓✓✓✓✓✓', mx, my - 120, { size: 30, family: FONTS.mono, color: '#9ff0d0', align: 'center', alpha: rd }); }
  ctx.restore();
  line(ctx, mx, my + 180, mx, my + 250, '#0c0a18', 22); ctx.fillStyle = '#0c0a18'; rrect(ctx, mx - 90, my + 245, 180, 16, 6); ctx.fill();
  // desk
  ctx.fillStyle = '#141028'; ctx.fillRect(500, 730, 1300, 24); ctx.fillRect(560, 754, 20, 330); ctx.fillRect(1720, 754, 20, 330);
  // keyboard with RGB
  ctx.fillStyle = '#1e1a3a'; rrect(ctx, 960, 712, 300, 20, 6); ctx.fill();
  for (let k = 0; k < 12; k++) { ctx.fillStyle = `hsl(${(k * 30 + t * 120) % 360},90%,60%)`; ctx.globalAlpha = 0.6; ctx.fillRect(972 + k * 24, 716, 16, 4); } ctx.globalAlpha = 1;
}
const SEAT = { ...SIDE_STAND, torso: 0.1, head: 0.05, thF: 1.45, knF: 1.5, thB: 1.4, knB: 1.55, shF: 0.8, elF: 0.9, shB: 0.7, elB: 1.0 };
const ROOM_POSE = poseTrack([
  [0, SEAT],
  [T.headset[0], { ...SEAT, shF: 2.6, elF: 1.6, shB: 2.4, elB: 1.7, head: -0.05 }, E.inOutCubic],
  [T.headset[1], { ...SEAT, shF: 2.5, elF: 1.8, shB: 2.3, elB: 1.8, head: 0.05 }],
  [2.1, { ...SEAT, shF: 0.9, elF: 0.6, head: 0.0, torso: 0.18 }, E.inOutCubic],
]);

// ---------------------------------------------------------------------------- emote close-up (match-cut source)
export const EMOTE_FRAME = { x: 760, y: 800, s: 640, aim: 0.55 };
function drawEmote(ctx, t, frame) {
  vgrad(ctx, '#1a0c44', '#05030f');
  for (let k = 0; k < 220; k++) circle(ctx, hash(k) * W, hash(k + 300) * H, 1 + hash(k + 600) * 1.8, '#dfe6ff', 0.3 + 0.6 * Math.abs(Math.sin(t * (0.5 + hash(k)) + k)));
  crescent(ctx, 1520, 230, 110, { color: PAL.moon, k: 0.45, inner: 0.88 }); glow(ctx, 1520, 230, 420, '#c8d0ff', 0.35);
  // platform edge + party silhouettes far below
  ctx.fillStyle = '#2a2458'; ctx.beginPath(); ctx.ellipse(900, 1260, 1500, 330, 0, Math.PI, 0); ctx.fill();
  ctx.strokeStyle = '#8a7cff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(900, 1260, 1500, 330, 0, Math.PI, 0); ctx.stroke();
  for (let k = 0; k < 12; k++) glow(ctx, 900 + Math.cos(Math.PI + k / 11 * Math.PI) * 1350, 1260 + Math.sin(Math.PI + k / 11 * Math.PI) * 300, 40, '#9a8cff', 0.6);
  const raise = E.inOutCubic(seg(t, T.emote[0] + 0.2, T.emote[0] + 1.0));
  const dr = E.inOutCubic(seg(t, T.emote[0] + 0.9, T.hold));
  const F = EMOTE_FRAME;
  const pose = archeryPose(F.aim * raise, dr);
  pose.hairSwing = 0.35 + 0.25 * Math.sin(t * 2.3);
  pose.breath = 0.5 + 0.5 * Math.sin(t * 1.4);
  const zoom = 1 + 0.05 * E.inOutSine(seg(t, T.emote[0], T.end));
  ctx.save(); ctx.translate(F.x, F.y); ctx.scale(zoom, zoom); ctx.translate(-F.x, -F.y);
  glow(ctx, F.x + 40, F.y - 300, 520, '#7a5cff', 0.35);
  drawHer(ctx, F.x, F.y, F.s, pose, { style: STYLE_AVATAR, rim: { color: '#c8b8ff', dx: 1, dy: -0.8, width: 4 }, halo: 0.25 });
  const out = {};
  drawBow(ctx, pose, F.x, F.y, F.s, { drawn: dr, wood: '#d9a46a', string: 'rgba(255,240,200,0.9)', out });
  if (out.tip) { const gl = 0.4 + 0.6 * seg(t, T.end - 1.2, T.end); glow(ctx, out.tip[0], out.tip[1], 60 + 140 * gl, PAL.gold, gl); }
  ctx.restore();
  text(ctx, 'victory emote: /moonshot', 70, 1010, { size: 26, family: FONTS.mono, color: '#bfb0ff', alpha: win(t, T.emote[0] + 0.5, T.end, 0.3, 0.6) * 0.8 });
  post(ctx, { bloom: 0.7, vignette: 0.5, grain: 0.05, frame });
}

// ---------------------------------------------------------------------------- render
export default {
  duration: T.end, cues, subs,
  render(ctx, t, info) {
    const frame = info?.frame || 0;
    const po = { bloom: 0.75, vignette: 0.55, grain: 0.05, frame };
    if (t < T.dive[1]) {
      // ---------------- room + dive ----------------
      const dz = E.inExpo(seg(t, T.dive[0], T.dive[1]));
      const k = Math.pow(W / 620, dz);
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(k, k); ctx.translate(-lerp(W / 2, 1180, dz), -lerp(H / 2, 470, dz));
      drawRoom(ctx, t);
      const pose = ROOM_POSE(t); pose.hairSwing = hairLag(ROOM_POSE, t, 'shF', 0.5);
      drawHer(ctx, 700, 760, 600, pose, { style: STYLE_NIGHT, rim: { color: '#a58aff', dx: 1, dy: -0.3, width: 4 }, halo: 0.2 });
      // headset
      const hd = sideHead(pose, 700, 760, 600);
      const on = seg(t, T.headset[0] + 0.5, T.headset[1]);
      const hy = lerp(hd[1] - 160, hd[1], E.outCubic(on));
      ctx.strokeStyle = '#1a1830'; ctx.lineWidth = 14; ctx.beginPath(); ctx.arc(hd[0] - 4, hy, 62, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
      ctx.fillStyle = '#1a1830'; rrect(ctx, hd[0] - 32, hy - 10, 40, 56, 14); ctx.fill();
      circle(ctx, hd[0] - 12, hy + 18, 6, '#a58aff', 0.9); glow(ctx, hd[0] - 12, hy + 18, 30, '#a58aff', 0.6);
      // the cat asleep by the keyboard (warm electronics)
      drawCat(ctx, 1480, 730, 150, { t, curl: 0.85, style: CAT_NIGHT });
      ctx.restore();
      post(ctx, { ...po, fade: seg(t, 0, 0.5) });
      return;
    }
    if (t >= T.emote[0]) { drawEmote(ctx, t, frame); return; }
    // ---------------- the arena ----------------
    const shake = (() => { let s = 0; for (const [tt, a] of [[T.roar, 14], [T.meteor, 22], [T.hit, 18]]) { const d = t - tt; if (d > 0 && d < 0.6) s += Math.sin(d * 70) * a * (1 - d / 0.6); } return s; })();
    const zoomHer = E.inOutCubic(seg(t, T.final[0], T.charge[0])) * (1 - E.inOutCubic(seg(t, T.release, T.hit + 0.3)));
    const emoteZ = E.inOutCubic(seg(t, T.emote[0], T.hold + 1.0));
    const her = partyPos(0, t);
    const cam = camera({
      yaw: Math.sin(t * 0.25) * 0.18 + 0.2 * E.inOutSine(seg(t, T.soften[0], T.victory)),
      pitch: -lerp(0.78, 0.5, zoomHer) + 0.25 * emoteZ - 0.12 * (1 - E.outCubic(seg(t, T.dive[1], T.dive[1] + 1.4))),
      dist: lerp(lerp(1900, 1250, zoomHer), 900, emoteZ) + 900 * (1 - E.outCubic(seg(t, T.dive[1], T.dive[1] + 1.4))),
      fov: 45, target: [lerp(lerp(0, her[0], zoomHer * 0.6), her[0], emoteZ), lerp(-60, -40, zoomHer) - 120 * emoteZ, lerp(lerp(-60, her[2] - 100, zoomHer * 0.6), her[2], emoteZ)], cx: 960 + shake, cy: 720,
    });
    // void + stars + moon
    vgrad(ctx, '#140a3a', '#05030f');
    for (let k = 0; k < 160; k++) circle(ctx, hash(k) * W, hash(k + 300) * H * 0.8, 1 + hash(k + 600) * 1.6, '#dfe6ff', 0.3 + 0.5 * Math.abs(Math.sin(t * (0.5 + hash(k)) + k)));
    crescent(ctx, 1640, 170, 60, { color: PAL.moon, k: 0.45, inner: 0.88 }); glow(ctx, 1640, 170, 260, '#c8d0ff', 0.3);
    // boss behind the arena
    const bp = cam.project(BOSS);
    const soft = E.inOutCubic(seg(t, T.soften[0], T.soften[1]));
    const roar = Math.sin(seg(t, T.roar, T.roar + 1.0) * Math.PI) + Math.sin(seg(t, T.enrage[0], T.enrage[0] + 1.2) * Math.PI) * 0.8;
    const hitFl = t > T.hit ? Math.exp(-(t - T.hit) * 4) : 0;
    const BS = 0.78 + 0.25 * zoomHer, headY = 285 + (bp.y - 330) * 0.45;
    const BY = headY + 420 * BS;
    drawBoss(ctx, bp.x, BY, BS, t, soft, { roar: roar * (1 - soft), sit: soft });
    // platform (disc + tiles + runes)
    const disc = Array.from({ length: 64 }, (_, k) => [Math.cos(k / 64 * TAU) * R, Math.sin(k / 64 * TAU) * R]);
    // underside rim
    ctx.save(); ctx.translate(0, 34 * bp.s * 1.5); groundPoly(ctx, cam, disc); ctx.fillStyle = '#120c2c'; ctx.fill(); ctx.restore();
    groundPoly(ctx, cam, disc); ctx.fillStyle = '#2a2458'; ctx.fill(); ctx.strokeStyle = '#8a7cff'; ctx.lineWidth = 4; ctx.stroke();
    ctx.strokeStyle = 'rgba(160,150,255,0.25)'; ctx.lineWidth = 2;
    for (let k = 1; k < 4; k++) { groundPoly(ctx, cam, disc.map(([x, z]) => [x * k / 4, z * k / 4])); ctx.stroke(); }
    for (let k = 0; k < 16; k++) { const a = k / 16 * TAU, p0 = cam.project([Math.cos(a) * R * 0.25, 0, Math.sin(a) * R * 0.25]), p1 = cam.project([Math.cos(a) * R, 0, Math.sin(a) * R]); line(ctx, p0.x, p0.y, p1.x, p1.y, 'rgba(160,150,255,0.18)', 2); }
    // runes glow (cracks during enrage)
    const crack = seg(t, T.meteor - 0.1, T.meteor + 0.3) * (1 - seg(t, T.final[0], T.final[0] + 1.5));
    for (let k = 0; k < 12; k++) { const a = k / 12 * TAU + 0.13, p = cam.project([Math.cos(a) * R * 0.88, 0, Math.sin(a) * R * 0.88]); glow(ctx, p.x, p.y, 40, crack > 0 ? '#ff8a1c' : '#9a8cff', 0.5 + crack * 0.5); }
    // telegraphs
    const tel = [];
    tel.push([T.cone, { type: 'cone', ang: Math.PI / 2, half: 0.5, len: R * 1.9 }]);
    PARTY.forEach((m, i) => { if (i === 0 || i === 1 || i === 3 || i === 6) { const pp = FORM.spread[i]; tel.push([T.spread, { type: 'circle', x: pp[0], z: pp[1], r: 120 }]); } });
    tel.push([T.donut, { type: 'donut', r0: 170, r1: R }]);
    for (const x0 of [-420, 0, 400]) tel.push([T.lines, { type: 'line', x0, w: 260 }]);
    for (const [[a, b], sh] of tel) {
      if (t < a || t > b + 0.4) continue;
      telegraph(ctx, cam, sh, clamp((t - a) / (b - a)), t - b);
    }
    // her analysis overlay: safe spots + path (cyan graph)
    const ana = [[T.cone, 'cone'], [T.spread, 'spread'], [T.lines, 'lines']];
    for (const [[a, b], f] of ana) {
      const aa = win(t, a + 0.1, b, 0.2, 0.25);
      if (aa <= 0) continue;
      const target = FORM[f][0];
      const tp = cam.project([target[0], 0, target[1]]), hp_ = cam.project(her);
      ctx.setLineDash([10, 8]); line(ctx, hp_.x, hp_.y, tp.x, tp.y, rgba('#5fe0ff', 0.9), 3, aa); ctx.setLineDash([]);
      ring(ctx, tp.x, tp.y, 30 + 6 * Math.sin(t * 10), '#5fe0ff', 3, aa);
      // other safe nodes
      for (let k = 1; k < 8; k++) { const q = FORM[f][k], qp = cam.project([q[0], 0, q[1]]); circle(ctx, qp.x, qp.y, 5, '#5fe0ff', aa * 0.6); }
      tag(ctx, tp.x, tp.y - 110, 'safe', { size: 20, align: 'center', alpha: aa, dot: '#5fe0ff', bg: 'rgba(5,10,30,0.7)' });
    }
    // stack marker over her during enrage
    const sa = win(t, T.stack, T.meteor + 0.2, 0.2, 0.2);
    // tokens (back to front)
    const order = PARTY.map((m, i) => ({ i, p: partyPos(i, t) })).map(o => ({ ...o, q: cam.project(o.p) })).sort((a, b) => b.q.z - a.q.z);
    for (const { i, q } of order) {
      const m = PARTY[i];
      let alpha = 1, s = q.s * 1.4;
      if (i === 7) { const d = seg(t, T.death, T.death + 0.7); if (d > 0 && t < T.raise[1]) alpha = 1 - d; if (t >= T.raise[0] && t < T.raise[1] + 0.3) alpha = seg(t, T.raise[0] + 0.4, T.raise[1]); }
      let dy = 0;
      if (i === 0 && t >= T.emote[0]) { dy = 0; }
      token(ctx, q.x, q.y + dy, s * (i === 0 ? 1.15 : 1), m, { alpha });
      if (i === 0 && sa > 0) {
        for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + t * 2; const rr = 60 + 10 * Math.sin(t * 8); ctx.save(); ctx.translate(q.x + Math.cos(a) * rr * s, q.y - 40 * s + Math.sin(a) * rr * s * 0.5); ctx.rotate(a + Math.PI); ctx.fillStyle = rgba('#ffd27a', sa); ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(16, 0); ctx.lineTo(0, 10); ctx.closePath(); ctx.fill(); ctx.restore(); }
      }
    }
    // death poof + raise beam
    const dp = cam.project(partyPos(7, Math.min(t, T.death + 0.1)));
    const dd = t - T.death;
    if (dd > 0 && dd < 0.8) { for (let k = 0; k < 10; k++) { const a = k / 10 * TAU; circle(ctx, dp.x + Math.cos(a) * dd * 160, dp.y - 40 + Math.sin(a) * dd * 100, 14 * (1 - dd), '#ffd0b0', 1 - dd / 0.8); } }
    const rb = win(t, T.raise[0], T.raise[1] + 0.3, 0.15, 0.3);
    if (rb > 0) { const hp3 = cam.project(partyPos(3, t)), tp = cam.project(partyPos(7, t)); line(ctx, hp3.x, hp3.y - 40, tp.x, tp.y - 40, '#7affb0', 6, rb); glow(ctx, tp.x, tp.y - 40, 90, '#7affb0', rb); }
    // meteor (enrage resolution): shared gold shield holds
    const md = t - T.meteor;
    if (md > -0.6 && md < 1.2) {
      const hq = cam.project([0, 0, 160]);
      if (md < 0) { const u = 1 + md / 0.6; const mx = lerp(hq.x + 900, hq.x, u), my = lerp(hq.y - 900, hq.y - 40, u); glow(ctx, mx, my, 160, '#ff8a3a', 1); circle(ctx, mx, my, 40, '#fff0c8'); line(ctx, mx, my, mx + 300 * (1 - u) + 120, my - 300 * (1 - u) - 120, 'rgba(255,160,80,0.6)', 30, 1); }
      else { const u = clamp(md / 1.2); ring(ctx, hq.x, hq.y - 40, 120 + u * 420, PAL.gold, 12 * (1 - u), 1 - u); glow(ctx, hq.x, hq.y - 40, 300, '#ffe08a', (1 - u) * 0.9); }
      if (md >= 0 && md < 0.9) { ctx.save(); ctx.beginPath(); ctx.ellipse(hq.x, hq.y - 40, 180, 110, 0, 0, TAU); ctx.strokeStyle = rgba(PAL.gold, 0.9 * (1 - md / 0.9)); ctx.lineWidth = 6; ctx.stroke(); ctx.fillStyle = rgba('#ffe08a', 0.18 * (1 - md / 0.9)); ctx.fill(); ctx.restore(); }
    }
    // final charged shot
    const hq = cam.project(her);
    const ch = seg(t, T.charge[0], T.charge[1]);
    if (ch > 0 && t < T.release + 0.05) { glow(ctx, hq.x + 30 * hq.s, hq.y - 60 * hq.s * 1.4, 60 + 160 * ch, PAL.gold, 0.4 + 0.6 * ch); for (let k = 0; k < 10; k++) { const a = k / 10 * TAU + t * 4; circle(ctx, hq.x + Math.cos(a) * (140 - 120 * ch), hq.y - 70 + Math.sin(a) * (80 - 60 * ch), 4, '#fff2b0', ch); } }
    const fly = seg(t, T.release, T.hit);
    if (fly > 0 && fly < 1) {
      const bx = bp.x, by = BY - 400 * BS;
      const ax = lerp(hq.x, bx, E.inQuad(fly)), ay = lerp(hq.y - 70, by, E.inQuad(fly));
      line(ctx, lerp(hq.x, ax, 0.4), lerp(hq.y - 70, ay, 0.4), ax, ay, PAL.gold, 8, 1); glow(ctx, ax, ay, 120, PAL.gold, 1);
    }
    if (hitFl > 0.01) { ctx.fillStyle = rgba('#fff4d0', hitFl * 0.55); ctx.fillRect(0, 0, W, H); }
    // round cat boops the boss's nose
    const ca = seg(t, T.soften[1] - 0.4, T.soften[1] + 0.3);
    if (ca > 0) {
      const nose = [bp.x, BY - (420 - 60 - 40) * BS];
      const cx = lerp(nose[0] + 380, nose[0] + 120, E.outCubic(seg(t, T.soften[1] - 0.4, T.boop - 0.2))), cy = nose[1] + 150;
      const paw = Math.sin(seg(t, T.boop - 0.2, T.boop + 0.4) * Math.PI);
      drawCat(ctx, cx, cy, 130, { t, face: -1, paw, alpha: ca, look: [-1, -1] });
      if (t > T.boop && t < T.boop + 0.6) ring(ctx, nose[0] + 40, nose[1] + 40, 20 + (t - T.boop) * 120, '#ffffff', 4, 1 - (t - T.boop) / 0.6);
    }
    // purr text
    const pr = win(t, T.purr, T.victory + 0.4, 0.3, 0.4);
    if (pr > 0) text(ctx, 'p u r r r r r', bp.x + Math.sin(t * 40) * 3, 250, { size: 64, family: FONTS.serif, style: 'italic', weight: 600, color: '#ffd6ec', align: 'center', alpha: pr, shadow: 'rgba(255,120,200,0.8)' });
    // ---- game UI ----
    const ui = 1 - seg(t, T.victory, T.victory + 0.4);
    const hpv = clamp(1 - seg(t, T.roar, T.enrage[0]) * 0.55 - seg(t, T.enrage[0], T.meteor + 0.6) * 0.36 - seg(t, T.release, T.hit) * 0.09);
    if (ui > 0.01) {
      ctx.save(); ctx.globalAlpha = ui * seg(t, T.dive[1], T.dive[1] + 0.5);
      text(ctx, 'THE STARMANE', 960, 40, { size: 30, weight: 800, color: '#f0e6ff', align: 'center', spacing: 6, family: FONTS.serif });
      rrect(ctx, 560, 52, 800, 18, 9); ctx.fillStyle = 'rgba(20,10,40,0.85)'; ctx.fill();
      rrect(ctx, 562, 54, 796 * hpv, 14, 7); ctx.fillStyle = hpv < 0.12 ? '#ff5a4a' : '#c84ad8'; ctx.fill();
      text(ctx, `${(hpv * 100).toFixed(1)}%`, 1380, 68, { size: 20, family: FONTS.mono, color: '#e0d0ff' });
      const casts = [[T.roar, T.cone[1], 'Starfall Roar'], [T.spread[0], T.spread[1], 'Comet Scatter'], [T.donut[0], T.donut[1], 'Halo of Night'], [T.lines[0], T.lines[1], 'Meridian Lances'], [T.enrage[0], T.meteor, 'ENRAGE: Supernova']];
      for (const [a, b, nmx] of casts) { if (t < a || t > b) continue; const u = (t - a) / (b - a); rrect(ctx, 760, 82, 400, 12, 6); ctx.fillStyle = 'rgba(20,10,40,0.8)'; ctx.fill(); rrect(ctx, 760, 82, 400 * u, 12, 6); ctx.fillStyle = nmx.startsWith('ENRAGE') ? '#ff5a3a' : '#ffb35c'; ctx.fill(); text(ctx, nmx, 960, 120, { size: 24, color: nmx.startsWith('ENRAGE') ? '#ffb0a0' : '#ffe0b8', align: 'center', weight: 600 }); }
      // party list
      PARTY.forEach((m, i) => { const yy = 300 + i * 46; const dead = i === 7 && t > T.death && t < T.raise[1]; rrect(ctx, 40, yy, 220, 34, 8); ctx.fillStyle = 'rgba(10,8,30,0.7)'; ctx.fill(); circle(ctx, 62, yy + 17, 9, dead ? '#555' : m.col); rrect(ctx, 82, yy + 12, 160 * (dead ? 0 : 1), 10, 5); ctx.fillStyle = dead ? '#555' : '#7affb0'; ctx.fill(); if (i === 0) text(ctx, '☾', 248, yy + 25, { size: 22, color: PAL.gold }); });
      ctx.restore();
    }
    // party chat
    const chat = [[T.sorry, 'sorry lol', '#ff6a5a'], [T.raise[1] - 0.2, 'ty heals 🙏', '#ff6a5a'], [T.chat2[0], 'gg', '#5a8cff'], [T.chat2[1], 'that arrow tho 🏹', '#4ad48a'], [T.chat2[2], 'wait… is the boss purring?', '#ff6a5a']];
    let cy = 900;
    const shown = chat.filter(c => t >= c[0] && t < T.hold + 0.5);
    for (const [t0, msg, col] of shown.slice(-3)) { const a = seg(t, t0, t0 + 0.2) * (1 - seg(t, T.hold, T.hold + 0.5)); rrect(ctx, 40, cy, 440, 44, 10); ctx.fillStyle = rgba('#0a081e', 0.7 * a); ctx.fill(); circle(ctx, 64, cy + 22, 8, col, a); text(ctx, msg, 84, cy + 31, { size: 24, color: '#f0eaff', alpha: a }); cy += 52; }
    // perfect pops
    for (const tp of [T.cone[1], T.spread[1], T.lines[1]]) { const a = win(t, tp - 0.02, tp + 0.7, 0.05, 0.3); if (a > 0) { const q = cam.project(her); text(ctx, 'PERFECT', q.x, q.y - 150 - (t - tp) * 60, { size: 30, weight: 900, color: PAL.gold, align: 'center', alpha: a, spacing: 4, stroke: 'rgba(40,20,0,0.8)', strokeWidth: 5 }); } }
    // victory + loot
    const va = win(t, T.victory, T.emote[0] + 0.5, 0.15, 0.5);
    if (va > 0) {
      const sc = 1 + 0.4 * (1 - E.outBack(seg(t, T.victory, T.victory + 0.5)));
      ctx.save(); ctx.translate(960, 360); ctx.scale(sc, sc);
      text(ctx, 'VICTORY', 0, 0, { size: 120, weight: 900, color: '#fff2c8', align: 'center', alpha: va, spacing: 18, family: FONTS.serif, shadow: 'rgba(255,200,87,0.9)', shadowBlur: 40 });
      ctx.restore();
      const la = seg(t, T.loot, T.loot + 0.3) * va;
      if (la > 0) tag(ctx, 960, 450, '★ obtained: Starmane plushie ×1', { size: 28, align: 'center', alpha: la, dot: PAL.gold, bg: 'rgba(20,10,40,0.85)', border: 'rgba(255,200,87,0.6)' });
    }
    post(ctx, po);
  },
};
