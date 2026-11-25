/* Kokonoe — one scroll timeline, no framework.
   Everything scroll-driven reads from a smoothed scroll value and writes
   transform / opacity / clip-path only. */
import { HEROINES, byId, VID, RM, clamp, lerp, eo, revealWhenReady, artOf, artImg, loadArt, drawCover } from "./js/data.js";
import { store } from "./js/store.js";
import { openSheet } from "./js/sheet.js";
import { pencilize } from "./js/pencilize.js";

(() => {
  "use strict";

  const M = RM ? 0 : 1; // multiplier for movement; opacity changes stay
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const seg = (p, a, b) => clamp((p - a) / (b - a));
  const eio = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const fade = (p, a, b, c, d) => Math.min(seg(p, a, b), 1 - seg(p, c, d));

  const N = HEROINES.length;
  let dirty = true, pickInView = false;

  /* ------------------------------------------------------------ elements */
  const story = $(".story"), roster = $(".roster"), pick = $(".pick"), credits = $(".credits");
  const letters = $$(".mega span");
  const tate = $(".tate");
  const night = $(".night"), paper = $(".paper");
  const HAS_GL = () => document.documentElement.classList.contains("has-gl");
  const wrap = $(".cel-wrap"), cel = $(".cel"), field = $(".field");
  const layers = $$(".l-bg, .l-flat, .l-shade, .l-line, .l-light", cel); // bottom → top
  const sketch = $(".l-sketch"), comp = $(".l-comp"), brush = $(".brush");
  const anchors = $$(".anchor", cel);
  const callouts = $$(".callouts li");
  const leaders = $$(".leaders path");
  const sweepB = $(".sweep-back"), sweepF = $(".sweep-front");
  const focus = $(".focus"), fctx = focus.getContext("2d");
  const c1 = $(".c1"), c2 = $(".c2"), c3 = $(".c3"), c4 = $(".c4"), c5 = $(".c5");
  const xsheetN = $(".xsheet-n");
  const navLinks = $$(".top nav a");

  /* -------------------------------------------------------------- layout */
  let vw = 0, vh = 0, docMax = 1, celW = 0, celH = 0, sweepW = 0;
  const geo = { story: {}, roster: {}, pick: {}, credits: {} };
  const sectionGeo = (el) => ({ top: el.offsetTop, len: Math.max(1, el.offsetHeight - vh), h: el.offsetHeight });

  function measure() {
    vw = innerWidth; vh = innerHeight;
    geo.story = sectionGeo(story);
    geo.roster = sectionGeo(roster);
    geo.pick = sectionGeo(pick);
    geo.credits = sectionGeo(credits);
    docMax = Math.max(1, document.documentElement.scrollHeight - vh);
    celW = wrap.offsetWidth; celH = wrap.offsetHeight;
    sweepW = sweepB.offsetWidth;
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    focus.width = Math.round(vw * dpr); focus.height = Math.round(vh * dpr);
    measureTrack();
    rollH = roll.offsetHeight;
    dirty = true;
  }

  /* ------------------------------------------------ title scatter seeds */
  const seeds = letters.map((_, i) => {
    const r = (n) => (Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1;
    return { x: (i - 3) * 0.22 + r(1) * 0.15, y: -0.6 + Math.abs(r(2)) * 1.4, rz: r(3) * 70, s: 1.4 + Math.abs(r(4)) };
  });

  /* ------------------------------------------- cel layer canvases (12fps) */
  const LCW = 480, LCH = 600;
  [...layers, sketch].forEach((c) => { c.width = LCW; c.height = LCH; });
  const lctx = [...layers, sketch].map((c) => c.getContext("2d"));
  // The cel holds Makima's art. Its five "passes" are drawn once from the
  // illustration; the pencil sketch is redrawn on twos with a little line boil.
  const HERO = byId.makima;
  let heroArt = null;
  loadArt(HERO).then((img) => { heroArt = img; drawLayers(true, true); }).catch(() => {});
  function drawLayers(includeSketch, includeLayers) {
    if (!heroArt) return;
    if (includeLayers) for (let i = 0; i < 5; i++) drawCover(lctx[i], heroArt, LCW, LCH, HERO.fy);
    if (includeSketch) pencilize(heroArt, sketch, { fy: HERO.fy, boil: RM ? 0 : 1 });
  }

  /* ------------------------------------- focus lines (集中線), on twos */
  function drawFocus() {
    const w = focus.width, h = focus.height, cx = w / 2, cy = h / 2;
    const R = Math.hypot(w, h) * 0.6, base = Math.min(w, h);
    fctx.clearRect(0, 0, w, h);
    fctx.fillStyle = "#fff";
    const count = 150;
    for (let k = 0; k < count; k++) {
      const a = (k / count) * Math.PI * 2 + Math.random() * 0.03;
      const r0 = base * (0.3 + Math.random() * 0.22);
      const half = (0.002 + Math.random() * 0.007);
      fctx.globalAlpha = 0.45 + Math.random() * 0.5;
      fctx.beginPath();
      fctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      fctx.lineTo(cx + Math.cos(a - half) * R, cy + Math.sin(a - half) * R);
      fctx.lineTo(cx + Math.cos(a + half) * R, cy + Math.sin(a + half) * R);
      fctx.closePath();
      fctx.fill();
    }
    fctx.globalAlpha = 1;
  }

  /* --------------------------------------------------------------- story */
  const FLIP = ["mikasa", "yor", "shinobu", "mitsuri", "marin", "robin", "hinata", "waguri", "makima"];
  HEROINES.forEach((h) => loadArt(h).catch(() => {})); // warm the cache so flips are instant
  let shownArt = "makima";
  comp.style.objectPosition = `50% ${byId.makima.fy * 100}%`;
  function showArt(id) {
    if (id === shownArt) return;
    shownArt = id;
    const h = byId[id];
    comp.src = artOf(h);
    comp.alt = `${h.name} from ${h.series}`;
    comp.style.objectPosition = `50% ${h.fy * 100}%`;
    dispatchEvent(new CustomEvent("koko:accent", { detail: h.accent }));
    if (!RM) comp.animate([{ filter: "brightness(2.2) saturate(0)" }, { filter: "none" }], { duration: 140, easing: "ease-out" });
  }
  let storyFlags = { sketch: true, layers: false, focus: false };

  // hero: the frame leans toward the mouse, and the pointer is a paintbrush
  // that shows the colour under the sketch
  let tmx = 0, tmy = 0, hmx = 0, hmy = 0, brushX = 0, brushY = 0, brushR = 0, overCel = false;
  const fineMouse = matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (fineMouse && !RM) {
    addEventListener("pointermove", (e) => {
      tmx = (e.clientX / innerWidth) * 2 - 1;
      tmy = (e.clientY / innerHeight) * 2 - 1;
      const r = cel.getBoundingClientRect();
      overCel = e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom;
      if (overCel) { brushX = ((e.clientX - r.left) / r.width) * cel.offsetWidth; brushY = ((e.clientY - r.top) / r.height) * cel.offsetHeight; }
    }, { passive: true });
  }
  function renderStory(p) {
    // 1 — title scatters as night falls
    const sc = eio(seg(p, 0.08, 0.22));
    const lo = 1 - seg(p, 0.12, 0.21);
    letters.forEach((el, i) => {
      const s = seeds[i];
      el.style.transform = `translate3d(${s.x * sc * vw * M}px, ${s.y * sc * vh * 0.5 * M}px, 0) rotate(${s.rz * sc * M}deg) scale(${1 + (s.s - 1) * sc * M})`;
      el.style.opacity = lo;
    });
    tate.style.opacity = 1 - seg(p, 0.06, 0.14);
    c1.style.opacity = 1 - seg(p, 0.02, 0.07);
    c1.style.transform = `translateY(${-seg(p, 0.02, 0.07) * 20 * M}px)`;

    // 2 — ink & paint: colour wipes over the blue-pencil sketch
    const w = eio(seg(p, 0.05, 0.19));
    // before the scroll wipe starts, the brush paints a circle of colour
    comp.style.clipPath = w < 0.01 && brushR > 1 ? `circle(${brushR.toFixed(1)}px at ${brushX.toFixed(1)}px ${brushY.toFixed(1)}px)` : `inset(0 ${(1 - w) * 100}% 0 0)`;
    brush.style.transform = `translateX(${w * celW}px)`;
    brush.style.opacity = Math.sin(Math.PI * w);
    storyFlags.sketch = w < 1;
    sketch.style.visibility = w < 1 ? "visible" : "hidden";

    // night spreads from the frame
    const y0 = vh * (vw <= 760 ? 0.02 : 0.12);
    const lift = eio(seg(p, 0.14, 0.3));
    const celY = y0 * (1 - lift);
    const n = eo(seg(p, 0.1, 0.24));
    const nr = n * Math.hypot(vw, vh), ny = 50 + (celY / vh) * 100;
    night.style.clipPath = `circle(${nr}px at 50% ${ny}%)`;
    // with the WebGL water behind, punch a matching hole in the paper instead
    if (HAS_GL()) paper.style.maskImage = paper.style.webkitMaskImage = nr > 1 ? `radial-gradient(circle at 50% ${ny}%, transparent ${nr}px, #000 ${nr + 1}px)` : "";
    field.style.opacity = 1 - seg(p, 0.15, 0.24);

    c2.style.opacity = fade(p, 0.13, 0.17, 0.24, 0.28);
    c2.style.transform = `translateY(${(1 - eo(seg(p, 0.13, 0.18))) * 30 * M}px)`;

    // 3 — tilt to isometric, explode into passes, drift, collapse
    const tilt = eio(seg(p, 0.24, 0.36)) * (1 - eio(seg(p, 0.6, 0.71)));
    const drift = seg(p, 0.36, 0.64);
    const ex = eio(seg(p, 0.36, 0.48)) * (1 - eio(seg(p, 0.58, 0.68)));
    storyFlags.layers = ex > 0.001;
    const rx = 56 * tilt * M, rz = (-34 - 18 * drift) * tilt * M;

    c3.style.opacity = fade(p, 0.27, 0.3, 0.35, 0.39);
    c3.style.transform = `translateY(${(1 - eo(seg(p, 0.27, 0.31))) * 30 * M}px)`;
    c4.style.opacity = fade(p, 0.4, 0.44, 0.58, 0.62);
    c4.style.transform = `translateY(${(1 - eo(seg(p, 0.4, 0.45))) * -24 * M}px)`;

    // 4 — zoom into the frame until it fills the screen
    const z = eio(seg(p, 0.74, 0.9));
    const cover = Math.max(vw / celW, vh / celH) * 1.04;
    const scale = lerp(1 - 0.2 * tilt * M, cover, z);
    // mouse tilt, strongest at the top of the page and gone once scrolling takes over
    const tk = (1 - seg(p, 0.02, 0.14)) * (fineMouse ? 1 : 0) * M;
    wrap.style.transform = `translate3d(0, ${celY}px, 0) perspective(1600px) rotateX(${(-hmy * 8 * tk).toFixed(2)}deg) rotateY(${(hmx * 11 * tk).toFixed(2)}deg)`;
    field.style.transform = tk > 0 ? `translateZ(${-70 * tk}px)` : "";
    wrap.toggleAttribute("data-cursor", tk > 0.5);
    if (tk > 0.5) { wrap.dataset.cursor = "Paint"; wrap.dataset.cursorStyle = "brush"; }
    cel.style.transform = RM ? `scale(${scale})` : `scale(${scale}) rotateX(${rx}deg) rotateZ(${rz}deg)`;

    const gap = celH * 0.36 * ex * M;
    const layerOn = clamp(ex * 4);
    layers.forEach((el, i) => {
      el.style.transform = `translateZ(${(i - 2) * gap}px)`;
      el.style.opacity = layerOn * (i === 4 ? 0.75 : 1);
    });
    anchors.forEach((el, i) => { el.style.transform = `translateZ(${(i - 2) * gap}px)`; });
    comp.style.transform = `translateZ(${2 * gap + 1}px)`;
    comp.style.opacity = 1 - layerOn;
    comp.style.borderRadius = `${6 * (1 - z)}px`;

    // callouts + leader lines follow the real projected anchors
    const anyCallout = p > 0.42 && p < 0.63;
    callouts.forEach((li, i) => {
      const k = anyCallout ? fade(p, 0.44 + i * 0.014, 0.47 + i * 0.014, 0.57, 0.61) : 0;
      li.style.opacity = k;
      const path = leaders[i];
      if (k <= 0) { path.style.opacity = 0; return; }
      const r = anchors[i].getBoundingClientRect();
      const ax = r.left, ay = r.top;
      const lh = li.offsetHeight;
      const top = clamp(ay - 14, vh * 0.2, vh - lh - 50);
      li.style.transform = `translateY(${top}px)`;
      const right = li.dataset.side === "r";
      const lb = li.getBoundingClientRect();
      const lx = right ? lb.left - 14 : lb.right + 14;
      const ly = top + 13;
      const len = Math.hypot(ax - lx, ay - ly) + 20;
      path.setAttribute("d", `M${lx} ${ly} H${lerp(lx, ax, 0.35)} L${ax} ${ay}`);
      path.style.strokeDasharray = `${len}`;
      path.style.strokeDashoffset = `${len * (1 - k)}`;
      path.style.opacity = 0.8;
    });

    // 5 — the giant word passes through the frame
    const sw = seg(p, 0.64, 0.9);
    const sOp = fade(p, 0.64, 0.67, 0.86, 0.9);
    const sx = RM ? (vw - sweepW) / 2 : lerp(vw * 1.02, -sweepW - vw * 0.05, sw);
    sweepB.style.transform = sweepF.style.transform = `translate3d(${sx}px, 0, 0)`;
    sweepB.style.opacity = sOp * 0.95;
    sweepF.style.opacity = sOp;

    // the frame flips through all nine as the word passes, landing on Makima
    const fi = p < 0.665 ? -1 : Math.min(FLIP.length - 1, Math.floor(seg(p, 0.665, 0.84) * FLIP.length));
    showArt(fi < 0 ? "makima" : FLIP[fi]);

    // 6 — focus lines and the hand-off
    const fo = seg(p, 0.86, 0.94);
    focus.style.opacity = fo * 0.9;
    storyFlags.focus = fo > 0;
    focus.style.transform = `scale(${1 + 0.15 * (1 - fo) * M})`;
    c5.style.opacity = seg(p, 0.9, 0.95);
    c5.style.transform = `scale(${lerp(1.25, 1, eo(seg(p, 0.9, 0.96))) * (M ? 1 : 1)})`;
    if (RM) c5.style.transform = "none";
  }

  /* -------------------------------------------------------------- roster */
  const track = $(".track");
  const rName = $(".roster-name"), rInfo = $(".roster-info"), rJp = $(".roster-jp");
  const riI = $(".ri-i"), riName = $(".ri-name"), riSeries = $(".ri-series"), riDesc = $(".ri-desc");
  const frames = HEROINES.map((c, i) => {
    const f = document.createElement("div");
    f.className = "frame";
    f.innerHTML = `<div class="frame-in" role="button" tabindex="0" aria-label="Open ${c.name}'s character sheet" style="--c:${c.accent}" data-n="Cut ${String(i + 1).padStart(2, "0")}"><span class="frame-open" aria-hidden="true">Open sheet</span><span class="ph" aria-hidden="true">${c.jp}</span></div>`;
    track.appendChild(f);
    const inner = f.firstElementChild;
    const art = artImg(c, "vid");
    art.alt = `${c.name}, ${c.series}`;
    inner.appendChild(art);
    showWhenLoaded(art);
    const video = null;
    const open = () => openSheet(c.id, inner);
    inner.addEventListener("click", open);
    inner.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
    return { el: f, inner, video };
  });
  let fw = 0, unit = 0, active = -1;
  function measureTrack() {
    const first = frames[0].el;
    const cs = getComputedStyle(first);
    fw = first.offsetWidth;
    unit = fw + parseFloat(cs.marginLeft) + parseFloat(cs.marginRight);
  }
  function setActive(i) {
    if (i === active) return;
    const first = active === -1;
    active = i;
    const c = HEROINES[i];
    roster.style.setProperty("--accent", c.accent);
    if (rosterVisible) dispatchEvent(new CustomEvent("koko:accent", { detail: c.accent }));
    const apply = () => {
      riI.textContent = i + 1;
      riName.textContent = c.name;
      riSeries.textContent = `${c.series} · ${c.nick}`;
      riDesc.textContent = c.desc;
      rName.textContent = c.name;
      rJp.textContent = c.jp;
      rInfo.classList.remove("swap");
      rName.classList.remove("swap");
    };
    if (first) { apply(); return; }
    rInfo.classList.add("swap");
    rName.classList.add("swap");
    clearTimeout(setActive.t);
    setActive.t = setTimeout(apply, 180);
  }
  let skew = 0, rosterVisible = false, glitching = false;
  function renderRoster(rp, vel, inView) {
    glitching = false;
    if (inView && !rosterVisible) dispatchEvent(new CustomEvent("koko:accent", { detail: HEROINES[Math.max(0, active)].accent }));
    rosterVisible = inView;
    const f = clamp((rp - 0.03) / 0.94) * (N - 1);
    const x = vw / 2 - (f * unit + unit / 2);
    skew = lerp(skew, clamp(-vel * 0.006, -9, 9) * M, 0.18);
    if (Math.abs(skew) > 0.05) glitching = true; // ease the lean back to zero after scrolling stops
    track.style.transform = `translate3d(${x}px, 0, 0) skewX(${skew}deg)`;
    const a = Math.round(f);
    setActive(a);
    frames.forEach((fr, i) => {
      const d = i - f, ad = Math.abs(d);
      if (ad > 3) { fr.inner.style.opacity = 0; fr.inner.style.filter = ""; playIf(fr.video, false); return; }
      const s = 1 - Math.min(ad, 2) * 0.13;
      fr.inner.style.transform = `rotateY(${clamp(d, -2, 2) * -16 * M}deg) scale(${RM ? 1 : s})`;
      fr.inner.style.opacity = 1 - Math.min(ad, 2.5) * 0.3;
      // fast scrolling splits the frames into red and cyan copies
      const g = M * clamp(Math.abs(vel) * 0.0016 - 0.5, 0, 1);
      if (g > 0.02) glitching = true;
      fr.inner.style.filter = g > 0.02 ? `drop-shadow(${(g * 7).toFixed(1)}px 0 0 rgba(255,40,90,.8)) drop-shadow(${(-g * 7).toFixed(1)}px 0 0 rgba(40,210,255,.8))` : "";
      playIf(fr.video, inView && i === a && !store.modal);
    });
    rName.style.transform = `translate3d(${vw * 0.04 - (f - a) * vw * 0.25 * M}px, 0, 0)`;
  }

  /* -------------------------------------------------------------- videos */
  function showWhenLoaded(img) {
    if (img.complete && img.naturalWidth) img.classList.add("ready");
    else img.addEventListener("load", () => img.classList.add("ready"), { once: true });
  }
  function playIf(v, on) {
    if (!v || !v.play) return;
    if (on && v.paused) v.play().catch(() => {});
    else if (!on && !v.paused) v.pause();
  }
  let focusVideo = null;
  function setFocusVideo(v) {
    if (v === focusVideo) return;
    if (focusVideo) focusVideo.muted = true;
    focusVideo = v;
    if (v) v.muted = !store.audible;
  }
  store.on((what) => {
    if (what === "sound" && focusVideo) focusVideo.muted = !store.audible;
  });

  /* ------------------------------------------------------------- credits */
  const roll = $(".roll"), hanko = $(".hanko"), finL = $(".fin-l"), finR = $(".fin-r"), fan = $(".fin-fan"), finLine = $(".fin-line");
  let rollH = 0;
  // every credit line pops in letter by letter as it rolls up into view
  const credLines = $$(".roll dd").map((dd) => {
    const text = dd.textContent;
    dd.setAttribute("aria-label", text);
    dd.innerHTML = [...text].map((ch, i) => `<span class="cl" style="--i:${i}" aria-hidden="true">${ch === " " ? "&nbsp;" : ch}</span>`).join("");
    return dd;
  });
  // the nine fan out from behind the cracked 終
  const fanCards = HEROINES.map((h, i) => {
    const c = document.createElement("span");
    c.className = "fan-card";
    c.style.setProperty("--c", h.accent);
    c.style.zIndex = String(10 - Math.abs(i - 4));
    c.appendChild(artImg(h));
    fan.appendChild(c);
    return c;
  });
  function renderCredits(cp) {
    const k = seg(cp, 0, 0.56);
    roll.style.transform = `translate3d(0, ${-k * (rollH + vh)}px, 0)`;
    credLines.forEach((dd) => { if (!dd.classList.contains("in") && dd.getBoundingClientRect().top < vh * 0.9) dd.classList.add("in"); });
    const r = eo(seg(cp, 0.56, 0.66));
    const crack = eio(seg(cp, 0.74, 0.88)) * M;
    const halfOut = (dir) => `translate3d(${dir * crack * 34}vw, ${crack * 3}vh, 0) rotate(${dir * crack * 9}deg)`;
    finL.style.clipPath = `inset(0 50% ${(1 - r) * 100}% 0)`;
    finR.style.clipPath = `inset(0 0 ${(1 - r) * 100}% 50%)`;
    finL.style.transform = halfOut(-1);
    finR.style.transform = halfOut(1);
    const fo = RM ? 1 - seg(cp, 0.74, 0.8) : 1 - seg(cp, 0.84, 0.92) * 0.75;
    finL.style.opacity = finR.style.opacity = fo;
    const h = seg(cp, 0.66, 0.71);
    hanko.style.opacity = clamp(h * 3) * (1 - seg(cp, 0.74, 0.8));
    hanko.style.transform = `rotate(-8deg) scale(${RM ? 1 : lerp(1.5, 1, eo(h))})`;
    const f = eo(seg(cp, 0.76, 0.94));
    const step = Math.min(vw * 0.085, vh * 0.12);
    fanCards.forEach((c, i) => {
      const d = i - 4;
      c.style.opacity = seg(cp, 0.76, 0.8);
      c.style.transform = RM ? `translate(-50%, -50%) translateX(${d * step}px)` :
        `translate(-50%, -50%) translate3d(${(d * f * step).toFixed(1)}px, ${(Math.abs(d) * f * vh * 0.018 + (1 - f) * 30).toFixed(1)}px, 0) rotate(${(d * f * 7).toFixed(2)}deg) scale(${(0.7 + 0.3 * f).toFixed(3)})`;
    });
    finLine.style.opacity = seg(cp, 0.9, 0.97);
    finLine.style.transform = `translateY(${(1 - eo(seg(cp, 0.9, 0.97))) * 16 * M}px)`;
  }

  /* ---------------------------------------------------------- swipe deck */
  const deck = $(".deck");
  const btnPass = $('[data-act="pass"]'), btnKeep = $('[data-act="keep"]');
  const status = document.createElement("p");
  status.className = "sr"; status.setAttribute("aria-live", "polite");
  deck.after(status);
  deck.removeAttribute("aria-live");
  deck.tabIndex = 0;
  deck.setAttribute("role", "group");
  deck.setAttribute("aria-label", "Card deck. Left arrow passes, right arrow keeps.");

  let cards = [];
  let anim = null; // the card currently springing
  function buildDeck() {
    deck.innerHTML = "";
    cards = HEROINES.map((c) => {
      const el = document.createElement("div");
      el.className = "card";
      el.style.setProperty("--c", c.accent);
      el.innerHTML = `<span class="ph" aria-hidden="true">${c.jp}</span>
        <span class="stamp keep">推し<small>Keep</small></span>
        <span class="stamp pass">また今度<small>Pass</small></span>
        <div class="card-cap"><b>${c.name}</b><span>${c.series}</span></div>`;
      const art = artImg(c, "vid");
      el.prepend(art);
      el.querySelector(".ph").after(art);
      showWhenLoaded(art);
      return { c, el, video: null, keep: el.querySelector(".keep"), pass: el.querySelector(".pass"), x: 0, y: 0, vx: 0, vy: 0 };
    });
    [...cards].reverse().forEach((k) => deck.appendChild(k.el));
    layoutDeck();
    bindTop();
  }
  function layoutDeck() {
    cards.forEach((k, i) => {
      if (i === 0) return;
      k.el.style.transform = `translate3d(0, ${Math.min(i, 3) * 18}px, 0) scale(${1 - Math.min(i, 3) * 0.05})`;
      k.el.style.opacity = i < 3 ? 1 : 0;
    });
    if (cards[0]) { cards[0].el.style.transform = "translate3d(0,0,0)"; cards[0].el.style.opacity = 1; }
    const empty = cards.length === 0;
    btnPass.disabled = btnKeep.disabled = empty;
    if (empty && !deck.querySelector(".deck-done")) {
      const d = document.createElement("div");
      d.className = "deck-done";
      d.innerHTML = `<p>That's everyone.</p><button type="button" class="btn ghost">Start over</button>`;
      d.querySelector("button").addEventListener("click", buildDeck);
      deck.appendChild(d);
    }
  }

  function linkNext(progress) {
    const n = cards[1];
    if (!n) return;
    n.el.classList.add("dragging");
    const t = clamp(progress);
    n.el.style.transform = `translate3d(0, ${18 * (1 - t)}px, 0) scale(${0.95 + 0.05 * t})`;
  }
  function paint(k) {
    const w = deck.offsetWidth;
    k.el.style.transform = `translate3d(${k.x}px, ${k.y}px, 0) rotate(${k.x * 0.05 * (M || 0.3)}deg)`;
    k.keep.style.opacity = clamp(k.x / (w * 0.28));
    k.pass.style.opacity = clamp(-k.x / (w * 0.28));
    linkNext(Math.abs(k.x) / (w * 0.5));
  }

  function bindTop() {
    const k = cards[0];
    if (!k || k.bound) return;
    k.bound = true;
    const el = k.el;
    let id = null, sx = 0, sy = 0, ox = 0, oy = 0, samples = [];
    el.addEventListener("pointerdown", (e) => {
      if (id !== null || cards[0] !== k) return; // ignore extra fingers
      if (anim === k) anim = null; // catch it mid-flight
      id = e.pointerId;
      el.setPointerCapture(id);
      el.classList.add("dragging");
      sx = e.clientX; sy = e.clientY; ox = k.x; oy = k.y;
      samples = [{ t: e.timeStamp, x: e.clientX, y: e.clientY }];
    });
    el.addEventListener("pointermove", (e) => {
      if (e.pointerId !== id) return;
      k.x = ox + (e.clientX - sx);
      const dy = oy + (e.clientY - sy);
      k.y = dy * 0.35; // not the decision axis: resist
      samples.push({ t: e.timeStamp, x: e.clientX, y: e.clientY });
      if (samples.length > 8) samples.shift();
      paint(k);
    });
    const end = (e) => {
      if (e.pointerId !== id) return;
      id = null;
      el.classList.remove("dragging");
      const now = e.timeStamp;
      const recent = samples.filter((s) => now - s.t < 100);
      const a = recent[0] || samples[0], b = samples[samples.length - 1];
      const dt = Math.max(1, b.t - a.t);
      k.vx = ((b.x - a.x) / dt) * 1000; // px/s
      k.vy = ((b.y - a.y) / dt) * 1000 * 0.35;
      const w = deck.offsetWidth;
      const fast = Math.abs(k.vx) > 500 && Math.sign(k.vx) === Math.sign(k.x || k.vx);
      if (Math.abs(k.x) > w * 0.4 || fast) fling(k, Math.sign(k.x || k.vx));
      else settle(k);
    };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    playIf(k.video, pickInView);
  }

  // release phase: velocity-seeded spring
  function settle(k) {
    k.target = { x: 0, y: 0 };
    k.spring = { stiffness: 420, damping: 2 * Math.sqrt(420) * 0.78 }; // slight bounce: a drag applied force
    k.mode = "settle";
    anim = k;
  }
  function fling(k, dir) {
    k.dir = dir;
    if (RM) { decide(k); return; }
    k.el.classList.add("flying");
    k.target = { x: dir * (vw * 0.5 + deck.offsetWidth * 1.4), y: k.y + k.vy * 0.25 };
    k.spring = { stiffness: 110, damping: 2 * Math.sqrt(110) };
    k.mode = "fling";
    anim = k;
  }
  function stepSpring(k, dt) {
    const { stiffness, damping } = k.spring;
    for (const ax of ["x", "y"]) {
      const v = ax === "x" ? "vx" : "vy";
      const a = -stiffness * (k[ax] - k.target[ax]) - damping * k[v];
      k[v] += a * dt;
      k[ax] += k[v] * dt;
    }
    paint(k);
    if (k.mode === "settle" && Math.abs(k.x) < 0.5 && Math.abs(k.vx) < 5 && Math.abs(k.y) < 0.5) {
      k.x = k.y = k.vx = k.vy = 0; paint(k); anim = null;
      if (cards[1]) cards[1].el.classList.remove("dragging");
      layoutDeck();
    }
    if (k.mode === "fling" && Math.abs(k.x) > vw * 0.5 + deck.offsetWidth) decide(k);
  }
  function decide(k) {
    if (anim === k) anim = null;
    playIf(k.video, false);
    k.el.remove();
    cards.shift();
    if (cards[0]) cards[0].el.classList.remove("dragging");
    if (k.dir > 0) store.addLineup(k.c.id, "deck");
    status.textContent = `${k.dir > 0 ? "Kept" : "Passed"} ${k.c.name}.${cards[0] ? ` Next: ${cards[0].c.name}.` : " That's everyone."}`;
    layoutDeck();
    bindTop();
  }
  function decideTop(dir, animated) {
    const k = cards[0];
    if (!k || anim === k) return;
    if (!animated) { k.dir = dir; decide(k); return; }
    k.vx = dir * 1400; k.vy = -120;
    fling(k, dir);
  }
  btnPass.addEventListener("click", () => decideTop(-1, true));
  btnKeep.addEventListener("click", () => decideTop(1, true));
  deck.addEventListener("keydown", (e) => {
    // keyboard: no animation, the decision is instant
    if (e.key === "ArrowLeft") { e.preventDefault(); decideTop(-1, false); }
    if (e.key === "ArrowRight") { e.preventDefault(); decideTop(1, false); }
  });

  /* ------------------------------------------------------------ nav jump */
  navLinks.forEach((a) => {
    if (!a.dataset.jump) return;
    a.addEventListener("click", (e) => {
      e.preventDefault();
      scrollTo({ top: geo.story.top + parseFloat(a.dataset.jump) * geo.story.len, behavior: RM ? "auto" : "smooth" });
    });
  });

  /* ---------------------------------------------------------------- loop */
  let target = scrollY, smooth = scrollY, prev = scrollY, last = performance.now(), tickAcc = 0;
  let lastNav = -1;
  const navTargets = navLinks.map((a) => (a.dataset.jump ? null : document.querySelector(a.getAttribute("href"))));
  addEventListener("scroll", () => { target = scrollY; }, { passive: true });
  addEventListener("resize", () => { measure(); target = smooth = scrollY; });

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    target = scrollY;
    smooth = RM ? target : lerp(smooth, target, 1 - Math.exp(-dt * 10));
    if (Math.abs(target - smooth) < 0.3) smooth = target;
    const vel = (smooth - prev) / Math.max(dt, 0.001);
    const moved = smooth !== prev || dirty;
    prev = smooth;
    const y = smooth;

    const sp = clamp((y - geo.story.top) / geo.story.len);
    const storyIn = y < geo.story.top + geo.story.h;
    const rp = clamp((y - geo.roster.top) / geo.roster.len);
    const rosterIn = y > geo.roster.top - vh && y < geo.roster.top + geo.roster.h;
    const cp = clamp((y - geo.credits.top) / geo.credits.len);
    pickInView = y > geo.pick.top - vh * 0.6 && y < geo.pick.top + geo.pick.h - vh * 0.3;

    if (moved) {
      if (storyIn) renderStory(sp);
      renderRoster(rp, rosterIn ? vel : 0, rosterIn);
      if (y > geo.credits.top - vh) renderCredits(cp);
      xsheetN.textContent = String(Math.round((y / docMax) * 2160)).padStart(4, "0");
      // which chapter is under the middle of the screen
      let sec = sp > 0.33 && sp < 0.66 ? 1 : 0;
      navTargets.forEach((el, i) => { if (el && el.offsetTop <= y + vh * 0.5) sec = i; });
      if (sec !== lastNav) { lastNav = sec; navLinks.forEach((a, i) => a.setAttribute("aria-current", String(i === sec))); }
      dirty = false;
    }

    // hero mouse tilt + brush radius ease toward their targets
    const hk = 1 - Math.exp(-dt * 7);
    hmx += (tmx - hmx) * hk; hmy += (tmy - hmy) * hk;
    brushR += ((overCel && y < geo.story.top + geo.story.len * 0.05 ? 120 : 0) - brushR) * (1 - Math.exp(-dt * 10));
    if (Math.abs(tmx - hmx) > 0.001 || Math.abs(tmy - hmy) > 0.001 || (brushR > 0.5 && brushR < 119.5) || overCel) dirty = true;
    if (glitching) dirty = true; // keep rendering until the split settles back to none
    const free = !store.modal; // a sheet or dialog owns the screen: hold everything else
    if (cards[0]) playIf(cards[0].video, free && pickInView);
    if (!free) frames.forEach((fr) => playIf(fr.video, false));
    setFocusVideo(!free ? null : pickInView ? cards[0]?.video : null);

    // things animated "on twos": 12 drawings a second, like the real thing
    tickAcc += dt;
    if (tickAcc >= 1 / 12) {
      tickAcc = 0;
      if (storyIn && storyFlags.sketch) drawLayers(true, false);
      if (storyIn && storyFlags.focus) drawFocus();
    }

    if (anim) stepSpring(anim, dt);
    requestAnimationFrame(frame);
  }

  /* ---------------------------------------------------------------- boot */
  buildDeck();
  measure();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  addEventListener("load", measure);
  requestAnimationFrame(frame);
})();
