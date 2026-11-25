// Soundtrack: the Suzume theme on a loop. It starts on the first click, tap or
// key press (browsers block sound before that), ducks under character clips,
// pauses with the tab, and a live analyser feeds the beat to the rest of the
// site through window.kokoAudio = { level, bands }.
import { store } from "./store.js";
import { RM, EASE_OUT } from "./data.js";

const SRC = "media/audio/suzume.mp3";
const FULL = 0.42, DUCKED = 0.07;
const eq = document.querySelector(".eq");
const bars = eq ? [...eq.querySelectorAll("i")] : [];
const hint = document.querySelector(".sound-hint");

const audio = new Audio();
audio.src = SRC;
audio.loop = true;
audio.preload = "auto";
audio.crossOrigin = "anonymous";

let ctx = null, gain = null, analyser = null, freq = null, started = false, muted = false, startedAt = 0;
const ducks = new Set();
window.kokoAudio = { level: 0, bands: [0, 0, 0, 0] };

function target() { return muted || document.hidden ? 0 : ducks.size ? DUCKED : FULL; }
function ramp(sec = 0.8) {
  if (!gain) return;
  const t = ctx.currentTime;
  gain.gain.cancelScheduledValues(t);
  gain.gain.setValueAtTime(gain.gain.value, t);
  gain.gain.linearRampToValueAtTime(target(), t + sec);
}

function start() {
  if (started || !store.audible) return;
  started = true;
  startedAt = performance.now();
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const src = ctx.createMediaElementSource(audio);
    gain = ctx.createGain();
    gain.gain.value = 0;
    analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    freq = new Uint8Array(analyser.frequencyBinCount);
    src.connect(analyser);
    analyser.connect(gain);
    gain.connect(ctx.destination);
  } catch { /* no Web Audio: plain element playback still works */ }
  audio.play().then(() => { ramp(2.2); eq?.classList.add("playing"); }).catch(() => { started = false; });
  if (hint) {
    hint.classList.add("gone");
    setTimeout(() => hint.remove(), 600);
  }
}

function setMuted(m) {
  muted = m;
  if (eq) {
    eq.setAttribute("aria-pressed", String(m));
    eq.setAttribute("aria-label", m ? "Play music" : "Pause music");
    eq.classList.toggle("muted", m);
  }
  if (!started && !m) { start(); return; }
  if (!m && audio.paused) audio.play().catch(() => {});
  ramp(m ? 0.5 : 1);
  if (m) setTimeout(() => { if (muted) audio.pause(); }, 550);
}

/* other modules duck the music while a clip with sound is playing */
export function duck(key, on) {
  if (on) ducks.add(key); else ducks.delete(key);
  ramp(on ? 0.4 : 1.2);
}

store.on((what) => { if (what === "sound") start(); });
// the first click anywhere starts the music; if that click was on the
// equalizer itself, don't immediately treat it as "pause"
eq?.addEventListener("click", () => { if (performance.now() - startedAt > 500) setMuted(!muted); });
addEventListener("keydown", (e) => {
  if ((e.key === "m" || e.key === "M") && !e.metaKey && !e.ctrlKey && !e.altKey && !/input|textarea/i.test(e.target.tagName) && performance.now() - startedAt > 500) setMuted(!muted);
});
document.addEventListener("visibilitychange", () => {
  if (!started) return;
  if (document.hidden) { ramp(0.3); setTimeout(() => document.hidden && audio.pause(), 350); }
  else if (!muted) { audio.play().catch(() => {}); ramp(1); }
});

/* analyser → level and four bands, smoothed; drives the equalizer bars */
let smooth = 0;
const bandSmooth = [0, 0, 0, 0];
function frame() {
  if (analyser && !audio.paused) {
    analyser.getByteFrequencyData(freq);
    const avg = (a, b) => { let s = 0; for (let i = a; i < b; i++) s += freq[i]; return s / (b - a) / 255; };
    const bands = [avg(1, 5), avg(5, 14), avg(14, 32), avg(32, 70)];
    const vol = gain ? gain.gain.value / FULL : 1;
    const bass = bands[0] * vol;
    smooth += (bass - smooth) * 0.25;
    bands.forEach((v, i) => (bandSmooth[i] += (v * vol - bandSmooth[i]) * 0.3));
  } else {
    smooth *= 0.9; bandSmooth.forEach((v, i) => (bandSmooth[i] = v * 0.9));
  }
  window.kokoAudio.level = RM ? 0 : smooth;
  window.kokoAudio.bands = bandSmooth;
  bars.forEach((b, i) => { b.style.transform = `scaleY(${(0.18 + bandSmooth[i] * 1.1).toFixed(3)})`; });
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
