import { drawHer, SIDE_STAND, BACK_STAND, STYLE_DAY, STYLE_NIGHT } from '../engine/figure.js';
import { vgrad, text } from '../engine/draw.js';
export default {
  duration: 2,
  render(ctx, t) {
    vgrad(ctx, '#e9e4ef', '#cfc6da', 0, 0, 1920, 540);
    vgrad(ctx, '#0b1230', '#05081a', 0, 540, 1920, 540);
    const sit = { ...SIDE_STAND, torso: -0.05, thF: 1.5, knF: 1.5, thB: 1.45, knB: 1.5, shF: 0.7, elF: 0.9, shB: 0.6, elB: 1.0 };
    const reach = { ...SIDE_STAND, torso: 0.1, head: -0.25, shF: 2.4, elF: 0.2, shB: -0.3, elB: 0.3, thF: 0.15, knF: 0.05, thB: -0.2, knB: 0.2 };
    const lying = { ...SIDE_STAND, torso: -Math.PI / 2, head: 0.1, shF: 0.1, elF: 0.4, thF: Math.PI / 2 - 0.05, knF: 0.0, thB: Math.PI / 2, knB: 0 };
    const walk = { ...SIDE_STAND, shF: -0.4, elF: 0.4, shB: 0.4, elB: 0.3, thF: 0.35, knF: 0.1, thB: -0.3, knB: 0.5, hairSwing: 0.6 };
    drawHer(ctx, 160, 300, 420, SIDE_STAND);
    drawHer(ctx, 420, 300, 420, walk);
    drawHer(ctx, 700, 330, 420, sit);
    drawHer(ctx, 980, 300, 420, reach);
    drawHer(ctx, 1260, 300, 420, BACK_STAND, { view: 'back' });
    drawHer(ctx, 1520, 300, 420, { ...BACK_STAND, rS: 2.2, rE: 0.3, headTilt: 0.15, lean: -0.05 }, { view: 'back' });
    drawHer(ctx, 1760, 470, 300, lying);
    // night versions with rim light
    const rim = { color: '#7fe8ff', dx: 1, dy: -0.4, width: 4 };
    drawHer(ctx, 200, 840, 420, SIDE_STAND, { style: STYLE_NIGHT, rim, halo: 0.25 });
    drawHer(ctx, 520, 870, 420, sit, { style: STYLE_NIGHT, rim });
    drawHer(ctx, 840, 840, 420, reach, { style: STYLE_NIGHT, rim });
    drawHer(ctx, 1160, 840, 420, BACK_STAND, { view: 'back', style: STYLE_NIGHT, rim: { color: '#7fe8ff', dx: 0, dy: -1, width: 4 } });
    drawHer(ctx, 1480, 840, 420, { ...BACK_STAND, rS: 2.0, rE: 0.4, headTilt: 0.2 }, { view: 'back', style: STYLE_NIGHT, rim: { color: '#ffd27a', dx: 1, dy: -1, width: 4 }, halo: 0.3 });
    text(ctx, 'model sheet — her (depiction, not a portrait)', 40, 40, { size: 24, color: '#333' });
  },
};
