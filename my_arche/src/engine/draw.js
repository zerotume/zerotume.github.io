// draw.js — reusable drawing primitives: glows, text, UI cards, chat bubbles, seal stamps.
import { W, H, TAU, clamp, lerp, rgba, hex, E, seg } from './core.js';

export const FONTS = {
  ui: '"Inter", "Noto Sans CJK SC", sans-serif',
  uiCJK: '"Noto Sans CJK SC", "Inter", sans-serif',
  serif: '"Lora", "Noto Serif CJK SC", serif',
  cjkSerif: '"Noto Serif CJK SC", serif',
  mono: '"DejaVu Sans Mono", "Noto Sans Mono CJK SC", monospace',
  emoji: '"Noto Color Emoji"',
};

export function mkCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}

// ---- glow sprites -------------------------------------------------------
const glowCache = new Map();
function glowSprite(color, hard = 0) {
  const key = color + '|' + hard;
  let s = glowCache.get(key);
  if (s) return s;
  const N = 128; s = mkCanvas(N, N); const g = s.getContext('2d');
  const [r, gg, b] = hex(color);
  const grd = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  grd.addColorStop(0, `rgba(${r},${gg},${b},1)`);
  grd.addColorStop(clamp(0.08 + hard * 0.3), `rgba(${r},${gg},${b},${0.55 + hard * .4})`);
  grd.addColorStop(0.35, `rgba(${r},${gg},${b},0.18)`);
  grd.addColorStop(0.7, `rgba(${r},${gg},${b},0.04)`);
  grd.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  g.fillStyle = grd; g.fillRect(0, 0, N, N);
  glowCache.set(key, s);
  return s;
}
// additive glow centred at x,y with radius r
export function glow(ctx, x, y, r, color, alpha = 1, hard = 0) {
  if (alpha <= 0.003 || r <= 0.5) return;
  const op = ctx.globalCompositeOperation, ga = ctx.globalAlpha;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = ga * clamp(alpha);
  ctx.drawImage(glowSprite(color, hard), x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = ga; ctx.globalCompositeOperation = op;
}

export function circle(ctx, x, y, r, fill, alpha = 1) {
  if (alpha <= 0.003) return;
  ctx.globalAlpha = clamp(alpha);
  ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;
}
export function ring(ctx, x, y, r, stroke, lw = 2, alpha = 1, a0 = 0, a1 = TAU) {
  if (alpha <= 0.003) return;
  ctx.globalAlpha = clamp(alpha);
  ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), a0, a1); ctx.stroke();
  ctx.globalAlpha = 1;
}
export function line(ctx, x0, y0, x1, y1, stroke, lw = 2, alpha = 1) {
  if (alpha <= 0.003) return;
  ctx.globalAlpha = clamp(alpha);
  ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.globalAlpha = 1;
}
export function rrect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// ---- text ------------------------------------------------------------------
export function font(size, family = FONTS.ui, weight = 400, style = '') {
  return `${style} ${weight} ${size}px ${family}`;
}
export function text(ctx, str, x, y, o = {}) {
  const a = o.alpha ?? 1; if (a <= 0.003 || !str) return 0;
  ctx.save();
  ctx.globalAlpha = clamp(a);
  ctx.font = font(o.size || 32, o.family || FONTS.ui, o.weight || 400, o.style || '');
  ctx.textAlign = o.align || 'left';
  ctx.textBaseline = o.baseline || 'alphabetic';
  if (o.spacing) ctx.letterSpacing = o.spacing + 'px';
  if (o.shadow) { ctx.shadowColor = o.shadow; ctx.shadowBlur = o.shadowBlur ?? 18; }
  if (o.stroke) { ctx.strokeStyle = o.stroke; ctx.lineWidth = o.strokeWidth || 4; ctx.lineJoin = 'round'; ctx.strokeText(str, x, y); }
  ctx.fillStyle = o.color || '#fff';
  ctx.fillText(str, x, y);
  const w = ctx.measureText(str).width;
  ctx.restore();
  return w;
}
export function measure(ctx, str, o = {}) {
  ctx.save();
  ctx.font = font(o.size || 32, o.family || FONTS.ui, o.weight || 400, o.style || '');
  if (o.spacing) ctx.letterSpacing = o.spacing + 'px';
  const w = ctx.measureText(str).width; ctx.restore(); return w;
}
// reveal string progressively; p in 0..1 (CJK-safe: splits by code point)
export function typed(str, p) {
  const chars = Array.from(str);
  return chars.slice(0, Math.round(chars.length * clamp(p))).join('');
}
// text whose characters rise + fade in one by one (for "her voice" lines)
export function revealText(ctx, str, x, y, p, o = {}) {
  const chars = Array.from(str);
  ctx.save();
  ctx.font = font(o.size || 48, o.family || FONTS.cjkSerif, o.weight || 500, o.style || '');
  if (o.spacing) ctx.letterSpacing = o.spacing + 'px';
  const total = ctx.measureText(str).width;
  let cx = o.align === 'center' ? x - total / 2 : o.align === 'right' ? x - total : x;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const n = chars.length, spread = o.spread ?? 0.5;
  const alphaMul = o.alpha ?? 1;
  for (let i = 0; i < n; i++) {
    const ch = chars[i];
    const cw = ctx.measureText(ch).width + (o.spacing || 0);
    const start = (i / n) * (1 - spread);
    const q = clamp((p - start) / spread);
    const e = E.outCubic(q);
    if (q > 0) {
      ctx.globalAlpha = clamp(e * alphaMul);
      if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = 24 * (1 - q * .5); }
      ctx.fillStyle = o.color || '#fff';
      ctx.fillText(ch, cx, y + (1 - e) * (o.rise ?? 18));
    }
    cx += cw;
  }
  ctx.restore();
  return total;
}

