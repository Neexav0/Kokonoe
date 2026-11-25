// Petals for the quiz: they fall from the portrait card, sway, and settle into a
// heap along the bottom of the section. Sweep the mouse through the heap to
// scatter them; "Play again" blows them away.
import { RM } from "./data.js";

const section = document.querySelector(".quiz");
const canvas = document.createElement("canvas");
canvas.className = "petal-canvas";
canvas.setAttribute("aria-hidden", "true");
section.prepend(canvas);
const ctx = canvas.getContext("2d");

const petals = [];
const BIN = 14;           // heap resolution in px
let heap = [];            // pile height per column
let W = 0, H = 0, dpr = 1, running = false, mouse = null, wind = 0;

function size() {
  dpr = Math.min(devicePixelRatio || 1, 1.5);
  W = section.clientWidth; H = section.clientHeight;
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  heap = new Array(Math.ceil(W / BIN) + 1).fill(0);
  petals.forEach((p) => { if (p.rest) p.rest = false; });
}
size();
addEventListener("resize", size);

section.addEventListener("pointermove", (e) => {
  const r = section.getBoundingClientRect();
  const x = e.clientX - r.left, y = e.clientY - r.top;
  mouse = mouse ? { x, y, vx: x - mouse.x, vy: y - mouse.y } : { x, y, vx: 0, vy: 0 };
  wake();
}, { passive: true });
section.addEventListener("pointerleave", () => (mouse = null));

/** rain(color, rect) — rect is the element they fall from (viewport coords) */
export function rain(color, rect, count = 38) {
  if (RM) return;
  const r = section.getBoundingClientRect();
  for (let i = 0; i < count; i++) {
    petals.push({
      x: rect.left - r.left + Math.random() * rect.width,
      y: rect.top - r.top + Math.random() * rect.height * 0.4,
      vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 4 - 1,
      a: Math.random() * Math.PI * 2, va: (Math.random() - 0.5) * 0.2,
      s: 6 + Math.random() * 7, ph: Math.random() * 6.28,
      c: Math.random() < 0.3 ? "#ffffff" : color, rest: false,
    });
  }
  while (petals.length > 320) petals.shift();
  wake();
}

/** blow every petal off to the side, then clear */
export function sweep() {
  wind = 18;
  petals.forEach((p) => { p.rest = false; p.vy = -3 - Math.random() * 4; });
  heap.fill(0);
  wake();
}

function wake() { if (!running) { running = true; last = performance.now(); requestAnimationFrame(step); } }
let last = 0;
function step(now) {
  const dt = Math.min(2, (now - last) / 16.7); last = now;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  let moving = 0;
  wind *= 0.97;
  for (let i = petals.length - 1; i >= 0; i--) {
    const p = petals[i];
    // the mouse kicks settled petals back into the air
    if (mouse) {
      const dx = p.x - mouse.x, dy = p.y - mouse.y, d = Math.hypot(dx, dy);
      if (d < 70) {
        const f = (1 - d / 70) * 0.9;
        p.vx += (dx / (d || 1)) * f * 3 + mouse.vx * 0.15 * f;
        p.vy += (dy / (d || 1)) * f * 3 - 2.5 * f + mouse.vy * 0.15 * f;
        if (p.rest) { p.rest = false; const b = Math.floor(p.x / BIN); if (heap[b]) heap[b] = Math.max(0, heap[b] - p.s * 0.35); }
      }
    }
    if (!p.rest) {
      moving++;
      p.vy += 0.09 * dt;                       // gravity
      p.vx += Math.sin(now / 600 + p.ph) * 0.03 * dt + wind * 0.02;  // sway and wind
      p.vx *= 0.985; p.vy *= 0.985;
      p.vy = Math.min(p.vy, 2.6);             // petals drift, they don't drop like stones
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.a += p.va * dt;
      const b = Math.max(0, Math.min(heap.length - 1, Math.floor(p.x / BIN)));
      const floor = H - heap[b];
      if (p.y >= floor - p.s * 0.3 && wind < 1) {
        p.y = floor - p.s * 0.3; p.rest = true; p.vx = p.vy = 0;
        heap[b] += p.s * 0.35;
        if (heap[b - 1] !== undefined) heap[b - 1] += p.s * 0.12;
        if (heap[b + 1] !== undefined) heap[b + 1] += p.s * 0.12;
      }
      if (p.x < -40 || p.x > W + 40 || p.y > H + 40) { petals.splice(i, 1); continue; }
    }
    // draw: a petal is two curves meeting at a notched tip
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.a);
    ctx.scale(1, 0.55 + 0.45 * Math.abs(Math.sin(now / 400 + p.ph)) * (p.rest ? 0 : 1) + (p.rest ? 0.5 : 0));
    ctx.fillStyle = p.c;
    ctx.globalAlpha = 0.92;
    ctx.beginPath();
    ctx.moveTo(0, -p.s);
    ctx.quadraticCurveTo(p.s * 0.9, -p.s * 0.2, 0, p.s);
    ctx.quadraticCurveTo(-p.s * 0.9, -p.s * 0.2, 0, -p.s);
    ctx.fill();
    ctx.restore();
  }
  // keep animating while anything moves or the mouse is in the section;
  // once all settle, the last frame stays drawn until the next interaction
  if (moving || mouse) requestAnimationFrame(step);
  else running = false;
}
