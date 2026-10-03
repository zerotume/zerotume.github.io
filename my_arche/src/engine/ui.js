// ui.js — original, generic interface pieces (no real product branding): chat app, alerts, sliders.
import { clamp, lerp, E, TAU, rgba, seg } from './core.js';
import { rrect, circle, text, FONTS, crescent, glow } from './draw.js';

// avatar: coloured disc with a simple glyph; 'moon' = her
export function avatar(ctx, x, y, r, kind, color, a = 1) {
  if (a <= 0.003) return;
  ctx.save(); ctx.globalAlpha *= a;
  circle(ctx, x, y, r, kind === 'moon' ? '#1c2148' : color);
  ctx.globalAlpha = a;
  if (kind === 'moon') crescent(ctx, x, y, r * 0.55, { color: '#ffc857', k: 0.45, inner: 0.85, angle: -0.6 });
  else { ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(x, y - r * 0.18, r * 0.3, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(x, y + r * 0.55, r * 0.55, r * 0.38, 0, Math.PI, 0); ctx.fill(); }
  ctx.restore();
}

// one chat message row (light theme). returns height
export function messageRow(ctx, x, y, o) {
  const a = o.alpha ?? 1; if (a <= 0.003) return o.h || 90;
  const s = o.scale ?? 1;
  ctx.save(); ctx.globalAlpha *= a;
  ctx.translate(x, y + (1 - E.outCubic(clamp(o.rise ?? 1))) * 24);
  ctx.scale(s, s);
  avatar(ctx, 30, 30, 28, o.kind || 'person', o.color || '#888', 1);
  text(ctx, o.name || '', 78, 24, { size: 25, weight: 700, color: '#2b2440', family: FONTS.ui });
  const nw = ctx.measureText ? 0 : 0;
  text(ctx, o.time || '', 78 + (o.nameW || 120), 24, { size: 20, color: '#9a93a8', family: FONTS.ui });
  if (o.text) text(ctx, o.text, 78, 64, { size: 29, color: '#2f2a3a', family: FONTS.ui });
  ctx.restore();
  return o.h || 90;
}

export function reactionPill(ctx, x, y, emoji, count, o = {}) {
  const a = o.alpha ?? 1; if (a <= 0.003) return 0;
  const pop = o.pop ?? 1;
  const w = 96 + String(count).length * 14;
  ctx.save(); ctx.globalAlpha *= a; ctx.translate(x + w / 2, y + 20); ctx.scale(pop, pop); ctx.translate(-(x + w / 2), -(y + 20));
  rrect(ctx, x, y, w, 42, 21); ctx.fillStyle = o.mine ? '#e9e3ff' : '#efeaf3'; ctx.fill();
  ctx.strokeStyle = o.mine ? '#8a72ff' : 'rgba(0,0,0,0.08)'; ctx.lineWidth = 2; ctx.stroke();
  text(ctx, emoji, x + 14, y + 31, { size: 24, family: FONTS.emoji });
  text(ctx, String(count), x + 52, y + 30, { size: 22, weight: 700, color: '#4a3d78' });
  ctx.restore();
  return w + 10;
}

// alert card: amber/red "what if" bubble. size multiplier; readable when big
export function alertCard(ctx, x, y, str, o = {}) {
  const a = o.alpha ?? 1; if (a <= 0.003) return;
  const sc = o.scale ?? 1, rot = o.rot || 0;
  ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sc, sc);
  const size = 26;
  ctx.font = `600 ${size}px ${FONTS.ui}`;
  const tw = o.bars ? 220 : ctx.measureText(str).width;
  const w = tw + 84, h = 58;
  ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4;
  rrect(ctx, -w / 2, -h / 2, w, h, 16); ctx.fillStyle = o.bg || (o.red ? '#ffe3df' : '#fff4dc'); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = o.red ? '#ff5a44' : '#ffb347'; ctx.lineWidth = 3; ctx.stroke();
  // warning triangle
  ctx.fillStyle = o.red ? '#ff5a44' : '#ff9f1c';
  ctx.beginPath(); ctx.moveTo(-w / 2 + 22, h / 2 - 16); ctx.lineTo(-w / 2 + 38, -h / 2 + 14); ctx.lineTo(-w / 2 + 54, h / 2 - 16); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = `900 18px ${FONTS.ui}`; ctx.textAlign = 'center'; ctx.fillText('!', -w / 2 + 38, h / 2 - 19);
  ctx.textAlign = 'left';
  if (o.bars) {
    ctx.fillStyle = 'rgba(80,50,20,0.28)'; rrect(ctx, -w / 2 + 68, -9, tw * 0.9, 9, 4); ctx.fill(); rrect(ctx, -w / 2 + 68, 6, tw * 0.55, 9, 4); ctx.fill();
  } else {
    ctx.fillStyle = '#4a2a0a'; ctx.textBaseline = 'middle'; ctx.fillText(str, -w / 2 + 68, 1);
  }
  ctx.restore();
}

// a horizontal slider with end labels. v in 0..1
export function slider(ctx, cx, cy, w, v, o = {}) {
  const a = o.alpha ?? 1; if (a <= 0.003) return;
  ctx.save(); ctx.globalAlpha *= a;
  const x0 = cx - w / 2;
  rrect(ctx, x0 - 40, cy - 92, w + 80, 172, 28); ctx.fillStyle = o.bg || 'rgba(255,252,246,0.94)'; ctx.fill();
  ctx.strokeStyle = 'rgba(60,40,90,0.15)'; ctx.lineWidth = 2; ctx.stroke();
  text(ctx, o.title || '', cx, cy - 48, { size: 22, weight: 700, color: '#6a5a8a', align: 'center', family: FONTS.mono, spacing: 4 });
  rrect(ctx, x0, cy - 6, w, 12, 6); ctx.fillStyle = '#e5ddef'; ctx.fill();
  const g = ctx.createLinearGradient(x0, 0, x0 + w, 0); g.addColorStop(0, '#ff6a4d'); g.addColorStop(1, '#38c9a0');
  rrect(ctx, x0, cy - 6, Math.max(12, w * v), 12, 6); ctx.fillStyle = g; ctx.fill();
  const kx = x0 + w * v;
  ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 10;
  circle(ctx, kx, cy, 24, '#ffffff'); ctx.shadowColor = 'transparent';
  ctx.globalAlpha = a;
  circle(ctx, kx, cy, 11, v > 0.5 ? '#38c9a0' : '#ff6a4d');
  text(ctx, o.left || '', x0, cy + 52, { size: 22, color: '#8a4a3a', family: FONTS.ui, weight: 500 });
  text(ctx, o.right || '', x0 + w, cy + 52, { size: 22, color: '#2a7a64', family: FONTS.ui, weight: 500, align: 'right' });
  ctx.restore();
}
