// Scene 7 — "Meow!"
// Late night, the window seat. She drafts a long, careful message (with an offer of extra curry).
// Risk alerts multiply. The frame starts to turn — drafts fan out behind it like the layers of scene 1 —
// and this time she stops it. She deletes everything, types "Meow!", sends it, and lets the reply stay unknown.
import { W, H, TAU, clamp, lerp, seg, win, E, track, hash, noise, rgba, mixc, PAL, frac } from '../engine/core.js';
import { glow, circle, ring, line, rrect, text, tag, vgrad, FONTS, crescent, typed, measure } from '../engine/draw.js';
import { drawHer, STYLE_NIGHT, SIDE_STAND, poseTrack, hairLag, sideHand } from '../engine/figure.js';
import { drawCat, CAT_NIGHT } from '../engine/cat.js';
import { alertCard } from '../engine/ui.js';
import { room, MOON } from './s6.js';
import { post } from '../engine/post.js';

const DRAFT = "hey! hope this isn't weird, but I made extra curry and was wondering if maybe, if you're not busy, no pressure at all, you'd";
const T = {
  pickup: [0, 1.8], phoneIn: [1.6, 2.4], type: [2.6, 9.2], alerts: [4.0, 4.9, 5.8, 6.5, 7.2, 7.8, 8.3], turn: [8.6, 10.5], stop: [10.5, 11.3], breathe: [11.3, 12.4],
  del: [12.4, 14.4], meow: [14.7, 16.3], hover: [16.3, 17.0], send: 17.0, delivered: 17.6, dots: 18.7, pull: [19.8, 27.0], end: 27.0,
};
const MEOW_KEYS = [14.75, 15.1, 15.45, 15.8, 16.2];
export const cues = { ...T, meowKeys: MEOW_KEYS, nChars: DRAFT.length };
export const subs = [
  [3.0, 9.2, '嘿！希望这不会很奇怪……我做了多的咖喱，想问问你如果不忙、完全没压力的话，要不要……', ''],
  [4.0, 10.5, '太主动了？/ 太含糊了？/ 万一她很忙？/ 万一很奇怪？/ 重写？/ 加个笑话？/ 删掉笑话？', ''],
  [17.0, 19.8, '喵！', ''],
];
const ALERT_TXT = ['too forward?', 'too vague?', "what if she's busy?", "what if it's weird?", 'rewrite?', 'add a joke?', 'remove the joke?'];
const OTHER_DRAFTS = ['hi! random question but', 'hey, so, um —', 'hope your week is going well! I was', 'would you maybe want to', 'ok this is a weird text but'];