// ---- UI pieces -------------------------------------------------------------
// phone-style notification banner
export function notification(ctx, x, y, w, o) {
  const a = o.alpha ?? 1; if (a <= 0.003) return;
  const h = o.h || 128;
  ctx.save(); ctx.globalAlpha = a;
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 12;
  rrect(ctx, x, y, w, h, 28); ctx.fillStyle = o.bg || 'rgba(28,32,52,0.92)'; ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 2; ctx.stroke();
  // icon
  rrect(ctx, x + 24, y + 24, 56, 56, 14); ctx.fillStyle = o.iconBg || '#ff4d3d'; ctx.fill();
  ctx.font = font(30, FONTS.ui, 800); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(o.icon || '!', x + 52, y + 53);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.font = font(22, FONTS.ui, 600); ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText(o.app || 'PAGER', x + 100, y + 44);
  ctx.textAlign = 'right'; ctx.fillText(o.time || 'now', x + w - 28, y + 44); ctx.textAlign = 'left';
  ctx.font = font(30, FONTS.ui, 700); ctx.fillStyle = '#fff';
  ctx.fillText(o.title || '', x + 100, y + 82);
  if (o.body) { ctx.font = font(24, FONTS.ui, 400); ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillText(o.body, x + 100, y + 112); }
  ctx.restore();
}

// chat bubble; returns height used
export function bubble(ctx, x, y, str, o = {}) {
  const a = o.alpha ?? 1; if (a <= 0.003) return 0;
  const size = o.size || 26, padX = 22, padY = 14;
  const fam = o.family || FONTS.ui;
  ctx.save();
  ctx.font = font(size, fam, o.weight || 450);
  const tw = ctx.measureText(str).width;
  const bw = tw + padX * 2, bh = size + padY * 2;
  const bx = o.right ? x - bw : x;
  const sc = o.scale ?? 1;
  ctx.globalAlpha = a;
  ctx.translate(bx + (o.right ? bw : 0), y + bh / 2); ctx.scale(sc, sc); ctx.translate(-(bx + (o.right ? bw : 0)), -(y + bh / 2));
  if (o.avatar) {
    const ax = o.right ? bx + bw + 16 + 20 : bx - 16 - 20;
    circle(ctx, ax, y + bh / 2, 20, o.avatar, a);
    ctx.globalAlpha = a;
  }
  rrect(ctx, bx, y, bw, bh, bh / 2); ctx.fillStyle = o.bg || 'rgba(255,255,255,0.12)'; ctx.fill();
  ctx.fillStyle = o.color || '#fff'; ctx.textBaseline = 'middle';
  ctx.fillText(str, bx + padX, y + bh / 2 + 1);
  ctx.restore();
  return bh;
}

// small label tag with dot
export function tag(ctx, x, y, str, o = {}) {
  const a = o.alpha ?? 1; if (a <= 0.003) return;
  ctx.save(); ctx.globalAlpha = a;
  const size = o.size || 22;
  ctx.font = font(size, o.family || FONTS.mono, o.weight || 500);
  const tw = ctx.measureText(str).width;
  const padX = 14, h = size + 16, w = tw + padX * 2 + (o.dot ? 18 : 0);
  const bx = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
  rrect(ctx, bx, y - h / 2, w, h, 8);
  ctx.fillStyle = o.bg || 'rgba(8,12,30,0.78)'; ctx.fill();
  ctx.strokeStyle = o.border || 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5; ctx.stroke();
  if (o.dot) circle(ctx, bx + padX + 5, y, 5, o.dot, a);
  ctx.globalAlpha = a;
  ctx.fillStyle = o.color || '#fff'; ctx.textBaseline = 'middle';
  ctx.fillText(str, bx + padX + (o.dot ? 18 : 0), y + 1);
  ctx.restore();
}

