// One small store for state that several sections share, saved between visits.
const KEY = "kokonoe.v1";

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
const saved = load();
const state = {
  lineup: Array.isArray(saved.lineup) ? saved.lineup : [],
  tiers: saved.tiers || null,
  quizBest: saved.quizBest || 0,
};
let sound = false;
let modal = false;
const subs = new Set();

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode: keep it in memory */ }
}
function emit(what, detail) { subs.forEach((fn) => fn(what, detail)); }

export const store = {
  get lineup() { return state.lineup.slice(); },
  inLineup(id) { return state.lineup.includes(id); },
  addLineup(id, source = "deck") {
    if (state.lineup.includes(id)) return false;
    state.lineup.push(id); save(); emit("lineup", { added: id, source });
    return true;
  },
  removeLineup(id) {
    state.lineup = state.lineup.filter((x) => x !== id); save(); emit("lineup", { removed: id });
  },
  setLineup(ids) { state.lineup = [...new Set(ids)]; save(); emit("lineup", { replaced: true }); },

  get tiers() { return state.tiers; },
  setTiers(t) { state.tiers = t; save(); emit("tiers"); },

  get quizBest() { return state.quizBest; },
  setQuizBest(n) { if (n > state.quizBest) { state.quizBest = n; save(); emit("quiz"); } },

  get sound() { return sound; },
  setSound(v) { sound = v; emit("sound"); },

  get modal() { return modal; },
  setModal(v) { modal = v; emit("modal"); },

  on(fn) { subs.add(fn); return () => subs.delete(fn); },
};
