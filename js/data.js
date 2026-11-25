// Shared data and tiny helpers for every Kokonoe module.
export const VID = "media/";
export const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const eo = (t) => 1 - Math.pow(1 - t, 3);
export const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";
export const EASE_IN_OUT = "cubic-bezier(0.77, 0, 0.175, 1)";
export const EASE_DRAWER = "cubic-bezier(0.32, 0.72, 0, 1)";

/* Each heroine:
   still  — the time of her best single frame (cards, tier list, poster)
   turn   — six frames for the character sheet's turnaround strip
   eyes   — [time, x, y, width] of an eye close-up, as fractions of the frame;
            the crop is 2.4:1, so its height is width × 16/9 ÷ 2.4 */
export const HEROINES = [
  { id: "makima", fy: 0.25, name: "Makima", jp: "マキマ", series: "Chainsaw Man", nick: "Control Devil", accent: "#ff3b5f",
    desc: "A calm, hypnotic manipulator whose mysterious smile hides terrifying authority.",
    words: ["Calm", "Commanding", "Unreadable"],
    known: ["Ringed golden eyes", "A smile that gives orders", "Public Safety's quiet centre"],
    still: 17.2, turn: [1.5, 10.9, 17.2, 20.3, 26.6, 36], eyes: [14, 0.42, 0.57, 0.58] },
  { id: "mikasa", fy: 0.2, name: "Mikasa Ackerman", jp: "ミカサ・アッカーマン", series: "Attack on Titan", nick: "The strongest soldier", accent: "#d14b4b",
    desc: "Silent, fiercely loyal, and one of humanity's deadliest warriors.",
    words: ["Loyal", "Lethal", "Quiet"],
    known: ["The red scarf", "Omni-directional mobility gear", "Ackerman strength"],
    still: 11.4, turn: [6.8, 11.4, 20.6, 29.8, 34.4, 39], eyes: [29.8, 0.15, 0.18, 0.5] },
  { id: "yor", fy: 0.18, name: "Yor Forger", jp: "ヨル・フォージャー", series: "Spy x Family", nick: "Thorn Princess", accent: "#ff4568",
    desc: "An elegant assassin who balances extraordinary combat skill with a caring heart.",
    words: ["Elegant", "Deadly", "Gentle"],
    known: ["Golden stilettos", "A black dress with roses", "A secret double life"],
    still: 26.7, turn: [5.3, 8.9, 16, 19.6, 26.7, 30.3], eyes: [26.7, 0.17, 0.12, 0.42] },
  { id: "shinobu", fy: 0.32, name: "Shinobu Kocho", jp: "胡蝶しのぶ", series: "Demon Slayer", nick: "Insect Hashira", accent: "#bd8cff",
    desc: "Graceful and sharp-witted, her butterfly-like elegance hides formidable skill.",
    words: ["Graceful", "Sharp", "Smiling"],
    known: ["Butterfly-wing haori", "Poison instead of strength", "A smile that hides anger"],
    still: 16.8, turn: [3.8, 9, 11.6, 16.8, 19.4, 22], eyes: [16.8, 0.32, 0.12, 0.5] },
  { id: "mitsuri", fy: 0.15, name: "Mitsuri Kanroji", jp: "甘露寺蜜璃", series: "Demon Slayer", nick: "Love Hashira", accent: "#ff8fc8",
    desc: "A warm-hearted, powerful swordswoman who leads with compassion and courage.",
    words: ["Warm", "Strong", "Fearless"],
    known: ["Pink-to-green braids", "A whip-thin Nichirin blade", "Love Breathing"],
    still: 6.8, turn: [4.1, 6.8, 9.6, 15.1, 20.6, 28.8], eyes: [6.8, 0.15, 0.28, 0.6] },
  { id: "marin", fy: 0.24, name: "Marin Kitagawa", jp: "喜多川海夢", series: "My Dress-Up Darling", nick: "The cosplay queen", accent: "#ffb05c",
    desc: "Cheerful and confident, her love of cosplay and self-expression is impossible to ignore.",
    words: ["Bright", "Bold", "Genuine"],
    known: ["Cosplay passion", "Gyaru style", "Zero shame about what she loves"],
    still: 4.6, turn: [1.5, 4.6, 14.1, 23.5, 26.6, 29.8], eyes: [4.6, 0.18, 0.22, 0.5] },
  { id: "robin", fy: 0.12, name: "Nico Robin", jp: "ニコ・ロビン", series: "One Piece", nick: "Devil Child", accent: "#9b5cff",
    desc: "An elegant archaeologist whose quiet intellect hides immense emotional depth.",
    words: ["Calm", "Brilliant", "Resilient"],
    known: ["The Flower-Flower Fruit", "Reading Poneglyphs", "Dry, dark humour"],
    still: 14.4, turn: [2.8, 6.7, 8.6, 10.6, 14.4, 16.3], eyes: [14.4, 0.3, 0.18, 0.5] },
  { id: "hinata", fy: 0.23, name: "Hinata Hyuga", jp: "日向ヒナタ", series: "Naruto", nick: "Byakugan princess", accent: "#b993ff",
    desc: "Gentle yet courageous, she grows into one of the Hidden Leaf's brightest spirits.",
    words: ["Gentle", "Brave", "Steady"],
    known: ["The Byakugan", "Gentle Fist", "Never giving up on Naruto"],
    still: 52.8, turn: [36.1, 41.6, 47.2, 52.8, 58.3, 63.9], eyes: [52.8, 0.38, 0.36, 0.4] },
  { id: "waguri", fy: 0.22, name: "Kaoruko Waguri", jp: "和栗薫子", series: "The Fragrant Flower Blooms with Dignity", nick: "Golden blossom", accent: "#f2c14e",
    desc: "A graceful presence whose warmth and quiet charm leave a lasting impression.",
    words: ["Kind", "Graceful", "Sunny"],
    known: ["Kikyo Girls' Academy", "A serious love of cake", "Seeing people as they are"],
    still: 19.8, turn: [5.3, 8.9, 19.8, 23.4, 27, 37.8], eyes: [19.8, 0.2, 0.2, 0.6] },
];
export const byId = Object.fromEntries(HEROINES.map((h) => [h.id, h]));
export const fileOf = (h) => `${VID}${h.id}.mp4`;
export const artOf = (h) => `${VID}art/${h.id}.jpg`;

