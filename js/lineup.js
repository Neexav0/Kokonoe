// Your lineup: the heroines you kept, saved between visits, shareable as a
// link or a poster.
import { HEROINES, byId, artImg, loadArt, drawCover, RM, EASE_OUT, EASE_DRAWER } from "./data.js";
import { store } from "./store.js";
import { openSheet } from "./sheet.js";
import { toast } from "./toast.js";

const list = document.querySelector(".lineup-list");
const countEl = document.querySelector(".lineup-count");
const posterBtn = document.querySelector("[data-act=poster]");
const linkBtn = document.querySelector("[data-act=link]");
const clearBtn = document.querySelector("[data-act=clear]");
const banner = document.querySelector(".shared-banner");

/* --------------------------------------------------------------- chips */
function chip(id) {
  const h = byId[id];
  const li = document.createElement("li");
  li.dataset.id = id;
  li.style.setProperty("--c", h.accent);
  li.innerHTML = `<button type="button" class="lu-open" aria-label="Open ${h.name}'s character sheet"><span class="lu-av"></span>${h.name}</button><button type="button" class="lu-x" aria-label="Remove ${h.name} from your lineup">×</button>`;
  li.querySelector(".lu-av").appendChild(artImg(h));
  li.querySelector(".lu-open").addEventListener("click", (e) => openSheet(id, e.currentTarget.querySelector(".lu-av")));
  li.querySelector(".lu-x").addEventListener("click", () => {
    if (RM) { store.removeLineup(id); return; }
    // leave the way it came: shrink and fade, then let the row close up
    li.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(.9)" }], { duration: 180, easing: EASE_OUT })
      .finished.then(() => store.removeLineup(id));
  });
  return li;
}

export function renderLineup() {
  const want = store.lineup;
  const before = new Map([...list.children].map((li) => [li, li.getBoundingClientRect()]));
  [...list.children].forEach((li) => { if (!want.includes(li.dataset.id)) li.remove(); });
  // appendChild moves existing chips too, so the DOM follows the saved order
  want.forEach((id) => list.appendChild(list.querySelector(`[data-id="${id}"]`) || chip(id)));
  // FLIP the chips that stayed, so removals close the gap smoothly
  if (!RM) [...list.children].forEach((li) => {
    const a = before.get(li); if (!a) return;
    const b = li.getBoundingClientRect();
    if (a.left !== b.left || a.top !== b.top) li.animate([{ transform: `translate(${a.left - b.left}px, ${a.top - b.top}px)` }, { transform: "none" }], { duration: 260, easing: EASE_OUT });
  });
  const n = want.length;
  countEl.textContent = n ? `${n} of ${HEROINES.length}` : "";
  posterBtn.disabled = linkBtn.disabled = clearBtn.disabled = n === 0;
}

clearBtn.addEventListener("click", () => {
  const prev = store.lineup;
  store.setLineup([]);
  toast("Lineup cleared");
  live(`Lineup cleared. ${prev.length} removed.`);
});

/* ---------------------------------------------------------- share link */
function shareUrl() {
  const u = new URL(location.href);
  u.search = "";
  u.hash = "pick";
  u.searchParams.set("lineup", store.lineup.join(","));
  return u.toString();
}
linkBtn.addEventListener("click", async () => {
  const url = shareUrl();
  try { await navigator.clipboard.writeText(url); toast("Link copied. Anyone who opens it can load your lineup."); }
  catch { prompt("Copy this link:", url); }
});

// Someone opened a shared link: offer it, don't overwrite silently.
function checkShared() {
  const p = new URLSearchParams(location.search).get("lineup");
  if (!p) return;
  const ids = p.split(",").filter((id) => byId[id]);
  if (!ids.length) return;
  banner.hidden = false;
  banner.querySelector(".sb-names").textContent = ids.map((id) => byId[id].name).join(", ");
  banner.querySelector("[data-act=use]").addEventListener("click", () => {
    store.setLineup(ids);
    closeBanner();
    toast("Shared lineup loaded");
  }, { once: true });
  banner.querySelector("[data-act=dismiss]").addEventListener("click", closeBanner, { once: true });
  function closeBanner() {
    const u = new URL(location.href); u.searchParams.delete("lineup");
    history.replaceState(null, "", u);
    if (RM) { banner.hidden = true; return; }
    banner.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-8px)" }], { duration: 200, easing: EASE_OUT }).finished.then(() => (banner.hidden = true));
  }
}

