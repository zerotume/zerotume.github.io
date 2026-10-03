// Scene 1 — "03:14"
// A 3 a.m. page. Everyone keeps restarting the failing service. She asks 从来如此，便对吗？,
// turns the flat diagram and finds the real cause hiding directly behind the symptom: one clock, three minutes late.
// Fixing it heals the system — and locks the music onto the beat.
import { W, H, TAU, clamp, lerp, seg, win, E, track, rng, hash, noise, rgba, mixc, PAL, frac, remap } from '../engine/core.js';
import { glow, circle, ring, line, rrect, text, revealText, notification, bubble, tag, seal, vgrad, FONTS, mkCanvas, measure, crescent } from '../engine/draw.js';
import { camera } from '../engine/cam3d.js';
import { drawHer, STYLE_NIGHT, SIDE_STAND, BACK_STAND, poseTrack, hairLag } from '../engine/figure.js';
import { post } from '../engine/post.js';

// ---------------------------------------------------------------------------
// Timing (seconds) — shared with the score via cues
export const BPM = 100, BEAT = 60 / BPM;
const T = {
  buzz: [1.0, 1.55, 2.45], banner: 1.25, sitUp: 2.0, cut1: 3.6, lidOpen: 3.75, diveStart: 4.35, inNet: 6.2,
  chat: [6.7, 7.5, 8.6, 11.0, 11.7],
  stopHand: 12.3, question: 13.0, grab: 15.3, turnStart: 15.9, turnEnd: 19.0,
  traceStart: 19.1, traceEnd: 20.5, point: 20.6, flick: 21.35, snap: 22.2,
  rootTag: 23.6, stamp: 24.5, diveOut: 26.4, cut2: 28.6, lidClose: 28.95, flop: 29.45, zzz: 30.05, end: 31.0,
};
// restart clicks: 3 slow, then 44 accelerating
const CLICKS = (() => {
  const c = [7.4, 8.25, 8.95];
  const n = 44, a = 9.45, b = 12.15;
  for (let i = 0; i < n; i++) { const u = i / (n - 1); c.push(a + (b - a) * (1 - Math.pow(1 - u, 1.8))); }
  return c;
})();
// soft-subtitle data: zh = translation of on-screen English; en = translation of on-screen Chinese (when not already shown)
export const subs = [
  [1.3, 3.5, '支付服务故障 · 错误率 38% 并持续上升 · 你在值班', ''],
  [6.7, 7.4, '支付又挂了 😩', ''], [7.5, 8.5, '重启一下？', ''], [8.6, 10.9, '重启一下总能好的 🤷', ''],
  [11.0, 11.6, '又来？', ''], [11.7, 12.6, '又来。', ''], [9.0, 12.6, '', ''],
  [20.4, 23.2, '一个慢了三分钟的时钟', ''],
  [23.6, 26.4, '根因：一个没人想到去检查的时钟。重启什么都没解决，修好时钟解决了一切。', ''],
  [24.6, 26.4, '', 'Resolved · 03:41'],
  [28.1, 28.9, '修好了，是时钟的问题 🕒 回去睡觉了 💤', ''],
].filter(r => r[2] || r[3]);
export const cues = { ...T, clicks: CLICKS, bpm: BPM, lock: T.snap, typing: [26.95, 27.05, 27.2, 27.3, 27.38, 27.5, 27.62, 27.7, 27.82, 27.95, 28.04], send: 28.12 };

// ---------------------------------------------------------------------------
// The network: three layers stacked in depth. In the flat (front) view the back layers hide exactly
// behind front nodes, so the cause is literally invisible from the usual angle.
const R_POS = [210, -40];
let G = null;
function buildGraph() {
  if (G) return G;
  const r = rng(314159);
  const nodes = [];
  // front layer: jittered grid
  const cols = 10, rows = 5;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    if (r() < 0.2) continue;
    let x = -760 + i * (1520 / (cols - 1)) + (r() - .5) * 90 + (j % 2) * 60;
    let y = -330 + j * (660 / (rows - 1)) + (r() - .5) * 70;
    nodes.push({ x, y, layer: 0, size: 0.8 + r() * 0.5 });
  }
  // force R
  let ri = 0, best = 1e9;
  nodes.forEach((n, i) => { const d = Math.hypot(n.x - R_POS[0], n.y - R_POS[1]); if (d < best) { best = d; ri = i; } });
  nodes[ri].x = R_POS[0]; nodes[ri].y = R_POS[1]; nodes[ri].size = 1.5;
  const front = nodes.map((_, i) => i);
  // mid layer: under a subset of front nodes (always under R)
  const mid = [];
  front.forEach(i => { if (i === ri || r() < 0.42) { nodes.push({ x: nodes[i].x, y: nodes[i].y, layer: 1, size: 0.9 + r() * 0.4, above: i }); mid.push(nodes.length - 1); } });
  const mi = mid.find(k => nodes[k].above === ri);
  const back = [];
  mid.forEach(k => { if (k === mi || r() < 0.45) { nodes.push({ x: nodes[k].x, y: nodes[k].y, layer: 2, size: 1.0 + r() * 0.4, above: k }); back.push(nodes.length - 1); } });
  const ci = back.find(k => nodes[k].above === mi);
  nodes[ci].size = 1.6;
  const edges = [];
  const has = new Set();
  const addE = (a, b, kind) => { const k = a < b ? a + '-' + b : b + '-' + a; if (a === b || has.has(k)) return; has.add(k); edges.push({ a, b, kind, ph: r(), sp: 0.25 + r() * 0.35 }); };
  const near = (set, i, k) => set.filter(j => j !== i).map(j => [j, Math.hypot(nodes[j].x - nodes[i].x, nodes[j].y - nodes[i].y)]).sort((p, q) => p[1] - q[1]).slice(0, k).map(p => p[0]);
  front.forEach(i => near(front, i, 3).forEach(j => { if (Math.hypot(nodes[j].x - nodes[i].x, nodes[j].y - nodes[i].y) < 330) addE(i, j, 'f'); }));
  mid.forEach(i => near(mid, i, 2).forEach(j => addE(i, j, 'm')));
  back.forEach(i => near(back, i, 2).forEach(j => addE(i, j, 'b')));
  mid.forEach(k => addE(nodes[k].above, k, 'v'));
  back.forEach(k => addE(nodes[k].above, k, 'v'));
  mid.forEach(k => { const nf = near(front, k, 2)[1]; if (nf !== undefined) addE(k, nf, 'd'); });
  back.forEach(k => { const nm = near(mid, k, 2)[1]; if (nm !== undefined) addE(k, nm, 'd'); });
  // BFS hop distance from the clock (for the healing wave)
  const adj = nodes.map(() => []);
  edges.forEach(e => { adj[e.a].push(e.b); adj[e.b].push(e.a); });
  const hop = nodes.map(() => 99); hop[ci] = 0; const q = [ci];
  while (q.length) { const u = q.shift(); for (const v of adj[u]) if (hop[v] > hop[u] + 1) { hop[v] = hop[u] + 1; q.push(v); } }
  // stress: front nodes near R are amber before the fix
  nodes.forEach((n, i) => { n.stress = n.layer === 0 ? clamp(1 - Math.hypot(n.x - R_POS[0], n.y - R_POS[1]) / 420) : (i === mi ? 0.8 : 0); });
  G = { nodes, edges, ri, mi, ci, hop, front, mid, back };
  return G;
}

