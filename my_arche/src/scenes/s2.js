// Scene 2 — "The animal that can't jump"
// Team chat game: "Which animal can't jump?" She posts a gloriously round cat; everyone laughs.
// Then one small alert: "what if someone takes it personally?" → an alert storm → a monster shadow on the wall.
// She turns the frame: the monster is the shadow of the little cat in front of a floor lamp.
// She drags her ALERT THRESHOLD from "every possible blame" to "how people actually feel". The cat stays.
import { W, H, TAU, clamp, lerp, seg, win, E, track, hash, noise, rgba, mixc, PAL, frac } from '../engine/core.js';
import { glow, circle, ring, line, rrect, text, revealText, bubble, tag, vgrad, FONTS, crescent } from '../engine/draw.js';
import { camera } from '../engine/cam3d.js';
import { drawHer, STYLE_DAY, SIDE_STAND, poseTrack, hairLag, sideHand, sideHead } from '../engine/figure.js';
import { drawCat, catOutline } from '../engine/cat.js';
import { avatar, messageRow, reactionPill, alertCard, slider } from '../engine/ui.js';
import { post } from '../engine/post.js';

const T = {
  lapse0: 0.4, lapse1: 3.0, pull: [1.8, 4.0], whipIn: [3.9, 4.55],
  msgs: [4.9, 5.8, 6.4, 7.0], herPost: 7.9, react: 8.6, replies: [9.2, 9.7, 10.15],
  catLook: 10.35, whipOut: [10.75, 11.4],
  wiggle: 11.5, alert1: 12.2, catFall: 12.75, catLand: 13.25, alerts: [13.2, 13.7, 14.15], storm: 14.6, stormFull: 16.6,
  turnBack: 17.1, recoil: 17.9, grab: 19.6, orbit: [20.1, 22.6], mrrp: 22.9, laugh: 23.6,
  panel: 24.5, flick: 25.5, knob: [25.6, 27.3], principle: 27.6, catBack: [28.6, 31.0],
  wiggleJump: 31.1, hop: 32.0, cantJump: 32.25, scoop: 33.0, lap: 33.7, purr: 33.9, sunset: [33.6, 35.4], end: 36.0,
};
export const cues = { ...T };
export const subs = [
  [4.9, 7.9, '周五小游戏 🎲 —— 什么动物不会跳？ / 蜗牛 🐌 / 大象，严格来说 🐘 / 周一的我', ''],
  [7.9, 10.6, '我：证物 A（一只很圆的猫）· 笑死 · 就是它了 · 绝对的大块头', ''],
  [12.2, 14.6, '万一有人觉得被冒犯了怎么办？/ 万一听起来很刻薄？/ 万一他们以为我在说他们？', ''],
  [22.9, 23.8, '喵呜？', ''],
  [24.5, 27.5, '警报阈值：每一种可能的指责 → 别人真实的感受', ''],
  [29.0, 31.5, '✓ 大家都笑了。不确定的话——直接问。', ''],
  [32.2, 33.2, '（不会跳。）', ''],
];

// ---------------------------------------------------------------------------- the room (3D-lite)
const ZW = -350, FLOOR = 400;
const LAMP = [1150, 384, 150];
// cat path in world: desk -> fall -> waddle to lamp -> back to her chair
function catWorld(t) {
  if (t < T.whipOut[1]) return { x: 330, y: 150, z: 0, s: 1 };
  if (t < T.catFall) return { x: 330, y: 150, z: 0 };
  if (t < T.catLand) { const u = seg(t, T.catFall, T.catLand); return { x: lerp(330, 470, u), y: lerp(150, FLOOR, E.inQuad(u)), z: lerp(0, 10, u), rot: u * 1.6, fall: true }; }
  if (t < 14.4) { const u = E.inOutSine(seg(t, T.catLand + 0.3, 14.4)); return { x: lerp(470, 525, u), y: FLOOR, z: lerp(10, -100, u), walk: u * 3 }; }
  if (t < 18.8) { const u = E.inOutSine(seg(t, 14.4, 18.8)); const z = lerp(-100, 60, u); const k = (ZW - LAMP[2]) / (z - LAMP[2]); return { x: LAMP[0] - 1250 / k, y: FLOOR, z, walk: 3 + u * 7 }; }
  if (t < T.catBack[0]) return { x: 925, y: FLOOR, z: 60 };
  if (t < T.catBack[1]) { const u = E.inOutSine(seg(t, T.catBack[0], T.catBack[1])); return { x: lerp(925, -60, u), y: FLOOR, z: lerp(60, 70, u) + Math.sin(u * Math.PI) * 120, walk: u * 14, face: -1 }; }
  return { x: -60, y: FLOOR, z: 70, face: -1 };
}
function camState(t) {
  const front = { yaw: 0, pitch: 0.02, dist: 1350, tx: -60, ty: -60, tz: 0 };
  const win_ = { yaw: 0, pitch: 0, dist: 640, tx: -450, ty: -270, tz: ZW };
  let c;
  const pu = E.inOutCubic(seg(t, T.pull[0], T.pull[1]));
  c = mixCam(win_, front, pu);
  // storm push-in
  const push = E.inOutSine(seg(t, 13.0, 19.4));
  c = mixCam(c, { yaw: 0, pitch: 0.04, dist: 1180, tx: -150, ty: -140, tz: -60 }, push);
  // the orbit (she turns the frame)
  const ob = E.inOutCubic(seg(t, T.orbit[0], T.orbit[1]));
  c = mixCam(c, { yaw: 0.62, pitch: 0.1, dist: 1700, tx: 380, ty: -60, tz: -40 }, ob);
  // settle back toward a gentle 3/4 view near her chair for the ending
  const back = E.inOutCubic(seg(t, 28.4, 31.4));
  c = mixCam(c, { yaw: 0.16, pitch: 0.05, dist: 1150, tx: -170, ty: 40, tz: 0 }, back);
  return c;
}
function mixCam(a, b, u) { const o = {}; for (const k in a) o[k] = lerp(a[k], b[k], u); return o; }

function dayLight(t) {   // 0 night .. 1 day; storm dims; sunset warms
  const lapse = E.inOutSine(seg(t, T.lapse0, T.lapse1));
  const storm = E.inOutSine(seg(t, 14.4, 16.8)) * (1 - E.inOutSine(seg(t, 25.8, 27.6)));
  const sunset = E.inOutSine(seg(t, T.sunset[0], T.sunset[1]));
  return { lapse, storm, sunset };
}