/* -------------------------------------------------------------- poster */
async function drawPoster() {
  const ids = store.lineup;
  const W = 1080, H = 1350, pad = 64;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d");
  // night sky with her colours glowing in
  x.fillStyle = "#1e1747"; x.fillRect(0, 0, W, H);
  ids.slice(0, 3).forEach((id, k) => {
    const g = x.createRadialGradient(W * (0.2 + k * 0.3), H * (0.15 + (k % 2) * 0.6), 0, W * (0.2 + k * 0.3), H * (0.15 + (k % 2) * 0.6), W * 0.6);
    g.addColorStop(0, byId[id].accent + "55"); g.addColorStop(1, "#1e174700");
    x.fillStyle = g; x.fillRect(0, 0, W, H);
  });
  x.strokeStyle = "rgba(230,235,245,.06)";
  for (let gx = 0; gx < W; gx += 54) { x.beginPath(); x.moveTo(gx, 0); x.lineTo(gx, H); x.stroke(); }
  for (let gy = 0; gy < H; gy += 54) { x.beginPath(); x.moveTo(0, gy); x.lineTo(W, gy); x.stroke(); }

  x.fillStyle = "#e6ebf5";
  x.font = '86px "Dela Gothic One"';
  x.fillText("My lineup", pad, 150);
  x.font = '500 28px "Zen Kaku Gothic New"';
  x.fillStyle = "rgba(230,235,245,.7)";
  x.fillText(`${ids.length} of 9 heroines · Kokonoe`, pad, 200);

  // grid of portraits
  const cols = ids.length <= 1 ? 1 : ids.length <= 4 ? 2 : 3;
  const rows = Math.ceil(ids.length / cols);
  const top = 250, bottom = H - 150, gap = 22;
  const cw = (W - pad * 2 - gap * (cols - 1)) / cols;
  const chMax = (bottom - top - gap * (rows - 1)) / rows;
  const ch = Math.min(chMax, cw * 1.5);
  const imgs = await Promise.all(ids.map((id) => loadArt(byId[id]).catch(() => null)));
  ids.forEach((id, i) => {
    const h = byId[id];
    const col = i % cols, row = Math.floor(i / cols);
    const lastRowCount = ids.length - row * cols;
    const offset = row === rows - 1 && lastRowCount < cols ? ((cols - lastRowCount) * (cw + gap)) / 2 : 0;
    const cx = pad + col * (cw + gap) + offset, cy = top + row * (ch + gap);
    x.save();
    roundRect(x, cx, cy, cw, ch, 22); x.clip();
    if (imgs[i]) drawCover(x, imgs[i], cw, ch, h.fy, cx, cy);
    const g = x.createLinearGradient(0, cy + ch * 0.55, 0, cy + ch);
    g.addColorStop(0, "rgba(22,17,46,0)"); g.addColorStop(1, "rgba(22,17,46,.9)");
    x.fillStyle = g; x.fillRect(cx, cy, cw, ch);
    x.fillStyle = h.accent; x.fillRect(cx, cy + ch - 8, cw, 8);
    x.restore();
    x.fillStyle = "#fff";
    x.font = `${cols === 3 ? 30 : 40}px "Dela Gothic One"`;
    x.fillText(h.name, cx + 20, cy + ch - (cols === 3 ? 52 : 64), cw - 40);
    x.font = `500 ${cols === 3 ? 19 : 24}px "Zen Kaku Gothic New"`;
    x.fillStyle = "rgba(255,255,255,.8)";
    x.fillText(h.series, cx + 20, cy + ch - (cols === 3 ? 24 : 30), cw - 40);
  });

  // hanko seal
  x.save();
  x.translate(W - pad - 70, H - 90);
  x.rotate(-0.12);
  x.fillStyle = "#e5384f";
  roundRect(x, -50, -50, 100, 100, 12); x.fill();
  x.fillStyle = "#fff"; x.font = '42px "Dela Gothic One"'; x.textAlign = "center";
  x.fillText("九", 0, -4); x.fillText("重", 0, 40);
  x.restore();
  x.fillStyle = "rgba(230,235,245,.6)";
  x.font = '500 22px "Zen Kaku Gothic New"';
  x.fillText("Nine heroines, frame by frame", pad, H - 80);
  return c;
}
function roundRect(x, l, t, w, h, r) {
  x.beginPath(); x.moveTo(l + r, t); x.arcTo(l + w, t, l + w, t + h, r); x.arcTo(l + w, t + h, l, t + h, r);
  x.arcTo(l, t + h, l, t, r); x.arcTo(l, t, l + w, t, r); x.closePath();
}

