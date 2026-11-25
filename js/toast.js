// A small toast: enters and leaves from the bottom, uses transitions so
// a second toast can interrupt the first without a jump.
import { RM } from "./data.js";

let host = null;
function ensure() {
  if (host) return host;
  host = document.createElement("div");
  host.className = "toasts";
  host.setAttribute("role", "status");
  host.setAttribute("aria-live", "polite");
  document.body.appendChild(host);
  return host;
}

export function toast(message, { accent = null, ms = 2600 } = {}) {
  const h = ensure();
  const t = document.createElement("div");
  t.className = "toast";
  if (accent) t.style.setProperty("--c", accent);
  t.textContent = message;
  h.appendChild(t);
  while (h.children.length > 3) h.firstElementChild.remove();
  requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add("in")));
  setTimeout(() => {
    t.classList.remove("in");
    t.classList.add("out");
    setTimeout(() => t.remove(), RM ? 0 : 400);
  }, ms);
}