// ---------------------------------------------------------------------------
// Network rendering. s: state {yaw,pitch,dist,depth,target,alpha,chrome}
function netState(t) {
  const u = E.inOutCubic(seg(t, T.turnStart, T.turnEnd));
  const after = seg(t, T.turnEnd, T.diveOut + 2.0);
  let yaw = lerp(0, -0.92, u) - 0.22 * E.inOutSine(after);
  let pitch = lerp(0, 0.24, u) + 0.06 * E.inOutSine(after);
  let dist = lerp(1484, 2350, u) + 260 * E.inOutSine(after);
  const depth = E.inOutCubic(seg(t, T.turnStart + 0.3, T.turnEnd));
  const target = [lerp(0, 120, u), lerp(0, 20, u), lerp(0, -560, depth)];
  // grab: slight tug before turn
  const tug = Math.sin(seg(t, T.grab, T.turnStart) * Math.PI) * 0.035;
  yaw += tug;
  return { yaw, pitch, dist, depth, target };
}

function healAt(i, t) {   // 0 unhealthy -> 1 healed
  const g = buildGraph();
  const tt = T.snap + g.hop[i] * 0.11;
  return E.outCubic(seg(t, tt, tt + 0.35));
}

function drawNet(ctx, t, o = {}) {
  const g = buildGraph();
  const st = o.state || netState(t);
  const cam = camera({ yaw: st.yaw, pitch: st.pitch, dist: st.dist, fov: 40, target: st.target, cx: 960, cy: 575, zoom: 0.86 });
  const gap = 560 * st.depth;
  const pos = n => [n.x, n.y, -n.layer * gap];
  const P = g.nodes.map(n => cam.project(pos(n)));
  const layerA = l => l === 0 ? 1 : clamp(st.depth * 1.6);
  const locked = t >= T.snap;
  const beatPh = locked ? frac((t - T.snap) / BEAT) : 0;
  const beatPulse = locked ? Math.exp(-beatPh * 5) : 0;
  const alpha = o.alpha ?? 1;

  // background dust (parallax with yaw)
  ctx.save();
  for (let i = 0; i < 140; i++) {
    const x = hash(i) * 2400 - 1200, y = hash(i + 500) * 1400 - 700, z = -hash(i + 900) * 2600 + 600;
    const p = cam.project([x, y, z]);
    if (p.s <= 0) continue;
    circle(ctx, p.x, p.y, 1.2 * p.s + 0.4, '#8fb4ff', 0.25 * alpha * (0.5 + 0.5 * hash(i + 77)));
  }
  ctx.restore();

  // frame border (the "frame" of the flat picture) in the z=0 plane
  const fr = [[-830, -400, 0], [830, -400, 0], [830, 400, 0], [-830, 400, 0]].map(p => cam.project(p));
  const grabGlow = win(t, T.grab - 0.1, T.turnEnd + 0.4, 0.3, 0.8);
  const fa = (0.10 + 0.25 * grabGlow) * alpha * (o.chrome ? 0 : 1);
  if (fa > 0.01) {
    ctx.lineWidth = 2; ctx.strokeStyle = rgba('#cfe6ff', fa);
    ctx.beginPath(); fr.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); ctx.stroke();
    // corner ticks
    if (grabGlow > 0) {
      // left edge glows gold where she grabs it
      ctx.lineWidth = 5; ctx.strokeStyle = rgba(PAL.gold, grabGlow * alpha);
      ctx.beginPath(); ctx.moveTo(fr[3].x, fr[3].y); ctx.lineTo(fr[0].x, fr[0].y); ctx.stroke();
      glow(ctx, (fr[0].x + fr[3].x) / 2, (fr[0].y + fr[3].y) / 2, 120, PAL.gold, grabGlow * 0.5 * alpha);
    }
  }
  // layer sheets (faint planes) once depth appears
  if (st.depth > 0.02) {
    for (let l = 1; l <= 2; l++) {
      const q = [[-830, -400], [830, -400], [830, 400], [-830, 400]].map(p => cam.project([p[0], p[1], -l * gap]));
      ctx.fillStyle = rgba(l === 2 ? '#ffb347' : '#5fe0ff', 0.035 * clamp(st.depth * 2) * alpha);
      ctx.strokeStyle = rgba(l === 2 ? '#ffb347' : '#5fe0ff', 0.12 * clamp(st.depth * 2) * alpha);
      ctx.lineWidth = 1.5;
      ctx.beginPath(); q.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }

  // edges
  const nodeCol = i => {
    const n = g.nodes[i];
    const h = healAt(i, t);
    let c;
    if (i === g.ri) c = mixc(PAL.alert, PAL.teal, h);
    else if (i === g.ci) c = mixc(PAL.amber, PAL.teal, h);
    else if (i === g.mi) c = mixc('#ff7a4d', PAL.teal, h);
    else c = mixc(mixc('#5fc8ff', PAL.amber, n.stress * 0.85), PAL.teal, h);
    return c;
  };
  ctx.lineCap = 'round';
  // draw back layers first
  const order = g.edges.map((e, k) => k).sort((a, b) => (P[g.edges[b].a].z + P[g.edges[b].b].z) - (P[g.edges[a].a].z + P[g.edges[a].b].z));
  for (const k of order) {
    const e = g.edges[k];
    const la = Math.max(g.nodes[e.a].layer, g.nodes[e.b].layer);
    const vis = (e.kind === 'f' ? 1 : layerA(la)) * alpha;
    if (vis < 0.01) continue;
    const pa = P[e.a], pb = P[e.b];
    const c = mixc(nodeCol(e.a), nodeCol(e.b), 0.5);
    const w = (e.kind === 'v' || e.kind === 'd') ? 1.4 : 2.0;
    line(ctx, pa.x, pa.y, pb.x, pb.y, rgba(c, 1), w * Math.sqrt((pa.s + pb.s) / 2), (0.28 + 0.25 * beatPulse) * vis);
  }
  // trace (gold) R -> M -> C
  const tr = seg(t, T.traceStart, T.traceEnd);
  const traceVis = (1 - seg(t, T.snap + 1.4, T.snap + 3)) * alpha;
  if (tr > 0 && traceVis > 0) {
    const path = [g.ri, g.mi, g.ci].map(i => P[i]);
    const total = 2, pp = E.inOutSine(tr) * total;
    ctx.lineWidth = 4.5; ctx.strokeStyle = rgba(PAL.gold, 0.95 * traceVis);
    ctx.beginPath(); ctx.moveTo(path[0].x, path[0].y);
    let head = path[0];
    for (let s = 0; s < 2; s++) {
      const u = clamp(pp - s); if (u <= 0) break;
      const x = lerp(path[s].x, path[s + 1].x, u), y = lerp(path[s].y, path[s + 1].y, u);
      ctx.lineTo(x, y); head = { x, y };
    }
    ctx.stroke();
    glow(ctx, head.x, head.y, 70, PAL.gold, 0.9 * traceVis);
  }

  // pulses (traffic) along edges
  for (const e of g.edges) {
    const la = Math.max(g.nodes[e.a].layer, g.nodes[e.b].layer);
    const vis = (e.kind === 'f' ? 1 : layerA(la)) * alpha;
    if (vis < 0.05) continue;
    const pa = P[e.a], pb = P[e.b];
    const intoR = e.b === g.ri || e.a === g.ri;
    for (let m = 0; m < 2; m++) {
      let u;
      if (!locked) {
        u = frac(t * e.sp + e.ph + m * 0.5);
        if (intoR) { u = 1 - Math.pow(1 - u, 3); }           // traffic jams near the failing node
        u += 0.02 * noise(t * 7 + e.ph * 30, m);             // jitter: out of phase
      } else {
        u = frac((t - T.snap) / (BEAT * 2) + m * 0.5);       // everything in time
      }
      u = clamp(u);
      const from = intoR && e.b !== g.ri ? pb : pa, to = intoR && e.b !== g.ri ? pa : pb;
      const x = lerp(from.x, to.x, u), y = lerp(from.y, to.y, u);
      const c = locked ? PAL.teal : (intoR ? PAL.amber : '#9fe6ff');
      const s = Math.sqrt((pa.s + pb.s) / 2);
      glow(ctx, x, y, 12 * s, c, 0.55 * vis);
      circle(ctx, x, y, 2.4 * s, '#ffffff', 0.8 * vis);
    }
  }

  // nodes, back to front
  const nOrder = g.nodes.map((n, i) => i).sort((a, b) => P[b].z - P[a].z);
  for (const i of nOrder) {
    const n = g.nodes[i], p = P[i];
    const vis = layerA(n.layer) * alpha;
    if (vis < 0.01 || p.s <= 0) continue;
    const c = nodeCol(i);
    let r = (9 + 5 * n.size) * p.s;
    let bright = 0.5 + 0.35 * beatPulse;
    // failing node: alarm pulse + restart flicker
    if (i === g.ri) {
      const h = healAt(i, t);
      const alarm = (1 - h) * (0.5 + 0.5 * Math.sin(t * TAU * 1.4));
      bright += alarm * 0.6;
      r *= 1 + 0.15 * alarm;
      // restart: white flash then fake-green then back to red
      let fl = 0, green = 0;
      for (const ck of CLICKS) { const d = t - ck; if (d >= 0 && d < 0.5) { fl = Math.max(fl, Math.exp(-d * 14)); green = Math.max(green, d < 0.32 ? 1 : 0); } }
      if (t < T.snap && green > 0) { circle(ctx, p.x, p.y, r * 1.05, PAL.teal, 0.9 * vis); }
      glow(ctx, p.x, p.y, r * 7, green > 0 && t < T.snap ? PAL.teal : rgbaHex(c), 0.7 * bright * vis);
      if (fl > 0) glow(ctx, p.x, p.y, r * 5, '#ffffff', fl * vis);
    }
    if (i === g.ci && t > T.traceStart) {
      clockIcon(ctx, p.x, p.y, Math.max(r * 2.2, 26 * p.s), t, vis * clamp(seg(t, T.traceEnd - 0.4, T.traceEnd + 0.2) + (t > T.snap ? 1 : 0)));
    }
    glow(ctx, p.x, p.y, r * 4.2, rgbaHex(c), bright * vis * 0.8);
    circle(ctx, p.x, p.y, r, rgba(mixc(c, '#ffffff', 0.35)), 0.95 * vis);
    circle(ctx, p.x, p.y, r * 0.55, '#ffffff', 0.85 * vis);
    // healing ring as wave passes
    const hw = T.snap + g.hop[i] * 0.11, hd = t - hw;
    if (hd > 0 && hd < 0.8) ring(ctx, p.x, p.y, r * (1 + hd * 6), rgba(PAL.teal), 2.5, (1 - hd / 0.8) * vis);
  }
  return { P, cam, g };
}
const rgbaHex = c => '#' + c.map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');

