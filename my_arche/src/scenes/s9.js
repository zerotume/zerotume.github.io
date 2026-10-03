// Scene 9 — "No action required"
// Rush back from orbit to the windowsill. The round cat stares at the moon, wiggles as if — finally — to jump…
// and doesn't. It curls into a crescent beside the crescent moon. The phone: 03:14 · cat asleep · no action required.
import { W, H, TAU, clamp, lerp, seg, win, E, track, hash, noise, rgba, mixc, PAL, frac } from '../engine/core.js';
import { glow, circle, ring, line, rrect, text, revealText, vgrad, FONTS, crescent, drawMoon, notification } from '../engine/draw.js';
import { drawHer, STYLE_NIGHT, SIDE_STAND } from '../engine/figure.js';
import { drawCat, CAT_NIGHT } from '../engine/cat.js';
import { post } from '../engine/post.js';

const T = { rush: [0, 1.6], stare: [1.8, 4.4], wiggle: [4.4, 6.3], nope: 6.35, yawn: [6.7, 7.6], curl: [7.6, 9.4], buzz: 9.5, banner: 9.7, title: [11.6, 15.4], zzz: 14.4, end: 16.0 };
export const cues = { ...T };
export const subs = [[9.7, 11.8, '03:14 · 猫睡着了 · 无需处理', ''], [11.8, 15.4, '我的构造', '']];

function scene(ctx, t) {
  vgrad(ctx, '#0a1030', '#05070f');
  // window (close framing)
  const wx = 200, wy = 60, ww = 1560, wh = 760;
  const g = ctx.createLinearGradient(0, wy, 0, wy + wh); g.addColorStop(0, '#0c1644'); g.addColorStop(1, '#1e2c64');
  ctx.fillStyle = g; ctx.fillRect(wx, wy, ww, wh);
  ctx.save(); ctx.beginPath(); ctx.rect(wx, wy, ww, wh); ctx.clip();
  for (let k = 0; k < 220; k++) circle(ctx, wx + hash(k + 60) * ww, wy + hash(k + 160) * wh * 0.85, 0.8 + hash(k + 260) * 1.5, '#e6ecff', 0.35 + 0.5 * Math.abs(Math.sin(t * (0.4 + hash(k)) + k)));
  glow(ctx, 1330, 300, 520, '#b8c8ff', 0.35);
  drawMoon(ctx, 1330, 300, 150, 0.42, 1);
  for (let i = 0; i < 30; i++) { const bh = 40 + hash(i + 1900) * 120; ctx.fillStyle = '#0a1028'; ctx.fillRect(wx + i * 54, wy + wh - bh, 50, bh); for (let k = 0; k < 4; k++) if (hash(i * 5 + k + 77) > 0.8) { ctx.fillStyle = 'rgba(255,210,140,0.7)'; ctx.fillRect(wx + i * 54 + 8 + (k % 2) * 18, wy + wh - bh + 14 + Math.floor(k / 2) * 22, 6, 8); } }
  ctx.restore();
  ctx.strokeStyle = '#1a2246'; ctx.lineWidth = 22; ctx.strokeRect(wx, wy, ww, wh);
  // sill
  ctx.fillStyle = '#20284e'; rrect(ctx, 100, 820, 1760, 40, 10); ctx.fill();
  ctx.fillStyle = '#121734'; ctx.fillRect(120, 860, 1720, 240);
  // moonlight on the sill
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(120,150,255,0.10)'; ctx.fillRect(560, 822, 900, 36); ctx.restore();
}

