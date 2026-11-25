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
const MAGNETIC = ".chip-btn, .btn, .menu-btn, .brand, .tab, .mini-chip, .seg button";

if (fine && !RM) {
  const root = document.createElement("div");
  root.className = "cursor";
  root.setAttribute("aria-hidden", "true");
  root.innerHTML = `<span class="c-ring"><span class="c-label"></span></span><span class="c-dot"></span>`;
  document.body.appendChild(root);
  document.documentElement.classList.add("has-cursor");
  const dot = root.querySelector(".c-dot"), ring = root.querySelector(".c-ring"), label = root.querySelector(".c-label");

  let x = -100, y = -100, rx = -100, ry = -100, last = performance.now(), shown = false;
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
    const hit = LABELS.find(([sel]) => t.closest(sel));
    const text = hit ? hit[1] : "";
    label.textContent = text;
    root.classList.toggle("label", !!text);
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
    dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
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