function clockIcon(ctx, x, y, r, t, a) {
  if (a <= 0.01) return;
  // before fix: hands jitter, 3 minutes behind; flick spins them forward; snap locks
  let minute = -0.05 * TAU;     // "3 minutes late"
  const spin = E.inOutCubic(seg(t, T.flick, T.snap));
  minute += spin * (TAU * 2 + 0.05 * TAU);
  const jit = t < T.flick ? 0.04 * noise(t * 9, 3) : 0;
  const c = t < T.snap ? PAL.amber : PAL.teal;
  glow(ctx, x, y, r * 2.4, c, 0.6 * a);
  circle(ctx, x, y, r, '#101830', 0.92 * a);
  ring(ctx, x, y, r, rgba(c), Math.max(2, r * 0.12), a);
  for (let k = 0; k < 12; k++) {
    const an = k / 12 * TAU;
    line(ctx, x + Math.cos(an) * r * 0.78, y + Math.sin(an) * r * 0.78, x + Math.cos(an) * r * 0.9, y + Math.sin(an) * r * 0.9, rgba(c), Math.max(1, r * 0.05), a * 0.8);
  }
  const ha = -Math.PI / 2 + (3 / 12 + 14 / 720) * TAU + minute / 12 + jit;   // ~03:14
  const ma = -Math.PI / 2 + 14 / 60 * TAU + minute + jit * 3;
  line(ctx, x, y, x + Math.cos(ha) * r * 0.5, y + Math.sin(ha) * r * 0.5, '#ffffff', Math.max(2, r * 0.1), a);
  line(ctx, x, y, x + Math.cos(ma) * r * 0.75, y + Math.sin(ma) * r * 0.75, '#ffffff', Math.max(1.5, r * 0.07), a);
  circle(ctx, x, y, r * 0.08, '#fff', a);
}

