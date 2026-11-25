// Character sheets (settei): a full-page profile that grows out of a film frame.
import { HEROINES, byId, fileOf, artOf, loadArt, drawCover, RM, clamp, EASE_OUT, EASE_DRAWER, spring } from "./data.js";
import { store } from "./store.js";
import { still, cloneCanvas } from "./stills.js";
import { duck } from "./audio.js";

let root, scroller, media, art, video, nameEl, jpEl, seriesEl, descEl, wordsEl, paletteEl, turnEl, knownEl, idxEl, closeBtn, prevBtn, nextBtn, status;
let current = -1, origin = null, isOpen = false, busy = false, sampleTimer = 0, lastFocus = null;

const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

function build() {
  root = document.createElement("div");
  root.className = "sheet";
  root.hidden = true;
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-labelledby", "sheet-name");
  root.innerHTML = `
    <div class="sheet-bg" aria-hidden="true"></div>
    <div class="sheet-scroll">
      <div class="sheet-bar">
        <p class="sheet-kicker">Character sheet <span class="sheet-idx"></span></p>
        <div class="sheet-ctrl">
          <button type="button" class="chip-btn" data-go="-1">Previous</button>
          <button type="button" class="chip-btn" data-go="1">Next</button>
          <button type="button" class="chip-btn solid" data-close>Close</button>
        </div>
      </div>
      <div class="sheet-hero">
        <div class="sheet-media"><img class="sheet-art" alt="" draggable="false" /><span class="sheet-swipe" aria-hidden="true">Swipe for the next heroine</span></div>
        <div class="sheet-id">
          <p class="sheet-jp" aria-hidden="true"></p>
          <h2 class="sheet-name" id="sheet-name"></h2>
          <p class="sheet-series"></p>
          <p class="sheet-desc"></p>
          <ul class="sheet-words" aria-label="In three words"></ul>
        </div>
      </div>
      <section class="sheet-block reveal">
        <div class="sb-head"><h3>Colour model</h3><p>Sampled from her portrait. Select a swatch to copy its hex code.</p></div>
        <ol class="palette"></ol>
      </section>
      <section class="sheet-block reveal">
        <div class="sb-head"><h3>In motion</h3><p>Her clip, with six frames pulled from it. Select a frame to jump the clip there.</p></div>
        <div class="sheet-clip"><video muted loop playsinline preload="none"></video></div>
        <ol class="turn"></ol>
      </section>
      <section class="sheet-block reveal">
        <div class="sb-head"><h3>Known for</h3></div>
        <ul class="known"></ul>
      </section>
      <p class="sr sheet-status" aria-live="polite"></p>
    </div>`;
  document.body.appendChild(root);
  scroller = root.querySelector(".sheet-scroll");
  media = root.querySelector(".sheet-media");
  art = media.querySelector(".sheet-art");
  video = root.querySelector(".sheet-clip video");
  nameEl = root.querySelector(".sheet-name");
  jpEl = root.querySelector(".sheet-jp");
  seriesEl = root.querySelector(".sheet-series");
  descEl = root.querySelector(".sheet-desc");
  wordsEl = root.querySelector(".sheet-words");
  paletteEl = root.querySelector(".palette");
  turnEl = root.querySelector(".turn");
  knownEl = root.querySelector(".known");
  idxEl = root.querySelector(".sheet-idx");
  closeBtn = root.querySelector("[data-close]");
  prevBtn = root.querySelector('[data-go="-1"]');
  nextBtn = root.querySelector('[data-go="1"]');
  status = root.querySelector(".sheet-status");

  closeBtn.addEventListener("click", () => close());
  prevBtn.addEventListener("click", () => go(-1, true));
  nextBtn.addEventListener("click", () => go(1, true));
  root.addEventListener("keydown", onKey);
  bindSwipe();

  // Blocks inside the sheet reveal as they scroll into view.
  scroller.addEventListener("scroll", revealBlocks, { passive: true });

  for (let i = 0; i < 6; i++) {
    const li = document.createElement("li");
    li.innerHTML = `<button type="button" class="swatch"><i></i><span>#------</span></button>`;
    li.querySelector("button").addEventListener("click", copySwatch);
    paletteEl.appendChild(li);
  }
}

function revealBlocks() {
  root.querySelectorAll(".reveal:not(.in)").forEach((el) => {
    if (el.getBoundingClientRect().top < innerHeight * 0.88) el.classList.add("in");
  });
}

