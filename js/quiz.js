// "Whose eyes?" — six rounds, a tight crop of one heroine's eyes each.
import { HEROINES, byId, artOf, RM, EASE_OUT, EASE_IN_OUT } from "./data.js";
import { store } from "./store.js";
import { still, cloneCanvas } from "./stills.js";
import { toast } from "./toast.js";
import { rain, sweep } from "./petals.js";

const section = document.querySelector(".quiz");
const card = section.querySelector(".quiz-card");
const stage = section.querySelector(".qz-stage");
const zoom = section.querySelector(".qz-zoom");
const reveal = section.querySelector(".qz-reveal");
const stamp = section.querySelector(".qz-stamp");
const flip = section.querySelector(".qz-flip");
const nameTag = section.querySelector(".qz-name");
const answers = section.querySelector(".qz-answers");
const roundEl = section.querySelector(".qz-round b");
const scoreEl = section.querySelector(".qz-score-n");
const hintBtn = section.querySelector("[data-act=hint]");
const nextBtn = section.querySelector("[data-act=next]");
const result = section.querySelector(".qz-result");
const live = section.querySelector(".qz-live");
const play = section.querySelector(".qz-play");

const ROUNDS = 6;
let order = [], round = 0, score = 0, hinted = false, answered = false;

const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

function start() {
  if (round > 0 || score > 0) sweep();
  order = shuffle(HEROINES).slice(0, ROUNDS);
  round = 0; score = 0;
  setScore(0, false);
  result.hidden = true;
  card.classList.remove("done");
  // warm the crops so rounds switch instantly
  order.forEach((h) => still(h.id, h.eyes[0], { crop: h.eyes.slice(1), w: 960, h: 400 }).catch(() => {}));
  showRound();
}

function showRound() {
  const h = order[round];
  hinted = false; answered = false;
  roundEl.textContent = String(round + 1);
  stage.style.setProperty("--c", h.accent);
  flip.style.setProperty("--c", h.accent);
  dispatchEvent(new CustomEvent("koko:accent", { detail: h.accent }));
  stage.classList.remove("revealed", "right", "wrong");
  flip.classList.remove("revealed", "right", "wrong");
  nameTag.textContent = "";
  stamp.textContent = "";
  zoom.style.transition = "none";
  zoom.style.transform = RM ? "none" : "scale(1.5)";
  hintBtn.disabled = false;
  nextBtn.hidden = true;
  zoom.innerHTML = "";
  zoom.classList.add("loading");
  still(h.id, h.eyes[0], { crop: h.eyes.slice(1), w: 960, h: 400 }).then((c) => {
    if (order[round] !== h) return;
    zoom.innerHTML = "";
    zoom.appendChild(cloneCanvas(c, "qz-eyes"));
    zoom.classList.remove("loading");
    if (!RM) zoom.animate([{ opacity: 0, filter: "blur(10px)" }, { opacity: 1, filter: "blur(0)" }], { duration: 500, easing: EASE_OUT });
  }).catch(() => { zoom.classList.remove("loading"); zoom.textContent = "This frame didn't load."; });
  reveal.src = artOf(h);
  reveal.style.objectPosition = `50% ${h.fy * 100}%`;

  // four choices: her and three others
  const opts = shuffle([h, ...shuffle(HEROINES.filter((x) => x !== h)).slice(0, 3)]);
  answers.innerHTML = "";
  opts.forEach((o, k) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "qz-opt";
    b.style.setProperty("--c", o.accent);
    b.style.setProperty("--k", k);
    b.innerHTML = `<span class="qz-k" aria-hidden="true">${"ABCD"[k]}</span>${o.name}`;
    b.addEventListener("click", () => answer(o, b));
    answers.appendChild(b);
  });
  live.textContent = `Round ${round + 1} of ${ROUNDS}. Whose eyes are these?`;
}

hintBtn.addEventListener("click", () => {
  if (answered || hinted) return;
  hinted = true;
  hintBtn.disabled = true;
  zoom.style.transition = RM ? "none" : `transform 700ms ${EASE_IN_OUT}`;
  zoom.style.transform = "none";
  live.textContent = "Zoomed out. This round is now worth 1 point.";
});

