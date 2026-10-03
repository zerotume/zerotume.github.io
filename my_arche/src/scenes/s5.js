// Scene 5 — "Release"
// Match cut: the game avatar's draw becomes her real draw, at an archery range at golden hour.
// She lowers the aim from the sky to the target. Stillness: breath, a slowed world, a quiet trajectory model
// that she lets go of. Release — the camera whips with the arrow — X-ring.
// Then a push into the gold centre while the sky turns to night: the gold becomes the moon.
import { W, H, TAU, clamp, lerp, seg, win, E, track, hash, noise, rgba, mixc, PAL, frac } from '../engine/core.js';
import { glow, circle, ring, line, rrect, text, tag, vgrad, FONTS, crescent, drawMoon } from '../engine/draw.js';
import { drawHer, STYLE_DAY, archeryPose, drawBow, hairLag } from '../engine/figure.js';
import { post } from '../engine/post.js';

const T = { lower: [1.0, 2.8], still: [3.0, 6.6], model: [3.4, 5.4], letGo: [5.4, 6.2], release: 6.6, hit: 7.55, score: 7.8, lowerBow: [8.2, 9.4], push: [9.4, 13.6], moon: [12.6, 16.0], end: 16.0 };
export const cues = { ...T };
export const subs = [[3.6, 5.6, '风 ← 2 米/秒 · 下坠 18 厘米', ''], [7.8, 9.4, '10 环 · X（正中）', '']];

const F = { x: 760, y: 800, s: 640 };   // same framing as the game emote (match cut)
const TARGET_X = 4300;                  // world x of the target (her at F.x)

// time dilation during the held breath: world motion slows
function tau(t) { const a = T.still[0], b = T.release; if (t < a) return t; if (t < b) return a + (t - a) * 0.18; return a + (b - a) * 0.18 + (t - b); }

function sky(ctx, t) {
  const night = E.inOutSine(seg(t, T.push[0] + 0.6, T.moon[0] + 1.6));
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, rgba(mixc('#7a6ab8', '#0a0f2e', night))); g.addColorStop(0.45, rgba(mixc('#ff9e8a', '#1a2050', night))); g.addColorStop(0.75, rgba(mixc('#ffd29a', '#2a2a5a', night)));
  ctx.fillStyle = g; ctx.fillRect(-4000, -2000, 14000, 4200);
  return night;
}

