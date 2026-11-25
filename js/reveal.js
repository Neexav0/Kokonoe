// Scroll reveals for section heads and blocks.
//   [data-split]  headings: letters rise in, word by word
//   [data-reveal] any block: fades and lifts in
// Uses a scroll check rather than IntersectionObserver so it also works in
// throttled background tabs.
import { RM } from "./data.js";

function split(el) {
  const text = el.textContent;
  el.setAttribute("aria-label", text);
  let i = 0;
  el.innerHTML = text.split(" ").map((word) =>
    `<span class="w" aria-hidden="true">${[...word].map((ch) => `<span class="l" style="--i:${i++}">${ch}</span>`).join("")}</span>`
  ).join(" ");
}

const pending = new Set();
function check() {
  const limit = innerHeight * 0.86;
  pending.forEach((el) => {
    if (el.getBoundingClientRect().top < limit) { el.classList.add("in"); pending.delete(el); }
  });
}
let queued = false;
function onScroll() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; check(); });
}

export function watchReveals(scope = document) {
  scope.querySelectorAll("[data-split]:not(.split-ready)").forEach((el) => { split(el); el.classList.add("split-ready"); pending.add(el); });
  scope.querySelectorAll("[data-reveal]").forEach((el) => pending.add(el));
  if (RM) pending.forEach((el) => el.classList.add("in"));
  check();
}

// Parallax: [data-parallax="-0.2"] drifts by that fraction of its offset from the viewport centre.
const drifters = [...document.querySelectorAll("[data-parallax]")];
function parallax() {
  if (!RM) drifters.forEach((el) => {
    const r = el.parentElement.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    const off = (r.top + r.height / 2 - innerHeight / 2) * parseFloat(el.dataset.parallax);
    el.style.transform = `translate3d(0, ${off.toFixed(1)}px, 0)`;
  });
  requestAnimationFrame(parallax);
}
requestAnimationFrame(parallax);

addEventListener("scroll", onScroll, { passive: true });
addEventListener("resize", onScroll);
setInterval(check, 600); // safety net if scroll events are throttled
