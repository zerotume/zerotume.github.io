// cat.js — the round cat. Born as the meme she posts ("which animal can't jump?"); becomes her
// mischievous companion. Gloriously spherical. Never jumps.
// drawCat(ctx, x, y, size, state): x,y = centre of the body's ground contact; size = body diameter in px.
// state: {face:1|-1, eye:0..1 (open), look:[dx,dy], mouth:'w'|'o'|'yawn'|'none', tail:-1..1, squash:0..1(+squash/-stretch),
//         curl:0..1 (ball -> sleeping crescent), wiggle:0..1, walk:phase|null, paw:0..1 (raise front paw), ear:0..1 twitch,
//         style:{fur, belly, stripe, ...}, shadowOnly:bool, color override for silhouettes}
import { TAU, clamp, lerp } from './core.js';

export const CAT_GINGER = { fur: '#f0a352', furShade: '#d9843c', belly: '#fde8cc', stripe: '#c96f2a', nose: '#e88a8a', eye: '#2a1a12', line: '#5a3418', innerEar: '#f6b9a4' };
export const CAT_NIGHT = { fur: '#c98a4e', furShade: '#a96f3a', belly: '#e9d2b4', stripe: '#9c5a26', nose: '#c87676', eye: '#1a0f0a', line: '#3a220f', innerEar: '#d99c8a' };

export function catSilhouette(ctx, s, R) {
  // body + head + ears as one path (for shadows); local coords, origin at ground centre
  const curl = s.curl || 0;
  ctx.beginPath();
  ctx.ellipse(0, -R * 0.95, R * 1.0, R * 0.95 * (1 - (s.squash || 0) * 0.15), 0, 0, TAU);
  const hx = R * 0.42 * (s.face || 1), hy = -R * 1.55;
  ctx.moveTo(hx + R * 0.62, hy);
  ctx.ellipse(hx, hy, R * 0.62, R * 0.55, 0, 0, TAU);
  // ears
  for (const sgn of [-1, 1]) {
    const ex = hx + sgn * R * 0.36, ey = hy - R * 0.38;
    ctx.moveTo(ex - R * 0.2, ey + R * 0.08); ctx.lineTo(ex + sgn * R * 0.05, ey - R * 0.42); ctx.lineTo(ex + R * 0.2, ey + R * 0.05); ctx.closePath();
  }
}