// --------------------------------------------------------------------------- phone UI
const PH = { x: 960, y: 545, w: 600, h: 1050 };
function wrap(ctx, str, maxW, size) {
  const words = str.split(' '); const lines = []; let cur = '';
  ctx.save(); ctx.font = `450 ${size}px ${FONTS.ui}`;
  for (const w of words) { const test = cur ? cur + ' ' + w : w; if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test; }
  if (cur) lines.push(cur); ctx.restore(); return lines;
}
function phoneScreen(ctx, t, o) {
  const x0 = PH.x - PH.w / 2, y0 = PH.y - PH.h / 2;
  // body
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 60;
  rrect(ctx, x0 - 18, y0 - 18, PH.w + 36, PH.h + 36, 70); ctx.fillStyle = '#0c0d16'; ctx.fill(); ctx.shadowColor = 'transparent';
  rrect(ctx, x0, y0, PH.w, PH.h, 56); ctx.fillStyle = '#10131f'; ctx.fill();
  ctx.save(); rrect(ctx, x0, y0, PH.w, PH.h, 56); ctx.clip();
  vgrad(ctx, '#151a2e', '#0d1020', x0, y0, PH.w, PH.h);
  // header: avatar (a star) + blurred name (kept private)
  ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(x0, y0, PH.w, 190);
  const ax = x0 + 110, ay = y0 + 130;
  const ag = ctx.createRadialGradient(ax - 10, ay - 10, 4, ax, ay, 40); ag.addColorStop(0, '#ffd6f0'); ag.addColorStop(1, '#7a6cff');
  circle(ctx, ax, ay, 38, ag);
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? 7 : 16, a = -Math.PI / 2 + k * Math.PI / 5; ctx.lineTo(ax + Math.cos(a) * r, ay + Math.sin(a) * r); } ctx.closePath(); ctx.fill();
  for (let k = 0; k < 6; k++) { rrect(ctx, x0 + 170 + k * 3, y0 + 104 + k * 0.5, 170, 30, 15); ctx.fillStyle = 'rgba(220,220,255,0.06)'; ctx.fill(); }
  text(ctx, 'active now', x0 + 172, y0 + 168, { size: 22, color: '#8a90b0' });
  // messages area: the sent bubble + typing indicator
  const sentA = seg(t, T.send, T.send + 0.25);
  if (sentA > 0) {
    const by = lerp(y0 + 580, y0 + 330, E.outBack(sentA));
    const bw = measure(ctx, 'Meow!', { size: 44, weight: 600 }) + 60;
    rrect(ctx, x0 + PH.w - 40 - bw, by, bw, 78, 39); ctx.fillStyle = '#ffc857'; ctx.fill();
    text(ctx, 'Meow!', x0 + PH.w - 40 - bw + 30, by + 53, { size: 44, weight: 600, color: '#2a1a06' });
    const da = seg(t, T.delivered, T.delivered + 0.4);
    text(ctx, 'delivered', x0 + PH.w - 44, by + 112, { size: 20, color: '#8a90b0', align: 'right', alpha: da });
    const dt = seg(t, T.dots, T.dots + 0.3);
    if (dt > 0) {
      const dy = by + 150;
      rrect(ctx, x0 + 40, dy, 140, 70, 35); ctx.fillStyle = rgba('#2a2f4a', dt); ctx.fill();
      for (let k = 0; k < 3; k++) { const ph = Math.sin(t * 5 - k * 0.8) * 0.5 + 0.5; circle(ctx, x0 + 75 + k * 35, dy + 35 - ph * 6, 9, rgba('#cfd4ff', dt * (0.45 + 0.55 * ph))); }
    }
  }
  // input box (grows with the text)
  const kbH = 360;
  const kbY = y0 + PH.h - kbH;
  const size = 34;
  const lines = wrap(ctx, o.input || '', PH.w - 170, size);
  const ih = Math.max(1, lines.length) * 46 + 34;
  const iy = kbY - 24 - ih;
  rrect(ctx, x0 + 30, iy, PH.w - 140, ih, 30); ctx.fillStyle = '#20253c'; ctx.fill();
  if (!o.input) text(ctx, 'Message', x0 + 64, iy + 50, { size, color: '#6a7090' });
  lines.forEach((ln, i) => text(ctx, ln, x0 + 64, iy + 52 + i * 46, { size, color: '#eef0ff' }));
  // caret
  if (Math.floor(t * 2) % 2 === 0) { const last = lines[lines.length - 1] || ''; const cw = measure(ctx, last, { size }); line(ctx, x0 + 66 + cw, iy + 24 + (lines.length - 1) * 46, x0 + 66 + cw, iy + 60 + (lines.length - 1) * 46, '#ffc857', 3); }
  // send button
  const sb = o.sendHot ? 1 : 0;
  circle(ctx, x0 + PH.w - 70, iy + ih - 34, 30, o.input ? (sb ? '#ffe08a' : '#ffc857') : '#2a3050');
  ctx.fillStyle = '#1a1206'; ctx.beginPath(); ctx.moveTo(x0 + PH.w - 84, iy + ih - 46); ctx.lineTo(x0 + PH.w - 52, iy + ih - 34); ctx.lineTo(x0 + PH.w - 84, iy + ih - 22); ctx.lineTo(x0 + PH.w - 78, iy + ih - 34); ctx.closePath(); ctx.fill();
  // keyboard
  ctx.fillStyle = '#1a1e30'; ctx.fillRect(x0, kbY, PH.w, kbH);
  const rows = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
  rows.forEach((r, ri) => {
    const kw = 50, gap = 8, rw = r.length * (kw + gap) - gap, rx = PH.x - rw / 2 - (ri === 2 ? 46 : 0);
    [...r].forEach((ch, ci) => {
      const kx = rx + ci * (kw + gap), ky = kbY + 26 + ri * 82;
      const hot = o.hotKey === ch;
      rrect(ctx, kx, ky, kw, 68, 10); ctx.fillStyle = hot ? '#5a6090' : '#2c3150'; ctx.fill();
      text(ctx, ch, kx + kw / 2, ky + 45, { size: 28, color: '#d8dcff', align: 'center' });
    });
  });
  // backspace key
  rrect(ctx, x0 + PH.w - 104, kbY + 190, 80, 68, 10); ctx.fillStyle = o.hotKey === '⌫' ? '#7a6090' : '#2c3150'; ctx.fill();
  text(ctx, '⌫', x0 + PH.w - 64, kbY + 236, { size: 32, color: '#d8dcff', align: 'center' });
  rrect(ctx, PH.x - 170, kbY + 274, 340, 68, 10); ctx.fillStyle = '#2c3150'; ctx.fill();
  ctx.restore();
}