// ---------------------------------------------------------------------------
// Bedroom (side view, night)
const stars = Array.from({ length: 70 }, (_, i) => [hash(i * 3) , hash(i * 3 + 1), hash(i * 3 + 2)]);
function drawBedroom(ctx, t, s) {
  // s: {screenOn, phoneOn, pose, laptop:{x,y,open}}
  vgrad(ctx, '#0a1029', '#060917');
  // window
  const wx = 1240, wy = 150, ww = 430, wh = 400;
  const sky = ctx.createLinearGradient(0, wy, 0, wy + wh);
  sky.addColorStop(0, '#0d1a44'); sky.addColorStop(1, '#1b2d5e');
  ctx.fillStyle = sky; ctx.fillRect(wx, wy, ww, wh);
  ctx.save(); ctx.beginPath(); ctx.rect(wx, wy, ww, wh); ctx.clip();
  for (const [a, b, c] of stars) circle(ctx, wx + a * ww, wy + b * wh * 0.8, 1 + c * 1.3, '#dfe8ff', 0.4 + 0.5 * Math.abs(Math.sin(t * (0.5 + c) + a * 10)));
  // crescent moon
  const mx = wx + ww * 0.68, my = wy + wh * 0.3;
  glow(ctx, mx, my, 180, '#bcd0ff', 0.35);
  crescent(ctx, mx, my, 36, { color: PAL.moon, k: 0.42, inner: 0.9, angle: -0.5 });
  // distant city silhouettes
  ctx.fillStyle = '#0a1230';
  for (let i = 0; i < 14; i++) { const bx = wx + i * 34, bh = 40 + hash(i + 40) * 90; ctx.fillRect(bx, wy + wh - bh, 30, bh); }
  ctx.fillStyle = '#ffd38a';
  for (let i = 0; i < 40; i++) { const bx = wx + hash(i + 70) * ww, by = wy + wh - hash(i + 99) * 110; if (hash(i + 7) > 0.5) ctx.fillRect(bx, by, 3, 4); }
  ctx.restore();
  // window frame
  ctx.strokeStyle = '#1d2547'; ctx.lineWidth = 14; ctx.strokeRect(wx, wy, ww, wh);
  ctx.lineWidth = 8; line(ctx, wx + ww / 2, wy, wx + ww / 2, wy + wh, '#1d2547', 8); line(ctx, wx, wy + wh / 2, wx + ww, wy + wh / 2, '#1d2547', 8);
  // moonlight spill on wall + bed
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  ctx.restore();
  glow(ctx, wx + ww * 0.4, wy + wh * 0.5, 620, '#6f8cff', 0.10);
  // floor
  vgrad(ctx, '#080c20', '#04060f', 0, 880, W, 200);
  // phone glow on wall
  if (s.phoneOn > 0) { glow(ctx, 265, 560, 420, '#6fb8ff', 0.45 * s.phoneOn); }
  if (s.screenOn > 0) { glow(ctx, s.laptop.x + 40, s.laptop.y - 80, 520, '#5fe0ff', 0.32 * s.screenOn); }
  // nightstand
  ctx.fillStyle = '#121833'; rrect(ctx, 190, 610, 150, 270, 10); ctx.fill();
  ctx.fillStyle = '#0d1229'; ctx.fillRect(205, 700, 120, 6);
  // phone (with buzz jitter)
  let jx = 0, jy = 0;
  for (const b of T.buzz) { const d = t - b; if (d > 0 && d < 0.35) { jx += Math.sin(d * 220) * 3 * (1 - d / 0.35); } }
  ctx.fillStyle = '#05070f'; rrect(ctx, 225 + jx, 598 + jy, 82, 12, 4); ctx.fill();
  if (s.phoneOn > 0) { ctx.fillStyle = rgba('#bfe2ff', s.phoneOn); rrect(ctx, 229 + jx, 598 + jy, 74, 5, 2); ctx.fill(); glow(ctx, 266 + jx, 600, 70, '#9fd2ff', s.phoneOn); }
  // bed: headboard, mattress
  ctx.fillStyle = '#151b38'; rrect(ctx, 360, 440, 46, 440, 14); ctx.fill();
  ctx.fillStyle = '#1a2142'; rrect(ctx, 380, 640, 900, 120, 22); ctx.fill();
  ctx.fillStyle = '#10152e'; ctx.fillRect(400, 760, 18, 120); ctx.fillRect(1240, 760, 18, 120);
  // pillow
  ctx.fillStyle = '#2b3360'; ctx.beginPath(); ctx.ellipse(500, 625, 105, 34, -0.05, 0, TAU); ctx.fill();
  // her (behind blanket)
  drawHer(ctx, 760, 628, 520, s.pose, { style: STYLE_NIGHT, rim: { color: s.rimColor || '#8fb0ff', dx: s.rimDir?.[0] ?? 1, dy: s.rimDir?.[1] ?? -0.6, width: 3 }, hide: { legs: true }, halo: 0.12 });
  // laptop
  drawLaptopSide(ctx, s.laptop.x, s.laptop.y, s.laptop.open, s.screenOn, s.laptop.rot || 0);
  // blanket over legs (soft lumps)
  ctx.fillStyle = '#2a3266';
  ctx.beginPath(); ctx.moveTo(640, 655);
  ctx.bezierCurveTo(700, s.blanketTop ?? 600, 820, 590, 900, 612);
  ctx.bezierCurveTo(1000, 630, 1080, 590, 1180, 615);
  ctx.bezierCurveTo(1250, 630, 1300, 660, 1290, 700);
  ctx.lineTo(1300, 790); ctx.bezierCurveTo(1100, 810, 800, 800, 600, 790); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(140,160,255,0.18)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(700, 640); ctx.bezierCurveTo(800, 700, 950, 690, 1040, 650); ctx.stroke();
}
function drawLaptopSide(ctx, x, y, open, on, rot) {
  // side view: base slab + lid rotating up from the hinge at the back (x)
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = '#3a4266'; rrect(ctx, -90, -6, 180, 10, 3); ctx.fill();
  const ang = -lerp(0.04, 1.85, open);    // lid angle (0 closed lying on base)
  ctx.save(); ctx.translate(-88, -4); ctx.rotate(ang);
  ctx.fillStyle = '#4a5280'; rrect(ctx, 0, -6, 170, 8, 3); ctx.fill();
  if (on > 0) { ctx.fillStyle = rgba('#9feaff', on * 0.9); ctx.fillRect(4, 1, 160, 2); }
  ctx.restore(); ctx.restore();
}

