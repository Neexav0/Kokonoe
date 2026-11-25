// Tier list: drag heroines into S, A and B. Cards follow the pointer 1:1,
// neighbours make room with FLIP, and a dropped card springs into its slot.
import { HEROINES, byId, RM, clamp, EASE_OUT, spring, artImg, loadArt, drawCover } from "./data.js";
import { store } from "./store.js";
import { toast } from "./toast.js";

const section = document.querySelector(".tiers");
const zones = Object.fromEntries([...section.querySelectorAll("[data-zone]")].map((z) => [z.dataset.zone, z]));
const ORDER = ["S", "A", "B", "pool"];
const LABEL = { S: "S tier", A: "A tier", B: "B tier", pool: "Unranked" };
const live = section.querySelector(".tier-live");
const cards = {};

/* ------------------------------------------------------------- cards */
function makeCard(h) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "tcard";
  b.dataset.id = h.id;
  b.style.setProperty("--c", h.accent);
  b.innerHTML = `<span class="tc-img"></span><span class="tc-name">${h.name}</span>`;
  b.setAttribute("aria-label", `${h.name}. Arrow keys move her between tiers.`);
  const img = artImg(h);
  b.querySelector(".tc-img").appendChild(img);
  const done = () => b.classList.add("loaded");
  if (img.complete && img.naturalWidth) done(); else img.addEventListener("load", done, { once: true });
  bindDrag(b);
  bindKeys(b);
  return b;
}

function layoutFromStore() {
  const saved = store.tiers;
  const placed = new Set();
  ORDER.forEach((z) => {
    const ids = (saved && saved[z]) || [];
    ids.forEach((id) => { if (cards[id] && !placed.has(id)) { zones[z].appendChild(cards[id]); placed.add(id); } });
  });
  HEROINES.forEach((h) => { if (!placed.has(h.id)) zones.pool.appendChild(cards[h.id]); });
  updateEmpty();
}

function save() {
  const t = {};
  ORDER.forEach((z) => (t[z] = [...zones[z].querySelectorAll(".tcard")].map((c) => c.dataset.id)));
  store.setTiers(t);
  updateEmpty();
}
function updateEmpty() {
  ORDER.forEach((z) => zones[z].classList.toggle("empty", !zones[z].querySelector(".tcard")));
}

/* -------------------------------------------------------------- FLIP */
// Record where every card is, run a DOM change, then animate each card from
// its old spot to its new one.
function flip(change, skip) {
  const all = [...section.querySelectorAll(".tcard, .tph")].filter((el) => el !== skip);
  const before = new Map(all.map((el) => [el, el.getBoundingClientRect()]));
  change();
  if (RM) return;
  all.forEach((el) => {
    const a = before.get(el), b = el.getBoundingClientRect();
    const dx = a.left - b.left, dy = a.top - b.top;
    if (!dx && !dy) return;
    el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: 260, easing: EASE_OUT, composite: "add" });
  });
}

/* -------------------------------------------------------------- drag */
function zoneAt(x, y) {
  for (const z of ORDER) {
    const r = zones[z].getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top - 8 && y <= r.bottom + 8) return zones[z];
  }
  return null;
}
function insertBefore(zone, x, y, ignore) {
  const items = [...zone.querySelectorAll(".tcard, .tph")].filter((el) => el !== ignore);
  for (const el of items) {
    const r = el.getBoundingClientRect();
    const sameRow = y >= r.top && y <= r.bottom;
    if ((sameRow && x < r.left + r.width / 2) || y < r.top) return el;
  }
  return null;
}

