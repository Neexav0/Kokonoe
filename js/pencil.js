// Pencil to paint: drag a divider between the blue-pencil sketch and the colour.
import { HEROINES, artOf, loadArt, RM, clamp, EASE_OUT, spring } from "./data.js";
import { store } from "./store.js";
import { pencilize } from "./pencilize.js";

const section = document.querySelector(".pencil");
const cmp = section.querySelector(".compare");
const art = cmp.querySelector(".cmp-color");
let artImgEl = null; // the loaded Image for the current heroine
const canvas = cmp.querySelector(".cmp-sketch");
const ctx = canvas.getContext("2d");
const handle = cmp.querySelector(".cmp-handle");
const labelL = cmp.querySelector(".cmp-label.l"), labelR = cmp.querySelector(".cmp-label.r");
const tabsWrap = section.querySelector(".tabs-scroll");
const tabs = section.querySelector(".tabs");
const tabsOn = section.querySelector(".tabs-on");
const caption = section.querySelector(".cmp-caption");

let pos = 0.5, current = -1, demoDone = false, demoAnim = null, glide = null, visible = false;

/* --------------------------------------------------------------- tabs */
HEROINES.forEach((h, i) => {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "tab";
  b.setAttribute("role", "tab");
  b.id = `ptab-${h.id}`;
  b.textContent = h.name.split(" ")[0];
  b.addEventListener("click", () => select(i, true));
  b.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const n = (i + (e.key === "ArrowRight" ? 1 : -1) + HEROINES.length) % HEROINES.length;
      select(n, false);
      tabs.children[n].focus();
    }
  });
  tabs.appendChild(b);
  const s = document.createElement("span");
  s.className = "tab";
  s.textContent = b.textContent;
  s.style.setProperty("--c", h.accent);
  tabsOn.appendChild(s);
});

// The highlighted copy of the tab row is clipped down to the active tab, so
// the colour change and the movement happen as one shape.
function clipTo(i, animate) {
  const b = tabs.children[i];
  const W = tabs.offsetWidth, H = tabs.offsetHeight;
  const l = b.offsetLeft, r = W - (b.offsetLeft + b.offsetWidth);
  const t = b.offsetTop, btm = H - (b.offsetTop + b.offsetHeight);
  tabsOn.style.transition = animate && !RM ? `clip-path 340ms ${EASE_OUT}` : "none";
  tabsOn.style.clipPath = `inset(${t}px ${r}px ${btm}px ${l}px round 999px)`;
  tabsOn.style.setProperty("--c", HEROINES[i].accent);
}

function select(i, animate) {
  if (i === current) return;
  current = i;
  const h = HEROINES[i];
  [...tabs.children].forEach((b, k) => {
    b.setAttribute("aria-selected", String(k === i));
    b.tabIndex = k === i ? 0 : -1;
  });
  clipTo(i, animate);
  section.style.setProperty("--c", h.accent);
  caption.textContent = `${h.name} · ${h.series}`;
  // swap with a short blur so the two clips read as one change
  cmp.classList.add("swapping");
  const load = () => {
    loadArt(h).then((img) => {
      if (HEROINES[current] !== h) return;
      artImgEl = img;
      art.src = artOf(h);
      art.style.objectPosition = `50% ${h.fy * 100}%`;
      cmp.classList.remove("swapping");
      draw(true);
    }).catch(() => cmp.classList.remove("swapping"));
  };
  if (animate && !RM) setTimeout(load, 160); else load();
}

/* ------------------------------------------------------------ divider */
function setPos(p) {
  pos = clamp(p);
  const pct = pos * 100;
  art.style.clipPath = `inset(0 0 0 ${pct}%)`;
  handle.style.transform = `translateX(${pos * cmp.clientWidth}px)`;
  handle.setAttribute("aria-valuenow", String(Math.round(pct)));
  handle.setAttribute("aria-valuetext", `${Math.round(pct)}% sketch`);
  labelL.style.opacity = clamp(pos / 0.22);
  labelR.style.opacity = clamp((1 - pos) / 0.22);
}

