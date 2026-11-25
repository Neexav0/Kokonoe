// Marquee bands: the nine names roll across, pushed by your scroll. Scrolling
// down speeds them up, scrolling up flips them, and fast scrolls skew them.
// Holding the mouse over a band slows it right down.
import { HEROINES, artImg, RM, clamp } from "./data.js";

const bands = [...document.querySelectorAll(".marquee")].map((band, b) => {
  const track = band.querySelector(".mq-track");
  const dir = band.dataset.dir === "rtl" ? -1 : 1;
  const item = (h) => {
    const s = document.createElement("span");
    s.className = "mq-item";
    s.style.setProperty("--c", h.accent);
    const av = document.createElement("span");
    av.className = "mq-av";
    av.appendChild(artImg(h));
    s.append(av, document.createTextNode(b % 2 ? h.jp : h.name));
    const star = document.createElement("i");
    star.textContent = "✦";
    s.appendChild(star);
    return s;
  };
  // two identical halves so the loop is seamless
  for (let k = 0; k < 2; k++) {
    const half = document.createElement("span");
    half.className = "mq-half";
    HEROINES.forEach((h) => half.appendChild(item(h)));
    track.appendChild(half);
  }
  const state = { band, track, dir, x: 0, slow: 1, half: track.firstElementChild };
  band.addEventListener("pointerenter", () => (state.hover = true));
  band.addEventListener("pointerleave", () => (state.hover = false));
  return state;
});

let lastY = scrollY, vel = 0, dirSign = 1, last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const dy = scrollY - lastY; lastY = scrollY;
  vel += (dy - vel) * 0.12;
  if (Math.abs(dy) > 0.5) dirSign = Math.sign(dy);
  bands.forEach((s) => {
    const r = s.band.getBoundingClientRect();
    if (r.bottom < -50 || r.top > innerHeight + 50) return;
    s.slow += ((s.hover ? 0.15 : 1) - s.slow) * Math.min(1, dt * 6);
    const speed = RM ? 0 : (60 + Math.abs(vel) * 18) * dirSign * s.dir * s.slow;
    const w = s.half.offsetWidth || 1;
    s.x = (s.x - speed * dt) % w;
    if (s.x > 0) s.x -= w;
    const skew = RM ? 0 : clamp(vel * -0.35, -12, 12);
    s.track.style.transform = `translate3d(${s.x}px, 0, 0) skewX(${skew}deg)`;
  });
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