function skyColors(t) {
  const { lapse, sunset } = dayLight(t);
  const night = ['#0d1a44', '#1b2d5e'], dawn = ['#ffb38a', '#ffe0b8'], day = ['#7ec3ff', '#d6eeff'], dusk = ['#ff8a5c', '#ffd08a'];
  let top, bot;
  if (lapse < 0.5) { const u = lapse * 2; top = mixc(night[0], dawn[0], u); bot = mixc(night[1], dawn[1], u); }
  else { const u = (lapse - 0.5) * 2; top = mixc(dawn[0], day[0], u); bot = mixc(dawn[1], day[1], u); }
  top = mixc(top, dusk[0], sunset); bot = mixc(bot, dusk[1], sunset);
  return [top, bot];
}

function plane(ctx, cam, fn, nu, nv, fill) {
  ctx.fillStyle = fill; ctx.strokeStyle = fill; ctx.lineWidth = 1.5;
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const P = [fn(i / nu, j / nv), fn((i + 1) / nu, j / nv), fn((i + 1) / nu, (j + 1) / nv), fn(i / nu, (j + 1) / nv)].map(p => cam.project(p));
    if (P.some(p => p.s <= 0 || p.z < 60)) continue;
    ctx.beginPath(); P.forEach((p, k) => k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
}
function quad(ctx, cam, pts) {
  const P = pts.map(p => cam.project(p));
  ctx.beginPath(); P.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath();
  return P;
}

function drawRoom(ctx, t, cam, o) {
  const L = dayLight(t);
  const dim = L.storm;
  // wall
  const wallDay = mixc('#e6d6c0', '#f2c79a', L.sunset), wallNight = '#1a2246';
  let wc = mixc(wallNight, wallDay, L.lapse);
  wc = mixc(wc, '#3a3550', dim * 0.75);
  plane(ctx, cam, (u, v) => [lerp(-3000, 9000, u), lerp(-1600, FLOOR, v), ZW], 16, 4, rgba(wc));
  // window + sky
  const wp = quad(ctx, cam, [[-750, -520, ZW + 1], [-150, -520, ZW + 1], [-150, -20, ZW + 1], [-750, -20, ZW + 1]]);
  const [st, sb] = skyColors(t);
  const g = ctx.createLinearGradient(0, wp[0].y, 0, wp[2].y);
  g.addColorStop(0, rgba(mixc(st, '#3a3a5a', dim * 0.6))); g.addColorStop(1, rgba(mixc(sb, '#5a5070', dim * 0.6)));
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  // sun arc + moon set during lapse
  const lu = seg(t, T.lapse0, T.lapse1);
  const mp = cam.project([lerp(-300, -200, lu), lerp(-400, 40, E.inQuad(lu)), ZW + 2]);
  crescent(ctx, mp.x, mp.y, 30 * mp.s, { color: PAL.moon, alpha: 1 - seg(t, 0.4, 2.2) });
  const sunU = seg(t, 1.0, 3.4);
  const sp = cam.project([lerp(-700, -560, sunU), lerp(60, -380, E.outCubic(sunU)) + E.inOutSine(seg(t, T.sunset[0], T.sunset[1])) * 330, ZW + 2]);
  glow(ctx, sp.x, sp.y, 150 * sp.s, '#ffd27a', 0.55 * seg(t, 1.0, 1.6));
  circle(ctx, sp.x, sp.y, 38 * sp.s, '#fff3c4', seg(t, 1.0, 1.6));
  // clouds drift fast during the lapse
  for (let k = 0; k < 5; k++) {
    const cx = -800 + frac(k * 0.31 + t * (t < 3.2 ? 0.25 : 0.01)) * 800, cy = -440 + k * 70;
    const cp = cam.project([cx, cy, ZW + 2]);
    ctx.fillStyle = rgba('#ffffff', 0.55 * L.lapse);
    ctx.beginPath(); ctx.ellipse(cp.x, cp.y, 70 * cp.s, 16 * cp.s, 0, 0, TAU); ctx.fill();
  }
  // city silhouette
  ctx.fillStyle = rgba(mixc('#0a1230', '#9aa9c8', L.lapse * (1 - L.sunset * 0.6)), 1);
  for (let i = 0; i < 16; i++) { const bx = -750 + i * 38, bh = 60 + hash(i + 40) * 120; quad(ctx, cam, [[bx, -20 - bh, ZW + 3], [bx + 34, -20 - bh, ZW + 3], [bx + 34, -20, ZW + 3], [bx, -20, ZW + 3]]); ctx.fill(); }
  ctx.restore();
  // frame
  ctx.strokeStyle = rgba(mixc('#c9b79c', '#2a2440', dim * 0.7)); ctx.lineWidth = 12 * wp[0].s; quad(ctx, cam, [[-750, -520, ZW + 1], [-150, -520, ZW + 1], [-150, -20, ZW + 1], [-750, -20, ZW + 1]]); ctx.stroke();
  const m1 = cam.project([-450, -520, ZW + 1]), m2 = cam.project([-450, -20, ZW + 1]); line(ctx, m1.x, m1.y, m2.x, m2.y, ctx.strokeStyle, 7 * m1.s);
  // wall print: moon phases (a personal symbol)
  quad(ctx, cam, [[260, -470, ZW + 1], [560, -470, ZW + 1], [560, -280, ZW + 1], [260, -280, ZW + 1]]);
  ctx.fillStyle = rgba(mixc('#22264a', '#1a1d38', dim)); ctx.fill();
  for (let k = 0; k < 5; k++) {
    const pp = cam.project([300 + k * 55, -375, ZW + 2]);
    const ph = k / 4;
    if (k === 2) circle(ctx, pp.x, pp.y, 18 * pp.s, '#f4e6c4');
    else crescent(ctx, pp.x, pp.y, 18 * pp.s, { color: '#f4e6c4', k: k < 2 ? 0.6 - k * 0.25 : 0.6 - (4 - k) * 0.25, angle: k < 2 ? -0.1 : Math.PI + 0.1 });
  }
  // shelf + plant
  quad(ctx, cam, [[700, -300, ZW + 1], [1050, -300, ZW + 1], [1050, -285, ZW + 1], [700, -285, ZW + 1]]); ctx.fillStyle = '#b08a64'; ctx.fill();
  const pl = cam.project([800, -300, ZW + 2]);
  ctx.fillStyle = '#5c9a6a';
  for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.ellipse(pl.x + (k - 2) * 14 * pl.s, pl.y - 40 * pl.s, 12 * pl.s, 34 * pl.s, (k - 2) * 0.35, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#d97b52'; rrect(ctx, pl.x - 22 * pl.s, pl.y - 30 * pl.s, 44 * pl.s, 30 * pl.s, 4 * pl.s); ctx.fill();
  // floor
  plane(ctx, cam, (u, v) => [lerp(-3000, 9000, u), FLOOR, lerp(ZW, 2400, v)], 16, 12, rgba(mixc(mixc('#1a1630', '#b8875c', L.lapse), '#3b3048', dim * 0.7)));
  for (let k = 0; k < 9; k++) { const z = ZW + 80 + k * 150; const a = cam.project([-2600, FLOOR, z]), b = cam.project([3200, FLOOR, z]); if (a.s > 0 && b.s > 0 && a.z > 60 && b.z > 60) line(ctx, a.x, a.y, b.x, b.y, 'rgba(0,0,0,0.09)', 2); }
  // baseboard
  const b0 = cam.project([-1800, FLOOR, ZW]), b1 = cam.project([2400, FLOOR, ZW]); line(ctx, b0.x, b0.y, b1.x, b1.y, rgba('#a88a6a', 0.6), 6 * b0.s);
}

// shadow of the cat on the wall, projected from the lamp
function drawShadow(ctx, cam, t, cw, alpha) {
  if (alpha <= 0.01) return null;
  const R = 80;
  const pts = catOutline(R, cw.face || 1);
  const S = pts.map(([px, py]) => {
    const P = [cw.x + px, cw.y + py, cw.z];
    const k = (ZW - LAMP[2]) / (P[2] - LAMP[2]);
    return cam.project([LAMP[0] + (P[0] - LAMP[0]) * k, LAMP[1] + (P[1] - LAMP[1]) * k, ZW + 0.5]);
  });
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowColor = 'rgba(20,10,40,0.9)'; ctx.shadowBlur = 30;
  ctx.fillStyle = 'rgba(30,18,52,0.82)';
  ctx.beginPath(); S.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); ctx.fill();
  ctx.restore();
  // shadow head/eye positions (for monster eyes)
  const kk = (ZW - LAMP[2]) / (cw.z - LAMP[2]);
  const head = [cw.x + R * 0.42 * (cw.face || 1), cw.y - R * 1.55, cw.z];
  const hp = cam.project([LAMP[0] + (head[0] - LAMP[0]) * kk, LAMP[1] + (head[1] - LAMP[1]) * kk, ZW + 1]);
  return { hp, scale: kk * hp.s, S };
}

// light cone from the lamp
function drawBeam(ctx, cam, sh, a) {
  if (!sh || a <= 0.01) return;
  const lp = cam.project(LAMP);
  let minI = 0, maxI = 0;
  sh.S.forEach((p, i) => { if (Math.atan2(p.y - lp.y, p.x - lp.x) < Math.atan2(sh.S[minI].y - lp.y, sh.S[minI].x - lp.x)) minI = i; if (Math.atan2(p.y - lp.y, p.x - lp.x) > Math.atan2(sh.S[maxI].y - lp.y, sh.S[maxI].x - lp.x)) maxI = i; });
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(lp.x, lp.y, 0, lp.x, lp.y, 1400 * lp.s);
  g.addColorStop(0, `rgba(255,214,140,${0.6 * a})`); g.addColorStop(1, 'rgba(255,214,140,0)');
  ctx.fillStyle = g;
  const p1 = sh.S[minI], p2 = sh.S[maxI];
  const ext = (p) => [lp.x + (p.x - lp.x) * 1.35, lp.y + (p.y - lp.y) * 1.35];
  const e1 = ext(p1), e2 = ext(p2);
  ctx.beginPath(); ctx.moveTo(lp.x, lp.y); ctx.lineTo(e1[0], e1[1]); ctx.lineTo(e2[0], e2[1]); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawLamp(ctx, cam, on) {
  const b = cam.project([LAMP[0], FLOOR, LAMP[2]]);
  const s = b.s * 1.6;
  ctx.fillStyle = '#3a3448'; rrect(ctx, b.x - 34 * s, b.y - 12 * s, 68 * s, 12 * s, 4 * s); ctx.fill();
  ctx.save(); ctx.translate(b.x, b.y - 14 * s); ctx.rotate(-0.55);
  ctx.fillStyle = '#4a4258'; ctx.beginPath(); ctx.moveTo(-24 * s, 0); ctx.lineTo(24 * s, 0); ctx.lineTo(16 * s, -44 * s); ctx.lineTo(-16 * s, -44 * s); ctx.closePath(); ctx.fill();
  ctx.fillStyle = rgba('#fff2c8', on); ctx.beginPath(); ctx.ellipse(0, -44 * s, 16 * s, 5 * s, 0, 0, TAU); ctx.fill();
  ctx.restore();
  glow(ctx, b.x - 22 * s, b.y - 46 * s, 160 * s, '#ffd27a', 0.9 * on);
}

// desk, chair, laptop (cutouts at z=0)
function drawDesk(ctx, cam, t, o) {
  const P = (x, y) => cam.project([x, y, 0]);
  const top = quad(ctx, cam, [[-150, 150, 0], [460, 150, 0], [460, 172, 0], [-150, 172, 0]]);
  ctx.fillStyle = '#9a6e4c'; ctx.fill();
  for (const lx of [-120, 420]) { quad(ctx, cam, [[lx, 172, 0], [lx + 18, 172, 0], [lx + 18, FLOOR, 0], [lx, FLOOR, 0]]); ctx.fillStyle = '#7a5538'; ctx.fill(); }
  // chair
  quad(ctx, cam, [[-370, 190, 5], [-170, 190, 5], [-170, 210, 5], [-370, 210, 5]]); ctx.fillStyle = '#4a4060'; ctx.fill();
  quad(ctx, cam, [[-380, -60, 4], [-355, -60, 4], [-355, 210, 4], [-380, 210, 4]]); ctx.fill();
  quad(ctx, cam, [[-280, 210, 5], [-262, 210, 5], [-262, FLOOR, 5], [-280, FLOOR, 5]]); ctx.fill();
  // mug with steam
  const m = P(400, 150);
  ctx.fillStyle = '#e8eef8'; rrect(ctx, m.x - 22 * m.s, m.y - 48 * m.s, 44 * m.s, 48 * m.s, 8 * m.s); ctx.fill();
  ring(ctx, m.x + 26 * m.s, m.y - 26 * m.s, 12 * m.s, '#e8eef8', 6 * m.s);
  // laptop (3/4 view): base + screen face parallelogram
  const sc = laptopScreen(cam);
  ctx.fillStyle = '#5b6380';
  quad(ctx, cam, [[-60, 146, 0], [150, 146, 0], [160, 152, 0], [-70, 152, 0]]); ctx.fill();
  ctx.beginPath(); ctx.moveTo(sc[0].x - 8 * sc[0].s, sc[0].y - 8 * sc[0].s); ctx.lineTo(sc[1].x + 8 * sc[0].s, sc[1].y - 8 * sc[0].s); ctx.lineTo(sc[2].x + 8 * sc[0].s, sc[2].y + 4 * sc[0].s); ctx.lineTo(sc[3].x - 8 * sc[0].s, sc[3].y + 4 * sc[0].s); ctx.closePath();
  ctx.fillStyle = '#2a2f45'; ctx.fill();
  return sc;
}
function laptopScreen(cam) {
  // screen face corners (TL, TR, BR, BL) in world (slightly angled toward camera)
  return [[-20, 30, 30], [140, 44, -20], [140, 145, -20], [-20, 145, 30]].map(p => cam.project(p));
}
// affine transform mapping full frame (0..W,0..H) onto screen parallelogram TL,TR,BL
function frameToQuad(ctx, q) {
  const [tl, tr, br, bl] = q;
  ctx.transform((tr.x - tl.x) / W, (tr.y - tl.y) / W, (bl.x - tl.x) / H, (bl.y - tl.y) / H, tl.x, tl.y);
}

// ---------------------------------------------------------------------------- chat app (full frame)
const PEOPLE = [['Lead', '#7a6cf0'], ['Ana', '#3cb6a0'], ['Ben', '#f08a5c'], ['Chris', '#e0607e']];  // generic, fictional teammates
function drawChat(ctx, t) {
  vgrad(ctx, '#fbf8f4', '#f3eee7');
  // sidebar
  ctx.fillStyle = '#2b2440'; ctx.fillRect(0, 0, 360, H);
  text(ctx, 'workspace', 40, 70, { size: 26, weight: 800, color: '#fff' });
  const chans = ['# general', '# team-fun', '# incident-payments ✓', '# random', '# lunch'];
  chans.forEach((c, i) => {
    if (i === 1) { rrect(ctx, 20, 120 + i * 58 - 30, 320, 48, 10); ctx.fillStyle = '#5b4bb0'; ctx.fill(); }
    text(ctx, c, 40, 120 + i * 58, { size: 24, color: i === 1 ? '#fff' : '#b8b0cc', weight: i === 1 ? 700 : 500 });
  });
  // header
  ctx.fillStyle = '#ffffff'; ctx.fillRect(360, 0, W - 360, 110);
  line(ctx, 360, 110, W, 110, '#e6dfd6', 2);
  text(ctx, '# team-fun', 410, 66, { size: 34, weight: 800, color: '#2b2440' });
  text(ctx, 'Friday game 🎲', 610, 66, { size: 26, color: '#8a8299' });
  text(ctx, 'FRI 15:30', W - 60, 66, { size: 24, color: '#9a93a8', align: 'right', family: FONTS.mono });
  // messages
  const x = 410; let y = 150;
  const rows = [
    [T.msgs[0], 0, 'Friday riddle 🎲  Which animal can\'t jump?', '15:30'],
    [T.msgs[1], 1, 'a snail 🐌', '15:31'],
    [T.msgs[2], 2, 'elephants, technically 🐘', '15:31'],
    [T.msgs[3], 3, 'me on mondays', '15:31'],
  ];
  // scroll up as content grows
  const scroll = E.inOutCubic(seg(t, T.herPost - 0.2, T.herPost + 0.6)) * 250 + E.inOutCubic(seg(t, T.replies[0], T.replies[2] + 0.4)) * 120;
  ctx.save(); ctx.beginPath(); ctx.rect(360, 112, W - 360, H - 112 - 110); ctx.clip();
  ctx.translate(0, -scroll);
  for (const [t0, pi, msg, tm] of rows) {
    const a = seg(t, t0, t0 + 0.25);
    messageRow(ctx, x, y, { alpha: a, rise: seg(t, t0, t0 + 0.35), name: PEOPLE[pi][0], color: PEOPLE[pi][1], text: msg, time: tm, nameW: PEOPLE[pi][0].length * 15 + 20 });
    y += 100;
  }
  // her post with the image
  const ha = seg(t, T.herPost, T.herPost + 0.3);
  if (ha > 0) {
    messageRow(ctx, x, y, { alpha: ha, rise: seg(t, T.herPost, T.herPost + 0.4), name: 'me', kind: 'moon', text: 'exhibit A', time: '15:32', nameW: 60 });
    const ix = x + 78, iy = y + 92, iw = 560, ih = 360;
    const pop = E.outBack(seg(t, T.herPost + 0.1, T.herPost + 0.55));
    ctx.save(); ctx.globalAlpha = ha; ctx.translate(ix + iw / 2, iy + ih / 2); ctx.scale(0.6 + 0.4 * pop, 0.6 + 0.4 * pop); ctx.translate(-(ix + iw / 2), -(iy + ih / 2));
    rrect(ctx, ix, iy, iw, ih, 22); ctx.save(); ctx.clip();
    vgrad(ctx, '#cfe3f5', '#eef3e6', ix, iy, iw, ih);
    ctx.fillStyle = '#b9c9a8'; ctx.fillRect(ix, iy + ih * 0.78, iw, ih * 0.22);
    const look = t > T.catLook ? [1, 0.6] : [0, 0];
    const blink = (frac(t * 0.35) > 0.96 || (t > T.catLook && t < T.catLook + 0.12)) ? 0.1 : 1;
    const out = E.inBack(seg(t, T.whipOut[0] - 0.1, T.whipOut[0] + 0.25));
    drawCat(ctx, ix + iw / 2, iy + ih * 0.86 - out * 30, 210 * (1 + out * 0.5), { t, eye: blink, look, mouth: 'w' });
    ctx.restore();
    ctx.restore();
    // reactions
    const ry = iy + ih + 22;
    const nLaugh = Math.round(lerp(0, 23, E.outCubic(seg(t, T.react, T.react + 1.6))));
    let rx = ix;
    if (nLaugh > 0) rx += reactionPill(ctx, rx, ry, '😂', nLaugh, { pop: 1 + 0.15 * Math.sin(seg(t, T.react, T.react + 1.6) * Math.PI * 6) * (1 - seg(t, T.react + 1.2, T.react + 1.6)), mine: false });
    const n2 = Math.round(lerp(0, 5, seg(t, T.react + 0.4, T.react + 1.4))); if (n2 > 0) rx += reactionPill(ctx, rx, ry, '🏆', n2);
    const n3 = Math.round(lerp(0, 8, seg(t, T.react + 0.6, T.react + 1.5))); if (n3 > 0) rx += reactionPill(ctx, rx, ry, '💀', n3);
    // replies
    const rep = [[T.replies[0], 1, 'LMAO'], [T.replies[1], 2, 'this is the one 😂'], [T.replies[2], 3, 'the absolute unit']];
    let yy = ry + 70;
    for (const [t0, pi, m] of rep) {
      messageRow(ctx, x, yy, { alpha: seg(t, t0, t0 + 0.2), rise: seg(t, t0, t0 + 0.3), name: PEOPLE[pi][0], color: PEOPLE[pi][1], text: m, time: '15:32', nameW: PEOPLE[pi][0].length * 15 + 20 });
      yy += 96;
    }
  }
  ctx.restore();
  // composer
  ctx.fillStyle = '#ffffff'; rrect(ctx, 400, H - 92, W - 450, 64, 16); ctx.fill(); ctx.strokeStyle = '#e0d8ce'; ctx.lineWidth = 2; ctx.stroke();
  text(ctx, 'Message #team-fun', 430, H - 50, { size: 24, color: '#b0a8bc' });
  // emoji burst
  const bt = t - T.react;
  if (bt > 0 && bt < 2.2) {
    for (let i = 0; i < 34; i++) {
      const d = bt - hash(i) * 0.6; if (d <= 0) continue;
      const ang = -Math.PI / 2 + (hash(i + 9) - 0.5) * 2.2;
      const sp = 500 + hash(i + 19) * 700;
      const ex = 410 + 78 + 280 + Math.cos(ang) * sp * d, ey = 150 + 400 + 92 + 180 - 250 + Math.sin(ang) * sp * d + 500 * d * d;
      text(ctx, ['😂', '😂', '😂', '🏆', '💀', '😹'][i % 6], ex, ey, { size: 44 + hash(i + 3) * 30, family: FONTS.emoji, alpha: clamp(1 - d / 1.4), align: 'center' });
    }
  }
}

// ---------------------------------------------------------------------------- her poses (seated, side view)
const SEAT = { ...SIDE_STAND, torso: 0.08, head: 0.12, thF: 1.45, knF: 1.5, thB: 1.4, knB: 1.55, shF: 0.7, elF: 0.95, shB: 0.6, elB: 1.05 };
const POSE = poseTrack([
  [0, SEAT],
  [11.4, SEAT],
  [11.6, { ...SEAT, torso: 0.12, head: -0.05 }], [11.8, { ...SEAT, torso: -0.02, head: 0.1 }], [12.0, { ...SEAT, torso: 0.1, head: -0.05 }],
  [12.25, { ...SEAT, torso: 0.02, head: -0.18, shF: 0.75, elF: 0.8 }, E.outCubic],     // freeze: alert
  [14.5, { ...SEAT, torso: 0.15, head: 0.05, shF: 0.6, elF: 1.2, shB: 0.6, elB: 1.2 }],
  [16.6, { ...SEAT, torso: 0.38, head: 0.32, shF: 0.35, elF: 1.9, shB: 0.3, elB: 1.9 }],  // hunched
  [17.1, { ...SEAT, torso: 0.38, head: 0.32, shF: 0.35, elF: 1.9, shB: 0.3, elB: 1.9 }],
]);
// after she turns to face the wall (flip=true): facing left
const POSE_BACK = poseTrack([
  [17.1, { ...SEAT, torso: 0.0, head: -0.25, shF: 0.5, elF: 1.4, shB: 0.4, elB: 1.4 }],
  [17.9, { ...SEAT, torso: -0.22, head: -0.35, shF: 1.3, elF: 1.6, shB: 1.2, elB: 1.7 }, E.outBack],   // recoil
  [19.4, { ...SEAT, torso: -0.15, head: -0.3, shF: 1.2, elF: 1.5, shB: 1.1, elB: 1.6 }],
]);
const POSE_LATE = poseTrack([
  [19.4, { ...SEAT, torso: -0.05, head: -0.2, shF: 0.9, elF: 0.8 }],
  [19.8, { ...SEAT, torso: 0.0, head: -0.3, shF: 2.6, elF: 0.2, wrF: 0.3 }, E.outCubic],   // reach up: grab the frame
  [20.3, { ...SEAT, torso: 0.05, head: -0.25, shF: 2.5, elF: 0.25 }],
  [22.6, { ...SEAT, torso: 0.05, head: 0.1, shF: 1.0, elF: 0.6 }, E.inOutCubic],         // pull through
  [23.6, { ...SEAT, torso: 0.0, head: 0.15, shF: 0.9, elF: 0.8 }],
  [23.9, { ...SEAT, torso: -0.12, head: -0.35, shF: 0.7, elF: 1.4 }],                   // laugh
  [24.15, { ...SEAT, torso: 0.02, head: -0.05, shF: 0.7, elF: 1.4 }],
  [24.4, { ...SEAT, torso: -0.1, head: -0.3, shF: 0.7, elF: 1.4 }],
  [24.7, { ...SEAT, torso: 0.03, head: 0.0, shF: 0.9, elF: 0.8 }],
  [25.45, { ...SEAT, torso: 0.06, head: 0.05, shF: 1.25, elF: 0.6 }],
  [25.62, { ...SEAT, torso: 0.1, head: 0.05, shF: 1.55, elF: 0.05, wrF: -0.2 }, E.outQuad],  // flick
  [26.3, { ...SEAT, torso: 0.04, head: 0.1, shF: 0.9, elF: 0.7 }],
  [30.8, { ...SEAT, torso: 0.15, head: 0.35, shF: 0.7, elF: 0.6 }],                       // watching the cat
  [33.0, { ...SEAT, torso: 0.7, head: 0.45, shF: 0.25, elF: 0.15, shB: 0.2, elB: 0.2 }],  // scoop
  [33.7, { ...SEAT, torso: 0.08, head: 0.3, shF: 0.75, elF: 1.25, shB: 0.6, elB: 1.4 }],  // cat on lap
  [36.0, { ...SEAT, torso: 0.04, head: 0.25, shF: 0.7, elF: 1.3, shB: 0.6, elB: 1.4 }],
]);
function herPose(t) {
  if (t < 17.1) { const p = POSE(t); p.hairSwing = hairLag(POSE, t, 'torso', 3); return [p, false]; }
  if (t < 19.4) { const p = POSE_BACK(t); p.hairSwing = hairLag(POSE_BACK, t, 'torso', 3); return [p, true]; }
  const p = POSE_LATE(t); p.hairSwing = hairLag(POSE_LATE, t, 'head', 2.5); return [p, false];
}

// ---------------------------------------------------------------------------- alerts storm
const ALERTS_TXT = ['what if someone takes it personally?', 'what if it sounds mean?', 'what if they think I meant them?', 'what if someone is hurt and won\'t say?'];
const NA = 110;
const ALERTS = Array.from({ length: NA }, (_, i) => {
  const ts = i < 4 ? [T.alert1, ...T.alerts][i] : T.storm + 2.0 * Math.pow((i - 4) / (NA - 4), 0.7);
  return { ts, ang: hash(i * 3) * TAU, r: 120 + hash(i * 3 + 1) * 420, sp: (0.25 + hash(i * 3 + 2) * 0.6) * (hash(i + 7) > 0.5 ? 1 : -1), sc: i < 4 ? 0.9 : 0.2 + hash(i + 99) * 0.28, red: hash(i + 5) > 0.6, dis: hash(i + 31) };
});
function drawAlerts(ctx, t, head, knob) {
  for (let i = NA - 1; i >= 0; i--) {
    const A = ALERTS[i];
    const d = t - A.ts; if (d < 0) continue;
    // dissolve as the knob passes this alert's threshold
    const gone = clamp((knob - A.dis * 0.9) / 0.1);
    if (gone >= 1) {
      const sd = (knob - A.dis * 0.9 - 0.1) * 6; if (sd < 1.2) { /* sparkle */ }
      continue;
    }
    const grow = E.outBack(clamp(d / 0.35));
    const storm = E.inOutSine(seg(t, T.storm, T.stormFull));
    let x, y, sc = A.sc * grow, rot = 0;
    if (i < 4) {
      // readable cards stack near her head, then join the swirl
      const sx = head[0] + 260 + (i % 2) * 120, sy = head[1] - 150 - i * 76;
      const ang = A.ang + t * A.sp * 0.6, rr = A.r * 0.6;
      x = lerp(sx, head[0] + Math.cos(ang) * rr * 1.2, storm * 0.9); y = lerp(sy, head[1] + Math.sin(ang) * rr * 0.6, storm * 0.9);
      sc *= lerp(1, 0.75, storm);
    } else {
      const ang = A.ang + t * A.sp;
      const rr = A.r * clamp(d / 1.2) ;
      x = head[0] + 60 + Math.cos(ang) * rr * 1.25; y = head[1] + 40 + Math.sin(ang) * rr * 0.5; rot = Math.sin(ang) * 0.25;
    }
    const calm = 1 - 0.65 * E.inOutSine(seg(t, T.orbit[0], T.orbit[1]));
    const a = (1 - gone) * calm * (i < 4 ? 1 : 0.85);
    alertCard(ctx, x, y, ALERTS_TXT[i] || '', { scale: sc * (1 - gone * 0.5), alpha: a, red: A.red && i >= 4, bars: i >= 4, rot });
    if (gone > 0) glow(ctx, x, y, 60 * (1 + gone), '#fff2b0', gone * 0.8);
  }
}

// ---------------------------------------------------------------------------- render
export default {
  duration: T.end, cues, subs,
  render(ctx, t, info) {
    const frame = info?.frame || 0;
    const po = { bloom: 0.08, vignette: 0.3, grain: 0.045, frame };
    const inChat = t >= T.whipIn[1] && t < T.whipOut[0];
    if (inChat) {
      // ---------------- the chat ----------------
      const punch = 1 + 0.06 * E.inOutSine(seg(t, T.herPost, T.react + 0.6)) - 0.03 * E.inOutSine(seg(t, T.react + 1.0, T.whipOut[0]));
      const settle = 1 + 0.25 * (1 - E.outExpo(seg(t, T.whipIn[1], T.whipIn[1] + 0.5)));
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(punch * settle, punch * settle); ctx.translate(-W / 2, -H / 2 + 20 * E.inOutSine(seg(t, T.herPost, T.react + 0.6)));
      drawChat(ctx, t);
      ctx.restore();
      post(ctx, { ...po, bloom: 0.15, vignette: 0.2 });
      return;
    }
    // ---------------- the room ----------------
    const cs = camState(t);
    const cam = camera({ yaw: cs.yaw, pitch: cs.pitch, dist: cs.dist, fov: 40, target: [cs.tx, cs.ty, cs.tz], cx: 960, cy: 540 });
    // dive transform (whip in / out of the laptop screen)
    let dive = 0;
    if (t >= T.whipIn[0] && t < T.whipIn[1]) dive = E.inExpo(seg(t, T.whipIn[0], T.whipIn[1]));
    if (t >= T.whipOut[0] && t < T.whipOut[1]) dive = 1 - E.outExpo(seg(t, T.whipOut[0], T.whipOut[1]));
    ctx.save();
    if (dive > 0) {
      const q = laptopScreen(cam);
      // map: screen quad -> full frame, interpolated in log-scale
      const sw = Math.hypot(q[1].x - q[0].x, q[1].y - q[0].y), k = Math.pow(W / sw, dive);
      const cx = lerp(W / 2, (q[0].x + q[2].x) / 2, dive), cy = lerp(H / 2, (q[0].y + q[2].y) / 2, dive);
      ctx.translate(W / 2, H / 2); ctx.scale(k, k); ctx.translate(-cx, -cy);
    }
    drawRoom(ctx, t, cam, {});
    const cw = catWorld(t);
    const L = dayLight(t);
    // lamp + shadow (lamp switches on when she freezes)
    const lampOn = seg(t, 12.0, 12.6);
    const sh = drawShadow(ctx, cam, t, cw, lampOn * clamp(0.25 + 0.75 * seg(t, 14.6, 18.0)) * (1 - 0.6 * seg(t, 26.0, 28.0)));
    // monster eyes in the shadow (two red alerts)
    if (sh) {
      const ea = seg(t, 16.4, 17.4) * (1 - seg(t, 21.0, 22.4));
      for (const sgn of [-1, 1]) {
        const ex = sh.hp.x + sgn * 0.24 * 80 * sh.scale, ey = sh.hp.y - 0.02 * 80 * sh.scale;
        glow(ctx, ex, ey, 46 * sh.scale * 0.4, '#ff3b2f', ea);
        circle(ctx, ex, ey, 8 * sh.scale * 0.4, '#ffd0c8', ea);
      }
    }
    drawBeam(ctx, cam, sh, lampOn * (1 - 0.5 * seg(t, 26, 28)) * 0.8);
    drawLamp(ctx, cam, lampOn);
    // desk + laptop screen content
    const sc = drawDesk(ctx, cam, t, {});
    ctx.save(); ctx.beginPath(); ctx.moveTo(sc[0].x, sc[0].y); ctx.lineTo(sc[1].x, sc[1].y); ctx.lineTo(sc[2].x, sc[2].y); ctx.lineTo(sc[3].x, sc[3].y); ctx.closePath(); ctx.clip();
    frameToQuad(ctx, sc);
    drawChat(ctx, Math.min(t, T.whipOut[0] + 0.01));
    ctx.restore();
    glow(ctx, (sc[0].x + sc[2].x) / 2, (sc[0].y + sc[2].y) / 2, 260 * sc[0].s, '#bfe0ff', 0.25);
    // her
    const [pose, flip] = herPose(t);
    const hp = cam.project([-260, 160, 0]);
    const S = 560 * hp.s;
    // cat (on desk / floor / lap)
    const catOnLap = t >= T.scoop;
    const drawTheCat = () => {
      let cx, cy, size, st = { t, face: cw.face || 1 };
      if (catOnLap) {
        const hand = sideHand(pose, hp.x, hp.y, S, flip);
        const lapP = cam.project([-150, 150, 4]);
        const u = E.inOutCubic(seg(t, T.scoop, T.lap));
        const fp = cam.project([-60, FLOOR, 70]);
        cx = lerp(fp.x, lapP.x - 10 * lapP.s, u); cy = lerp(fp.y, lapP.y + 6 * lapP.s, u);
        if (u > 0 && u < 1) { cx = lerp(cx, hand[0], 0.5 * Math.sin(u * Math.PI)); cy = lerp(cy, hand[1] + 40 * lapP.s, 0.5 * Math.sin(u * Math.PI)); }
        size = 160 * lapP.s; st.face = 1; st.eye = t > T.purr ? 0.1 : 1; st.squash = 0.15 * Math.sin(seg(t, T.lap, T.lap + 0.4) * Math.PI);
        st.mouth = 'w'; st.tail = Math.sin(t * 2) * 0.5;
      } else {
        const p = cam.project([cw.x, cw.y, cw.z]);
        cx = p.x; cy = p.y; size = 160 * p.s;
        if (cw.walk != null) st.walk = cw.walk;
        if (cw.fall) { st.squash = -0.2; }
        if (t > T.catLand - 0.02 && t < T.catLand + 0.35) st.squash = 0.6 * Math.sin(seg(t, T.catLand, T.catLand + 0.35) * Math.PI);
        if (t > 18.8 && t < T.mrrp) { st.paw = 0.5 + 0.5 * Math.sin(t * 7); st.eye = 0.15; st.face = -1; }
        if (t >= T.mrrp && t < T.catBack[0]) { st.face = -1; st.look = [-1, 0]; st.mouth = 'o'; st.ear = Math.sin(t * 10) > 0.6 ? 1 : 0; }
        if (t > 12.2 && t < T.catFall) { st.look = [-1, -1]; }
        if (t >= T.wiggleJump && t < T.hop) { st.wiggle = 1; st.squash = 0.2; st.look = [1, -1]; }
        if (t >= T.hop && t < T.hop + 0.3) { cy -= 10 * Math.sin(seg(t, T.hop, T.hop + 0.3) * Math.PI) * p.s; st.squash = -0.15; }
        if (t >= T.hop + 0.3 && t < T.scoop) { st.squash = 0.25 * Math.sin(seg(t, T.hop + 0.3, T.hop + 0.6) * Math.PI); st.look = [1, -1]; st.eye = 1; }
        // pop-out from the screen during the whip-out
        if (t < T.whipOut[1] + 0.25) {
          const u = E.outCubic(seg(t, T.whipOut[0], T.whipOut[1] + 0.25));
          const q = laptopScreen(cam);
          const sx = (q[0].x + q[2].x) / 2, sy = (q[0].y + q[2].y) / 2;
          cx = lerp(sx, cx, u); cy = lerp(sy, cy, u) - Math.sin(u * Math.PI) * 120 * p.s;
          size *= lerp(0.5, 1, u);
          if (u < 1) st.squash = -0.2 * Math.sin(u * Math.PI);
        }
        if (cw.rot) { ctx.save(); ctx.translate(cx, cy - size / 2); ctx.rotate(cw.rot); ctx.translate(-cx, -(cy - size / 2)); drawCat(ctx, cx, cy, size, st); ctx.restore(); return; }
      }
      drawCat(ctx, cx, cy, size, st);
    };
    if (!catOnLap && t >= T.whipOut[0]) drawTheCat();
    drawHer(ctx, hp.x, hp.y, S, pose, { style: STYLE_DAY, flip });
    if (catOnLap) drawTheCat();
    // storm dimming overlay (cold)
    if (L.storm > 0.01) { ctx.fillStyle = rgba('#1a1438', 0.38 * L.storm); ctx.fillRect(-2000, -2000, 6000, 6000); }
    ctx.restore();

    // ---- screen-space overlays ----
    const head = sideHead(pose, hp.x, hp.y, S, flip);
    // knob progress
    const knob = E.outBack(seg(t, T.knob[0], T.knob[1]));
    drawAlerts(ctx, t, head, knob);
    // frame grab: gold border around the whole frame
    const fg = win(t, T.grab - 0.15, T.orbit[1] + 0.3, 0.25, 0.6);
    if (fg > 0) {
      ctx.strokeStyle = rgba(PAL.gold, 0.9 * fg); ctx.lineWidth = 10;
      const tilt = Math.sin(seg(t, T.orbit[0], T.orbit[1]) * Math.PI) * 18;
      ctx.beginPath(); ctx.moveTo(18, 18 + tilt); ctx.lineTo(W - 18, 18 - tilt); ctx.lineTo(W - 18, H - 18 + tilt); ctx.lineTo(18, H - 18 - tilt); ctx.closePath(); ctx.stroke();
      glow(ctx, W - 30, H / 2, 260, PAL.gold, 0.4 * fg);
    }
    // "mrrp?"
    const ma = win(t, T.mrrp, T.mrrp + 1.1, 0.12, 0.3);
    if (ma > 0) {
      const p = cam.project([cw.x, cw.y - 200, cw.z]);
      bubble(ctx, p.x - 40, p.y - 40, 'mrrp?', { size: 34, bg: 'rgba(255,255,255,0.95)', color: '#5a3418', alpha: ma, scale: 0.8 + 0.2 * E.outBack(seg(t, T.mrrp, T.mrrp + 0.3)), family: FONTS.serif });
    }
    // the threshold slider
    const pa = win(t, T.panel, T.principle + 2.4, 0.4, 0.6);
    if (pa > 0) {
      const nAlive = ALERTS.filter(A => t >= A.ts && clamp((knob - A.dis * 0.9) / 0.1) < 1).length;
      slider(ctx, 1240, 860, 640, lerp(0.02, 0.98, clamp(knob)), { alpha: pa * E.outCubic(seg(t, T.panel, T.panel + 0.4)), title: 'ALERT THRESHOLD', left: 'every possible blame', right: 'how people actually feel' });
      text(ctx, `active alerts: ${nAlive}`, 1240, 1010, { size: 22, family: FONTS.mono, color: nAlive > 5 ? '#ffb0a0' : '#9ff0d0', align: 'center', alpha: pa });
    }
    // remaining good alert
    const ga = win(t, 27.4, 31.6, 0.4, 0.5);
    if (ga > 0) {
      const gx = head[0] + 280, gy = head[1] - 120;
      ctx.save(); ctx.globalAlpha = ga; ctx.translate(gx, gy); ctx.scale(0.9 + 0.1 * E.outBack(seg(t, 27.4, 27.8)), 0.9 + 0.1 * E.outBack(seg(t, 27.4, 27.8)));
      rrect(ctx, -10, -36, 520, 72, 18); ctx.fillStyle = '#e4fbf1'; ctx.fill(); ctx.strokeStyle = '#38c9a0'; ctx.lineWidth = 3; ctx.stroke();
      text(ctx, '✓  they laughed. if unsure — ask.', 22, 10, { size: 28, weight: 600, color: '#1d5a48' });
      ctx.restore();
    }
    // her principle
    const pr = win(t, T.principle, T.catBack[1] + 0.4, 0.01, 0.7);
    if (pr > 0) {
      ctx.fillStyle = rgba('#fff8ee', 0.0);
      revealText(ctx, '在乎真实的感受，而不是每一种可能的指责。', 960, 120, seg(t, T.principle, T.principle + 1.5), { size: 56, align: 'center', color: '#2b2440', alpha: pr, spacing: 3, glow: 'rgba(255,255,255,0.9)' });
      text(ctx, 'Care about how people actually feel — not every blame you can imagine.', 960, 180, { size: 32, family: FONTS.serif, style: 'italic', align: 'center', color: '#3a3050', alpha: pr * seg(t, T.principle + 1.0, T.principle + 1.8), shadow: 'rgba(255,255,255,0.9)', shadowBlur: 12 });
    }
    // "(cannot jump)"
    const cj = win(t, T.cantJump, T.scoop + 0.3, 0.15, 0.3);
    if (cj > 0) { const p = cam.project([-60, FLOOR - 230, 70]); tag(ctx, p.x, p.y, '(cannot jump.)', { size: 26, align: 'center', alpha: cj, bg: 'rgba(255,255,255,0.9)', color: '#5a3418', border: 'rgba(90,52,24,0.3)' }); }
    // time-lapse clock
    const ca = 1 - seg(t, 3.4, 4.0);
    if (ca > 0) {
      const tl = seg(t, T.lapse0, T.lapse1);
      const mins = Math.round(lerp(3 * 60 + 41, 15 * 60 + 30, E.inOutSine(tl)));
      const hh = String(Math.floor(mins / 60)).padStart(2, '0'), mm = String(mins % 60).padStart(2, '0');
      text(ctx, (tl > 0.98 ? 'FRI ' : '') + `${hh}:${mm}`, 70, 1010, { size: 30, family: FONTS.mono, color: tl > 0.5 ? '#5a4a6a' : '#a9b8e8', alpha: ca * seg(t, 0.2, 0.6), spacing: 2 });
    }
    // purr
    const pa2 = win(t, T.purr, T.end, 0.3, 0.6);
    if (pa2 > 0) { const lp = cam.project([-150, 70, 4]); text(ctx, 'purr', lp.x + 40, lp.y - 30 - 10 * Math.sin(t * 3), { size: 30, family: FONTS.serif, style: 'italic', color: '#8a5a3a', alpha: pa2 * 0.8 }); }
    // sunset amber flood at the very end (light wipe into the kitchen)
    const am = seg(t, T.end - 1.0, T.end);
    po.fade = seg(t, 0, T.lapse0 + 0.2);
    post(ctx, po);
    if (am > 0) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = rgba('#ffb35c', E.inCubic(am) * 0.92); ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore(); }
  },
};
