// Touching a picture sends a ripple through it, like a finger on water.
// A generated map of concentric rings drives an SVG displacement filter; the
// ring grows from the touch point while the displacement dies away.
import { RM } from "./data.js";

const SURFACES = ".frame-in, .card, .tcard .tc-img, .sheet-media, .still, .qz-front, .fan-card, .cel, .compare, .pm-paper, .mq-av";
const NS = "http://www.w3.org/2000/svg";

// ring map: red/green hold the outward push, 50% grey is "no push"
const MAP = (() => {
  const n = 256, c = document.createElement("canvas");
  c.width = c.height = n;
  const x = c.getContext("2d"), img = x.createImageData(n, n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const dx = (i - n / 2) / (n / 2), dy = (j - n / 2) / (n / 2), d = Math.hypot(dx, dy);
    const k = (j * n + i) * 4;
    let r = 128, g = 128;
    if (d < 1) {
      const a = Math.atan2(dy, dx);
      const w = Math.sin(d * Math.PI * 5) * Math.pow(1 - d, 1.2);
      r = 128 + Math.cos(a) * w * 127;
      g = 128 + Math.sin(a) * w * 127;
    }
    img.data[k] = r; img.data[k + 1] = g; img.data[k + 2] = 128; img.data[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return c.toDataURL();
})();

const defs = document.createElementNS(NS, "svg");
defs.setAttribute("width", "0"); defs.setAttribute("height", "0");
defs.setAttribute("aria-hidden", "true");
defs.style.position = "absolute";
document.body.appendChild(defs);
let uid = 0;

function ripple(target, clientX, clientY) {
  const r = target.getBoundingClientRect();
  if (!r.width || !r.height) return;
  // filter user space is the element's own box, before transforms
  const sx = target.offsetWidth / r.width, sy = target.offsetHeight / r.height;
  const cx = (clientX - r.left) * sx, cy = (clientY - r.top) * sy;
  const id = `koko-ripple-${uid++}`;
  const f = document.createElementNS(NS, "filter");
  f.setAttribute("id", id);
  f.setAttribute("x", "0"); f.setAttribute("y", "0"); f.setAttribute("width", "100%"); f.setAttribute("height", "100%");
  f.setAttribute("primitiveUnits", "userSpaceOnUse");
  f.setAttribute("color-interpolation-filters", "sRGB");
  f.innerHTML = `<feFlood flood-color="rgb(128,128,128)" result="flat"/>
    <feImage href="${MAP}" preserveAspectRatio="none" result="rings"/>
    <feComposite in="rings" in2="flat" operator="over" result="map"/>
    <feDisplacementMap in="SourceGraphic" in2="map" scale="0" xChannelSelector="R" yChannelSelector="G"/>`;
  defs.appendChild(f);
  const imgEl = f.querySelector("feImage"), disp = f.querySelector("feDisplacementMap");
  const prev = target.style.filter;
  target.style.filter = `url(#${id})`;

  // a faint expanding ring of light on top
  const host = target.closest(SURFACES) || target;
  const ring = document.createElement("span");
  ring.className = "ripple-ring";
  const hr = host.getBoundingClientRect();
  ring.style.left = `${clientX - hr.left}px`; ring.style.top = `${clientY - hr.top}px`;
  host.appendChild(ring);

  const maxR = Math.hypot(Math.max(cx, target.offsetWidth - cx), Math.max(cy, target.offsetHeight - cy)) * 1.15;
  const t0 = performance.now(), dur = 950;
  const step = (now) => {
    const t = Math.min(1, (now - t0) / dur);
    const e = 1 - Math.pow(1 - t, 3);
    const R = 24 + e * maxR;
    imgEl.setAttribute("x", cx - R); imgEl.setAttribute("y", cy - R);
    imgEl.setAttribute("width", R * 2); imgEl.setAttribute("height", R * 2);
    disp.setAttribute("scale", (46 * (1 - t) * (1 - t)).toFixed(2));
    ring.style.transform = `translate(-50%, -50%) scale(${(R / 20).toFixed(3)})`;
    ring.style.opacity = String(0.55 * (1 - t));
    if (t < 1) requestAnimationFrame(step);
    else { target.style.filter = prev; f.remove(); ring.remove(); }
  };
  requestAnimationFrame(step);
}

if (!RM) {
  document.addEventListener("pointerdown", (e) => {
    if (e.button > 0) return;
    const host = e.target.closest(SURFACES);
    if (!host || host.closest(".lifted")) return;
    // ripple the picture itself, not captions or buttons laid over it
    const pic = host.matches("img, canvas") ? host : host.querySelector(".cmp-color, .l-comp, :scope > img, :scope > .vid, img, canvas");
    if (pic) ripple(pic, e.clientX, e.clientY);
  }, { passive: true });
}