/* Portrait art for each heroine, loaded once. */
const artCache = new Map();
export function loadArt(h) {
  if (!artCache.has(h.id)) {
    artCache.set(h.id, new Promise((res, rej) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => res(img);
      img.onerror = () => rej(new Error(`Can't load art for ${h.id}`));
      img.src = artOf(h);
    }));
  }
  return artCache.get(h.id);
}

/* An <img> of her art, cropped so her face stays in frame. */
export function artImg(h, className = "") {
  const img = new Image();
  img.src = artOf(h);
  img.alt = "";
  img.decoding = "async";
  img.draggable = false;
  img.className = className;
  img.style.objectPosition = `50% ${Math.round(h.fy * 100)}%`;
  return img;
}

/* Draw an image or video into a w×h box like object-fit: cover, keeping the
   point at height fy (0 top, 1 bottom) in view. */
export function drawCover(ctx, src, w, h, fy = 0.5, dx = 0, dy = 0) {
  const iw = src.videoWidth || src.naturalWidth || src.width;
  const ih = src.videoHeight || src.naturalHeight || src.height;
  if (!iw || !ih) return;
  const scale = Math.max(w / iw, h / ih);
  const cw = w / scale, ch = h / scale;
  const sx = (iw - cw) / 2;
  const sy = clamp(fy * ih - ch / 2, 0, ih - ch);
  ctx.drawImage(src, sx, sy, cw, ch, dx, dy, w, h);
}

/* Keep a heroine's video invisible over its tinted placeholder until it can play. */
export function revealWhenReady(v) {
  const show = () => v.classList.add("ready");
  if (v.readyState >= 2) show();
  else {
    v.addEventListener("loadeddata", show, { once: true });
    v.addEventListener("seeked", show, { once: true });
  }
}

/* Run fn when el first comes near the viewport. */
export function whenNear(el, fn, margin = "200px") {
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { io.disconnect(); fn(); }
  }, { rootMargin: margin });
  io.observe(el);
}

/* Small spring integrator for gesture releases (velocity in px/s). */
export function spring({ from, to, velocity = 0, stiffness = 380, damping = 30, onUpdate, onDone }) {
  let x = from, v = velocity, last = performance.now(), raf = 0, timer = 0, stopped = false;
  // rAF drives it; a timer takes over if frames stop arriving (throttled tab),
  // so a released card never hangs in mid-air.
  const next = () => {
    raf = requestAnimationFrame(step);
    timer = setTimeout(() => { cancelAnimationFrame(raf); step(performance.now()); }, 64);
  };
  const step = (now) => {
    clearTimeout(timer);
    if (stopped) return;
    // integrate the real elapsed time in small fixed sub-steps: stable at any frame rate
    let left = Math.min(0.5, Math.max(0.001, (now - last) / 1000)); last = now;
    while (left > 0) {
      const dt = Math.min(1 / 240, left); left -= dt;
      const a = -stiffness * (x - to) - damping * v;
      v += a * dt; x += v * dt;
    }
    if (Math.abs(x - to) < 0.3 && Math.abs(v) < 4) { x = to; onUpdate(x); onDone && onDone(); return; }
    onUpdate(x);
    next();
  };
  // No frames will come in a hidden tab, so settle at once instead of stalling.
  if (RM || document.hidden) { onUpdate(to); onDone && onDone(); return { stop() {} }; }
  next();
  return { stop() { stopped = true; cancelAnimationFrame(raf); clearTimeout(timer); }, get value() { return x; }, get velocity() { return v; } };
}
