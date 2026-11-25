// Timing playground: the same clip held on ones, twos or threes.
import { HEROINES, fileOf, RM, EASE_OUT } from "./data.js";
import { store } from "./store.js";

const section = document.querySelector(".timing");
const video = document.createElement("video");
video.muted = true; video.loop = true; video.playsInline = true; video.preload = "auto";
const stage = section.querySelector(".tm-canvas"), sctx = stage.getContext("2d");
const tally = section.querySelector(".tm-tally");
const nEl = section.querySelector(".tm-n");
const stripIn = section.querySelector(".tm-strip-in");
const rows = section.querySelector(".tm-rows");
const rateN = section.querySelector(".tm-rate-n");
const seg = section.querySelector(".seg"), segInd = seg.querySelector(".seg-ind");
const segBtns = [...seg.querySelectorAll("[role=radio]")];
const playBtn = section.querySelector("[data-act=play]");
const backBtn = section.querySelector("[data-act=back]");
const fwdBtn = section.querySelector("[data-act=fwd]");
const slowBtn = section.querySelector("[data-act=slow]");
const clips = section.querySelector(".tm-clips");

const ROWS = 15, FOCUS = 5; // visible timesheet rows, and which one is "now"
let N = 2, current = -1, lastDrawing = -1, drawings = 0, visible = false, userPaused = false, slow = false;

/* ---------------------------------------------------------- clip chips */
HEROINES.forEach((h, i) => {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "mini-chip";
  b.textContent = h.name.split(" ")[0];
  b.style.setProperty("--c", h.accent);
  b.setAttribute("aria-pressed", "false");
  b.addEventListener("click", () => setClip(i));
  clips.appendChild(b);
});
function setClip(i) {
  if (i === current) return;
  current = i;
  const h = HEROINES[i];
  section.style.setProperty("--c", h.accent);
  [...clips.children].forEach((b, k) => b.setAttribute("aria-pressed", String(k === i)));
  video.src = `${fileOf(h)}#t=${Math.max(0, h.still - 3)}`;
  video.playbackRate = slow ? 0.25 : 1;
  lastDrawing = -1;
  if (visible && !userPaused) video.play().catch(() => {});
}

/* ------------------------------------------------------ segmented control */
function moveIndicator(animate) {
  const b = segBtns.find((x) => x.getAttribute("aria-checked") === "true");
  segInd.style.transition = animate && !RM ? `transform 280ms ${EASE_OUT}, width 280ms ${EASE_OUT}` : "none";
  segInd.style.width = `${b.offsetWidth}px`;
  segInd.style.transform = `translateX(${b.offsetLeft}px)`;
}
function setTiming(n, animate) {
  const prev = N;
  N = n;
  segBtns.forEach((b) => {
    const on = +b.dataset.n === n;
    b.setAttribute("aria-checked", String(on));
    b.tabIndex = on ? 0 : -1;
  });
  moveIndicator(animate);
  rollNumber(rateN, String(24 / n), prev < n ? 1 : -1, animate);
  lastDrawing = -1;
  stripIn.innerHTML = "";
  buildRows(true);
}
segBtns.forEach((b, k) => {
  b.addEventListener("click", () => setTiming(+b.dataset.n, true));
  b.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = segBtns[(k + (e.key === "ArrowRight" ? 1 : -1) + segBtns.length) % segBtns.length];
    setTiming(+next.dataset.n, false);
    next.focus();
  });
});

// Numbers roll: the old value leaves upward, the new one rises from below.
function rollNumber(el, value, dir, animate) {
  if (el.textContent === value) return;
  if (!animate || RM) { el.textContent = value; return; }
  const old = document.createElement("span"), neu = document.createElement("span");
  old.textContent = el.textContent; neu.textContent = value;
  old.className = neu.className = "roll-n";
  el.textContent = "";
  el.append(old, neu);
  const opts = { duration: 380, easing: EASE_OUT, fill: "both" };
  old.animate([{ transform: "translateY(0)", opacity: 1 }, { transform: `translateY(${-60 * dir}%)`, opacity: 0 }], opts);
  neu.animate([{ transform: `translateY(${60 * dir}%)`, opacity: 0 }, { transform: "translateY(0)", opacity: 1 }], opts)
    .finished.then(() => { el.textContent = value; });
}