function answer(o, btn) {
  if (answered) return;
  answered = true;
  const h = order[round];
  const right = o === h;
  [...answers.children].forEach((b) => (b.disabled = true));
  btn.classList.add(right ? "right" : "wrong");
  if (!right) [...answers.children].find((b) => b.textContent.endsWith(h.name))?.classList.add("right");
  hintBtn.disabled = true;
  stage.classList.add("revealed", right ? "right" : "wrong");
  flip.classList.add("revealed", right ? "right" : "wrong");
  nameTag.textContent = h.name;
  stamp.textContent = right ? "正解" : "残念";
  stamp.setAttribute("aria-hidden", "true");
  if (right) {
    const pts = hinted ? 1 : 2;
    setScore(score + pts, true);
    const added = store.addLineup(h.id, "quiz");
    live.textContent = `Right, it's ${h.name}. Plus ${pts}.${added ? " She joined your lineup." : ""}`;
    if (added) toast(`${h.name} joined your lineup`, { accent: h.accent });
    burst();
    rain(h.accent, flip.getBoundingClientRect());
  } else {
    live.textContent = `Not quite. Those were ${h.name}'s eyes.`;
    if (!RM) card.animate([{ transform: "translateX(0)" }, { transform: "translateX(-10px)" }, { transform: "translateX(8px)" }, { transform: "translateX(-5px)" }, { transform: "translateX(0)" }], { duration: 360, easing: "ease-out" });
  }
  nextBtn.hidden = false;
  nextBtn.textContent = round + 1 < ROUNDS ? "Next round" : "See your score";
  nextBtn.focus({ preventScroll: true });
}

nextBtn.addEventListener("click", () => {
  if (round + 1 < ROUNDS) { round++; showRound(); return; }
  finish();
});

function finish() {
  card.classList.add("done");
  result.hidden = false;
  const max = ROUNDS * 2;
  const best = Math.max(store.quizBest, score);
  store.setQuizBest(score);
  result.querySelector(".qz-final").textContent = "0";
  result.querySelector(".qz-max").textContent = String(max);
  result.querySelector(".qz-best").textContent = score >= best && score > 0 ? "A new best on this device." : `Your best on this device is ${best} of ${max}.`;
  // count the final score up
  const el = result.querySelector(".qz-final");
  if (RM) el.textContent = String(score);
  else {
    const t0 = performance.now(), dur = 900;
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      el.textContent = String(Math.round(score * (1 - Math.pow(1 - t, 3))));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    setTimeout(() => { el.textContent = String(score); }, dur + 100); // in case frames are throttled
  }
  live.textContent = `Done. You scored ${score} of ${max}.`;
  play.focus({ preventScroll: true });
}
play.addEventListener("click", start);

function setScore(n, animate) {
  const prev = score;
  score = n;
  if (!animate || RM) { scoreEl.textContent = String(n); return; }
  scoreEl.textContent = String(n);
  scoreEl.animate([{ transform: "translateY(60%)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 360, easing: EASE_OUT });
  if (n > prev) scoreEl.parentElement.animate([{ transform: "scale(1.18)" }, { transform: "none" }], { duration: 420, easing: EASE_OUT });
}

function burst() {
  if (RM) return;
  const r = flip.getBoundingClientRect();
  const c = order[round].accent;
  for (let i = 0; i < 22; i++) {
    const p = document.createElement("i");
    p.className = "petal-burst";
    p.style.left = `${r.left + r.width / 2}px`;
    p.style.top = `${r.top + r.height / 2}px`;
    p.style.background = i % 3 ? c : "#fff";
    document.body.appendChild(p);
    const a = Math.random() * Math.PI * 2, d = 90 + Math.random() * 160;
    p.animate([
      { transform: "translate(-50%,-50%) scale(1.2)", opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d + 60}px)) scale(.3) rotate(${Math.random() * 540}deg)`, opacity: 0 },
    ], { duration: 900 + Math.random() * 500, easing: EASE_OUT }).finished.then(() => p.remove());
  }
}

/* ---------------------------------------------------------------- boot */
let booted = false;
function watch() { if (!booted && section.getBoundingClientRect().top < innerHeight * 2) { booted = true; start(); } }
addEventListener("scroll", watch, { passive: true });
setInterval(watch, 800);
watch();