let modal = null, posterCanvas = null, lastFocus = null;
function buildModal() {
  modal = document.createElement("div");
  modal.className = "poster-modal";
  modal.hidden = true;
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-label", "Your lineup poster");
  modal.innerHTML = `
    <div class="pm-scrim"></div>
    <div class="pm-body">
      <div class="pm-slot" aria-hidden="true"></div>
      <div class="pm-paper"></div>
      <div class="pm-actions">
        <button type="button" class="chip-btn light next-btn" data-pm="download">Download PNG</button>
        <button type="button" class="chip-btn light" data-pm="share">Share</button>
        <button type="button" class="chip-btn light" data-pm="close">Close</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelector(".pm-scrim").addEventListener("click", closeModal);
  modal.querySelector("[data-pm=close]").addEventListener("click", closeModal);
  modal.querySelector("[data-pm=download]").addEventListener("click", () => {
    posterCanvas.toBlob((blob) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = "kokonoe-lineup.png";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast("Saved kokonoe-lineup.png");
    });
  });
  const shareBtn = modal.querySelector("[data-pm=share]");
  shareBtn.addEventListener("click", () => {
    posterCanvas.toBlob(async (blob) => {
      const file = new File([blob], "kokonoe-lineup.png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: "My Kokonoe lineup", url: shareUrl() }); } catch { /* cancelled */ }
      } else {
        try { await navigator.clipboard.writeText(shareUrl()); toast("This browser can't share images, so the lineup link was copied instead."); }
        catch { prompt("Copy this link:", shareUrl()); }
      }
    });
  });
  modal.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.preventDefault(); closeModal(); }
    if (e.key === "Tab") {
      const f = [...modal.querySelectorAll("button")];
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  });
}

posterBtn.addEventListener("click", async () => {
  if (!modal) buildModal();
  posterBtn.disabled = true;
  posterBtn.textContent = "Printing";
  await document.fonts.ready;
  posterCanvas = await drawPoster();
  posterBtn.textContent = "Make a poster";
  posterBtn.disabled = false;
  const paper = modal.querySelector(".pm-paper");
  paper.innerHTML = "";
  const img = new Image();
  img.src = posterCanvas.toDataURL("image/jpeg", 0.9);
  img.alt = `Poster of your lineup: ${store.lineup.map((id) => byId[id].name).join(", ")}`;
  paper.appendChild(img);
  lastFocus = document.activeElement;
  modal.hidden = false;
  store.setModal(true);
  document.documentElement.classList.add("locked");
  // the poster prints: it slides down out of the slot, then settles
  if (RM) {
    modal.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
  } else {
    modal.querySelector(".pm-scrim").animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: "ease" });
    modal.querySelector(".pm-slot").animate([{ transform: "scaleX(.6)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 300, easing: EASE_OUT, fill: "both" });
    paper.animate([
      { transform: "translateY(-92%) rotate(0deg)", clipPath: "inset(92% 0 0 0)" },
      { transform: "translateY(0) rotate(-1.5deg)", clipPath: "inset(0 0 0 0)", offset: 0.85 },
      { transform: "translateY(0) rotate(0deg)", clipPath: "inset(0 0 0 0)" },
    ], { duration: 1300, delay: 250, easing: EASE_DRAWER, fill: "both" });
    modal.querySelector(".pm-actions").animate([{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], { duration: 400, delay: 1200, easing: EASE_OUT, fill: "both" });
  }
  modal.querySelector("[data-pm=download]").focus({ preventScroll: true });
});

function closeModal() {
  const done = () => {
    modal.hidden = true;
    modal.getAnimations({ subtree: true }).forEach((a) => a.cancel());
    store.setModal(false);
    document.documentElement.classList.remove("locked");
    if (lastFocus) lastFocus.focus({ preventScroll: true });
  };
  if (RM) return done();
  modal.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: "ease" }).finished.then(done);
}

function live(msg) { const el = document.querySelector(".lineup-live"); if (el) el.textContent = msg; }

store.on((what, d) => {
  if (what !== "lineup") return;
  renderLineup();
  if (d && d.added) live(`${byId[d.added].name} added to your lineup.`);
  if (d && d.removed) live(`${byId[d.removed].name} removed from your lineup.`);
});
renderLineup();
checkShared();