export function drawCat(ctx, x, y, size, s = {}) {
  const C = s.style || CAT_GINGER;
  const R = size / 2;
  const f = s.face || 1;
  const sq = s.squash || 0;
  const curl = clamp(s.curl || 0);
  const t = s.t || 0;
  ctx.save();
  ctx.translate(x, y);
  if (s.alpha !== undefined) ctx.globalAlpha *= s.alpha;
  // walk bob + wiggle
  let bob = 0, rot = 0;
  if (s.walk != null) { bob = Math.abs(Math.sin(s.walk * Math.PI)) * R * 0.08; rot = Math.sin(s.walk * Math.PI) * 0.06; }
  if (s.wiggle) rot += Math.sin(t * 38) * 0.05 * s.wiggle;
  ctx.translate(0, -bob); ctx.rotate(rot);
  ctx.scale(1 + sq * 0.18, 1 - sq * 0.18);

  if (s.silhouette) {
    ctx.fillStyle = s.silhouette; catSilhouette(ctx, s, R); ctx.fill(); ctx.restore(); return;
  }
  if (curl > 0.02) { drawCurl(ctx, R, curl, C, s, f); ctx.restore(); return; }

  // tail (behind body)
  const tw = (s.tail || 0) + Math.sin(t * 2.2) * 0.25;
  ctx.strokeStyle = C.furShade; ctx.lineWidth = R * 0.26; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-f * R * 0.75, -R * 0.45);
  ctx.bezierCurveTo(-f * R * 1.35, -R * 0.4, -f * R * (1.45 + tw * 0.2), -R * (1.0 + tw * 0.3), -f * R * (1.15 + tw * 0.25), -R * (1.45 + tw * 0.2));
  ctx.stroke();
  ctx.strokeStyle = C.stripe; ctx.lineWidth = R * 0.08;
  ctx.setLineDash([R * 0.12, R * 0.14]); ctx.stroke(); ctx.setLineDash([]);
  // feet (tiny)
  ctx.fillStyle = C.furShade;
  const wp = s.walk != null ? Math.sin(s.walk * TAU) * R * 0.12 : 0;
  for (const [fx, ph] of [[-0.45, 1], [0.15, -1], [0.5, 1]]) {
    ctx.beginPath(); ctx.ellipse(f * R * fx + ph * wp, -R * 0.06, R * 0.17, R * 0.1, 0, 0, TAU); ctx.fill();
  }
  // body
  const g = ctx.createRadialGradient(-R * 0.3, -R * 1.3, R * 0.2, 0, -R * 0.9, R * 1.15);
  g.addColorStop(0, C.fur); g.addColorStop(1, C.furShade);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(0, -R * 0.95, R, R * 0.95, 0, 0, TAU); ctx.fill();
  // belly
  ctx.fillStyle = C.belly;
  ctx.beginPath(); ctx.ellipse(f * R * 0.32, -R * 0.62, R * 0.5, R * 0.52, 0, 0, TAU); ctx.fill();
  // stripes on back
  ctx.strokeStyle = C.stripe; ctx.lineWidth = R * 0.09; ctx.lineCap = 'round';
  for (let k = 0; k < 4; k++) {
    const a = -Math.PI / 2 - f * (0.5 + k * 0.32);
    const cx = Math.cos(a) * R * 0.98, cy = -R * 0.95 + Math.sin(a) * R * 0.92;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx * 0.72, -R * 0.95 + (cy + R * 0.95) * 0.72); ctx.stroke();
  }
  // paw raise (boop)
  if (s.paw) {
    ctx.fillStyle = C.fur;
    const px = f * R * (0.75 + s.paw * 0.35), py = -R * (0.35 + s.paw * 0.55);
    ctx.beginPath(); ctx.ellipse(px, py, R * 0.18, R * 0.15, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = C.innerEar; ctx.beginPath(); ctx.arc(px + f * R * 0.05, py, R * 0.06, 0, TAU); ctx.fill();
  }
  // head
  const hx = f * R * 0.42, hy = -R * 1.55;
  ctx.fillStyle = C.fur;
  for (const sgn of [-1, 1]) {   // ears
    const tw2 = sgn === 1 ? (s.ear || 0) * 0.3 : 0;
    const ex = hx + sgn * R * 0.36, ey = hy - R * 0.38;
    ctx.save(); ctx.translate(ex, ey); ctx.rotate(sgn * 0.15 + tw2);
    ctx.beginPath(); ctx.moveTo(-R * 0.2, R * 0.1); ctx.lineTo(sgn * R * 0.04, -R * 0.38); ctx.lineTo(R * 0.2, R * 0.08); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.innerEar; ctx.beginPath(); ctx.moveTo(-R * 0.1, R * 0.06); ctx.lineTo(sgn * R * 0.03, -R * 0.24); ctx.lineTo(R * 0.1, R * 0.05); ctx.closePath(); ctx.fill();
    ctx.restore(); ctx.fillStyle = C.fur;
  }
  ctx.beginPath(); ctx.ellipse(hx, hy, R * 0.62, R * 0.55, 0, 0, TAU); ctx.fill();
  // forehead stripes
  ctx.strokeStyle = C.stripe; ctx.lineWidth = R * 0.06;
  for (const dx of [-0.12, 0, 0.12]) { ctx.beginPath(); ctx.moveTo(hx + dx * R, hy - R * 0.5); ctx.lineTo(hx + dx * R * 0.8, hy - R * 0.32); ctx.stroke(); }
  // muzzle
  ctx.fillStyle = C.belly; ctx.beginPath(); ctx.ellipse(hx + f * R * 0.12, hy + R * 0.2, R * 0.3, R * 0.2, 0, 0, TAU); ctx.fill();
  // eyes
  const eo = s.eye ?? 1, lk = s.look || [0, 0];
  for (const sgn of [-1, 1]) {
    const ex = hx + f * R * 0.08 + sgn * R * 0.24 + lk[0] * R * 0.05, ey = hy - R * 0.02 + lk[1] * R * 0.04;
    if (eo > 0.15) {
      ctx.fillStyle = C.eye; ctx.beginPath(); ctx.ellipse(ex, ey, R * 0.085, R * 0.11 * eo, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + R * 0.025, ey - R * 0.035 * eo, R * 0.03, 0, TAU); ctx.fill();
    } else {
      ctx.strokeStyle = C.line; ctx.lineWidth = R * 0.05; ctx.beginPath(); ctx.arc(ex, ey - R * 0.03, R * 0.09, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    }
  }
  // nose + mouth
  const nx = hx + f * R * 0.12, ny = hy + R * 0.13;
  ctx.fillStyle = C.nose; ctx.beginPath(); ctx.moveTo(nx - R * 0.06, ny - R * 0.03); ctx.lineTo(nx + R * 0.06, ny - R * 0.03); ctx.lineTo(nx, ny + R * 0.04); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = C.line; ctx.lineWidth = R * 0.035; ctx.lineCap = 'round';
  const mouth = s.mouth || 'w';
  if (mouth === 'w') {
    ctx.beginPath(); ctx.moveTo(nx, ny + R * 0.04); ctx.quadraticCurveTo(nx - R * 0.06, ny + R * 0.14, nx - R * 0.12, ny + R * 0.07);
    ctx.moveTo(nx, ny + R * 0.04); ctx.quadraticCurveTo(nx + R * 0.06, ny + R * 0.14, nx + R * 0.12, ny + R * 0.07); ctx.stroke();
  } else if (mouth === 'o' || mouth === 'yawn') {
    const oh = mouth === 'yawn' ? R * 0.16 : R * 0.07;
    ctx.fillStyle = '#7a3030'; ctx.beginPath(); ctx.ellipse(nx, ny + R * 0.08 + oh * 0.5, R * 0.07 * (mouth === 'yawn' ? 1.4 : 1), oh, 0, 0, TAU); ctx.fill();
  }
  // whiskers
  ctx.strokeStyle = 'rgba(90,52,24,0.55)'; ctx.lineWidth = R * 0.02;
  for (const sgn of [-1, 1]) for (const k of [-1, 0, 1]) {
    ctx.beginPath(); ctx.moveTo(nx + sgn * R * 0.18, ny + R * 0.06 + k * R * 0.04); ctx.lineTo(nx + sgn * R * 0.52, ny + k * R * 0.1); ctx.stroke();
  }
  ctx.restore();
}

// sleeping curl: body bends into a crescent (matches a crescent moon at curl=1)
function drawCurl(ctx, R, curl, C, s, f) {
  const N = 26;
  const span = lerp(0.2, 3.9, curl);           // radians of arc
  const rho = lerp(0.05, 0.62, curl) * R;      // arc radius
  const cy = -R * lerp(0.95, 0.72, curl);
  const a0 = -Math.PI / 2 - span / 2;
  ctx.fillStyle = C.fur;
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N, a = a0 + span * u;
    const thick = R * lerp(1.0, 0.42, curl) * (0.75 + 0.35 * Math.sin(u * Math.PI));
    pts.push([Math.cos(a) * rho * f, cy + Math.sin(a) * rho, thick]);
  }
  for (const [px, py, r] of pts) { ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.fill(); }
  // stripes along the back
  ctx.strokeStyle = C.stripe; ctx.lineWidth = R * 0.07; ctx.lineCap = 'round';
  for (let i = 3; i < N - 3; i += 4) {
    const [px, py, r] = pts[i];
    const a = a0 + span * i / N;
    ctx.beginPath(); ctx.moveTo(px + Math.cos(a) * f * r * 0.95, py + Math.sin(a) * r * 0.95); ctx.lineTo(px + Math.cos(a) * f * r * 0.55, py + Math.sin(a) * r * 0.55); ctx.stroke();
  }
  // head at the end (tucked), closed eyes
  const [hx, hy, hr] = pts[N];
  ctx.fillStyle = C.fur; ctx.beginPath(); ctx.arc(hx, hy, hr * 1.35, 0, TAU); ctx.fill();
  for (const sgn of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(hx + sgn * hr * 0.75 - hr * 0.25, hy - hr * 0.6); ctx.lineTo(hx + sgn * hr * 0.8, hy - hr * 1.35); ctx.lineTo(hx + sgn * hr * 0.75 + hr * 0.25, hy - hr * 0.55); ctx.closePath(); ctx.fill();
  }
  ctx.strokeStyle = C.line; ctx.lineWidth = R * 0.04;
  for (const sgn of [-1, 1]) { ctx.beginPath(); ctx.arc(hx + sgn * hr * 0.4, hy - hr * 0.05, hr * 0.22, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); }
  // tail wraps the other end
  const [tx, ty, tr] = pts[0];
  ctx.strokeStyle = C.furShade; ctx.lineWidth = R * 0.22;
  ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(tx + f * R * 0.5, ty + R * 0.5, tx + f * R * 0.9, ty + R * 0.35); ctx.stroke();
}