function inputAt(t) {
  if (t < T.type[0]) return '';
  if (t < T.del[0]) return DRAFT.slice(0, Math.round(DRAFT.length * seg(t, T.type[0], T.type[1])));
  if (t < T.meow[0]) { const u = seg(t, T.del[0], T.del[1]); return DRAFT.slice(0, Math.round(DRAFT.length * (1 - E.inCubic(u)))); }
  if (t < T.send) { let n = 0; for (const k of MEOW_KEYS) if (t >= k) n++; return 'Meow!'.slice(0, n); }
  return '';
}
function hotKeyAt(t) {
  if (t >= T.type[0] && t < T.type[1]) { const n = Math.round(DRAFT.length * seg(t, T.type[0], T.type[1])); const ch = DRAFT[Math.max(0, n - 1)]?.toLowerCase(); return frac(t * 18) < 0.5 ? ch : null; }
  if (t >= T.del[0] && t < T.del[1]) return '⌫';
  for (const k of MEOW_KEYS) if (t >= k && t < k + 0.14) return 'Meow!'['Meow!'.length - MEOW_KEYS.filter(x => x > t).length - 1]?.toLowerCase();
  return null;
}

const SIT = { ...SIDE_STAND, torso: -0.12, head: 0.3, thF: 2.05, knF: 2.3, thB: 2.0, knB: 2.35, shF: 1.0, elF: 1.2, shB: 0.9, elB: 1.3 };
const HUG = { ...SIDE_STAND, torso: 0.15, head: 0.45, thF: 2.3, knF: 2.7, thB: 2.25, knB: 2.75, shF: 1.25, elF: 1.5, shB: 1.2, elB: 1.6 };