function world(ctx, t, camX) {
  const tt = tau(t);
  const night = sky(ctx, t);
  // sun low on the horizon, behind the target
  const sunX = 1500 - camX * 0.05, sunY = 640 + seg(t, T.push[0], T.moon[0]) * 260;
  glow(ctx, sunX, sunY, 700, '#ffcf8a', 0.7 * (1 - night)); circle(ctx, sunX, sunY, 70, '#fff1c8', 1 - night);
  // stars when night falls
  if (night > 0.05) for (let k = 0; k < 150; k++) circle(ctx, hash(k) * W, hash(k + 50) * 620, 1 + hash(k + 90) * 1.5, '#e6ecff', night * (0.4 + 0.5 * Math.abs(Math.sin(t * 2 + k))));
  // far hills (slow parallax)
  for (const [par, col, hgt, sd] of [[0.08, '#b88aa8', 120, 1], [0.18, '#9a6a8a', 90, 2], [0.35, '#6a4a6a', 60, 3]]) {
    ctx.fillStyle = rgba(mixc(col, '#10142e', night));
    ctx.beginPath(); ctx.moveTo(-2000, H + 600);
    for (let x = -2000; x <= 6400; x += 50) { const wx = x + camX * par; ctx.lineTo(x, 760 - hgt * (0.5 + 0.5 * noise(wx / 400, sd)) - 40); }
    ctx.lineTo(6400, H + 600); ctx.closePath(); ctx.fill();
  }
  // tree line
  ctx.fillStyle = rgba(mixc('#4a3050', '#0a0c22', night));
  for (let k = 0; k < 70; k++) { const wx = k * 140 - (camX * 0.55) % 140 - 1400; const h0 = 80 + 60 * hash(k + Math.floor(camX * 0.55 / 140)); ctx.beginPath(); ctx.ellipse(wx, 760 - h0 * 0.5, 70, h0 * 0.6, 0, 0, TAU); ctx.fill(); }
  // ground
  ctx.fillStyle = rgba(mixc('#c9a060', '#141a30', night)); ctx.fillRect(-4000, 760, 14000, 900);
  ctx.fillStyle = rgba(mixc('#a88048', '#10142a', night)); ctx.fillRect(-4000, 880, 14000, 800);
  // grass blades (fast parallax), sway slowed by tau
  ctx.strokeStyle = rgba(mixc('#8a7a3a', '#1a2038', night)); ctx.lineWidth = 3;
  for (let k = 0; k < 220; k++) {
    const wx = ((hash(k) * 3000 - camX * 1.0) % 3000 + 3000) % 3000 - 500, by = 860 + hash(k + 7) * 220;
    const sw = Math.sin(tt * 2.2 + k) * 10;
    ctx.beginPath(); ctx.moveTo(wx, by); ctx.quadraticCurveTo(wx + sw * 0.5, by - 20, wx + sw, by - 34 - hash(k + 3) * 20); ctx.stroke();
  }
  // shooting line marker
  const lx = F.x + 60 - camX;
  if (lx > -50 && lx < W + 50) { ctx.fillStyle = rgba('#fff4e0', 0.6 * (1 - night)); ctx.fillRect(lx - 4, 850, 8, 120); }
  // drifting dust motes / a leaf that hangs in the air during the breath
  for (let k = 0; k < 24; k++) { const x = ((hash(k) * W * 1.5 + tt * 40) % (W * 1.5)) - camX * 0.9 % W, y = 300 + hash(k + 11) * 450 + Math.sin(tt + k) * 20; glow(ctx, ((x % W) + W) % W, y, 10, '#fff2c0', 0.5 * (1 - night)); }
  return night;
}

function drawTarget(ctx, x, y, s, t, night) {
  // stand
  ctx.strokeStyle = rgba(mixc('#6a4a2a', '#1a1428', night)); ctx.lineWidth = 12 * s;
  line(ctx, x - 60 * s, y + 150 * s, x - 20 * s, y + 40 * s, ctx.strokeStyle, 12 * s); line(ctx, x + 60 * s, y + 150 * s, x + 20 * s, y + 40 * s, ctx.strokeStyle, 12 * s);
  const rings = ['#f4f1ea', '#f4f1ea', '#1e1e24', '#1e1e24', '#3a8ad8', '#3a8ad8', '#e8473a', '#e8473a', '#ffcf3a', '#ffcf3a'];
  for (let k = 0; k < 10; k++) {
    const r = (100 - k * 10) * s;
    circle(ctx, x, y, r, rgba(mixc(rings[k], k >= 8 ? '#fff4d6' : '#1a1a2a', night * (k >= 8 ? 0.9 : 0.6))));
    ring(ctx, x, y, r, rgba('#000000', 0.25), Math.max(1, 1.2 * s));
  }
  ring(ctx, x, y, 5 * s, rgba('#000000', 0.4), Math.max(1, 1.2 * s));   // X ring
}

