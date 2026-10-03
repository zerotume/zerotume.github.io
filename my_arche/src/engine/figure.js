// figure.js — "her": a stylized, faceless adult woman (a depiction, not a portrait).
// Two rigs: SIDE (profile, forward kinematics) and BACK (planar puppet, seen from behind).
// Units: standing height ≈ 1.0, origin at the hip, y down. Draw scale = pixels per unit.
import { lerp, clamp, TAU } from './core.js';
import { mkCanvas, crescent } from './draw.js';

export const STYLE_DAY = {
  hair: '#20161f', hairHi: '#3b2a38', skin: '#ebc7a8', skinShade: '#d9ad8c',
  sweater: '#f1e6d2', sweaterShade: '#d8c8ae', rib: 'rgba(150,120,90,0.35)',
  legs: '#2a2633', legsBack: '#1d1a25', shoe: '#3a3140', clip: '#ffc857', clipHi: '#fff1b8',
  backLimb: 0.82,
};
export const STYLE_NIGHT = {   // near-silhouette palette for dark scenes (use with rim light)
  hair: '#0b0b16', hairHi: '#161626', skin: '#1c1f36', skinShade: '#161930',
  sweater: '#22284a', sweaterShade: '#1a1f3c', rib: 'rgba(120,140,220,0.18)',
  legs: '#121528', legsBack: '#0d1020', shoe: '#0d0f1e', clip: '#ffc857', clipHi: '#fff1b8',
  backLimb: 0.8,
};

const L = { torso: 0.30, neck: 0.035, ua: 0.165, fa: 0.15, hand: 0.065, th: 0.232, sh: 0.222, foot: 0.08 };
const HS = 1.22;   // head scale (stylized proportions)
const dir = a => [Math.sin(a), Math.cos(a)];           // angle from straight-down; + = forward(right)
const add = (p, d, l) => [p[0] + d[0] * l, p[1] + d[1] * l];

// ---------------------------------------------------------------------------------
// SIDE RIG
// pose fields (radians unless noted):
//  torso: lean (0 upright, + forward, -PI/2 lying on back)
//  head: head pitch relative to torso (+ = nod forward)
//  shF, elF, wrF / shB, elB, wrB : front/back arm shoulder swing (rel. torso), elbow bend (+ forward), wrist
//  thF, knF / thB, knB : thigh angle (absolute, + forward), knee flex (+ = shin back)
//  hairSwing: lateral hair lag (-1..1), breath (0..1)
export const SIDE_STAND = { torso: 0, head: 0, shF: 0.08, elF: 0.15, wrF: 0, shB: -0.05, elB: 0.12, wrB: 0, thF: 0.04, knF: 0.02, thB: -0.04, knB: 0.04, hairSwing: 0 };

export function sideJoints(p) {
  const hip = [0, 0];
  const at = p.torso || 0;
  const up = [Math.sin(at), -Math.cos(at)];
  const fwd = [Math.cos(at), Math.sin(at)];
  const sh = [hip[0] + up[0] * L.torso - fwd[0] * 0.012, hip[1] + up[1] * L.torso - fwd[1] * 0.012];
  const neck = [hip[0] + up[0] * (L.torso + 0.01), hip[1] + up[1] * (L.torso + 0.01)];
  const ah = at + (p.head || 0);
  const hup = [Math.sin(ah), -Math.cos(ah)];
  const headC = [neck[0] + hup[0] * (L.neck + 0.062 * HS), neck[1] + hup[1] * (L.neck + 0.062 * HS)];
  const arm = (s, e, w) => {
    const a1 = at + s, a2 = a1 + e, a3 = a2 + (w || 0);
    const el = add(sh, dir(a1), L.ua), wr = add(el, dir(a2), L.fa), hd = add(wr, dir(a3), L.hand);
    return { sh, el, wr, hd, a1, a2, a3 };
  };
  const leg = (th, kn) => {
    const k = add(hip, dir(th), L.th), a2 = th - kn, an = add(k, dir(a2), L.sh);
    const fa = a2 + Math.PI / 2;  // foot points forward
    const toe = add(an, dir(fa), L.foot);
    return { hip, k, an, toe, a1: th, a2 };
  };
  return {
    hip, at, ah, up, fwd, hup, sh, neck, headC,
    armF: arm(p.shF || 0, p.elF || 0, p.wrF), armB: arm(p.shB || 0, p.elB || 0, p.wrB),
    legF: leg(p.thF || 0, p.knF || 0), legB: leg(p.thB || 0, p.knB || 0),
  };
}

