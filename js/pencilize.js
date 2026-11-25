// Turn any image or video frame into blue-pencil line art: Sobel edges,
// inked in blue pencil on animation paper. Works at any aspect ratio.
import { drawCover } from "./data.js";

const PAPER = [230, 235, 245], PENCIL = [52, 92, 214];
const src = document.createElement("canvas");
const sctx = src.getContext("2d", { willReadFrequently: true });
let SW = 0, SH = 0, out = null, lum = null;

function ensure(w, h) {
  if (w === SW && h === SH) return;
  SW = w; SH = h;
  src.width = w; src.height = h;
  out = sctx.createImageData(w, h);
  lum = new Float32Array(w * h);
}

/**
 * pencilize(source, target, { fy, boil })
 *   fy   — vertical focus for cover-cropping (0 top … 1 bottom)
 *   boil — 0…1: jitter the drawing slightly, like hand-drawn lines that are
 *          retraced every frame ("line boil")
 */
export function pencilize(source, target, { fy = 0.5, boil = 0 } = {}) {
  // about 115k pixels whatever the shape, so it stays ~7ms a frame
  const aspect = target.width / target.height;
  const w = Math.round(Math.sqrt(115000 * aspect));
  const h = Math.round(w / aspect);
  ensure(w, h);
  sctx.fillStyle = "#fff";
  sctx.fillRect(0, 0, w, h);
  const jx = boil ? (Math.random() - 0.5) * 1.4 * boil : 0;
  const jy = boil ? (Math.random() - 0.5) * 1.4 * boil : 0;
  drawCover(sctx, source, w, h, fy, jx, jy);
  const d = sctx.getImageData(0, 0, w, h).data;
  for (let i = 0, p = 0; i < lum.length; i++, p += 4) lum[i] = d[p] * 0.299 + d[p + 1] * 0.587 + d[p + 2] * 0.114;
  const o = out.data;
  const lo = 28 + (boil ? (Math.random() - 0.5) * 10 * boil : 0);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let g = 0;
      if (x > 0 && y > 0 && x < w - 1 && y < h - 1) {
        const a = lum[i - w - 1], b = lum[i - w], c = lum[i - w + 1];
        const l = lum[i - 1], r = lum[i + 1];
        const f = lum[i + w - 1], hh = lum[i + w], k = lum[i + w + 1];
        const gx = c + 2 * r + k - a - 2 * l - f;
        const gy = f + 2 * hh + k - a - 2 * b - c;
        g = Math.sqrt(gx * gx + gy * gy);
      }
      // soft threshold: faint construction lines, darker contours
      const t = Math.min(1, Math.max(0, (g - lo) / 150));
      const ink = t * t * (3 - 2 * t);
      const p = i * 4;
      o[p] = PAPER[0] + (PENCIL[0] - PAPER[0]) * ink;
      o[p + 1] = PAPER[1] + (PENCIL[1] - PAPER[1]) * ink;
      o[p + 2] = PAPER[2] + (PENCIL[2] - PAPER[2]) * ink;
      o[p + 3] = 255;
    }
  }
  sctx.putImageData(out, 0, 0);
  const tctx = target.getContext("2d");
  tctx.imageSmoothingQuality = "high";
  tctx.drawImage(src, 0, 0, target.width, target.height);
}