export default {
  duration: T.end, cues, subs,
  render(ctx, t, info) {
    const frame = info?.frame || 0;
    // camera: x offset (pan with the arrow), zoom
    const fly = E.inOutCubic(seg(t, T.release, T.hit));
    const camX = lerp(0, TARGET_X - 1080, fly);
    const pushIn = seg(t, T.push[0], T.push[1]);
    const zoom = (1 + 0.1 * E.inOutSine(seg(t, 0, T.release))) * (t > T.hit ? lerp(1, 1.9, E.outCubic(seg(t, T.hit, T.hit + 0.6))) : 1) * Math.pow(30, E.inCubic(pushIn));
    const tx = TARGET_X - camX, ty = 520;
    // zoom centre: her (before release), then the target
    const zc = t < T.hit ? [lerp(F.x + 120, tx, fly), lerp(560, ty, fly)] : [tx, ty];
    ctx.save();
    ctx.translate(W / 2, H / 2); ctx.scale(zoom, zoom); ctx.translate(-zc[0] + (t < T.hit ? (zc[0] - W / 2) * (1 - fly) : 0), -zc[1] + (t < T.hit ? (zc[1] - H / 2) * (1 - fly) : 0));
    const night = world(ctx, t, camX);
    // target (far right in the wide shot)
    drawTarget(ctx, tx, ty, 1.0, t, night);
    // the arrow in flight / stuck
    const rel = t - T.release;
    if (rel >= 0) {
      if (t < T.hit) {
        const ax = lerp(F.x + 230, tx - 40, E.inOutCubic(seg(t, T.release, T.hit))) - camX * 0 , ay = lerp(560, ty, E.inOutCubic(seg(t, T.release, T.hit))) - Math.sin(seg(t, T.release, T.hit) * Math.PI) * 30;
        const axs = ax - camX * 0;
        line(ctx, axs - 140, ay, axs, ay, '#e8dcc0', 6); ctx.fillStyle = PAL.gold; ctx.beginPath(); ctx.moveTo(axs + 22, ay); ctx.lineTo(axs, ay - 7); ctx.lineTo(axs, ay + 7); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ff7a6a'; ctx.beginPath(); ctx.moveTo(axs - 140, ay); ctx.lineTo(axs - 110, ay - 12); ctx.lineTo(axs - 100, ay); ctx.lineTo(axs - 110, ay + 12); ctx.closePath(); ctx.fill();
        // speed lines
        for (let k = 0; k < 14; k++) line(ctx, axs - 200 - hash(k) * 600, ay + (hash(k + 4) - 0.5) * 160, axs - 160 - hash(k) * 300, ay + (hash(k + 4) - 0.5) * 160, rgba('#ffffff', 0.5), 2);
        glow(ctx, axs, ay, 60, PAL.gold, 0.7);
      } else {
        const vib = Math.sin((t - T.hit) * 60) * Math.exp(-(t - T.hit) * 5) * 6;
        const ax = tx - 4, ay = ty;
        ctx.save(); ctx.translate(ax, ay); ctx.rotate(vib * 0.01);
        line(ctx, -150, vib, 0, 0, '#e8dcc0', 6);
        ctx.fillStyle = '#ff7a6a'; ctx.beginPath(); ctx.moveTo(-150, vib); ctx.lineTo(-120, vib - 12); ctx.lineTo(-110, vib); ctx.lineTo(-120, vib + 12); ctx.closePath(); ctx.fill();
        ctx.restore();
        const hf = Math.exp(-(t - T.hit) * 6);
        ring(ctx, tx, ty, 10 + (t - T.hit) * 300, '#fff4d0', 4, hf);
      }
    }
    // her (side view, same framing as the emote), only while the camera is near her
    if (camX < 1400) {
      const lowerU = E.inOutCubic(seg(t, T.lower[0], T.lower[1]));
      const aim = lerp(0.55, 0.06, lowerU);
      let drawAmt = 1;
      const relU = seg(t, T.release, T.release + 0.12);
      let pose = archeryPose(aim, drawAmt);
      if (t >= T.release) {
        // follow-through: draw hand flies back past the ear, bow arm drops slightly
        pose = { ...pose, shF: pose.shF - 0.5 * E.outCubic(relU), elF: pose.elF - 0.5 * E.outCubic(relU), shB: pose.shB - 0.08 * relU };
      }
      const lb = E.inOutCubic(seg(t, T.lowerBow[0], T.lowerBow[1]));
      if (lb > 0) pose = { ...pose, shB: lerp(pose.shB, 0.35, lb), shF: lerp(pose.shF, 0.2, lb), elF: lerp(pose.elF, 0.3, lb), head: lerp(pose.head, 0.05, lb), torso: lerp(pose.torso, 0.02, lb) };
      pose.hairSwing = 0.15 * Math.sin(tau(t) * 2.0) + (t > T.release ? 0.4 * Math.exp(-(t - T.release) * 3) : 0);
      pose.breath = 0.5 + 0.5 * Math.sin(tau(t) * 1.3);
      drawHer(ctx, F.x - camX, F.y, F.s, pose, { style: STYLE_DAY, rim: { color: '#ffd9a0', dx: 1, dy: -0.3, width: 5 }, halo: 0.25 });
      const out = {};
      drawBow(ctx, pose, F.x - camX, F.y, F.s, { drawn: t < T.release ? 1 : 1 - relU, arrow: t < T.release, wood: '#7a4a2a', string: 'rgba(255,250,235,0.95)', out });
      // gold string glow during the breath
      const gs = win(t, T.still[0], T.release, 0.8, 0.05);
      if (gs > 0 && out.tip) glow(ctx, out.tip[0], out.tip[1], 50 + 40 * gs, PAL.gold, gs * 0.8);
      // trajectory model (her analysis) -> she lets it go
      const ma = win(t, T.model[0], T.letGo[1], 0.6, 0.8);
      if (ma > 0 && out.tip) {
        ctx.save(); ctx.setLineDash([16, 10]); ctx.strokeStyle = rgba('#2a5aff', 0.95 * ma); ctx.lineWidth = 5;
        ctx.beginPath(); for (let k = 0; k <= 40; k++) { const u = k / 40; const x = lerp(out.tip[0], tx - 40, u), y = lerp(out.tip[1], ty, u) - Math.sin(u * Math.PI) * 30; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); ctx.restore();
        tag(ctx, out.tip[0] + 360, out.tip[1] - 70, 'wind ← 2 m/s · drop 18 cm', { size: 22, alpha: ma, dot: '#5fe0ff', bg: 'rgba(20,10,30,0.55)' });
      }
    }
    ctx.restore();
    // score tag
    const sa = win(t, T.score, T.push[0] + 0.6, 0.15, 0.4);
    if (sa > 0) tag(ctx, 960, 200, '10 · X', { size: 44, align: 'center', alpha: sa, dot: '#ffcf3a', bg: 'rgba(30,15,10,0.7)', border: 'rgba(255,207,58,0.7)' });
    // the gold centre becomes the moon
    const mo = seg(t, T.moon[0], T.moon[0] + 1.6);
    if (mo > 0) {
      ctx.fillStyle = rgba('#0a0f2e', mo * 0.92); ctx.fillRect(0, 0, W, H);
      for (let k = 0; k < 180; k++) circle(ctx, hash(k + 700) * W, hash(k + 800) * H, 1 + hash(k + 900) * 1.6, '#e6ecff', mo * (0.3 + 0.5 * Math.abs(Math.sin(t * 1.5 + k))));
      const mr = lerp(700, 300, E.outCubic(seg(t, T.moon[0], T.end)));
      const ph = E.inOutSine(seg(t, T.moon[0] + 1.0, T.end - 0.3));
      glow(ctx, 960, 540, mr * 2.4, '#c8d4ff', 0.4 * mo * (1 - 0.4 * ph));
      drawMoon(ctx, 960, 540, mr, lerp(2.4, 0.42, ph), mo, mixc('#ffcf3a', '#f2ecdc', mo));
    }
    post(ctx, { bloom: 0.35 + 0.4 * mo, vignette: 0.45, grain: 0.05, frame });
  },
};