/* ------------------------------------------------------------ transport */
function setPlaying(on) {
  userPaused = !on;
  playBtn.setAttribute("aria-pressed", String(!on));
  playBtn.textContent = on ? "Pause" : "Play";
  backBtn.disabled = fwdBtn.disabled = on;
  if (on && visible) video.play().catch(() => {}); else video.pause();
}
playBtn.addEventListener("click", () => setPlaying(userPaused));
function step(dir) {
  // one drawing = N film frames
  const t = Math.max(0, video.currentTime + (dir * N) / 24);
  video.currentTime = t;
  video.addEventListener("seeked", () => { lastDrawing = -1; render(true); }, { once: true });
}
backBtn.addEventListener("click", () => step(-1));
fwdBtn.addEventListener("click", () => step(1));
slowBtn.addEventListener("click", () => {
  slow = !slow;
  slowBtn.setAttribute("aria-pressed", String(slow));
  video.playbackRate = slow ? 0.25 : 1;
});

/* ------------------------------------------------------------ timesheet */
function buildRows(force) {
  if (rows.children.length !== ROWS || force) {
    rows.innerHTML = "";
    for (let i = 0; i < ROWS; i++) {
      const r = document.createElement("div");
      r.className = "tm-row";
      r.innerHTML = `<span class="tm-f"></span><span class="tm-c"></span>`;
      rows.appendChild(r);
    }
  }
}
let lastFrame = -1;
function paintRows(frame, frac) {
  if (frame !== lastFrame) {
    lastFrame = frame;
    [...rows.children].forEach((r, i) => {
      const f = frame - FOCUS + i;
      const valid = f >= 0;
      r.classList.toggle("now", i === FOCUS);
      r.classList.toggle("key", valid && f % N === 0);
      r.children[0].textContent = valid ? String((f % 24) + 1).padStart(2, "0") : "";
      r.children[1].textContent = !valid ? "" : f % N === 0 ? String(Math.floor(f / N) + 1) : "";
      r.classList.toggle("sec", valid && f % 24 === 0);
    });
  }
  // continuous, linear scroll between frames: time passes at a constant rate
  rows.style.transform = `translateY(${-frac * 100 / ROWS}%)`;
}

/* --------------------------------------------------------------- render */
const THUMBS = 9;
function pushThumb(num) {
  const c = document.createElement("canvas");
  c.width = 160; c.height = 90;
  c.getContext("2d").drawImage(video, 0, 0, 160, 90);
  const cell = document.createElement("div");
  cell.className = "tm-thumb";
  cell.appendChild(c);
  const lbl = document.createElement("span");
  lbl.textContent = String(num);
  cell.appendChild(lbl);
  stripIn.appendChild(cell);
  while (stripIn.children.length > THUMBS + 1) stripIn.firstElementChild.remove();
  if (RM) return;
  const w = cell.offsetWidth + 8;
  const interval = (N / 24) * 1000 / (slow ? 0.25 : 1);
  stripIn.getAnimations().forEach((a) => a.cancel());
  stripIn.animate([{ transform: `translateX(${w}px)` }, { transform: "translateX(0)" }], { duration: Math.min(interval * 0.85, 220), easing: EASE_OUT });
  cell.animate([{ opacity: 0, filter: "brightness(2)" }, { opacity: 1, filter: "brightness(1)" }], { duration: Math.min(interval * 0.85, 260), easing: EASE_OUT });
}

function render(force) {
  if (video.readyState < 2) return;
  const exact = video.currentTime * 24;
  const frame = Math.floor(exact);
  const drawing = Math.floor(frame / N);
  if (drawing !== lastDrawing || force) {
    lastDrawing = drawing;
    drawings++;
    sctx.drawImage(video, 0, 0, stage.width, stage.height);
    nEl.textContent = String(drawing + 1);
    pushThumb(drawing + 1);
    tally.classList.remove("blink"); void tally.offsetWidth; tally.classList.add("blink");
  }
  paintRows(frame, RM ? 0 : exact - frame);
}

function loop() {
  if (visible) render(false);
  requestAnimationFrame(loop);
}

function checkVisible() {
  const r = section.getBoundingClientRect();
  const v = r.bottom > 0 && r.top < innerHeight && !store.modal;
  if (v === visible) return;
  visible = v;
  if (v && !userPaused) video.play().catch(() => {}); else video.pause();
  if (v) moveIndicator(false);
}

/* ---------------------------------------------------------------- boot */
let booted = false;
function boot() {
  if (booted) return;
  booted = true;
  stage.width = 960; stage.height = 540;
  buildRows(true);
  setTiming(2, false);
  setClip(4);
  setPlaying(true);
  requestAnimationFrame(loop);
}
function watch() {
  if (!booted && section.getBoundingClientRect().top < innerHeight * 2.5) boot();
  if (booted) checkVisible();
}
addEventListener("scroll", watch, { passive: true });
addEventListener("resize", () => booted && moveIndicator(false));
setInterval(watch, 700);
watch();
store.on((w) => { if (w === "modal") checkVisible(); });
