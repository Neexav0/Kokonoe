// Mobile chapters drawer: a bottom sheet that tracks the finger 1:1 and
// dismisses on distance or a quick flick. CSS transitions (the iOS sheet
// curve) handle open/close so it can be caught mid-flight.
import { RM } from "./data.js";

const btn = document.querySelector(".menu-btn");
const sheet = document.querySelector(".drawer");
const panel = sheet.querySelector(".drawer-panel");
const overlay = sheet.querySelector(".drawer-overlay");
let open = false, lastFocus = null;

function setOpen(v) {
  open = v;
  btn.setAttribute("aria-expanded", String(v));
  panel.style.transform = "";
  overlay.style.opacity = "";
  if (v) {
    lastFocus = document.activeElement;
    sheet.hidden = false;
    // let the hidden→visible change land before the transition starts
    requestAnimationFrame(() => requestAnimationFrame(() => sheet.classList.add("open")));
    setTimeout(() => panel.querySelector("a")?.focus({ preventScroll: true }), RM ? 0 : 200);
  } else {
    sheet.classList.remove("open");
    setTimeout(() => { if (!open) sheet.hidden = true; }, RM ? 0 : 500);
    if (lastFocus) lastFocus.focus({ preventScroll: true });
  }
}
btn.addEventListener("click", () => setOpen(!open));
overlay.addEventListener("click", () => setOpen(false));
sheet.addEventListener("keydown", (e) => {
  if (e.key === "Escape") setOpen(false);
  if (e.key === "Tab") {
    const f = [...panel.querySelectorAll("a, button")];
    const i = f.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
  }
});
panel.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setOpen(false)));

/* drag to dismiss */
let id = null, sy = 0, dy = 0, samples = [];
panel.addEventListener("pointerdown", (e) => {
  if (id !== null || e.target.closest("a, button")) return;
  id = e.pointerId; sy = e.clientY; dy = 0; samples = [{ t: e.timeStamp, y: e.clientY }];
  panel.setPointerCapture(id);
  sheet.classList.add("dragging");
});
panel.addEventListener("pointermove", (e) => {
  if (e.pointerId !== id) return;
  const raw = e.clientY - sy;
  // pulling up past the top meets resistance instead of a wall
  dy = raw >= 0 ? raw : -Math.sqrt(-raw) * 4;
  panel.style.transform = `translateY(${dy}px)`;
  const h = panel.offsetHeight;
  overlay.style.opacity = String(Math.max(0, 1 - Math.max(0, dy) / h));
  samples.push({ t: e.timeStamp, y: e.clientY });
  if (samples.length > 6) samples.shift();
});
const end = (e) => {
  if (e.pointerId !== id) return;
  id = null;
  sheet.classList.remove("dragging");
  const a = samples[0], b = samples[samples.length - 1];
  const v = (b.y - a.y) / Math.max(1, b.t - a.t); // px per ms
  if (dy > panel.offsetHeight * 0.3 || v > 0.5) setOpen(false);
  else { panel.style.transform = ""; overlay.style.opacity = ""; } // snap back on the transition
};
panel.addEventListener("pointerup", end);
panel.addEventListener("pointercancel", end);