// ---------------------------------------------------------------------------
// Over-the-shoulder: her back, laptop screen; screen content = network (flat) mapped into the screen rect.
const SCR = { x: 690, y: 210, w: 800, h: 450 };
function drawOTS(ctx, t, s) {
  // s: {lid 0..1, zoom 0..1 (dive), screenOn, msg:[...], chrome}
  // camera: lerp from identity to mapping SCR -> full frame
  const z = s.zoom;
  const kz = Math.pow(W / SCR.w, z);                    // scale
  const cx = lerp(W / 2, SCR.x + SCR.w / 2, z), cy = lerp(H / 2, SCR.y + SCR.h / 2, z);
  ctx.save();
  ctx.translate(W / 2, H / 2); ctx.scale(kz, kz); ctx.translate(-cx, -cy);
  // room behind (dark, soft)
  vgrad(ctx, '#0b1130', '#05070f', -2000, -2000, 6000, 6000);
  glow(ctx, 1700, 120, 520, '#7f9cff', 0.18);
  for (let i = 0; i < 9; i++) glow(ctx, 200 + i * 230, 120 + 40 * Math.sin(i), 40 + 30 * hash(i), '#ffd38a', 0.06);
  // laptop base (keyboard) in perspective
  const lid = s.lid;
  const bx = SCR.x - 40, by = SCR.y + SCR.h + 18, bw = SCR.w + 80;
  ctx.fillStyle = '#20263f';
  ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + bw, by); ctx.lineTo(bx + bw + 120, by + 300); ctx.lineTo(bx - 120, by + 300); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(140,170,255,0.25)'; ctx.lineWidth = 2; ctx.stroke();
  for (let r = 0; r < 4; r++) for (let k = 0; k < 13; k++) {
    const u = (k + 0.5) / 13, v = 0.15 + r * 0.17;
    const kx = lerp(lerp(bx, bx - 120, v), lerp(bx + bw, bx + bw + 120, v), u), ky = by + v * 300;
    const kw = lerp(46, 58, v), kh = 22;
    const pressed = s.typing && hash(Math.floor(t * 18) * 31 + k * 7 + r) > 0.93;
    ctx.fillStyle = pressed ? '#3f4a7a' : '#2b3256'; rrect(ctx, kx - kw / 2, ky, kw, kh, 4); ctx.fill();
  }
  // lid: screen rect grows from hinge (bottom) as it opens
  const sh = SCR.h * E.outCubic(lid);
  const sy = SCR.y + SCR.h - sh;
  ctx.fillStyle = '#0d1020'; rrect(ctx, SCR.x - 16, sy - 16, SCR.w + 32, sh + 30, 18); ctx.fill();
  if (lid > 0.02) {
    ctx.save(); ctx.beginPath(); ctx.rect(SCR.x, sy, SCR.w, sh); ctx.clip();
    ctx.fillStyle = '#04081a'; ctx.fillRect(SCR.x, sy, SCR.w, sh);
    // network content scaled into the screen
    ctx.save();
    ctx.translate(SCR.x, sy + (sh - SCR.h) * 0.5); ctx.scale(SCR.w / W, SCR.h / H);
    ctx.globalAlpha = s.screenOn;
    vgrad(ctx, '#071030', '#030616');
    drawNet(ctx, s.netT ?? t, { alpha: s.screenOn, state: s.netState });
    ctx.globalAlpha = 1;
    // dashboard chrome (falls away as we dive in)
    const ch = s.chrome * s.screenOn;
    if (ch > 0.01) {
      ctx.fillStyle = rgba('#0a0f24', 0.9 * ch); ctx.fillRect(0, 0, W, 86);
      text(ctx, '●', 40, 58, { size: 34, color: s.healed ? PAL.teal : PAL.alert, alpha: ch });
      text(ctx, s.healed ? 'payments · all systems normal' : 'payments · error rate 38% ↑', 90, 58, { size: 38, family: FONTS.mono, color: '#dfe8ff', alpha: ch });
      text(ctx, s.healed ? '03:41' : '03:15', W - 40, 58, { size: 38, family: FONTS.mono, color: '#9fb0d8', align: 'right', alpha: ch });
    }
    // chat overlay on screen (return shot)
    if (s.msgs) {
      let yy = 640;
      for (const m of s.msgs) {
        if (m.a <= 0) continue;
        bubble(ctx, m.right ? W - 120 : 140, yy, m.text, { size: 50, right: m.right, bg: m.right ? 'rgba(255,200,87,0.92)' : 'rgba(255,255,255,0.16)', color: m.right ? '#1a1206' : '#fff', alpha: m.a, avatar: m.avatar, scale: 0.9 + 0.1 * E.outBack(clamp(m.a)) });
        yy += 120;
      }
    }
    ctx.restore();
    ctx.restore();
    // screen glass sheen
    ctx.fillStyle = rgba('#ffffff', 0.03); ctx.beginPath(); ctx.moveTo(SCR.x, sy); ctx.lineTo(SCR.x + SCR.w * 0.4, sy); ctx.lineTo(SCR.x + SCR.w * 0.2, sy + sh); ctx.lineTo(SCR.x, sy + sh); ctx.fill();
  }
  ctx.restore();
  // screen light flood
  if (s.screenOn > 0) glow(ctx, lerp(1090, W / 2, z), lerp(430, H / 2, z), 900 * (1 + z), '#5fe0ff', 0.18 * s.screenOn * (1 - z));
  // her: foreground, back view, faster parallax (exits frame as we dive)
  const fz = 1 + z * 2.2;
  const fx = 430 - z * 1400, fy = 1290 + z * 700;
  const fa = 1 - seg(z, 0.08, 0.35);
  if (fa > 0.01) {
    const pose = { ...BACK_STAND, rS: 0.5, rE: 0.6, lS: 0.4, lE: 0.6, headTilt: s.headTilt || 0, hairSwing: s.hairSwing || 0, lean: 0.04, shrug: s.shrug || 0 };
    drawHer(ctx, fx, fy, 1150 * fz, pose, { view: 'back', style: STYLE_NIGHT, rim: { color: '#7fe8ff', dx: 0.8, dy: -1, width: 5 }, halo: 0.2 * s.screenOn, alpha: fa });
  }
}