function bindDrag(card) {
  let id = null, sx = 0, sy = 0, ox = 0, oy = 0, dragging = false, ph = null, lastX = 0, lastT = 0, vx = 0, tilt = 0, overZone = null;
  // Touch: a short hold arms the drag, so a quick swipe still scrolls the page.
  card.style.touchAction = "pan-y";
  let touch = false, armed = false, holdTimer = 0;
  card.addEventListener("touchmove", (e) => { if (armed) e.preventDefault(); }, { passive: false });

  // Window listeners rather than pointer capture: the card moves around the
  // DOM while dragging, and moving an element releases its capture.
  card.addEventListener("pointerdown", (e) => {
    if (id !== null || e.button > 0) return;
    id = e.pointerId;
    sx = e.clientX; sy = e.clientY; lastX = e.clientX; lastT = e.timeStamp;
    touch = e.pointerType === "touch"; armed = !touch;
    if (touch) holdTimer = setTimeout(() => { armed = true; card.classList.add("armed"); navigator.vibrate?.(8); }, 220);
    addEventListener("pointermove", move);
    addEventListener("pointerup", end);
    addEventListener("pointercancel", end);
  });

  const move = (e) => {
    if (e.pointerId !== id) return;
    if (!dragging) {
      if (Math.hypot(e.clientX - sx, e.clientY - sy) < 5) return;
      if (!armed) { cancelPress(); return; } // moved before the hold: it's a scroll
      // lift: swap the card for a placeholder and let it fly free
      dragging = true;
      const r = card.getBoundingClientRect();
      ox = sx - r.left; oy = sy - r.top;
      ph = document.createElement("span");
      ph.className = "tph";
      ph.style.width = `${r.width}px`; ph.style.height = `${r.height}px`;
      card.replaceWith(ph);
      document.body.appendChild(card);
      card.classList.add("lifted");
      card.style.width = `${r.width}px`;
      card.style.left = "0px"; card.style.top = "0px";
    }
    const dt = Math.max(1, e.timeStamp - lastT);
    vx = vx * 0.6 + ((e.clientX - lastX) / dt) * 0.4;
    lastX = e.clientX; lastT = e.timeStamp;
    tilt = clamp(vx * 6, -12, 12) * (RM ? 0 : 1);
    card.style.transform = `translate(${e.clientX - ox}px, ${e.clientY - oy}px) rotate(${tilt}deg) scale(${RM ? 1 : 1.06})`;

    const z = zoneAt(e.clientX, e.clientY);
    if (z !== overZone) {
      if (overZone) overZone.classList.remove("over");
      overZone = z;
      if (z) z.classList.add("over");
    }
    if (z) {
      const before = insertBefore(z, e.clientX, e.clientY, ph);
      if (ph.parentElement !== z || (before ? ph.nextElementSibling !== before : z.lastElementChild !== ph)) {
        flip(() => { z.insertBefore(ph, before); updateEmptyWithPh(); }, card);
      }
    }
  };

  const cancelPress = () => {
    clearTimeout(holdTimer);
    id = null; armed = false;
    card.classList.remove("armed");
    removeEventListener("pointermove", move);
    removeEventListener("pointerup", end);
    removeEventListener("pointercancel", end);
  };
  const end = (e) => {
    if (e.pointerId !== id) return;
    clearTimeout(holdTimer);
    card.classList.remove("armed");
    armed = false;
    id = null;
    removeEventListener("pointermove", move);
    removeEventListener("pointerup", end);
    removeEventListener("pointercancel", end);
    if (!dragging) return; // a plain click
    dragging = false;
    if (overZone) overZone.classList.remove("over");
    overZone = null;
    // spring from where the pointer let go into the placeholder's slot
    const from = card.getBoundingClientRect();
    const to = ph.getBoundingClientRect();
    const startX = from.left, startY = from.top;
    let doneCount = 0;
    const finish = () => {
      if (++doneCount < 2) return;
      card.classList.remove("lifted");
      card.style.transform = card.style.left = card.style.top = card.style.width = "";
      ph.replaceWith(card);
      ph = null;
      save();
      const zone = card.parentElement.dataset.zone;
      live.textContent = `${byId[card.dataset.id].name} moved to ${LABEL[zone]}.`;
      if (!RM) card.animate([{ transform: "scale(1.06)" }, { transform: "scale(0.97)" }, { transform: "none" }], { duration: 320, easing: EASE_OUT });
      if (zone === "S") burst(card);
    };
    let curX = startX, curY = startY, curR = tilt;
    const paint = () => { card.style.transform = `translate(${curX}px, ${curY}px) rotate(${curR}deg) scale(${1 + 0.06 * Math.min(1, Math.abs(curR) / 12 + 0.4)})`; };
    spring({ from: startX, to: to.left, velocity: vx * 1000, stiffness: 300, damping: 26, onUpdate: (v) => { curX = v; curR = tilt * Math.min(1, Math.abs(v - to.left) / 80); paint(); }, onDone: finish });
    spring({ from: startY, to: to.top, stiffness: 300, damping: 26, onUpdate: (v) => { curY = v; paint(); }, onDone: finish });
  };
}
function updateEmptyWithPh() {
  ORDER.forEach((z) => zones[z].classList.toggle("empty", !zones[z].querySelector(".tcard, .tph")));
}

