/* Kokonoe — one scroll timeline, no framework.
   Everything scroll-driven reads from a smoothed scroll value and writes
   transform / opacity / clip-path only. */
(() => {
  "use strict";

  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const M = RM ? 0 : 1; // multiplier for movement; opacity changes stay
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const seg = (p, a, b) => clamp((p - a) / (b - a));
  const lerp = (a, b, t) => a + (b - a) * t;
  const eo = (t) => 1 - Math.pow(1 - t, 3);
  const eio = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const fade = (p, a, b, c, d) => Math.min(seg(p, a, b), 1 - seg(p, c, d));

  const VID = "../Anime-Iconic-Faces/Videos/";
  const HEROINES = [
    { name: "Makima", jp: "マキマ", series: "Chainsaw Man", nick: "Control Devil", accent: "#ff3b5f", file: "makima.mp4",
      desc: "A calm, hypnotic manipulator whose mysterious smile hides terrifying authority." },
    { name: "Mikasa Ackerman", jp: "ミカサ・アッカーマン", series: "Attack on Titan", nick: "The strongest soldier", accent: "#d14b4b", file: "mikasa.mp4",
      desc: "Silent, fiercely loyal, and one of humanity's deadliest warriors." },
    { name: "Yor Forger", jp: "ヨル・フォージャー", series: "Spy x Family", nick: "Thorn Princess", accent: "#ff4568", file: "yor.mp4",
      desc: "An elegant assassin who balances extraordinary combat skill with a caring heart." },
    { name: "Shinobu Kocho", jp: "胡蝶しのぶ", series: "Demon Slayer", nick: "Insect Hashira", accent: "#bd8cff", file: "shinobu.mp4",
      desc: "Graceful and sharp-witted, her butterfly-like elegance hides formidable skill." },
    { name: "Mitsuri Kanroji", jp: "甘露寺蜜璃", series: "Demon Slayer", nick: "Love Hashira", accent: "#ff8fc8", file: "mitsuri.mp4",
      desc: "A warm-hearted, powerful swordswoman who leads with compassion and courage." },
    { name: "Marin Kitagawa", jp: "喜多川海夢", series: "My Dress-Up Darling", nick: "The cosplay queen", accent: "#ffb05c", file: "marin.mp4",
      desc: "Cheerful and confident, her love of cosplay and self-expression is impossible to ignore." },
    { name: "Nico Robin", jp: "ニコ・ロビン", series: "One Piece", nick: "Devil Child", accent: "#9b5cff", file: "robin.mp4",
      desc: "An elegant archaeologist whose quiet intellect hides immense emotional depth." },
    { name: "Hinata Hyuga", jp: "日向ヒナタ", series: "Naruto", nick: "Byakugan princess", accent: "#b993ff", file: "hinata.mp4",
      desc: "Gentle yet courageous, she grows into one of the Hidden Leaf's brightest spirits." },
    { name: "Kaoruko Waguri", jp: "和栗薫子", series: "The Fragrant Flower Blooms with Dignity", nick: "Golden blossom", accent: "#f2c14e", file: "waguri.mp4",
      desc: "A graceful presence whose warmth and quiet charm leave a lasting impression." },
  ];
  const N = HEROINES.length;
  let dirty = true, pickInView = false;

  /* ------------------------------------------------------------ elements */
  const story = $(".story"), roster = $(".roster"), pick = $(".pick"), credits = $(".credits");
  const letters = $$(".mega span");
  const tate = $(".tate");
  const night = $(".night");
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
  const soundBtn = $(".sound");
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
  const LCW = 480, LCH = 270;
  [...layers, sketch].forEach((c) => { c.width = LCW; c.height = LCH; });
  const lctx = [...layers, sketch].map((c) => c.getContext("2d"));
  function drawLayers(includeSketch, includeLayers) {
    if (comp.readyState < 2) return;
    if (includeLayers) for (let i = 0; i < 5; i++) lctx[i].drawImage(comp, 0, 0, LCW, LCH);
    if (includeSketch) lctx[5].drawImage(comp, 0, 0, LCW, LCH);
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
  let storyFlags = { sketch: true, layers: false, focus: false };
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
    comp.style.clipPath = `inset(0 ${(1 - w) * 100}% 0 0)`;
    brush.style.transform = `translateX(${w * celW}px)`;
    brush.style.opacity = Math.sin(Math.PI * w);
    storyFlags.sketch = w < 1;
    sketch.style.visibility = w < 1 ? "visible" : "hidden";

    // night spreads from the frame
    const y0 = vh * (vw <= 760 ? 0.1 : 0.12);
    const lift = eio(seg(p, 0.14, 0.3));
    const celY = y0 * (1 - lift);
    const n = eo(seg(p, 0.1, 0.24));
    night.style.clipPath = `circle(${n * Math.hypot(vw, vh)}px at 50% ${50 + (celY / vh) * 100}%)`;
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
    wrap.style.transform = `translate3d(0, ${celY}px, 0)`;
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
    f.innerHTML = `<div class="frame-in" data-n="Cut ${String(i + 1).padStart(2, "0")}"><video muted loop playsinline preload="metadata" src="${VID}${c.file}#t=2" aria-label="${c.name}, ${c.series}"></video></div>`;
    track.appendChild(f);
    return { el: f, inner: f.firstElementChild, video: f.querySelector("video") };
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
    frames.forEach((fr, k) => { if (Math.abs(k - i) <= 1) fr.video.preload = "auto"; });
  }
  let skew = 0;
  function renderRoster(rp, vel, inView) {
    const f = clamp((rp - 0.03) / 0.94) * (N - 1);
    const x = vw / 2 - (f * unit + unit / 2);
    skew = lerp(skew, clamp(-vel * 0.006, -9, 9) * M, 0.18);
    track.style.transform = `translate3d(${x}px, 0, 0) skewX(${skew}deg)`;
    const a = Math.round(f);
    setActive(a);
    frames.forEach((fr, i) => {
      const d = i - f, ad = Math.abs(d);
      if (ad > 3) { fr.inner.style.opacity = 0; playIf(fr.video, false); return; }
      const s = 1 - Math.min(ad, 2) * 0.13;
      fr.inner.style.transform = `rotateY(${clamp(d, -2, 2) * -16 * M}deg) scale(${RM ? 1 : s})`;
      fr.inner.style.opacity = 1 - Math.min(ad, 2.5) * 0.3;
      playIf(fr.video, inView && i === a);
    });
    rName.style.transform = `translate3d(${vw * 0.04 - (f - a) * vw * 0.25 * M}px, 0, 0)`;
  }

  /* -------------------------------------------------------------- videos */
  function playIf(v, on) {
    if (on && v.paused) v.play().catch(() => {});
    else if (!on && !v.paused) v.pause();
  }
  let soundOn = false, focusVideo = null;
  function setFocusVideo(v) {
    if (v === focusVideo) return;
    if (focusVideo) focusVideo.muted = true;
    focusVideo = v;
    if (v) v.muted = !soundOn;
  }
  soundBtn.addEventListener("click", () => {
    soundOn = !soundOn;
    soundBtn.setAttribute("aria-pressed", String(soundOn));
    soundBtn.textContent = soundOn ? "Sound on" : "Sound off";
    if (focusVideo) { focusVideo.muted = !soundOn; if (soundOn) focusVideo.play().catch(() => {}); }
  });

  /* ------------------------------------------------------------- credits */
  const roll = $(".roll"), finK = $(".fin-k"), hanko = $(".hanko");
  let rollH = 0;
  function renderCredits(cp) {
    const k = seg(cp, 0, 0.7);
    roll.style.transform = `translate3d(0, ${-k * (rollH + vh)}px, 0)`;
    const r = eo(seg(cp, 0.7, 0.86));
    finK.style.clipPath = `inset(0 0 ${(1 - r) * 100}% 0)`;
    const h = seg(cp, 0.88, 0.94);
    hanko.style.opacity = clamp(h * 3);
    hanko.style.transform = `rotate(-8deg) scale(${RM ? 1 : lerp(1.5, 1, eo(h))})`;
  }

  /* ---------------------------------------------------------- swipe deck */
  const deck = $(".deck"), lineupList = $(".lineup-list");
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
    lineupList.innerHTML = "";
    cards = HEROINES.map((c) => {
      const el = document.createElement("div");
      el.className = "card";
      el.innerHTML = `<video muted loop playsinline preload="metadata" src="${VID}${c.file}#t=3"></video>
        <span class="stamp keep">推し<small>Keep</small></span>
        <span class="stamp pass">また今度<small>Pass</small></span>
        <div class="card-cap"><b>${c.name}</b><span>${c.series}</span></div>`;
      return { c, el, video: el.querySelector("video"), keep: el.querySelector(".keep"), pass: el.querySelector(".pass"), x: 0, y: 0, vx: 0, vy: 0 };
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
    if (k.dir > 0) {
      const li = document.createElement("li");
      li.textContent = k.c.name;
      li.style.setProperty("--c", k.c.accent);
      lineupList.appendChild(li);
    }
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
      const sec = y < geo.roster.top - vh * 0.5 ? (sp > 0.33 && sp < 0.66 ? 1 : 0) : y < geo.pick.top - vh * 0.5 ? 2 : y < geo.credits.top - vh * 0.5 ? 3 : 4;
      if (sec !== lastNav) { lastNav = sec; navLinks.forEach((a, i) => a.setAttribute("aria-current", String(i === sec))); }
      dirty = false;
    }

    playIf(comp, storyIn);
    if (cards[0]) playIf(cards[0].video, pickInView);
    setFocusVideo(storyIn && sp < 0.98 ? comp : rosterIn ? frames[active]?.video : pickInView ? cards[0]?.video : null);

    // things animated "on twos": 12 drawings a second, like the real thing
    tickAcc += dt;
    if (tickAcc >= 1 / 12) {
      tickAcc = 0;
      if (storyIn) drawLayers(storyFlags.sketch, storyFlags.layers);
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
  comp.addEventListener("loadeddata", () => drawLayers(true, true));
  requestAnimationFrame(frame);
})();
