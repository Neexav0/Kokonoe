// Grab still frames from the clips, on demand, cached.
// One hidden <video> per clip; requests for the same clip run in order.
import { VID } from "./data.js";

const players = new Map();   // id -> { video, queue }
const cache = new Map();     // key -> Promise<HTMLCanvasElement>

function player(id) {
  if (!players.has(id)) {
    const video = document.createElement("video");
    video.muted = true;
    video.preload = "auto";
    video.playsInline = true;
    video.src = `${VID}${id}.mp4`;
    const ready = new Promise((res, rej) => {
      if (video.readyState >= 2) return res();
      video.addEventListener("loadeddata", res, { once: true });
      video.addEventListener("error", () => rej(new Error(`Can't load ${id}`)), { once: true });
    });
    players.set(id, { video, ready, queue: Promise.resolve() });
  }
  return players.get(id);
}

const timeout = (ms) => new Promise((_, rej) => setTimeout(() => rej(new Error("timed out")), ms));
const once = (el, ev) => new Promise((res) => el.addEventListener(ev, res, { once: true }));

// After `seeked`, the new frame may not be painted yet. Wait for it.
function painted(video) {
  return new Promise((res) => {
    let done = false;
    const finish = () => { if (!done) { done = true; res(); } };
    if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(finish);
    setTimeout(finish, 350);
  });
}

async function grab(p, t, crop, w, h) {
  await p.ready;
  const v = p.video;
  const target = Math.min(Math.max(0, t), (v.duration || t + 1) - 0.05);
  if (Math.abs(v.currentTime - target) > 0.01) {
    v.currentTime = target;
    await Promise.race([once(v, "seeked"), timeout(8000)]);
  }
  await painted(v);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  if (crop) {
    const [x, y, cw] = crop;
    const ch = Math.min(1 - y, (cw * (v.videoWidth / v.videoHeight)) / (w / h));
    ctx.drawImage(v, x * v.videoWidth, y * v.videoHeight, cw * v.videoWidth, ch * v.videoHeight, 0, 0, w, h);
  } else {
    ctx.drawImage(v, 0, 0, w, h);
  }
  return c;
}

/**
 * still("makima", 17.2) -> Promise<canvas>
 * still("makima", 14, { crop: [x, y, w], w: 480, h: 200 })
 */
export function still(id, t, { crop = null, w = 480, h = 270 } = {}) {
  const key = `${id}|${t}|${crop}|${w}x${h}`;
  if (!cache.has(key)) {
    const p = player(id);
    const job = p.queue.then(() => grab(p, t, crop, w, h));
    p.queue = job.catch(() => {});
    cache.set(key, job);
    job.catch(() => cache.delete(key));
  }
  return cache.get(key);
}

/* Copy a cached still into a fresh canvas (a canvas can only live in one place). */
export function cloneCanvas(src, className = "") {
  const c = document.createElement("canvas");
  c.width = src.width; c.height = src.height;
  c.getContext("2d").drawImage(src, 0, 0);
  if (className) c.className = className;
  return c;
}