export default {
  duration: T.end, cues, subs,
  render(ctx, t, info) {
    const frame = info?.frame || 0;
    const po = { bloom: 0.6, vignette: 0.55, grain: 0.05, frame };
    if (t < T.rush[1]) {
      // warp back down: stars streak outward, then the room arrives
      vgrad(ctx, '#020310', '#06081c');
      const u = E.inExpo(seg(t, 0, T.rush[1]));
      for (let k = 0; k < 360; k++) {
        const an = hash(k) * TAU, r0 = 30 + hash(k + 1) * 900;
        const r1 = r0 * (1 + 0.15 + u * 3.5), r2 = r0 * (1 + u * 0.6);
        line(ctx, 960 + Math.cos(an) * r2, 540 + Math.sin(an) * r2, 960 + Math.cos(an) * r1, 540 + Math.sin(an) * r1, hash(k + 5) > 0.7 ? '#ffd9a0' : '#cfd8ff', 1.5 + u * 2, 0.4 + 0.5 * u);
      }
      glow(ctx, 960, 540, 200 + 900 * u, '#ffb45c', 0.3 + 0.6 * u);
      const fl = seg(t, T.rush[1] - 0.3, T.rush[1]);
      if (fl > 0) { ctx.fillStyle = rgba('#fff2dc', fl * 0.8); ctx.fillRect(0, 0, W, H); }
      post(ctx, po); return;
    }
    const arr = 1 - E.outCubic(seg(t, T.rush[1], T.rush[1] + 0.6));
    const push = 1 + 0.06 * E.inOutSine(seg(t, T.rush[1], T.title[0]));
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(push, push); ctx.translate(-W / 2 - 40 * E.inOutSine(seg(t, 7, 11)), -H / 2);
    scene(ctx, t);
    // her, asleep on the window seat: head on a cushion, blanket to the shoulders (as in scene 1)
    ctx.fillStyle = '#2b3360'; ctx.beginPath(); ctx.ellipse(250, 800, 110, 34, -0.05, 0, TAU); ctx.fill();
    drawHer(ctx, 470, 812, 470, { ...SIDE_STAND, torso: -Math.PI / 2 + 0.03, head: 0.2, shF: -1.0, elF: 1.6, shB: -0.9, elB: 1.5, breath: 0.5 + 0.5 * Math.sin(t * 0.8) }, { style: STYLE_NIGHT, hide: { legs: true }, rim: { color: '#a8b8ff', dx: 0.6, dy: -1, width: 3 } });
    ctx.fillStyle = '#2a3266'; ctx.beginPath(); ctx.moveTo(320, 822); ctx.bezierCurveTo(330, 770 - 4 * Math.sin(t * 0.8), 420, 755 - 4 * Math.sin(t * 0.8), 520, 770); ctx.bezierCurveTo(600, 780, 680, 770, 720, 800); ctx.lineTo(730, 822); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(160,180,255,0.25)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(360, 790); ctx.quadraticCurveTo(480, 770, 640, 795); ctx.stroke();
    const pg = 0.4 + 0.6 * win(t, T.buzz, T.title[0] + 1.0, 0.1, 0.8);
    ctx.fillStyle = '#05060f'; rrect(ctx, 610, 760, 70, 10, 4); ctx.fill(); glow(ctx, 645, 756, 120, '#9fc8ff', 0.5 * pg);
    // the cat on the sill
    const st = { t, face: 1, style: CAT_NIGHT, look: [1, -1], eye: 1 };
    let cy = 822, cx = 860;
    if (t >= T.stare[0] && t < T.wiggle[1]) { st.ear = Math.sin(t * 6) > 0.7 ? 1 : 0; }
    if (t >= T.wiggle[0] && t < T.nope) { st.wiggle = E.inQuad(seg(t, T.wiggle[0], T.nope)) * 1.6; st.squash = 0.25 * seg(t, T.wiggle[0], T.nope); st.tail = Math.sin(t * 12) * 0.8; }
    if (t >= T.nope && t < T.yawn[1]) { const u = seg(t, T.nope, T.nope + 0.3); st.squash = lerp(0.35, 0.05, u); st.look = [0, 0]; if (t >= T.yawn[0]) { st.mouth = 'yawn'; st.eye = 0.1; } }
    if (t >= T.curl[0]) { st.curl = E.inOutCubic(seg(t, T.curl[0], T.curl[1])); st.eye = 0.1; }
    drawCat(ctx, cx, cy, 230, st);
    // moonlight rim on the cat
    glow(ctx, cx + 60, cy - 160, 160, '#b8c8ff', 0.18);
    ctx.restore();
    // arrival flash from the rush
    if (arr > 0) { ctx.fillStyle = rgba('#fff2dc', arr * 0.8); ctx.fillRect(0, 0, W, H); }
    // the notification: the alert system, at peace
    const nb = E.outBack(seg(t, T.banner, T.banner + 0.45)) - E.inCubic(seg(t, T.title[0] - 0.4, T.title[0]));
    if (nb > 0.001) notification(ctx, 560, lerp(-170, 40, nb), 800, { app: 'PAGER', time: '03:14', icon: '✓', iconBg: '#38c9a0', title: 'cat asleep', body: 'no action required', alpha: clamp(nb * 1.5), bg: 'rgba(24,30,52,0.94)' });
    // title
    const ta = win(t, T.title[0], T.end, 1.0, 1.2);
    if (ta > 0) {
      ctx.fillStyle = rgba('#03040c', 0.78 * ta); ctx.fillRect(0, 0, W, H);
      const tz = 1 + 0.04 * seg(t, T.title[0], T.end); ctx.save(); ctx.translate(960, 560); ctx.scale(tz, tz); ctx.translate(-960, -560);
      crescent(ctx, 960, 380, 46, { color: PAL.gold, k: 0.45, inner: 0.85, alpha: ta });
      glow(ctx, 960, 380, 200, PAL.gold, 0.35 * ta);
      text(ctx, 'THE ARCHITECTURE OF ME', 960, 540, { size: 78, family: FONTS.serif, weight: 500, color: '#f6efe0', align: 'center', alpha: ta, spacing: 14 });
      text(ctx, '我的构造', 960, 610, { size: 40, family: FONTS.cjkSerif, weight: 500, color: '#d8cfbf', align: 'center', alpha: ta * seg(t, T.title[0] + 0.6, T.title[0] + 1.4), spacing: 16 });
      text(ctx, '03:14', 960, 690, { size: 32, family: FONTS.mono, color: '#9fb0d8', align: 'center', alpha: ta * seg(t, T.title[0] + 1.0, T.title[0] + 1.8), spacing: 6 });
      text(ctx, 'every frame and every note written in code', 960, 960, { size: 22, family: FONTS.ui, color: '#7a809a', align: 'center', alpha: ta * seg(t, T.title[0] + 1.6, T.title[0] + 2.4), spacing: 2 });
      const za = win(t, T.zzz, T.end, 0.4, 0.6);
      if (za > 0) text(ctx, 'zzz … purr … zzz', 960, 800, { size: 30, family: FONTS.serif, style: 'italic', color: '#cfc4ff', align: 'center', alpha: za * ta });
      ctx.restore();
    }
    po.fade = 1 - seg(t, T.end - 0.6, T.end);
    post(ctx, po);
  },
};