/* ------------------------------------------------------------ content */
function letters(text) {
  return [...text].map((ch, i) => `<span class="ltr" style="--i:${i}">${ch === " " ? "&nbsp;" : ch}</span>`).join("");
}

function fill(i) {
  const h = HEROINES[i];
  current = i;
  root.style.setProperty("--c", h.accent);
  idxEl.textContent = `${i + 1} of ${HEROINES.length}`;
  nameEl.innerHTML = letters(h.name);
  nameEl.setAttribute("aria-label", h.name);
  jpEl.textContent = h.jp;
  seriesEl.textContent = `${h.series} · ${h.nick}`;
  descEl.textContent = h.desc;
  wordsEl.innerHTML = h.words.map((w, k) => `<li style="--k:${k}">${w}</li>`).join("");
  knownEl.innerHTML = h.known.map((w, k) => `<li style="--k:${k}">${w}</li>`).join("");
  art.classList.remove("ready");
  art.onload = () => art.classList.add("ready");
  art.src = artOf(h);
  art.alt = `${h.name} from ${h.series}`;
  art.style.objectPosition = `50% ${h.fy * 100}%`;
  if (art.complete && art.naturalWidth) art.classList.add("ready");
  video.src = `${fileOf(h)}#t=${h.still}`;
  video.muted = !store.audible;
  video.classList.remove("ready");
  video.addEventListener("loadeddata", () => video.classList.add("ready"), { once: true });
  video.play().catch(() => {});
  paletteEl.querySelectorAll(".swatch").forEach((s) => s.classList.remove("on"));
  fillTurn(h);
  clearTimeout(sampleTimer);
  sampleTimer = setTimeout(() => loadArt(h).then((img) => { if (HEROINES[current] === h) sample(img, h); }), 300);
}

function fillTurn(h) {
  turnEl.innerHTML = "";
  h.turn.forEach((t, k) => {
    const li = document.createElement("li");
    li.style.setProperty("--k", k);
    li.innerHTML = `<button type="button" class="still" aria-label="Jump to ${fmt(t)}"><span class="still-t">${fmt(t)}</span></button>`;
    const btn = li.firstElementChild;
    btn.addEventListener("click", (e) => {
      video.currentTime = t;
      video.play().catch(() => {});
      ripple(btn, e);
      status.textContent = `Jumped to ${fmt(t)}.`;
    });
    turnEl.appendChild(li);
    still(h.id, t, { w: 320, h: 180 }).then((c) => {
      if (current !== HEROINES.indexOf(h)) return;
      btn.prepend(cloneCanvas(c));
      requestAnimationFrame(() => btn.classList.add("developed"));
    }).catch(() => btn.classList.add("failed"));
  });
}

function ripple(el, e) {
  if (RM) return;
  const r = el.getBoundingClientRect();
  const dot = document.createElement("i");
  dot.className = "ripple";
  dot.style.left = `${(e.clientX || r.left + r.width / 2) - r.left}px`;
  dot.style.top = `${(e.clientY || r.top + r.height / 2) - r.top}px`;
  el.appendChild(dot);
  dot.animate([{ transform: "translate(-50%,-50%) scale(0.2)", opacity: 0.6 }, { transform: "translate(-50%,-50%) scale(6)", opacity: 0 }], { duration: 600, easing: EASE_OUT })
    .finished.then(() => dot.remove());
}

/* ------------------------------------------- live palette from the clip */
const sampler = document.createElement("canvas");
sampler.width = 64; sampler.height = 80;
const sctx = sampler.getContext("2d", { willReadFrequently: true });
const hex = (r, g, b) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");

function sample(img, h) {
  if (!isOpen) return;
  {
    drawCover(sctx, img, 64, 80, h.fy);
    const d = sctx.getImageData(0, 0, 64, 80).data;
    const buckets = new Map();
    for (let p = 0; p < d.length; p += 4) {
      const r = d[p], g = d[p + 1], b = d[p + 2];
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      const e = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0, s: 0 };
      e.n++; e.r += r; e.g += g; e.b += b; e.s += max - min;
      buckets.set(key, e);
    }
    // Rank by frequency, with a nudge toward saturated colours, then keep distinct ones.
    const ranked = [...buckets.values()]
      .map((e) => ({ r: e.r / e.n | 0, g: e.g / e.n | 0, b: e.b / e.n | 0, w: e.n * (1 + e.s / e.n / 64) }))
      .sort((a, b) => b.w - a.w);
    const picked = [];
    for (const c of ranked) {
      if (picked.every((p) => Math.hypot(p.r - c.r, p.g - c.g, p.b - c.b) > 56)) picked.push(c);
      if (picked.length === 6) break;
    }
    picked.sort((a, b) => (a.r * 0.3 + a.g * 0.59 + a.b * 0.11) - (b.r * 0.3 + b.g * 0.59 + b.b * 0.11));
    paletteEl.querySelectorAll(".swatch").forEach((s, k) => {
      const c = picked[k];
      if (!c) return;
      const hx = hex(c.r, c.g, c.b);
      s.style.setProperty("--sw", hx);
      s.dataset.hex = hx;
      if (!s.classList.contains("copied")) s.querySelector("span").textContent = hx;
      s.setAttribute("aria-label", `Copy ${hx}`);
      s.style.setProperty("--k", k);
      s.classList.add("on");
    });
  }
}

