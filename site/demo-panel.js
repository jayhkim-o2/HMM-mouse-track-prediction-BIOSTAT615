// Live demo panel (SPEC Section 11). Only loaded when the URL has ?demo=1.
// Feeds every recorded event to the live converter, every resulting action to the live
// forward algorithm, and draws:
//   - a stacked chart of the 4 state probabilities over time
//   - a tick mark for each action along the bottom (hover for its name)
//   - the current choice guess (e.g. "60% web / 30% AI / 10% person")
// After the click it also draws the Viterbi path as a strip under the chart.
// It's drawn as an overlay, so it never changes the page layout the recorder measures.

import { OPTIONS, SYM, STATES } from "../core/config.js";
import { createConverterStream } from "../core/converter.js";
import { createLiveForward, choiceGuess, viterbi } from "../core/hmm.js";
import { handsetModel } from "../core/model_handset.js";

const STATE_LABELS = ["Undecided", "Lean web", "Lean AI", "Lean person"];
const STATE_COLORS = ["#9aa5b1", "#1e6f8c", "#7b5ea7", "#c97d10"];
const OPTION_LABELS = { web: "Web survey", ai: "AI phone", person: "Person phone" };
const SVG_NS = "http://www.w3.org/2000/svg";

export function createDemoPanel({ getElapsed }) {
  const model = handsetModel();
  const converter = createConverterStream();
  const live = createLiveForward(model);

  // History: one entry per action, plus the starting point at t = 0.
  const actions = [];
  const history = [{ t: 0, probs: live.current() }];
  let nowT = 0;
  let viterbiPath = null;
  let chosen = null;

  // ---------- Build the panel ----------
  const panel = document.createElement("aside");
  panel.className = "demo-panel";
  panel.setAttribute("aria-label", "Live model view");
  panel.innerHTML = `
    <div class="dp-head"><strong>Live model view</strong><button type="button" class="dp-toggle">Hide</button></div>
    <div class="dp-body">
      <div class="dp-guess"></div>
      <div class="dp-sub">Hidden state over time</div>
      <svg class="dp-chart" viewBox="0 0 320 120" preserveAspectRatio="none"></svg>
      <div class="dp-legend">${STATE_LABELS.map((l, s) => `<span><i style="background:${STATE_COLORS[s]}"></i>${l}</span>`).join("")}</div>
      <div class="dp-sub">Actions (<span class="dp-n">0</span>), newest first</div>
      <ol class="dp-acts"></ol>
      <div class="dp-result"></div>
      <div class="dp-note">Demo mode: this visit is marked "demo" and left out of all analysis.</div>
    </div>`;
  document.body.appendChild(panel);
  const q = (sel) => panel.querySelector(sel);
  q(".dp-toggle").addEventListener("click", () => {
    const hidden = panel.classList.toggle("dp-min");
    q(".dp-toggle").textContent = hidden ? "Show" : "Hide";
  });

  // ---------- Drawing ----------
  const svgEl = (tag, attrs) => {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  };

  function render() {
    // Choice guess from the latest filtered probabilities.
    const g = choiceGuess(history[history.length - 1].probs);
    q(".dp-guess").innerHTML = OPTIONS.map((o, k) => `
      <div class="dp-row"><span>${OPTION_LABELS[o]}</span>
        <span class="dp-bar"><i style="width:${(g[k] * 100).toFixed(1)}%;background:${STATE_COLORS[k + 1]}"></i></span>
        <span class="dp-pct">${Math.round(g[k] * 100)}%</span></div>`).join("");

    // Stacked chart. The probabilities stay the same between actions, so each band is a
    // step shape: flat until the next action, then a jump.
    const W = 320, BAND_H = 88, TICK_Y = 92, STRIP_Y = 106;
    const tMax = Math.max(nowT, history[history.length - 1].t, 1000);
    const X = (t) => (t / tMax) * W;
    const svg = q(".dp-chart");
    svg.replaceChildren();

    for (let i = 0; i < history.length; i++) {
      const x0 = X(history[i].t);
      const x1 = i + 1 < history.length ? X(history[i + 1].t) : X(tMax);
      let y = 0;
      for (let s = 0; s < 4; s++) {
        const h = history[i].probs[s] * BAND_H;
        svg.appendChild(svgEl("rect", { x: x0, y, width: Math.max(x1 - x0, 0.5), height: h, fill: STATE_COLORS[s] }));
        y += h;
      }
    }

    // Action ticks along the bottom, with the action name on hover.
    for (const a of actions) {
      const tick = svgEl("rect", { x: X(a.t) - 0.75, y: TICK_Y, width: 1.5, height: 8, fill: "#1d2b36" });
      const title = svgEl("title", {});
      title.textContent = `${a.symbol} at ${(a.t / 1000).toFixed(1)} s`;
      tick.appendChild(title);
      svg.appendChild(tick);
    }

    // After the visit: the Viterbi path as a strip.
    if (viterbiPath) {
      viterbiPath.forEach((s, i) => {
        const x0 = X(actions[i].t);
        const x1 = i + 1 < actions.length ? X(actions[i + 1].t) : X(tMax);
        svg.appendChild(svgEl("rect", { x: x0, y: STRIP_Y, width: Math.max(x1 - x0, 0.5), height: 12, fill: STATE_COLORS[s] }));
      });
    }

    // Action list.
    q(".dp-n").textContent = actions.length;
    q(".dp-acts").innerHTML = actions.slice().reverse().slice(0, 40)
      .map((a) => `<li><span>${a.symbol}</span><span>${(a.t / 1000).toFixed(1)} s</span></li>`).join("");
  }

  // ---------- Feeding it ----------
  function addActions(newActions) {
    for (const a of newActions) {
      actions.push(a);
      history.push({ t: a.t, probs: live.step(SYM[a.symbol]) });
    }
  }

  // Called with every event the recorder logs.
  function onEvent(ev) {
    if (chosen) return;
    nowT = Math.max(nowT, ev.t);
    if (ev.type === "choice") {
      addActions(converter.push(ev));
      chosen = ev.option;
      finishVisit();
      return;
    }
    const out = converter.push(ev);
    addActions(out);
    if (out.length) render();
  }

  // Clock: lets time-based actions (like PAUSE) appear even when no events arrive,
  // and keeps the chart's time axis moving.
  const timer = setInterval(() => {
    if (chosen) return;
    nowT = Math.max(nowT, getElapsed());
    addActions(converter.tick(nowT));
    render();
  }, 100);

  function finishVisit() {
    clearInterval(timer);
    viterbiPath = actions.length ? viterbi(model, actions.map((a) => SYM[a.symbol])).path : [];
    const g = choiceGuess(history[history.length - 1].probs);
    let top = 0;
    for (let k = 1; k < 3; k++) if (g[k] > g[top]) top = k;
    const right = OPTIONS[top] === chosen;
    // Describe the Viterbi path as runs, e.g. "UNDECIDED for 5 actions, then LEAN_AI for 3".
    const runs = [];
    (viterbiPath || []).forEach((s) => {
      if (runs.length && runs[runs.length - 1].s === s) runs[runs.length - 1].n++;
      else runs.push({ s, n: 1 });
    });
    q(".dp-result").innerHTML = `<p><strong>You chose ${OPTION_LABELS[chosen]}.</strong>
      Just before the click the top guess was ${OPTION_LABELS[OPTIONS[top]]} (${Math.round(g[top] * 100)}%):
      <span class="${right ? "dp-ok" : "dp-no"}">${right ? "right" : "wrong"}</span>.</p>
      <p class="dp-sub">Viterbi's hindsight path (strip under the chart): ${runs.length
        ? runs.map((r) => `${STATES[r.s]} for ${r.n} action${r.n > 1 ? "s" : ""}`).join(", then ")
        : "no actions were recorded"}.</p>`;
    render();
  }

  render();
  return { onEvent };
}