// tapered capsule between points with radii r0 r1
function capsule(ctx, a, b, r0, r1) {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1e-6;
  const nx = -dy / len, ny = dx / len;
  const ang = Math.atan2(dy, dx);
  ctx.beginPath();
  ctx.moveTo(a[0] + nx * r0, a[1] + ny * r0);
  ctx.lineTo(b[0] + nx * r1, b[1] + ny * r1);
  ctx.arc(b[0], b[1], r1, ang + Math.PI / 2, ang - Math.PI / 2, true);
  ctx.lineTo(a[0] - nx * r0, a[1] - ny * r0);
  ctx.arc(a[0], a[1], r0, ang - Math.PI / 2, ang + Math.PI / 2, true);
  ctx.closePath();
}
// smooth closed curve through points (Catmull-Rom -> Bezier)
export function smoothClosed(ctx, pts, tension = 0.5) {
  const n = pts.length;
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) * tension / 3, p1[1] + (p2[1] - p0[1]) * tension / 3];
    const c2 = [p2[0] - (p3[0] - p1[0]) * tension / 3, p2[1] - (p3[1] - p1[1]) * tension / 3];
    ctx.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], p2[0], p2[1]);
  }
  ctx.closePath();
}
export function smoothOpen(ctx, pts, tension = 0.5, moveTo = true) {
  const n = pts.length;
  if (moveTo) { ctx.moveTo(pts[0][0], pts[0][1]); }
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) * tension / 3, p1[1] + (p2[1] - p0[1]) * tension / 3];
    const c2 = [p2[0] - (p3[0] - p1[0]) * tension / 3, p2[1] - (p3[1] - p1[1]) * tension / 3];
    ctx.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], p2[0], p2[1]);
  }
}
// local (u forward, v up) in a frame -> world
const frame = (o, fwd, up) => (u, v) => [o[0] + fwd[0] * u + up[0] * v, o[1] + fwd[1] * u + up[1] * v];

function drawSideArm(ctx, A, S, back) {
  const sw = back ? S.sweaterShade : S.sweater, sk = back ? S.skinShade : S.skin;
  ctx.fillStyle = sw;
  capsule(ctx, A.sh, A.el, 0.042, 0.036); ctx.fill();
  capsule(ctx, A.el, A.wr, 0.037, 0.034); ctx.fill();   // sleeve (oversized)
  // cuff
  ctx.fillStyle = back ? S.sweaterShade : S.sweaterShade;
  const cuff0 = [lerp(A.el[0], A.wr[0], 0.82), lerp(A.el[1], A.wr[1], 0.82)];
  capsule(ctx, cuff0, A.wr, 0.035, 0.035); ctx.fill();
  // hand (mitten)
  ctx.fillStyle = sk;
  capsule(ctx, A.wr, A.hd, 0.022, 0.018); ctx.fill();
}
function drawSideLeg(ctx, G, S, back) {
  ctx.fillStyle = back ? S.legsBack : S.legs;
  capsule(ctx, G.hip, G.k, 0.06, 0.043); ctx.fill();
  capsule(ctx, G.k, G.an, 0.042, 0.03); ctx.fill();
  ctx.fillStyle = S.shoe;
  capsule(ctx, G.an, G.toe, 0.03, 0.022); ctx.fill();
}

