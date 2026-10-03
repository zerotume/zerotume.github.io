import { drawCat, CAT_NIGHT } from '../engine/cat.js';
import { vgrad, text } from '../engine/draw.js';
export default { duration: 1, render(ctx, t) {
  vgrad(ctx, '#f4eee4', '#e6dccb', 0, 0, 1920, 540); vgrad(ctx, '#0b1230', '#05081a', 0, 540, 1920, 540);
  drawCat(ctx, 200, 420, 260, { t });
  drawCat(ctx, 520, 420, 260, { t, face: -1, eye: 0.1, mouth: 'yawn' });
  drawCat(ctx, 840, 420, 260, { t, paw: 1, look: [1, -1], mouth: 'o' });
  drawCat(ctx, 1160, 420, 260, { t, walk: 0.5 });
  drawCat(ctx, 1480, 420, 260, { t, curl: 0.5 });
  drawCat(ctx, 1760, 420, 260, { t, curl: 1 });
  drawCat(ctx, 300, 980, 260, { t, style: CAT_NIGHT });
  drawCat(ctx, 700, 980, 260, { t, silhouette: '#000' });
  drawCat(ctx, 1100, 980, 260, { t, curl: 1, style: CAT_NIGHT });
  drawCat(ctx, 1500, 980, 260, { t, squash: 0.6 });
  text(ctx, 'the round cat', 40, 40, { size: 24, color: '#333' });
}};