// polygon approximation of the sitting silhouette (local coords, origin ground centre, y up negative), for projected shadows
export function catOutline(R, face = 1) {
  const pts = [];
  const hx = R * 0.42 * face, hy = -R * 1.55;
  // body ellipse lower part (from left around bottom to right)
  for (let i = 0; i <= 20; i++) { const a = Math.PI * 0.95 - (i / 20) * Math.PI * 1.9 + Math.PI; pts.push([Math.cos(a) * R, -R * 0.95 + Math.sin(a) * R * 0.95]); }
  // up the right side to the head, ears (horns!)
  const ear = (sgn) => { const ex = hx + sgn * R * 0.36, ey = hy - R * 0.38; return [[ex - R * 0.2 * sgn * -1, ey + R * 0.1], [ex + sgn * R * 0.06, ey - R * 0.46], [ex + R * 0.2 * sgn * -1 * -1, ey + R * 0.06]]; };
  pts.push([hx + R * 0.62, hy + R * 0.1]);
  pts.push(...ear(1).reverse());
  pts.push([hx, hy - R * 0.5]);
  pts.push(...ear(-1).reverse());
  pts.push([hx - R * 0.62, hy + R * 0.1]);
  pts.push([-R * 0.9, -R * 1.3]);
  return pts;
}