async function copySwatch(e) {
  const s = e.currentTarget;
  const hx = s.dataset.hex;
  if (!hx) return;
  try { await navigator.clipboard.writeText(hx); } catch { /* clipboard blocked: still show the value */ }
  const label = s.querySelector("span");
  s.classList.add("copied");
  label.textContent = "Copied";
  status.textContent = `Copied ${hx}.`;
  setTimeout(() => { s.classList.remove("copied"); label.textContent = s.dataset.hex; }, 1200);
}

/* --------------------------------------------------- open, close, go */
function rectOf(el) { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; }

function flip(el, from, { duration, easing, reverse = false }) {
  const to = rectOf(el);
  const t = `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`;
  const frames = [{ transform: t, borderRadius: "4px" }, { transform: "none", borderRadius: "18px" }];
  return el.animate(reverse ? frames.reverse() : frames, { duration, easing, fill: "both" });
}

export function openSheet(id, fromEl) {
  if (!root) build();
  if (busy || isOpen) return;
  const i = HEROINES.findIndex((h) => h.id === id);
  if (i < 0) return;
  busy = true; isOpen = true;
  origin = fromEl || null;
  lastFocus = document.activeElement;
  store.setModal(true);
  duck("sheet", true);
  document.documentElement.classList.add("locked");
  root.hidden = false;
  scroller.scrollTop = 0;
  root.querySelectorAll(".reveal").forEach((el) => el.classList.remove("in"));
  fill(i);
  root.classList.remove("closing");
  root.classList.add("opening");

  const from = origin ? rectOf(origin) : null;
  const cx = from ? from.left + from.width / 2 : innerWidth / 2;
  const cy = from ? from.top + from.height / 2 : innerHeight / 2;
  const R = Math.hypot(Math.max(cx, innerWidth - cx), Math.max(cy, innerHeight - cy));
  const bg = root.querySelector(".sheet-bg");
  bg.getAnimations().forEach((a) => a.cancel()); // drop the last close's held end state
  const dur = RM ? 1 : 760;
  bg.animate([{ clipPath: `circle(0px at ${cx}px ${cy}px)` }, { clipPath: `circle(${R}px at ${cx}px ${cy}px)` }], { duration: RM ? 200 : 700, easing: EASE_DRAWER, fill: "both" });
  if (RM) bg.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, fill: "both" });
  const anim = from && !RM ? flip(media, from, { duration: dur, easing: EASE_DRAWER }) : media.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250, fill: "both" });
  requestAnimationFrame(() => root.classList.add("open"));
  setTimeout(revealBlocks, 500);
  anim.finished.then(() => { busy = false; anim.cancel(); closeBtn.focus({ preventScroll: true }); revealBlocks(); });
}

export function close() {
  if (!isOpen || busy) return;
  busy = true;
  root.classList.remove("open");
  root.classList.add("closing");
  clearTimeout(sampleTimer);
  const target = origin && origin.isConnected ? rectOf(origin) : null;
  const visible = target && target.width > 0 && target.bottom > 0 && target.top < innerHeight;
  const bg = root.querySelector(".sheet-bg");
  const cx = visible ? target.left + target.width / 2 : innerWidth / 2;
  const cy = visible ? target.top + target.height / 2 : innerHeight / 2;
  const R = Math.hypot(Math.max(cx, innerWidth - cx), Math.max(cy, innerHeight - cy));
  bg.animate([{ clipPath: `circle(${R}px at ${cx}px ${cy}px)` }, { clipPath: `circle(0px at ${cx}px ${cy}px)` }], { duration: RM ? 150 : 480, easing: EASE_OUT, fill: "both" });
  const anim = visible && !RM && scroller.scrollTop < 40
    ? flip(media, target, { duration: 480, easing: EASE_OUT, reverse: true })
    : media.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(0.96)" }], { duration: 200, easing: EASE_OUT, fill: "both" });
  anim.finished.then(() => {
    anim.cancel();
    root.hidden = true;
    root.classList.remove("closing", "opening");
    video.pause();
    isOpen = false; busy = false;
    duck("sheet", false);
    document.documentElement.classList.remove("locked");
    store.setModal(false);
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  });
}