// ---------------------------------------------------------------------------
// The figure standing in front of the network (back view, foreground left)
const NET_POSE = poseTrack([
  [6.2, { ...BACK_STAND, headTilt: -0.02 }],
  [9.0, { ...BACK_STAND, headTilt: 0.04, lean: 0.01 }],
  [11.5, { ...BACK_STAND, headTilt: -0.03, shrug: 0.4 }],
  // stop hand: raise right hand "wait"
  [12.3, { ...BACK_STAND, rS: 1.55, rE: 0.9, rW: 0.3, headTilt: 0, shrug: 0.2 }, E.outBack],
  [12.9, { ...BACK_STAND, rS: 1.45, rE: 0.95, rW: 0.3, headTilt: 0 }],
  // curious head tilt
  [13.6, { ...BACK_STAND, rS: 0.3, rE: 0.4, headTilt: 0.2, lean: -0.03 }],
  [15.0, { ...BACK_STAND, rS: 0.25, rE: 0.35, headTilt: 0.24, lean: -0.04 }],
  // grab the frame's left edge (left arm up and out)
  [15.6, { ...BACK_STAND, lS: 2.25, lE: 0.25, lW: 0.2, rS: 0.3, headTilt: 0.05, lean: -0.08 }, E.outCubic],
  // push: sweep left arm across toward the right
  [19.0, { ...BACK_STAND, lS: 0.1, lE: 1.2, lW: 0.0, rS: 0.5, rE: 0.3, headTilt: -0.06, lean: 0.08 }, E.inOutCubic],
  [20.3, { ...BACK_STAND, lS: 0.15, lE: 0.5, rS: 0.3, headTilt: -0.04, lean: 0.03 }],
]);
function drawHerInNet(ctx, t, P, g) {
  let pose = NET_POSE(t);
  // point at the clock, then flick
  if (t > T.point - 0.3) {
    const shx = 330 + 0.105 * 560, shy = 900 - 0.29 * 560;
    const c = P[g.ci];
    const aim = Math.atan2(c.x - shx, c.y - shy);           // angle from "down"
    const pIn = E.outCubic(seg(t, T.point - 0.3, T.point + 0.3));
    const pOut = E.inOutCubic(seg(t, T.snap + 0.4, T.snap + 1.4));
    const flick = Math.sin(seg(t, T.flick - 0.1, T.flick + 0.25) * Math.PI) * 0.25;
    const rS = lerp(pose.rS, aim - flick, pIn * (1 - pOut));
    pose = { ...pose, rS, rE: lerp(pose.rE, 0.05, pIn * (1 - pOut)), headTilt: lerp(pose.headTilt, 0.1, pIn * (1 - pOut)) };
    // tiny victory bounce after the snap
    const vb = Math.sin(seg(t, T.snap + 0.5, T.snap + 1.1) * Math.PI);
    pose.shrug = (pose.shrug || 0) + vb * 0.8;
  }
  pose.hairSwing = hairLag(NET_POSE, t, 'lean', 6) + 0.15 * Math.sin(t * 1.3);
  const bob = Math.sin(t * 1.6) * 3;
  const enter = E.outCubic(seg(t, T.inNet, T.inNet + 0.9));
  drawHer(ctx, 330 - (1 - enter) * 60, 900 + bob + (1 - enter) * 70, 560, pose, { alpha: enter, view: 'back', style: STYLE_NIGHT, rim: { color: t > T.snap ? '#7ff5d0' : '#8fd8ff', dx: 0.2, dy: -1, width: 4 }, halo: 0.22 });
}

// ---------------------------------------------------------------------------
const BED_POSE = poseTrack([
  [0, { ...SIDE_STAND, torso: -Math.PI / 2 + 0.02, head: 0.15, shF: 0.15, elF: 0.6, shB: 0.1, elB: 0.5 }],
  [T.sitUp, { ...SIDE_STAND, torso: -Math.PI / 2 + 0.02, head: 0.25, shF: 0.4, elF: 0.6, shB: 0.1, elB: 0.5 }],
  [T.sitUp + 0.55, { ...SIDE_STAND, torso: 0.12, head: 0.1, shF: 0.4, elF: 0.4, shB: 0.2, elB: 0.4 }, E.outBack],
  [T.sitUp + 0.9, { ...SIDE_STAND, torso: 0.02, head: 0.05, shF: 0.55, elF: 0.5, shB: 0.4, elB: 0.6 }],
  [3.3, { ...SIDE_STAND, torso: 0.1, head: 0.35, shF: 0.95, elF: 0.6, shB: 0.85, elB: 0.7 }],
  [3.6, { ...SIDE_STAND, torso: 0.08, head: 0.4, shF: 0.9, elF: 0.75, shB: 0.8, elB: 0.8 }],
]);
const END_POSE = poseTrack([
  [T.cut2, { ...SIDE_STAND, torso: 0.08, head: 0.35, shF: 0.95, elF: 0.75, shB: 0.85, elB: 0.8 }],
  [T.lidClose + 0.15, { ...SIDE_STAND, torso: 0.1, head: 0.3, shF: 0.9, elF: 0.4, shB: 0.8, elB: 0.5 }],
  [T.flop - 0.1, { ...SIDE_STAND, torso: 0.05, head: -0.1, shF: 0.5, elF: 0.3, shB: 0.3, elB: 0.3 }],
  [T.flop + 0.45, { ...SIDE_STAND, torso: -Math.PI / 2 - 0.06, head: 0.2, shF: -1.2, elF: 1.4, shB: -1.0, elB: 1.2 }, E.inCubic],
  [T.flop + 0.75, { ...SIDE_STAND, torso: -Math.PI / 2 + 0.03, head: 0.12, shF: -1.3, elF: 1.5, shB: -1.1, elB: 1.3 }, E.outQuad],
]);

// ---------------------------------------------------------------------------
function timestamp(ctx, str, a) {
  text(ctx, str, 70, 1010, { size: 30, family: FONTS.mono, color: '#a9b8e8', alpha: a, spacing: 2 });
}