// Chinese seal-style stamp (red square, characters, slight rotation). p: 0..1 stamp-in progress
export function seal(ctx, x, y, size, chars, p, o = {}) {
  if (p <= 0) return;
  const a = clamp(p * 4);
  const s = lerp(1.9, 1, E.outCubic(clamp(p * 1.4)));
  ctx.save();
  ctx.translate(x, y); ctx.rotate(o.rot ?? -0.08); ctx.scale(s, s);
  ctx.globalAlpha = a * (o.alpha ?? 1);
  const col = o.color || '#d7261e';
  rrect(ctx, -size / 2, -size / 2, size, size, size * 0.08);
  ctx.fillStyle = col; ctx.fill();
  // inner border
  ctx.strokeStyle = 'rgba(255,240,230,0.85)'; ctx.lineWidth = size * 0.035;
  rrect(ctx, -size / 2 + size * .07, -size / 2 + size * .07, size * .86, size * .86, size * .05); ctx.stroke();
  ctx.fillStyle = 'rgba(255,244,236,0.95)';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const cs = Array.from(chars);
  if (cs.length === 3) {
    ctx.font = font(size * 0.28, FONTS.cjkSerif, 900);
    cs.forEach((c, i) => ctx.fillText(c, 0, -size * 0.27 + i * size * 0.27));
  } else if (cs.length === 4) {
    ctx.font = font(size * 0.36, FONTS.cjkSerif, 900);
    ctx.fillText(cs[0], size * .19, -size * .19); ctx.fillText(cs[1], size * .19, size * .19);
    ctx.fillText(cs[2], -size * .19, -size * .19); ctx.fillText(cs[3], -size * .19, size * .19);
  } else {
    ctx.font = font(size * 0.4, FONTS.cjkSerif, 900); ctx.fillText(chars, 0, 0);
  }
  // ink grain: knock out a few specks deterministically
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 40; i++) {
    const hx = Math.sin(i * 91.7) * 0.5, hy = Math.cos(i * 37.3) * 0.5;
    ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.arc(hx * size, hy * size, size * 0.012 * (1 + (i % 3)), 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// soft vertical gradient background
export function vgrad(ctx, c0, c1, x = 0, y = 0, w = W, h = H) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, c0); g.addColorStop(1, c1);
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
}

// proper crescent: disc of radius r minus a disc of radius r2 offset by (dx,dy) (in units of r)
export function crescent(ctx, x, y, r, o = {}) {
  const k = o.k ?? 0.45, ang = o.angle ?? -0.6, r2 = r * (o.inner ?? 0.85);
  const ox = Math.cos(ang) * r * k, oy = Math.sin(ang) * r * k;
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  // clip-out inner disc using a big rect + inner arc (evenodd)
  ctx.rect(x - r * 3, y - r * 3, r * 6, r * 6);
  ctx.arc(x + ox, y + oy, r2, 0, Math.PI * 2, true);
  ctx.restore();
  ctx.save();
  ctx.beginPath(); ctx.rect(x - r * 3, y - r * 3, r * 6, r * 6); ctx.arc(x + ox, y + oy, r2, 0, Math.PI * 2, true); ctx.clip('evenodd');
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = o.color || '#fff4d6'; ctx.globalAlpha *= (o.alpha ?? 1); ctx.fill();
  ctx.restore();
}

// moon with soft maria; k = phase-shadow offset (>=2 full, ~0.42 crescent)
export function drawMoon(ctx, x, y, r, k, a = 1, col = [242, 236, 220]) {
  const TAU = Math.PI * 2; const hash = (n) => { let x = (n | 0) * 374761393 + 668265263; x = (x ^ (x >>> 13)) * 1274126177; x = x ^ (x >>> 16); return (x >>> 0) / 4294967296; };
  ctx.save(); ctx.globalAlpha *= a;
  ctx.beginPath(); ctx.rect(x - r * 4, y - r * 4, r * 8, r * 8); ctx.arc(x + Math.cos(-0.5) * r * k, y + Math.sin(-0.5) * r * k, r * 0.92, 0, TAU, true); ctx.clip('evenodd');
  circle(ctx, x, y, r, `rgb(${col[0]|0},${col[1]|0},${col[2]|0})`);
  for (let i = 0; i < 11; i++) { const an = hash(i + 30) * TAU, rr = r * 0.72 * Math.sqrt(hash(i + 31)); circle(ctx, x + Math.cos(an) * rr, y + Math.sin(an) * rr, r * (0.07 + 0.13 * hash(i + 32)), 'rgba(170,165,150,0.35)'); }
  const sh = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.2, x, y, r); sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(120,110,140,0.35)');
  circle(ctx, x, y, r, sh);
  ctx.restore();
}