function go(dir, animated) {
  if (busy) return;
  const next = (current + dir + HEROINES.length) % HEROINES.length;
  if (!animated || RM) { fill(next); status.textContent = `${HEROINES[next].name}.`; return; }
  busy = true;
  const id = root.querySelector(".sheet-id");
  const out = [{ opacity: 1, transform: "none", filter: "blur(0px)" }, { opacity: 0, transform: `translateX(${-dir * 40}px)`, filter: "blur(6px)" }];
  const parts = [id, media];
  Promise.all(parts.map((el) => el.animate(out, { duration: 180, easing: EASE_OUT, fill: "both" }).finished)).then(() => {
    fill(next);
    scroller.scrollTo({ top: 0, behavior: "smooth" });
    status.textContent = `${HEROINES[next].name}.`;
    const inn = [{ opacity: 0, transform: `translateX(${dir * 40}px)`, filter: "blur(6px)" }, { opacity: 1, transform: "none", filter: "blur(0px)" }];
    return Promise.all(parts.map((el, k) => el.animate(inn, { duration: 340, delay: k * 40, easing: EASE_OUT, fill: "both" }).finished));
  }).then(() => {
    parts.forEach((el) => el.getAnimations().forEach((a) => a.cancel()));
    busy = false;
  });
}

/* --------------------------------------------- swipe the media sideways */
function bindSwipe() {
  let id = null, sx = 0, x = 0, samples = [], sp = null;
  media.style.touchAction = "pan-y";
  media.addEventListener("pointerdown", (e) => {
    if (id !== null || busy) return;
    id = e.pointerId; sx = e.clientX; x = 0; samples = [{ t: e.timeStamp, x: e.clientX }];
    if (sp) sp.stop();
    media.setPointerCapture(id);
    media.classList.add("dragging");
  });
  media.addEventListener("pointermove", (e) => {
    if (e.pointerId !== id) return;
    const dx = e.clientX - sx;
    const limit = media.offsetWidth * 0.5;
    x = Math.abs(dx) < limit ? dx : Math.sign(dx) * (limit + (Math.abs(dx) - limit) * 0.2); // rubber-band past half
    media.style.transform = `translateX(${x}px) rotate(${x * 0.01}deg)`;
    samples.push({ t: e.timeStamp, x: e.clientX });
    if (samples.length > 6) samples.shift();
  });
  const end = (e) => {
    if (e.pointerId !== id) return;
    id = null;
    media.classList.remove("dragging");
    const a = samples[0], b = samples[samples.length - 1];
    const v = ((b.x - a.x) / Math.max(1, b.t - a.t)) * 1000;
    const w = media.offsetWidth;
    const dir = Math.abs(x) > w * 0.25 || Math.abs(v) > 600 ? -Math.sign(x || v) : 0;
    sp = spring({
      from: x, to: 0, velocity: v, stiffness: 420, damping: 32,
      onUpdate: (val) => { media.style.transform = val ? `translateX(${val}px) rotate(${val * 0.01}deg)` : ""; },
    });
    if (dir && Math.abs(x) > 6) go(dir, true);
  };
  media.addEventListener("pointerup", end);
  media.addEventListener("pointercancel", end);
}

/* ------------------------------------------------- keyboard and focus */
function onKey(e) {
  if (e.key === "Escape") { e.preventDefault(); close(); return; }
  if (e.key === "ArrowRight" && !e.target.closest("button.swatch")) { go(1, false); return; }
  if (e.key === "ArrowLeft" && !e.target.closest("button.swatch")) { go(-1, false); return; }
  if (e.key === "Tab") {
    const f = [...root.querySelectorAll("button, [href], [tabindex]:not([tabindex='-1'])")].filter((el) => !el.disabled && el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
}

store.on((what) => { if (what === "sound" && video) video.muted = !store.audible; });
export const sheetIsOpen = () => isOpen;
export { byId };
