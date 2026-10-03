// core.js — math, easing, deterministic randomness, colour, keyframes.
// Everything here is pure: the film is a function of time.

export const W = 1920, H = 1080;           // logical canvas size
export const TAU = Math.PI * 2;

export const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
export const lerp = (a, b, t) => a + (b - a) * t;
export const invlerp = (a, b, x) => clamp((x - a) / (b - a));
export const remap = (x, a, b, c, d) => lerp(c, d, invlerp(a, b, x));
export const frac = x => x - Math.floor(x);
export const smooth = t => t * t * (3 - 2 * t);
export const smoother = t => t * t * t * (t * (t * 6 - 15) + 10);

// progress of t through [a,b], clamped 0..1
export const seg = (t, a, b) => clamp((t - a) / (b - a));
// 0 -> 1 -> 0 window with soft edges (fade in over fi, out over fo)
export const win = (t, a, b, fi = 0.3, fo = 0.3) =>
  Math.min(seg(t, a, a + fi), 1 - seg(t, b - fo, b));

export const E = {
  linear: t => t,
  inQuad: t => t * t,
  outQuad: t => 1 - (1 - t) * (1 - t),
  inOutQuad: t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  inCubic: t => t * t * t,
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inOutCubic: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
  outSine: t => Math.sin(t * Math.PI / 2),
  inExpo: t => t === 0 ? 0 : Math.pow(2, 10 * t - 10),
  outExpo: t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
  inOutExpo: t => t === 0 ? 0 : t === 1 ? 1 : t < .5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
  outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  inBack: t => { const c1 = 1.70158, c3 = c1 + 1; return c3 * t * t * t - c1 * t * t; },
  outElastic: t => t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * (TAU / 3)) + 1,
  outBounce: t => {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + .75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + .9375;
    return n1 * (t -= 2.625 / d1) * t + .984375;
  },
};

// ---- deterministic randomness ------------------------------------------
export function hash(n) {               // integer -> [0,1)
  let x = (n | 0) * 374761393 + 668265263;
  x = (x ^ (x >>> 13)) * 1274126177;
  x = x ^ (x >>> 16);
  return (x >>> 0) / 4294967296;
}
export const hash2 = (a, b) => hash(a * 73856093 ^ b * 19349663);
export function rng(seed) {             // mulberry32
  let a = seed >>> 0;
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
// smooth 1D value noise in [-1,1]
export function noise(x, seed = 0) {
  const i = Math.floor(x), f = x - i;
  const a = hash(i + seed * 1013) * 2 - 1, b = hash(i + 1 + seed * 1013) * 2 - 1;
  return lerp(a, b, smoother(f));
}
export const fbm = (x, seed = 0) => noise(x, seed) * .6 + noise(x * 2.1, seed + 7) * .3 + noise(x * 4.3, seed + 13) * .1;

// ---- keyframe tracks ----------------------------------------------------
// keys: [[time, value, easeIntoThisKey?], ...]  value may be number or array
export function track(keys) {
  return t => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, v1, ez] = keys[i];
      if (t <= t1) {
        const [t0, v0] = keys[i - 1];
        const u = (ez || E.inOutCubic)((t - t0) / (t1 - t0));
        if (Array.isArray(v0)) return v0.map((x, j) => lerp(x, v1[j], u));
        return lerp(v0, v1, u);
      }
    }
    return keys[keys.length - 1][1];
  };
}

// ---- colour -------------------------------------------------------------
const _hexCache = new Map();
export function hex(h) {
  let v = _hexCache.get(h);
  if (!v) {
    const s = h.replace('#', '');
    const n = parseInt(s.length === 3 ? s.split('').map(c => c + c).join('') : s, 16);
    v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    _hexCache.set(h, v);
  }
  return v;
}
export const rgba = (c, a = 1) => {
  const [r, g, b] = typeof c === 'string' ? hex(c) : c;
  return `rgba(${r | 0},${g | 0},${b | 0},${clamp(a)})`;
};
export const mixc = (c1, c2, t) => {
  const a = typeof c1 === 'string' ? hex(c1) : c1, b = typeof c2 === 'string' ? hex(c2) : c2;
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
};

// ---- 2D helpers -------------------------------------------------------------
export const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
export function bezPoint(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
}

// Shared palette (scenes may extend)
export const PAL = {
  night: '#070b1c', navy: '#0b1230', ink: '#141a33', glass: '#5fe0ff', teal: '#38e0b8',
  alert: '#ff4d3d', amber: '#ffb347', gold: '#ffc857', cream: '#f4ead8', moon: '#fff4d6',
  rose: '#ff8fa3', violet: '#7b5cff', seal: '#d7261e', hair: '#1b1420', skin: '#e8c3a5',
  sweater: '#efe3cf',
};