// A small celebration for an S-tier placement: petals of her colour.
function burst(card) {
  if (RM) return;
  const r = card.getBoundingClientRect();
  for (let i = 0; i < 14; i++) {
    const p = document.createElement("i");
    p.className = "petal-burst";
    p.style.left = `${r.left + r.width / 2}px`;
    p.style.top = `${r.top + r.height / 2}px`;
    p.style.background = i % 3 ? card.style.getPropertyValue("--c") : "#fff";
    document.body.appendChild(p);
    const a = (i / 14) * Math.PI * 2 + Math.random() * 0.4;
    const d = 60 + Math.random() * 70;
    p.animate([
      { transform: "translate(-50%,-50%) scale(1) rotate(0deg)", opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d + 30}px)) scale(.4) rotate(${180 + Math.random() * 180}deg)`, opacity: 0 },
    ], { duration: 700 + Math.random() * 300, easing: EASE_OUT }).finished.then(() => p.remove());
  }
}

/* ------------------------------------------------------------ keyboard */
function bindKeys(card) {
  card.addEventListener("keydown", (e) => {
    const zone = card.parentElement;
    const zi = ORDER.indexOf(zone.dataset.zone);
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const next = ORDER[clamp(zi + (e.key === "ArrowUp" ? -1 : 1), 0, ORDER.length - 1)];
      if (next === zone.dataset.zone) return;
      zones[next].appendChild(card);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const sib = e.key === "ArrowLeft" ? card.previousElementSibling : card.nextElementSibling;
      if (!sib) return;
      if (e.key === "ArrowLeft") zone.insertBefore(card, sib); else zone.insertBefore(sib, card);
    } else return;
    card.focus();
    save();
    live.textContent = `${byId[card.dataset.id].name}: ${LABEL[card.parentElement.dataset.zone]}, position ${[...card.parentElement.children].indexOf(card) + 1}.`;
  });
}

/* ------------------------------------------------------- reset, export */
section.querySelector("[data-act=reset]").addEventListener("click", () => {
  flip(() => { HEROINES.forEach((h) => zones.pool.appendChild(cards[h.id])); });
  save();
  toast("Tier list cleared");
});

section.querySelector("[data-act=export]").addEventListener("click", async () => {
  const rowsWith = ["S", "A", "B"];
  const W = 1500, pad = 48, rowH = 250, head = 150;
  const c = document.createElement("canvas");
  c.width = W; c.height = head + rowsWith.length * (rowH + 16) + pad;
  const x = c.getContext("2d");
  x.fillStyle = "#e6ebf5"; x.fillRect(0, 0, W, c.height);
  x.strokeStyle = "rgba(62,107,230,.12)";
  for (let gx = 0; gx < W; gx += 48) { x.beginPath(); x.moveTo(gx, 0); x.lineTo(gx, c.height); x.stroke(); }
  for (let gy = 0; gy < c.height; gy += 48) { x.beginPath(); x.moveTo(0, gy); x.lineTo(W, gy); x.stroke(); }
  x.fillStyle = "#16112e";
  x.font = '72px "Dela Gothic One"';
  x.fillText("My Kokonoe tier list", pad, 100);
  x.font = '600 24px "Zen Kaku Gothic New"';
  x.fillStyle = "#e5384f";
  x.fillText("九重", W - pad - 60, 96);
  const tileCol = { S: "#e5384f", A: "#ff8fc8", B: "#3e6be6" };
  for (let i = 0; i < rowsWith.length; i++) {
    const z = rowsWith[i];
    const y = head + i * (rowH + 16);
    x.fillStyle = "rgba(22,17,46,.06)";
    roundRect(x, pad, y, W - pad * 2, rowH, 18); x.fill();
    x.fillStyle = tileCol[z];
    roundRect(x, pad, y, 150, rowH, 18); x.fill();
    x.fillStyle = "#fff";
    x.font = '96px "Dela Gothic One"';
    x.textAlign = "center"; x.fillText(z, pad + 75, y + rowH / 2 + 34); x.textAlign = "left";
    const ids = [...zones[z].querySelectorAll(".tcard")].map((el) => el.dataset.id);
    let cx = pad + 170;
    for (const id of ids) {
      const h = byId[id];
      const img = await loadArt(h);
      const w = 132, ih = 165;
      x.save(); roundRect(x, cx, y + 18, w, ih, 10); x.clip(); drawCover(x, img, w, ih, h.fy, cx, y + 18); x.restore();
      x.fillStyle = "#16112e"; x.font = '600 18px "Zen Kaku Gothic New"';
      x.fillText(h.name, cx, y + 18 + ih + 28, w);
      cx += w + 16;
      if (cx + w > W - pad) break;
    }
    if (!ids.length) { x.fillStyle = "rgba(22,17,46,.35)"; x.font = '500 22px "Zen Kaku Gothic New"'; x.fillText("Nobody yet", pad + 180, y + rowH / 2 + 8); }
  }
  download(c, "kokonoe-tier-list.png");
  toast("Saved kokonoe-tier-list.png");
});

export function roundRect(x, l, t, w, h, r) {
  x.beginPath();
  x.moveTo(l + r, t); x.arcTo(l + w, t, l + w, t + h, r); x.arcTo(l + w, t + h, l, t + h, r);
  x.arcTo(l, t + h, l, t, r); x.arcTo(l, t, l + w, t, r); x.closePath();
}
export function download(canvas, name) {
  canvas.toBlob((blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }, "image/png");
}

/* ---------------------------------------------------------------- boot */
let booted = false;
function boot() {
  if (booted) return;
  booted = true;
  HEROINES.forEach((h) => (cards[h.id] = makeCard(h)));
  layoutFromStore();
}
function watch() { if (!booted && section.getBoundingClientRect().top < innerHeight * 2.5) boot(); }
addEventListener("scroll", watch, { passive: true });
setInterval(watch, 800);
watch();
