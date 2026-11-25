// A custom cursor for mouse users: a dot that is the pointer, and a ring that
// follows with a little lag and morphs into a label over things you can act on.
// Buttons and chips lean toward the pointer ("magnetic").
import { RM } from "./data.js";

const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;

// what the ring says over each kind of thing
const LABELS = [
  [".frame-in", "Open"],
  [".card", "Drag"],
  [".tcard", "Drag"],
  [".compare", "Drag"],
  [".sheet-media", "Swipe"],
  [".still", "Jump"],
  [".lu-open", "View"],
  [".mq-track", "Hold"],
];
const INTERACTIVE = "a, button, [role=button], [role=slider], [role=tab], [role=radio], .tab, .qz-opt";
const MAGNETIC = ".chip-btn, .btn, .menu-btn, .eq, .brand, .tab, .mini-chip, .seg button";

if (fine && !RM) {
  const root = document.createElement("div");
  root.className = "cursor";
  root.setAttribute("aria-hidden", "true");
  // the pointer itself: a rounded arrow whose gradient takes the current heroine's colour
  root.innerHTML = `<span class="c-ring"><span class="c-label"></span></span><span class="c-dot"><svg class="c-arrow" viewBox="0 0 100 100" width="28" height="28"><defs><linearGradient id="curGrad" x1="8" y1="8" x2="70" y2="80" gradientUnits="userSpaceOnUse"><stop offset="0" style="stop-color:var(--cur, #ff0aa8)"/><stop offset="1" stop-color="#3b2a3a"/></linearGradient></defs><path d="M9 7 L88 33 Q95 36 88 40 L58 49 Q51 51 49 58 L38 91 Q35 98 31 91 Z" fill="url(#curGrad)" stroke="url(#curGrad)" stroke-width="9" stroke-linejoin="round"/></svg></span>`;
  document.body.appendChild(root);
  document.documentElement.classList.add("has-cursor");
  const dot = root.querySelector(".c-dot"), ring = root.querySelector(".c-ring"), label = root.querySelector(".c-label");

  let x = -100, y = -100, rx = -100, ry = -100, last = performance.now(), shown = false, px = -100, tilt = 0;
  addEventListener("koko:accent", (e) => root.style.setProperty("--cur", e.detail));
  let mag = null, magX = 0, magY = 0, mtx = 0, mty = 0;

  addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    x = e.clientX; y = e.clientY;
    if (!shown) { shown = true; rx = x; ry = y; root.classList.add("on"); }
    // magnetic pull: within the element, lean toward the pointer
    if (mag) {
      const r = mag.getBoundingClientRect();
      mtx = (x - (r.left + r.width / 2)) * 0.28;
      mty = (y - (r.top + r.height / 2)) * 0.36;
    }
  }, { passive: true });
  document.addEventListener("pointerleave", () => { shown = false; root.classList.remove("on"); });
  addEventListener("pointerdown", () => root.classList.add("down"));
  addEventListener("pointerup", () => root.classList.remove("down"));

  document.addEventListener("pointerover", (e) => {
    const t = e.target;
    const own = t.closest("[data-cursor]");
    const hit = own ? [null, own.dataset.cursor] : LABELS.find(([sel]) => t.closest(sel));
    const text = hit ? hit[1] : "";
    const brush = !!own && own.dataset.cursorStyle === "brush";
    label.textContent = text;
    root.classList.toggle("brush", brush);
    root.classList.toggle("label", !!text && !brush);
    root.classList.toggle("hover", !text && !!t.closest(INTERACTIVE));
    const m = t.closest(MAGNETIC);
    if (m !== mag) {
      if (mag) { mtx = 0; mty = 0; releaseMag(mag); }
      mag = m;
    }
  });

  let releasing = new Set();
  function releaseMag(el) { releasing.add(el); }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const k = 1 - Math.exp(-dt * 16);
    rx += (x - rx) * k; ry += (y - ry) * k;
    // lean a little into horizontal motion, settle back when still
    tilt += (Math.max(-14, Math.min(14, (x - px) * 0.9)) - tilt) * (1 - Math.exp(-dt * 12)); px = x;
    dot.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${tilt.toFixed(2)}deg)`;
    ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
    // magnetic element follows its target with the same soft lag
    const km = 1 - Math.exp(-dt * 14);
    if (mag) {
      magX += (mtx - magX) * km; magY += (mty - magY) * km;
      mag.style.translate = `${magX.toFixed(2)}px ${magY.toFixed(2)}px`;
    }
    releasing.forEach((el) => {
      if (el === mag) { releasing.delete(el); return; }
      const cur = (el.style.translate || "0px 0px").split(" ").map(parseFloat);
      const nx = cur[0] * (1 - km), ny = (cur[1] || 0) * (1 - km);
      if (Math.abs(nx) < 0.1 && Math.abs(ny) < 0.1) { el.style.translate = ""; releasing.delete(el); }
      else el.style.translate = `${nx.toFixed(2)}px ${ny.toFixed(2)}px`;
    });
    if (!mag) { magX *= 1 - km; magY *= 1 - km; }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
