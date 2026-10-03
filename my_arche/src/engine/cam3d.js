// cam3d.js — a tiny orbit camera with perspective projection (no WebGL needed).
// World: x right, y down (screen-like), z toward the viewer is negative depth.
export function camera({ yaw = 0, pitch = 0, roll = 0, dist = 1600, fov = 50, target = [0, 0, 0], cx = 960, cy = 540, zoom = 1 }) {
  const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const cr = Math.cos(roll), sr = Math.sin(roll);
  const f = (540 / Math.tan((fov * Math.PI / 180) / 2)) * zoom;   // focal length in px
  return {
    f, dist, cx, cy,
    // returns {x, y, s (scale factor), z (view depth)} ; s<=0 means behind camera
    project(p) {
      let x = p[0] - target[0], y = p[1] - target[1], z = p[2] - target[2];
      // yaw around Y
      let x1 = x * cyw + z * syw, z1 = -x * syw + z * cyw;
      // pitch around X
      let y1 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
      // roll
      let x2 = x1 * cr - y1 * sr, y2 = x1 * sr + y1 * cr;
      const zc = dist - z2;                 // depth from camera (camera sits at +dist toward viewer... z2 positive = toward camera)
      if (zc <= 1) return { x: cx, y: cy, s: 0, z: zc };
      const s = f / zc;
      return { x: cx + x2 * s, y: cy + y2 * s, s, z: zc };
    },
  };
}
