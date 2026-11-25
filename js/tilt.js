// Pictures react to the mouse: the art drifts against the pointer inside its
// frame (a window you look through), a soft glare follows the pointer, and
// standalone cards tilt in 3D. Values ease toward the pointer every frame so
// the motion feels weighted rather than glued on.
import { RM } from "./data.js";

const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
// parallax-inside targets (their own transform belongs to other code)
const INNER = ".frame-in, .card, .tcard, .sheet-media, .still, .tm-stage, .pm-paper";
// whole-element 3D tilt targets
const TILT3D = ".qz-flip, .known li, .swatch";

if (fine && !RM) {
  const live = new Map(); // el -> state

  function stateFor(el) {
    if (!live.has(el)) {
      const glare = document.createElement("span");
      glare.className = "tilt-glare";
      glare.setAttribute("aria-hidden", "true");
      el.appendChild(glare);
      live.set(el, { el, glare, tx: 0, ty: 0, cx: 0, cy: 0, on: false, three: el.matches(TILT3D) });
    }
    return live.get(el);
  }

  document.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    const t = e.target.closest(`${INNER}, ${TILT3D}`);
    live.forEach((s) => { if (s.el !== t) s.on = false; });
    if (!t || t.classList.contains("lifted") || t.closest(".dragging")) return;
    const s = stateFor(t);
    const r = t.getBoundingClientRect();
    s.tx = ((e.clientX - r.left) / r.width) * 2 - 1;
    s.ty = ((e.clientY - r.top) / r.height) * 2 - 1;
    s.on = true;
  }, { passive: true });
  document.addEventListener("pointerleave", () => live.forEach((s) => (s.on = false)));

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const k = 1 - Math.exp(-dt * 9);
    live.forEach((s, el) => {
      if (!el.isConnected) { live.delete(el); return; }
      const gx = s.on ? s.tx : 0, gy = s.on ? s.ty : 0;
      s.cx += (gx - s.cx) * k; s.cy += (gy - s.cy) * k;
      const mag = Math.hypot(s.cx, s.cy);
      const resting = !s.on && mag < 0.002;
      s.glare.style.opacity = String(s.on ? 0.9 : Math.min(0.9, mag));
      s.glare.style.background = `radial-gradient(60% 60% at ${50 + s.cx * 40}% ${50 + s.cy * 40}%, rgba(255,255,255,.35), rgba(255,255,255,0) 60%)`;
      if (s.three) {
        el.style.transform = resting ? "" : `perspective(900px) rotateX(${(-s.cy * 7).toFixed(2)}deg) rotateY(${(s.cx * 9).toFixed(2)}deg) translateZ(0)`;
      } else {
        const img = el.querySelector(":scope > img, :scope > canvas, :scope > .tc-img > img, :scope > .vid");
        if (img) img.style.transform = resting ? "" : `translate3d(${(-s.cx * 12).toFixed(2)}px, ${(-s.cy * 12).toFixed(2)}px, 0) scale(${(1 + 0.08 * Math.min(1, mag + (s.on ? 0.6 : 0))).toFixed(3)})`;
      }
      if (resting) { s.cx = s.cy = 0; }
    });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