// p.hide: {legs:true} etc.
export function drawSideBody(ctx, p, S, opts = {}) {
  const J = sideJoints(p);
  const T = frame(J.hip, J.fwd, J.up);           // torso frame
  const Hf = [Math.cos(J.ah), Math.sin(J.ah)];   // head forward
  const Hd0 = frame(J.headC, Hf, J.hup);
  const Hd = (u, v) => Hd0(u * HS, v * HS);        // head frame (scaled)
  const sw = (p.hairSwing || 0), br = (p.breath || 0) * 0.006;
  const hide = opts.hide || {};

  if (!hide.armB) drawSideArm(ctx, J.armB, S, true);
  if (!hide.legs) drawSideLeg(ctx, J.legB, S, true);

  // ---- hair, back mass (falls along the back, lags with swing)
  ctx.fillStyle = S.hair;
  const hairLen = opts.hairLen ?? 0.25;
  const tipBack = sw * 0.06;
  const hp = [
    Hd(0.015, 0.07), Hd(-0.045, 0.062), Hd(-0.075, 0.02), Hd(-0.08, -0.03),
    T(-0.085 - tipBack * 0.3, L.torso - 0.06), T(-0.095 - tipBack * 0.8, L.torso - hairLen * 0.6),
    T(-0.07 - tipBack, L.torso - hairLen), T(-0.04 - tipBack * 0.7, L.torso - hairLen * 0.85),
    T(-0.045, L.torso - 0.08), Hd(-0.03, -0.05), Hd(-0.01, -0.02),
  ];
  smoothClosed(ctx, hp, 0.55); ctx.fill();

  // ---- torso / sweater
  ctx.fillStyle = S.sweater;
  const tp = [
    T(-0.022, L.torso + 0.012), T(-0.062, L.torso - 0.04), T(-0.07, 0.16), T(-0.062, 0.06), T(-0.082, -0.07),
    T(0.0, -0.085), T(0.08, -0.07), T(0.07, 0.05), T(0.074, 0.14 + br), T(0.088 + br, 0.19), T(0.072, 0.25), T(0.022, L.torso + 0.008),
  ];
  smoothClosed(ctx, tp, 0.5); ctx.fill();
  // knit ribs at hem + neckline
  ctx.strokeStyle = S.rib; ctx.lineWidth = 0.006;
  for (let i = 0; i < 6; i++) {
    const u = -0.07 + i * 0.028;
    const a = T(u, -0.035), b = T(u + 0.002, -0.075);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  }
  // ---- neck
  ctx.fillStyle = S.skinShade;
  capsule(ctx, J.neck, [J.headC[0] - J.hup[0] * 0.05, J.headC[1] - J.hup[1] * 0.05], 0.023, 0.023); ctx.fill();

  if (!hide.legs) drawSideLeg(ctx, J.legF, S, false);

  // ---- head (profile: cranium + soft nose/chin silhouette, no facial features)
  ctx.fillStyle = S.skin;
  const head = [
    Hd(-0.055, 0.05), Hd(0.01, 0.072), Hd(0.055, 0.04), Hd(0.062, 0.0), Hd(0.074, -0.012), // brow -> nose tip
    Hd(0.06, -0.026), Hd(0.058, -0.045), Hd(0.045, -0.068), Hd(0.015, -0.078), Hd(-0.03, -0.055), Hd(-0.06, -0.01),
  ];
  smoothClosed(ctx, head, 0.45); ctx.fill();
  // ---- hair over the head (top + fringe), with gentle fringe sway
  ctx.fillStyle = S.hair;
  const hh = [
    Hd(-0.075, 0.0), Hd(-0.07, 0.05), Hd(-0.02, 0.083), Hd(0.035, 0.075), Hd(0.066, 0.045),
    Hd(0.07 + sw * 0.004, 0.015), Hd(0.05, 0.022), Hd(0.03, 0.035), Hd(0.0, 0.028), Hd(-0.02, 0.0),
    Hd(-0.035, -0.04), Hd(-0.06, -0.05),
  ];
  smoothClosed(ctx, hh, 0.5); ctx.fill();
  // hair highlight strand
  ctx.strokeStyle = S.hairHi; ctx.lineWidth = 0.006; ctx.beginPath();
  smoothOpen(ctx, [Hd(-0.02, 0.07), Hd(-0.06, 0.04), Hd(-0.075, -0.02), T(-0.085 - tipBack * 0.4, L.torso - 0.1)]); ctx.stroke();
  // ---- moon clip (crescent) near the temple
  const cc = Hd(-0.03, 0.045), cr = 0.022;
  crescent(ctx, cc[0], cc[1], cr * HS, { color: S.clip, k: 0.5, inner: 0.82, angle: -0.6 });

  if (!hide.armF) drawSideArm(ctx, J.armF, S, false);
  return J;
}