export default {
  duration: T.end, cues, subs,
  render(ctx, t, info) {
    const frame = info?.frame || 0;
    const po = { bloom: 0.55, vignette: 0.55, grain: 0.05, frame };
    // ---------------- side view: pick up / pull back ----------------
    const sideA = t < T.phoneIn[1] || t >= T.pull[0];
    if (sideA) {
      const pullU = E.inOutSine(seg(t, T.pull[0], T.pull[1]));
      const k = lerp(t < T.pull[0] ? 1.0 : 1.35, 0.92, pullU) * (t < T.phoneIn[1] ? 1 + 0.4 * E.inExpo(seg(t, T.phoneIn[0], T.phoneIn[1])) : 1);
      const cx = t < T.phoneIn[1] ? lerp(960, 860, seg(t, T.phoneIn[0], T.phoneIn[1])) : lerp(820, 1100, pullU), cy = t < T.phoneIn[1] ? 540 : lerp(600, 520, pullU);
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(k, k); ctx.translate(-cx, -cy);
      room(ctx, t + 30);
      // continues scene 6's last pose (reaching for the phone on the seat), then lifts it
      const lift = E.inOutCubic(seg(t, 0.15, 1.2));
      const pose = t < T.pull[0] ? { ...SIT, torso: lerp(0.02, -0.12, lift), head: lerp(0.3, 0.35, lift), shF: lerp(1.0, 1.0, lift), elF: lerp(1.4, 1.2, lift) } : { ...HUG, head: 0.45 - 0.3 * E.inOutSine(seg(t, 22.5, 25.0)) };
      pose.hairSwing = 0.1 * Math.sin(t * 1.1); pose.breath = 0.5 + 0.5 * Math.sin(t * 0.9);
      // the cat: asleep, then it pads over and rests its head on her foot
      const cu = E.inOutSine(seg(t, 21.6, 24.0));
      const cxp = lerp(1240, 930, cu);
      drawCat(ctx, cxp, 765, 140, { t, curl: t < 21.6 ? 0.95 : (t < 24 ? 0 : lerp(0, 0.7, seg(t, 24, 25.5))), walk: t >= 21.6 && t < 24 ? t * 2.2 : null, face: -1, eye: 0.1, style: CAT_NIGHT });
      drawHer(ctx, 700, 715, 560, pose, { style: STYLE_NIGHT, rim: { color: '#b8d4ff', dx: 1, dy: -0.4, width: 4 }, halo: 0.25 });
      const hd0 = sideHand(pose, 700, 715, 560);
      const hd = [lerp(925, hd0[0], lift), lerp(750, hd0[1], lift)];
      ctx.fillStyle = '#05060f'; rrect(ctx, hd[0] - 10, hd[1] - 30, 22, 40, 5); ctx.fill();
      glow(ctx, hd[0] + 10, hd[1] - 10, 200, '#9fc8ff', 0.75);
      // the reply indicator floating by the phone during the pull-back
      if (t >= T.pull[0]) {
        const da = seg(t, T.pull[0], T.pull[0] + 0.6);
        const bx = hd[0] + 40, by = hd[1] - 120;
        rrect(ctx, bx, by, 90, 44, 22); ctx.fillStyle = rgba('#2a2f4a', 0.85 * da); ctx.fill();
        for (let j = 0; j < 3; j++) { const ph = Math.sin(t * 5 - j * 0.8) * 0.5 + 0.5; circle(ctx, bx + 22 + j * 23, by + 22 - ph * 4, 6, rgba('#cfd4ff', da * (0.45 + 0.55 * ph))); }
      }
      ctx.restore();
      if (t >= T.pull[0]) po.fade = undefined;
      // last second: we pass through the window glass (bright moonlit veil) into scene 8
      const ex = seg(t, T.end - 1.2, T.end);
      if (ex > 0) { ctx.fillStyle = rgba('#0a1238', E.inCubic(ex) * 0.9); ctx.fillRect(0, 0, W, H); }
      post(ctx, po); return;
    }
    // ---------------- the phone ----------------
    vgrad(ctx, '#0a0e22', '#05060f');
    glow(ctx, 960, 560, 900, '#5a6aff', 0.18);
    // the turn: perspective swing + drafts fanning out behind
    const turnU = E.inOutCubic(seg(t, T.turn[0], T.turn[1])) * (1 - E.outBack(seg(t, T.stop[0], T.stop[1])));
    const turnA = clamp(turnU);
    const ang = 0.75 * turnA;
    const inp = inputAt(t);
    const drawPhoneAt = (dx, dz, alpha, txt, scale) => {
      ctx.save(); ctx.globalAlpha = alpha;
      ctx.translate(PH.x + dx, PH.y); ctx.transform(Math.cos(ang) * scale, -Math.sin(ang) * 0.12 * scale, 0, scale, 0, 0); ctx.translate(-PH.x, -PH.y);
      phoneScreen(ctx, t, { input: txt, hotKey: alpha > 0.9 ? hotKeyAt(t) : null, sendHot: t > T.hover[0] && t < T.send });
      ctx.restore();
    };
    if (turnA > 0.01) {
      for (let k = OTHER_DRAFTS.length - 1; k >= 0; k--) {
        const d = (k + 1) * 150 * turnA;
        drawPhoneAt(d * Math.cos(ang) * 1.6, d, 0.25 * turnA * (1 - k * 0.12), OTHER_DRAFTS[k], 1 - (k + 1) * 0.07 * turnA);
      }
    }
    const ent = E.outCubic(seg(t, T.phoneIn[1], T.phoneIn[1] + 0.6));
    const push = 1 + 0.035 * E.inOutSine(seg(t, T.phoneIn[1], T.stop[0])) + 0.09 * E.inOutSine(seg(t, T.breathe[0], T.pull[0])) ;
    ctx.save(); ctx.translate(PH.x, PH.y + 120); ctx.scale(push, push); ctx.rotate(-0.012 * E.inOutSine(seg(t, T.send, T.pull[0]))); ctx.translate(-PH.x, -PH.y - 120);
    ctx.translate(0, (1 - ent) * 300);
    drawPhoneAt(0, 0, 1, inp, 1);
    ctx.restore();
    // gold frame (the Turn) — she holds it still
    const fg = win(t, T.turn[0] - 0.2, T.breathe[1], 0.3, 0.8);
    if (fg > 0) {
      const tilt = 24 * turnA;
      ctx.strokeStyle = rgba(PAL.gold, 0.9 * fg); ctx.lineWidth = 10;
      ctx.beginPath(); ctx.moveTo(18, 18 + tilt); ctx.lineTo(W - 18, 18 - tilt); ctx.lineTo(W - 18, H - 18 + tilt); ctx.lineTo(18, H - 18 - tilt); ctx.closePath(); ctx.stroke();
      // her thumb pressing the frame flat
      const pr = win(t, T.stop[0] - 0.2, T.breathe[1], 0.2, 0.5);
      if (pr > 0) { ctx.save(); ctx.globalAlpha = pr; ctx.fillStyle = '#e2b898'; rrect(ctx, W - 120, H / 2 - 50, 140, 100, 50); ctx.fill(); ctx.restore(); glow(ctx, W - 40, H / 2, 160, PAL.gold, pr * 0.6); }
    }
    // alerts around the phone
    ALERT_TXT.forEach((s, i) => {
      const ta = T.alerts[i];
      const a = seg(t, ta, ta + 0.25) * (1 - seg(t, T.stop[1], T.breathe[1] + 0.3));
      if (a <= 0) return;
      const side = i % 2 ? 1 : -1;
      const x = 960 + side * (500 + (i % 3) * 60) + Math.sin(t * 1.3 + i) * 8, y = 220 + i * 105 + Math.cos(t * 1.1 + i) * 6;
      alertCard(ctx, x, y, s, { scale: 0.9 * E.outBack(seg(t, ta, ta + 0.35)), alpha: a, rot: side * -0.04 });
    });
    // more, tiny ones during the turn
    for (let i = 0; i < 40; i++) {
      const ta = 8.4 + i * 0.05; const a = seg(t, ta, ta + 0.2) * (1 - seg(t, T.stop[1], T.breathe[1]));
      if (a <= 0) continue;
      const an = hash(i) * TAU; const rr = 520 + hash(i + 3) * 280;
      alertCard(ctx, 960 + Math.cos(an) * rr * 1.2, 540 + Math.sin(an) * rr * 0.55, '', { bars: true, scale: 0.35 + hash(i + 7) * 0.2, alpha: a * 0.8, red: hash(i + 9) > 0.5 });
    }
    // the send: a little burst
    const sd = t - T.send;
    if (sd > 0 && sd < 0.6) for (let k = 0; k < 12; k++) { const an = k / 12 * TAU; circle(ctx, 1120 + Math.cos(an) * sd * 300, 640 + Math.sin(an) * sd * 300, 6 * (1 - sd / 0.6), PAL.gold, 1 - sd / 0.6); }
    // quiet: dim everything except the phone during the breath and after sending
    const q = win(t, T.breathe[0], T.breathe[1], 0.3, 0.3) * 0.25;
    if (q > 0) { ctx.fillStyle = rgba('#000000', q); ctx.fillRect(0, 0, W, H); }
    po.bloom = 0.4;
    post(ctx, po);
  },
};
