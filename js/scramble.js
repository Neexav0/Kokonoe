// Navigation labels scramble through katakana and resolve left to right on
// hover, like a title card locking in. Mouse only; short, so it never slows you.
import { RM } from "./data.js";

const GLYPHS = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン";
const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;

function scramble(el) {
  if (el._busy) return;
  const text = el.dataset.text || (el.dataset.text = el.textContent);
  el._busy = true;
  const start = performance.now(), dur = 360;
  const step = (now) => {
    const t = Math.min(1, (now - start) / dur);
    const fixed = Math.floor(t * text.length);
    el.textContent = [...text].map((ch, i) => (i < fixed || ch === " " ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0])).join("");
    if (t < 1) requestAnimationFrame(step);
    else { el.textContent = text; el._busy = false; }
  };
  requestAnimationFrame(step);
}

if (fine && !RM) {
  document.querySelectorAll(".top nav a, .brand-word, .foot a").forEach((a) => {
    a.setAttribute("aria-label", a.textContent.trim());
    a.addEventListener("pointerenter", () => scramble(a));
  });
}