// ---------------------------------------------------------------------------------
// BACK RIG (planar, seen from behind; screen-right = her right side)
// pose: lean (side bend), headTilt, armR:{s,e}, armL:{s,e} (s: angle from down, + = outward), legSpread, hairSwing
export const BACK_STAND = { lean: 0, headTilt: 0, rS: 0.12, rE: 0.05, lS: 0.12, lE: 0.05, legs: 0.05, hairSwing: 0, shrug: 0 };

export function backJoints(p) {
  const at = p.lean || 0;
  const up = [Math.sin(at), -Math.cos(at)], rt = [Math.cos(at), Math.sin(at)];
  const T = frame([0, 0], rt, up);
  const shy = L.torso - 0.02 + (p.shrug || 0) * 0.025;
  const shR = T(0.105, shy), shL = T(-0.105, shy);
  const neck = T(0, L.torso + 0.01);
  const ah = at + (p.headTilt || 0);
  const hup = [Math.sin(ah), -Math.cos(ah)];
  const headC = [neck[0] + hup[0] * 0.1 * HS, neck[1] + hup[1] * 0.1 * HS];
  // right arm: outward = +x; angle from down, + outward (to the right)
  const armR = (() => {
    const a1 = at + (p.rS || 0), a2 = a1 + (p.rE || 0);
    const el = add(shR, dir(a1), L.ua), wr = add(el, dir(a2), L.fa), hd = add(wr, dir(a2 + (p.rW || 0)), L.hand);
    return { sh: shR, el, wr, hd };
  })();
  const armL = (() => {
    const a1 = at - (p.lS || 0), a2 = a1 - (p.lE || 0);
    const el = add(shL, dir(a1), L.ua), wr = add(el, dir(a2), L.fa), hd = add(wr, dir(a2 - (p.lW || 0)), L.hand);
    return { sh: shL, el, wr, hd };
  })();
  const hipR = [0.055, 0.02], hipL = [-0.055, 0.02];
  const sp = p.legs ?? 0.05;
  const kR = add(hipR, dir(sp), L.th), aR = add(kR, dir(sp * 0.6), L.sh);
  const kL = add(hipL, dir(-sp), L.th), aL = add(kL, dir(-sp * 0.6), L.sh);
  return { T, up, rt, shR, shL, neck, headC, hup, armR, armL, legR: { hip: hipR, k: kR, an: aR }, legL: { hip: hipL, k: kL, an: aL } };
}