export default {
  duration: T.end,
  cues,
  subs,
  render(ctx, t, info) {
    const frame = info?.frame || 0;
    let postOpts = { bloom: 0.6, vignette: 0.55, grain: 0.06, frame };
    if (t < T.cut1) {
      // ---------------- Shot A1: bedroom, the page ----------------
      const push = 1 + 0.1 * E.inOutSine(seg(t, 0.8, T.cut1));
      let shake = 0; for (const b of T.buzz) { const d = t - b; if (d > 0 && d < 0.3) shake += Math.sin(d * 90) * 4 * (1 - d / 0.3); }
      ctx.save();
      ctx.translate(700, 560); ctx.scale(push, push); ctx.translate(-700 + shake, -560);
      const pose = BED_POSE(t);
      pose.hairSwing = hairLag(BED_POSE, t, 'torso', 2.5);
      const phoneOn = clamp(seg(t, T.buzz[0], T.buzz[0] + 0.1)) * (0.75 + 0.25 * Math.sin(t * 9));
      const lx = lerp(950, 860, E.inOutCubic(seg(t, 2.8, 3.4))), ly = lerp(612, 588, E.inOutCubic(seg(t, 2.8, 3.4)));
      drawBedroom(ctx, t, { pose, phoneOn, screenOn: 0, laptop: { x: lx, y: ly, open: 0 }, rimColor: '#9fc2ff', rimDir: [-1, -0.3] });
      ctx.restore();
      // notification banner
      const nb = E.outBack(seg(t, T.banner, T.banner + 0.45)) - E.inCubic(seg(t, 3.2, 3.55));
      if (nb > 0.001) notification(ctx, 560, lerp(-170, 40, nb), 800, { app: 'PAGER', time: 'now', icon: '!', title: 'payments are failing', body: 'error rate 38% and climbing · you are on call', alpha: clamp(nb * 1.5) });
      timestamp(ctx, '03:14', seg(t, 0.25, 0.9));
      postOpts.fade = seg(t, 0, 0.8);
      postOpts.bloom = 0.5;
    } else if (t < T.inNet) {
      // ---------------- Shot A2: over the shoulder, lid opens, dive ----------------
      const lid = seg(t, T.lidOpen, T.lidOpen + 0.55);
      const zoom = E.inOutExpo(seg(t, T.diveStart, T.inNet));
      drawOTS(ctx, t, { lid, zoom, screenOn: clamp(seg(t, T.lidOpen + 0.2, T.lidOpen + 0.7)), chrome: 1 - seg(t, T.diveStart + 0.6, T.diveStart + 1.3), netT: t, hairSwing: 0.2 * Math.sin(t * 2) });
      timestamp(ctx, '03:15', 1 - seg(t, T.diveStart, T.diveStart + 0.6));
      postOpts.bloom = 0.7;
    } else if (t < T.diveOut) {
      // ---------------- Shot B/C/D: the network ----------------
      vgrad(ctx, '#071030', '#030616');
      const { P, g } = drawNet(ctx, t);
      // chat panel
      const chatA = win(t, T.chat[0] - 0.3, T.stopHand + 1.4, 0.4, 0.8);
      if (chatA > 0) {
        ctx.save(); ctx.globalAlpha = chatA;
        rrect(ctx, 1370, 170, 500, 470, 26); ctx.fillStyle = 'rgba(10,14,36,0.78)'; ctx.fill();
        ctx.strokeStyle = 'rgba(160,190,255,0.18)'; ctx.lineWidth = 2; ctx.stroke();
        ctx.restore();
        text(ctx, '# incident-payments', 1400, 215, { size: 24, family: FONTS.mono, color: '#9fb0d8', alpha: chatA });
        const msgs = [
          ['payments down again 😩', '#5fd1c1'], ['restart it?', '#9b7bff'], ["it's always fixed by a restart 🤷", '#ff9f6b'],
          ['again?', '#9b7bff'], ['again.', '#5fd1c1'],
        ];
        let yy = 245;
        msgs.forEach(([m, av], k) => {
          const a = E.outCubic(seg(t, T.chat[k], T.chat[k] + 0.3)) * chatA;
          if (a > 0) { const h = bubble(ctx, 1440, yy, m, { size: 26, avatar: av, alpha: a, scale: 0.85 + 0.15 * E.outBack(seg(t, T.chat[k], T.chat[k] + 0.35)) }); }
          yy += 76;
        });
      }
      // restart cursor + counter
      const R = P[g.ri];
      let nClicks = 0; for (const c of CLICKS) if (t >= c) nClicks++;
      const curA = win(t, CLICKS[0] - 0.8, T.stopHand + 0.4, 0.3, 0.3);
      if (curA > 0) {
        const approach = E.inOutCubic(seg(t, CLICKS[0] - 0.8, CLICKS[0] - 0.05));
        let cx = lerp(1400, R.x + 8, approach), cy = lerp(520, R.y + 10, approach);
        let press = 0; for (const c of CLICKS) { const d = t - c; if (d >= -0.04 && d < 0.1) press = 1; }
        cx += noise(t * 30, 5) * 4 * seg(t, 9.4, 9.6); cy += noise(t * 30, 6) * 4 * seg(t, 9.4, 9.6);
        drawCursor(ctx, cx, cy + press * 3, curA);
        for (const c of CLICKS) { const d = t - c; if (d >= 0 && d < 0.4) ring(ctx, R.x, R.y, 20 + d * 120, '#ffffff', 3, (1 - d / 0.4) * 0.8 * curA); }
      }
      const cntA = win(t, CLICKS[0], T.question + 1.8, 0.2, 0.6);
      if (cntA > 0 && nClicks > 0) {
        const pop = 1 + 0.25 * Math.exp(-(t - CLICKS[nClicks - 1]) * 12);
        ctx.save(); ctx.translate(R.x, R.y - 78); ctx.scale(pop, pop);
        tag(ctx, 0, 0, `↻ restart ×${nClicks}`, { size: 30, align: 'center', dot: PAL.alert, alpha: cntA, border: 'rgba(255,90,70,0.6)' });
        ctx.restore();
      }
      if (t < T.snap) tag(ctx, R.x, R.y + 62, 'payments', { size: 22, align: 'center', alpha: 0.85 * (1 - seg(t, T.turnStart, T.turnStart + 0.6)) });
      // the question
      const qa = win(t, T.question, T.turnEnd - 0.2, 0.01, 0.8);
      if (qa > 0) {
        revealText(ctx, '从来如此，便对吗？', 960, 118, seg(t, T.question, T.question + 1.3), { size: 76, align: 'center', color: '#fff4dc', glow: 'rgba(255,200,87,0.7)', alpha: qa, spacing: 6 });
        text(ctx, '“It has always been done this way.” — Does that make it right?', 960, 178, { size: 34, family: FONTS.serif, style: 'italic', align: 'center', color: '#d9e2ff', alpha: qa * seg(t, T.question + 0.9, T.question + 1.6) });
      }
      // found: clock label
      const C = P[g.ci];
      const ca = win(t, T.traceEnd - 0.1, T.snap + 1.0, 0.3, 0.5);
      if (ca > 0) tag(ctx, C.x, C.y - 92, 'a clock running 3 minutes late', { size: 26, align: 'center', dot: PAL.amber, alpha: ca, border: 'rgba(255,180,70,0.6)' });
      // root cause + resolved stamp
      const ra = win(t, T.rootTag, T.diveOut + 0.2, 0.4, 0.4);
      if (ra > 0) {
        const gr = ctx.createLinearGradient(1100, 0, 1920, 0); gr.addColorStop(0, 'rgba(3,6,22,0)'); gr.addColorStop(0.35, 'rgba(3,6,22,0.75)');
        ctx.fillStyle = gr; ctx.globalAlpha = ra; ctx.fillRect(1100, 760, 820, 170); ctx.globalAlpha = 1;
        text(ctx, 'ROOT CAUSE', 1860, 800, { size: 22, family: FONTS.mono, color: '#7ff5d0', alpha: ra, spacing: 4, align: 'right' });
        text(ctx, 'one clock nobody thought to check', 1860, 848, { size: 40, family: FONTS.serif, color: '#ffffff', alpha: ra, align: 'right' });
        text(ctx, 'restarting fixed nothing. fixing the clock fixed everything.', 1860, 892, { size: 25, family: FONTS.ui, color: '#a8c4d8', alpha: ra * seg(t, T.rootTag + 0.6, T.rootTag + 1.2), align: 'right' });
      }
      const sp = seg(t, T.stamp, T.stamp + 0.35);
      if (sp > 0) {
        const sa = 1 - seg(t, T.diveOut - 0.2, T.diveOut + 0.2);
        seal(ctx, 1745, 330, 150, '已解决', sp, { alpha: sa });
        text(ctx, 'RESOLVED · 03:41', 1745, 445, { size: 24, family: FONTS.mono, align: 'center', color: '#ffb0a8', alpha: sa * seg(t, T.stamp + 0.2, T.stamp + 0.6), spacing: 3 });
      }
      // status line
      const healed = t > T.snap + 0.6;
      text(ctx, healed ? '●  ALL SYSTEMS NORMAL' : '●  SEV-2 · payments failing', 70, 80, { size: 24, family: FONTS.mono, color: healed ? PAL.teal : PAL.alert, alpha: 0.9, spacing: 2 });
      // her
      drawHerInNet(ctx, t, P, g);
      // snap flash
      const fl = Math.exp(-Math.max(0, t - T.snap) * 6) * (t >= T.snap ? 1 : 0);
      if (fl > 0.01) { ctx.fillStyle = rgba('#d8fff4', fl * 0.22); ctx.fillRect(0, 0, W, H); }
      postOpts.bloom = 0.85 + 0.35 * fl;
      // whoosh-in from the dive: brief zoom settle
      const settle = 1 - E.outCubic(seg(t, T.inNet, T.inNet + 0.6));
      if (settle > 0) { ctx.fillStyle = rgba('#5fe0ff', settle * 0.12); ctx.fillRect(0, 0, W, H); }
    } else if (t < T.cut2) {
      // ---------------- dive out: back to the laptop, she types "fixed" ----------------
      const zoom = 1 - E.inOutExpo(seg(t, T.diveOut, T.diveOut + 1.2));
      const st = netState(t);
      const msgs = [
        { text: 'fixed. it was a clock 🕒', right: true, a: E.outCubic(seg(t, cues.send, cues.send + 0.3)) },
        { text: 'going back to sleep 💤', right: true, a: E.outCubic(seg(t, cues.send + 0.25, cues.send + 0.55)) },
      ];
      drawOTS(ctx, t, { lid: 1, zoom, screenOn: 1, chrome: seg(t, T.diveOut + 0.6, T.diveOut + 1.1), netT: t, netState: st, healed: true, typing: t > 26.9 && t < 28.1, msgs, hairSwing: 0.15 * Math.sin(t * 2), shrug: 0.3 * Math.sin(seg(t, 28.2, 28.6) * Math.PI) });
      timestamp(ctx, '03:41', seg(t, T.diveOut + 0.6, T.diveOut + 1.0));
      postOpts.bloom = 0.7;
    } else {
      // ---------------- Shot E: bedroom, laptop closes, flop, zzz ----------------
      const pose = END_POSE(t);
      pose.hairSwing = hairLag(END_POSE, t, 'torso', 2.5);
      const on = 1 - seg(t, T.lidClose, T.lidClose + 0.08);
      const open = 1 - E.inCubic(seg(t, T.cut2 + 0.05, T.lidClose));
      const aside = E.inOutCubic(seg(t, T.lidClose + 0.1, T.flop));
      drawBedroom(ctx, t, { pose, phoneOn: 0, screenOn: on, laptop: { x: lerp(860, 1010, aside), y: lerp(588, 612, aside), open, rot: 0 }, rimColor: on > 0.5 ? '#7fe8ff' : '#9fc2ff', rimDir: on > 0.5 ? [1, -0.5] : [-1, -0.3] });
      // zzz
      const zA = seg(t, T.zzz, T.zzz + 0.3);
      if (zA > 0) for (let k = 0; k < 3; k++) {
        const u = seg(t, T.zzz + k * 0.28, T.zzz + k * 0.28 + 1.6);
        if (u <= 0) continue;
        text(ctx, 'z', 560 + k * 40 + Math.sin(u * 6 + k) * 10, 545 - u * 190 - k * 24, { size: 44 + k * 16, family: FONTS.serif, style: 'italic', color: '#dfe8ff', alpha: Math.sin(u * Math.PI) });
      }
      timestamp(ctx, '03:41', 1);
      postOpts.bloom = 0.45;
      postOpts.fade = 1 - seg(t, T.end - 0.7, T.end);
    }
    post(ctx, postOpts);
  },
};

function drawCursor(ctx, x, y, a) {
  ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.scale(1.6, 1.6);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 26); ctx.lineTo(7, 20); ctx.lineTo(12, 31); ctx.lineTo(16, 29); ctx.lineTo(11, 18); ctx.lineTo(19, 18); ctx.closePath();
  ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.strokeStyle = '#0a0f24'; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
}
