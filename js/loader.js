// Preloader: a rolling counter tied to real progress (the nine portraits and
// the fonts), a kanji drawn in one stroke, then a split curtain that opens on
// the first frame. The page's intro animations wait for it (html.loaded).
import { HEROINES, loadArt, RM, EASE_IN_OUT } from "./data.js";

const el = document.querySelector(".loader");
const digits = [...el.querySelectorAll(".ld-d")];
const bar = el.querySelector(".ld-bar i");
const html = document.documentElement;

// each digit is a column 0–9 that rolls to its value
digits.forEach((d) => { d.innerHTML = `<span>${[...Array(10).keys()].join("</span><span>")}</span>`; });
function show(n) {
  const s = String(Math.min(100, Math.round(n))).padStart(3, "0");
  digits.forEach((d, i) => { d.style.setProperty("--n", s[i]); });
  bar.style.transform = `scaleX(${n / 100})`;
}

let done = 0;
const total = HEROINES.length + 1;
const tick = () => { done++; };
HEROINES.forEach((h) => loadArt(h).then(tick, tick));
(document.fonts ? document.fonts.ready : Promise.resolve()).then(tick, tick);

const t0 = performance.now();
let shown = 0, finished = false;
function frame(now) {
  if (finished) return;
  const target = (done / total) * 100;
  // never faster than the real progress, never slower than ~1.4s overall
  const floor = Math.min(100, ((now - t0) / 1400) * 100);
  const want = Math.min(target, Math.max(shown, floor));
  shown += (want - shown) * 0.25;
  if (target >= 100 && now - t0 > 1400 && shown > 99.4) shown = 100;
  show(shown);
  if (shown >= 100) { finished = true; clearInterval(timer); leave(); }
}
// a timer rather than animation frames: the digits roll on a CSS transition,
// and a timer keeps counting even where frames are throttled
const timer = setInterval(() => frame(performance.now()), 40);
// safety: never trap anyone behind the loader
setTimeout(() => { if (!finished) { finished = true; show(100); leave(); } }, 7000);

function leave() {
  html.classList.add("loaded");
  if (RM) { el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: "forwards" }).finished.then(() => el.remove()); return; }
  const top = el.querySelector(".ld-top"), bot = el.querySelector(".ld-bot"), mid = el.querySelector(".ld-mid");
  mid.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(.96)" }], { duration: 260, easing: "ease-out", fill: "forwards" });
  const o = { duration: 1000, delay: 180, easing: EASE_IN_OUT, fill: "forwards" };
  top.animate([{ transform: "translateY(0)" }, { transform: "translateY(-100%)" }], o);
  bot.animate([{ transform: "translateY(0)" }, { transform: "translateY(100%)" }], o).finished.then(() => el.remove());
  // the stage underneath zooms in slightly as the curtain opens
  document.querySelector(".story .stage")?.animate([{ transform: "scale(1.06)" }, { transform: "none" }], { duration: 1400, delay: 180, easing: EASE_IN_OUT });
}