export function drawBackBody(ctx, p, S, opts = {}) {
  const J = backJoints(p);
  const sw = p.hairSwing || 0;
  const hide = opts.hide || {};
  // legs
  if (!hide.legs) {
    ctx.fillStyle = S.legs;
    for (const g of [J.legL, J.legR]) {
      capsule(ctx, g.hip, g.k, 0.058, 0.042); ctx.fill();
      capsule(ctx, g.k, g.an, 0.041, 0.03); ctx.fill();
      ctx.fillStyle = S.shoe; capsule(ctx, g.an, [g.an[0], g.an[1] + 0.03], 0.03, 0.026); ctx.fill(); ctx.fillStyle = S.legs;
    }
  }
  // arms raised above shoulder line are drawn after the torso; hanging ones before
  const armBefore = a => (a.el[1] > J.shR[1] - 0.02);
  const drawArm = (A, shade) => {
    ctx.fillStyle = shade ? S.sweaterShade : S.sweater;
    capsule(ctx, A.sh, A.el, 0.044, 0.038); ctx.fill();
    capsule(ctx, A.el, A.wr, 0.039, 0.036); ctx.fill();
    ctx.fillStyle = S.sweaterShade; capsule(ctx, [lerp(A.el[0], A.wr[0], .82), lerp(A.el[1], A.wr[1], .82)], A.wr, 0.037, 0.037); ctx.fill();
    ctx.fillStyle = S.skin; capsule(ctx, A.wr, A.hd, 0.023, 0.019); ctx.fill();
  };
  // torso (sweater, back view: broad soft trapezoid)
  ctx.fillStyle = S.sweater;
  const T = J.T;
  const torso = [T(-0.06, L.torso + 0.01), T(-0.125, L.torso - 0.025 + (p.shrug || 0) * .02), T(-0.12, 0.17), T(-0.1, 0.05), T(-0.11, -0.075),
    T(0, -0.09), T(0.11, -0.075), T(0.1, 0.05), T(0.12, 0.17), T(0.125, L.torso - 0.025 + (p.shrug || 0) * .02), T(0.06, L.torso + 0.01)];
  if (!armBefore(J.armL)) { /* draw later */ } else drawArm(J.armL, true);
  if (armBefore(J.armR)) drawArm(J.armR, true);
  ctx.fillStyle = S.sweater;
  smoothClosed(ctx, torso, 0.5); ctx.fill();
  ctx.strokeStyle = S.rib; ctx.lineWidth = 0.006;
  for (let i = 0; i < 9; i++) { const u = -0.1 + i * 0.025; const a = T(u, -0.04), b = T(u, -0.08); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
  // neck
  ctx.fillStyle = S.skinShade; capsule(ctx, J.neck, J.headC, 0.025, 0.025); ctx.fill();
  // head (back of head is all hair) + long hair falling down the back
  const Hd0 = frame(J.headC, [Math.cos(Math.atan2(J.hup[0], -J.hup[1])), Math.sin(Math.atan2(J.hup[0], -J.hup[1]))], J.hup);
  const Hd = (u, v) => Hd0(u * HS, v * HS);
  ctx.fillStyle = S.hair;
  const hl = opts.hairLen ?? 0.26;
  const hair = [
    Hd(-0.075, 0.01), Hd(-0.06, 0.06), Hd(0, 0.085), Hd(0.06, 0.06), Hd(0.075, 0.01),
    T(0.085 + sw * 0.01, L.torso - 0.03), T(0.09 + sw * 0.03, L.torso - hl * 0.6), T(0.06 + sw * 0.05, L.torso - hl),
    T(0.0 + sw * 0.055, L.torso - hl - 0.02), T(-0.06 + sw * 0.05, L.torso - hl), T(-0.09 + sw * 0.03, L.torso - hl * 0.6),
    T(-0.085 + sw * 0.01, L.torso - 0.03),
  ];
  smoothClosed(ctx, hair, 0.5); ctx.fill();
  ctx.strokeStyle = S.hairHi; ctx.lineWidth = 0.005;
  for (let k = -2; k <= 2; k++) {
    ctx.beginPath(); smoothOpen(ctx, [Hd(k * 0.02, 0.075), Hd(k * 0.035, 0.02), T(k * 0.03 + sw * 0.02, L.torso - 0.06), T(k * 0.028 + sw * 0.045, L.torso - hl * 0.85)]); ctx.stroke();
  }
  // moon clip on the right side of the head
  const cc = Hd(0.058, 0.035), cr = 0.022;
  crescent(ctx, cc[0], cc[1], cr * HS, { color: S.clip, k: 0.5, inner: 0.82, angle: -2.4 });
  if (!armBefore(J.armL)) drawArm(J.armL, false);
  if (!armBefore(J.armR)) drawArm(J.armR, false);
  return J;
}

// ---------------------------------------------------------------------------------
// Rendering wrapper with optional rim light (silhouette scenes).
// view: 'side' | 'back'; flip: mirror horizontally (face left)
// rim: {color, dx, dy, width(px)}  glowColor for soft outer halo
let buf1 = null, buf2 = null;
function bufs(w, h) {
  if (!buf1 || buf1.width < w || buf1.height < h) {
    buf1 = mkCanvas(Math.max(w, buf1?.width || 0), Math.max(h, buf1?.height || 0));
    buf2 = mkCanvas(buf1.width, buf1.height);
  }
  return [buf1, buf2];
}
export function drawHer(ctx, x, y, scale, pose, o = {}) {
  const S = o.style || STYLE_DAY;
  const view = o.view || 'side';
  const drawBody = (g) => view === 'side' ? drawSideBody(g, pose, S, o) : drawBackBody(g, pose, S, o);
  const alpha = o.alpha ?? 1;
  if (alpha <= 0.003) return;
  if (!o.rim) {
    ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(x, y); ctx.scale(o.flip ? -scale : scale, scale);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    drawBody(ctx); ctx.restore(); return;
  }
  // rim light path: render into offscreen buffers in device pixels
  const tf = ctx.getTransform();
  const dev = Math.hypot(tf.a, tf.b);                       // device pixels per logical px
  const ps = scale * dev;                                   // device px per figure unit
  const bw = Math.ceil(ps * 1.6), bh = Math.ceil(ps * 1.5);
  const [b1, b2] = bufs(bw, bh);
  const g1 = b1.getContext('2d'), g2 = b2.getContext('2d');
  const ox = bw / 2, oy = bh * 0.62;                         // hip position inside buffer
  const rimW = (o.rim.width ?? 3) * dev;
  const len = Math.hypot(o.rim.dx, o.rim.dy) || 1;
  const rx = o.rim.dx / len * rimW, ry = o.rim.dy / len * rimW;
  for (const [g, sty] of [[g1, null], [g2, S]]) {
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    g.clearRect(0, 0, bw, bh);
    g.setTransform(o.flip ? -ps : ps, 0, 0, ps, ox, oy);
    g.lineCap = 'round'; g.lineJoin = 'round';
  }
  // b1: flat rim colour silhouette ; b2: the coloured figure
  const flat = {}; for (const k in S) flat[k] = o.rim.color; flat.rib = 'rgba(0,0,0,0)'; flat.backLimb = 1;
  if (view === 'side') { drawSideBody(g1, pose, flat, o); drawSideBody(g2, pose, S, o); }
  else { drawBackBody(g1, pose, flat, o); drawBackBody(g2, pose, S, o); }
  // keep figure only where shifted copy overlaps; rim shows on the lit edge
  g1.setTransform(1, 0, 0, 1, 0, 0);
  g1.globalCompositeOperation = 'source-atop';
  g1.drawImage(b2, 0, 0, bw, bh, -rx, -ry, bw, bh);
  g1.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = alpha;
  const px = tf.a * x + tf.c * y + tf.e, py = tf.b * x + tf.d * y + tf.f;
  if (o.halo) {   // soft glow behind the figure
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha * o.halo;
    ctx.drawImage(b1, 0, 0, bw, bh, px - ox - rx * 2, py - oy - ry * 2, bw, bh);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = alpha;
  }
  ctx.drawImage(b1, 0, 0, bw, bh, px - ox, py - oy, bw, bh);
  ctx.restore();
}

export function poseMix(a, b, u) {
  const o = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) o[k] = lerp(a[k] ?? 0, b[k] ?? 0, u);
  return o;
}
// pose timeline: keys [[t, pose, ease]] -> pose at t
export function poseTrack(keys, ease) {
  return t => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (t <= keys[i][0]) {
        const u = (keys[i][2] || ease || (x => x * x * (3 - 2 * x)))((t - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0]));
        return poseMix(keys[i - 1][1], keys[i][1], u);
      }
    }
    return keys[keys.length - 1][1];
  };
}
// hair lag from a pose function: compares a reference joint over a short window
export function hairLag(poseFn, t, key = 'torso', k = 3) {
  const a = poseFn(t), b = poseFn(t - 0.12), c = poseFn(t - 0.24);
  const v = ((a[key] ?? 0) - (b[key] ?? 0)) * 0.7 + ((b[key] ?? 0) - (c[key] ?? 0)) * 0.3;
  return clamp(-v * k, -1.2, 1.2);
}