function stopAuto() {
  if (demoAnim) { demoAnim.stop(); demoAnim = null; }
  if (glide) { glide.stop(); glide = null; }
  demoDone = true;
}

let dragId = null, moved = false, downX = 0;
cmp.addEventListener("pointerdown", (e) => {
  if (dragId !== null) return;
  stopAuto();
  dragId = e.pointerId;
  cmp.setPointerCapture(dragId);
  moved = false; downX = e.clientX;
  const r = cmp.getBoundingClientRect();
  const onHandle = Math.abs(e.clientX - (r.left + pos * r.width)) < 28;
  cmp.classList.add("dragging");
  if (!onHandle) {
    // glide to where they pressed, then keep tracking the finger
    const to = (e.clientX - r.left) / r.width;
    glide = spring({ from: pos, to, stiffness: 520, damping: 40, onUpdate: (v) => setPos(v), onDone: () => (glide = null) });
  }
});
cmp.addEventListener("pointermove", (e) => {
  if (e.pointerId !== dragId) return;
  if (Math.abs(e.clientX - downX) > 2) moved = true;
  if (!moved) return;
  if (glide) { glide.stop(); glide = null; }
  const r = cmp.getBoundingClientRect();
  setPos((e.clientX - r.left) / r.width); // 1:1 with the pointer
});
const end = (e) => {
  if (e.pointerId !== dragId) return;
  dragId = null;
  cmp.classList.remove("dragging");
};
cmp.addEventListener("pointerup", end);
cmp.addEventListener("pointercancel", end);

handle.addEventListener("keydown", (e) => {
  const step = e.shiftKey ? 0.2 : 0.05;
  const map = { ArrowLeft: pos - step, ArrowRight: pos + step, Home: 0, End: 1 };
  if (e.key in map) { e.preventDefault(); stopAuto(); setPos(map[e.key]); }
});

// One demonstration sweep the first time the section is seen.
function demo() {
  if (demoDone || RM) return;
  const legs = [0.18, 0.82, 0.5];
  const run = (k) => {
    if (demoDone || k >= legs.length) { demoDone = true; return; }
    demoAnim = spring({ from: pos, to: legs[k], stiffness: 60, damping: 15, onUpdate: setPos, onDone: () => setTimeout(() => run(k + 1), 120) });
  };
  run(0);
}

/* ----------------------------------------------------- sketch drawing */
function sizeCanvas() {
  const dpr = Math.min(devicePixelRatio || 1, 1.5);
  canvas.width = Math.round(cmp.clientWidth * dpr);
  canvas.height = Math.round(cmp.clientHeight * dpr);
  setPos(pos);
  draw(true);
}
function draw(force) {
  if ((!visible && !force) || !artImgEl) return;
  pencilize(artImgEl, canvas, { fy: HEROINES[current].fy, boil: RM ? 0 : 1 });
}
let acc = 0, last = performance.now();
function loop(now) {
  acc += now - last; last = now;
  if (visible && acc > 1000 / 12) { acc = 0; draw(); } // on twos
  requestAnimationFrame(loop);
}

function checkVisible() {
  const r = cmp.getBoundingClientRect();
  const v = r.bottom > 0 && r.top < innerHeight && !store.modal;
  if (v !== visible) {
    visible = v;
    if (v && !demoDone) setTimeout(demo, 500);
  }
}

/* ---------------------------------------------------------------- boot */
let booted = false;
function boot() {
  if (booted) return;
  booted = true;
  select(0, false);
  sizeCanvas();
  requestAnimationFrame(loop);
}
const near = () => section.getBoundingClientRect().top < innerHeight * 2.5;
function watch() { if (!booted && near()) boot(); if (booted) checkVisible(); }
addEventListener("scroll", watch, { passive: true });
addEventListener("resize", () => { if (booted) { sizeCanvas(); clipTo(current, false); } });
setInterval(watch, 700);
watch();
store.on((what) => {
  if (what === "modal") checkVisible();
});