// world position of her front hand for a side-view draw at (x,y,scale,flip)
export function sideHand(pose, x, y, scale, flip = false, which = 'armF') {
  const J = sideJoints(pose);
  const h = J[which].hd;
  return [x + (flip ? -h[0] : h[0]) * scale, y + h[1] * scale];
}
export function sideHead(pose, x, y, scale, flip = false) {
  const J = sideJoints(pose);
  return [x + (flip ? -J.headC[0] : J.headC[0]) * scale, y + J.headC[1] * scale];
}

// walking: overlay a gait cycle (phase in cycles) on a base side pose
export function walkPose(base, phase, amp = 1) {
  const a = Math.sin(phase * Math.PI * 2) * amp, b = Math.cos(phase * Math.PI * 2);
  return {
    ...base,
    thF: (base.thF || 0) + 0.38 * a, thB: (base.thB || 0) - 0.38 * a,
    knF: (base.knF || 0) + Math.max(0, -a) * 0.7 * amp + 0.08, knB: (base.knB || 0) + Math.max(0, a) * 0.7 * amp + 0.08,
    shF: (base.shF || 0) - 0.3 * a, shB: (base.shB || 0) + 0.3 * a,
    torso: (base.torso || 0) + 0.04 * amp, hairSwing: (base.hairSwing || 0) + 0.25 * b * amp,
  };
}
export const walkBob = (phase, amp = 1) => -Math.abs(Math.cos(phase * Math.PI * 2)) * 0.012 * amp;   // hip rise (units)

// fantasy avatar palette (same silhouette, hair and moon clip; robe-like midnight sweater)
export const STYLE_AVATAR = {
  hair: '#160f1c', hairHi: '#3a2a48', skin: '#ebc7a8', skinShade: '#d2a888',
  sweater: '#2f3a8a', sweaterShade: '#232c6a', rib: 'rgba(255,210,120,0.55)',
  legs: '#1a1838', legsBack: '#121030', shoe: '#2a2048', clip: '#ffc857', clipHi: '#fff1b8', backLimb: 0.82,
};
// archery pose (side view, facing right). aim: radians above horizontal; draw: 0 (bow raised) .. 1 (full draw)
export function archeryPose(aim = 0.5, draw = 1, base = SIDE_STAND) {
  const bowSh = Math.PI / 2 + aim;                 // bow arm points along the arrow
  const drawSh = lerp(bowSh - 0.25, -Math.PI / 2 + aim + 0.08, draw);   // draw arm elbow swings back
  const drawEl = lerp(0.35, Math.PI - 0.12, draw);
  return { ...base, torso: -0.04, head: -aim * 0.75, shB: bowSh, elB: 0.02, wrB: 0, shF: drawSh, elF: drawEl, wrF: 0,
    thF: 0.12, knF: 0.04, thB: -0.14, knB: 0.06 };
}
// bow + string + arrow, from the current pose joints
export function drawBow(ctx, pose, x, y, scale, o = {}) {
  const J = sideJoints(pose);
  const toW = p => [x + (o.flip ? -p[0] : p[0]) * scale, y + p[1] * scale];
  const grip = toW(J.armB.hd), nock = toW(J.armF.wr);
  const ang = J.armB.a2;                            // forearm direction (angle from down)
  const dirv = [Math.sin(ang) * (o.flip ? -1 : 1), Math.cos(ang)];
  const perp = [-dirv[1], dirv[0]];
  const L = 0.31 * scale, bend = (o.bend ?? 0.16) * scale;
  const tip1 = [grip[0] + perp[0] * L - dirv[0] * bend * 0.6, grip[1] + perp[1] * L - dirv[1] * bend * 0.6];
  const tip2 = [grip[0] - perp[0] * L - dirv[0] * bend * 0.6, grip[1] - perp[1] * L - dirv[1] * bend * 0.6];
  const drawn = o.drawn ?? 1;
  const str = [lerp(lerp(tip1[0], tip2[0], 0.5), nock[0], drawn), lerp(lerp(tip1[1], tip2[1], 0.5), nock[1], drawn)];
  ctx.save(); ctx.lineCap = 'round';
  // limbs (recurve)
  ctx.strokeStyle = o.wood || '#8a5a34'; ctx.lineWidth = 0.022 * scale;
  ctx.beginPath(); ctx.moveTo(tip1[0], tip1[1]);
  ctx.quadraticCurveTo(grip[0] + perp[0] * L * 0.62 - dirv[0] * bend * 0.05, grip[1] + perp[1] * L * 0.62 - dirv[1] * bend * 0.05, grip[0], grip[1]);
  ctx.quadraticCurveTo(grip[0] - perp[0] * L * 0.62 - dirv[0] * bend * 0.05, grip[1] - perp[1] * L * 0.62 - dirv[1] * bend * 0.05, tip2[0], tip2[1]);
  ctx.stroke();
  // string
  ctx.strokeStyle = o.string || 'rgba(255,255,255,0.85)'; ctx.lineWidth = 0.004 * scale + 0.6;
  ctx.beginPath(); ctx.moveTo(tip1[0], tip1[1]); ctx.lineTo(str[0], str[1]); ctx.lineTo(tip2[0], tip2[1]); ctx.stroke();
  // arrow
  if (o.arrow !== false) {
    const tipA = [grip[0] + dirv[0] * 0.12 * scale, grip[1] + dirv[1] * 0.12 * scale];
    ctx.strokeStyle = o.shaft || '#e8dcc0'; ctx.lineWidth = 0.008 * scale;
    ctx.beginPath(); ctx.moveTo(str[0], str[1]); ctx.lineTo(tipA[0], tipA[1]); ctx.stroke();
    ctx.fillStyle = o.head || '#ffc857';
    ctx.beginPath(); ctx.moveTo(tipA[0] + dirv[0] * 0.03 * scale, tipA[1] + dirv[1] * 0.03 * scale); ctx.lineTo(tipA[0] + perp[0] * 0.012 * scale, tipA[1] + perp[1] * 0.012 * scale); ctx.lineTo(tipA[0] - perp[0] * 0.012 * scale, tipA[1] - perp[1] * 0.012 * scale); ctx.closePath(); ctx.fill();
    // fletching
    ctx.fillStyle = o.fletch || '#ff7a6a';
    for (const sgn of [-1, 1]) { ctx.beginPath(); ctx.moveTo(str[0] + dirv[0] * 0.01 * scale, str[1] + dirv[1] * 0.01 * scale); ctx.lineTo(str[0] + dirv[0] * 0.05 * scale + perp[0] * sgn * 0.016 * scale, str[1] + dirv[1] * 0.05 * scale + perp[1] * sgn * 0.016 * scale); ctx.lineTo(str[0] + dirv[0] * 0.06 * scale, str[1] + dirv[1] * 0.06 * scale); ctx.closePath(); ctx.fill(); }
    o.out && (o.out.tip = tipA, o.out.dir = dirv);
  }
  ctx.restore();
  return { grip, nock: str, dir: dirv };
}
