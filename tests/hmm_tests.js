// HMM correctness tests (SPEC Section 14, tests 1, 2, 4, 5, plus live-vs-batch).
// Used by tests.html in the browser and by tests/run_node.mjs in the terminal.
// Each test returns { name, pass, detail }.

import {
  validateModel, forwardScaled, forwardLog, viterbi, bruteForce, createLiveForward,
} from "../core/hmm.js";
import { handsetModel } from "../core/model_handset.js";

// Small seeded random number generator, so every run uses the same random models.
function makeRng(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
// A random probability row with every entry > 0.
function randomRow(rng, n) {
  const v = Array.from({ length: n }, () => 0.05 + rng());
  const s = v.reduce((a, b) => a + b, 0);
  return v.map((x) => x / s);
}
function randomModel(rng, nStates, nSymbols) {
  return {
    init: randomRow(rng, nStates),
    A: Array.from({ length: nStates }, () => randomRow(rng, nStates)),
    B: Array.from({ length: nStates }, () => randomRow(rng, nSymbols)),
  };
}
const close = (a, b, tol) => Math.abs(a - b) <= tol;

// Test 4's sanity rule, applied to every filtered vector computed in any test:
// sums to 1 within 1e-9, no negatives, no NaN.
let sanityChecked = 0;
let sanityFailures = 0;
function checkSanity(filtered) {
  for (const p of filtered) {
    sanityChecked++;
    const ok = close(p.reduce((a, b) => a + b, 0), 1, 1e-9) && p.every((v) => v >= 0 && !Number.isNaN(v));
    if (!ok) sanityFailures++;
  }
}

// Test 1: the 2-state example from SPEC Section 14, also worked by hand.
function test1() {
  const model = { init: [0.6, 0.4], A: [[0.7, 0.3], [0.4, 0.6]], B: [[0.9, 0.1], [0.2, 0.8]] };
  const obs = [0, 1, 0]; // x, y, x
  const f = forwardScaled(model, obs);
  const v = viterbi(model, obs);
  checkSanity(f.filtered);

  // Undo the rescaling to recover the un-normalized alphas:
  // alpha_t = filtered_t * (c_1 * ... * c_t)
  let running = 1;
  const alphas = f.filtered.map((p, t) => { running *= f.scales[t]; return p.map((x) => x * running); });
  const expectedAlphas = [[0.54, 0.08], [0.041, 0.168], [0.08631, 0.02262]];
  const alphasOk = alphas.every((a, t) => a.every((x, s) => close(x, expectedAlphas[t][s], 1e-9)));

  const pObs = Math.exp(f.logLik);
  const pA = f.filtered.map((p) => p[0]);
  const expectedPA = [0.87097, 0.19617, 0.79234];
  const pass = alphasOk
    && close(pObs, 0.10893, 1e-9)
    && pA.every((x, t) => close(x, expectedPA[t], 1e-5))
    && v.path.join(",") === "0,1,0"
    && close(Math.exp(v.logProb), 0.046656, 1e-9);
  return {
    name: "1. Hand-worked example",
    pass,
    detail: `alphas ${alphas.map((a) => "(" + a.map((x) => +x.toFixed(5)).join(", ") + ")").join(" ")}; ` +
      `P(obs) = ${pObs.toFixed(5)}; filtered P(A) = ${pA.map((x) => x.toFixed(5)).join(", ")}; ` +
      `Viterbi ${v.path.map((s) => "AB"[s]).join(", ")} with probability ${Math.exp(v.logProb).toFixed(6)}`,
  };
}

// Test 2: compare against listing every path, on 500 random 4-state, 16-symbol models.
function test2() {
  const rng = makeRng(615);
  let worst = 0;
  let failures = 0;
  for (let i = 0; i < 500; i++) {
    const model = randomModel(rng, 4, 16);
    const T = 1 + Math.floor(rng() * 5);
    const obs = Array.from({ length: T }, () => Math.floor(rng() * 16));
    const f = forwardScaled(model, obs);
    const b = bruteForce(model, obs);
    const v = viterbi(model, obs);
    checkSanity(f.filtered);

    const relLik = Math.abs(Math.exp(f.logLik) - b.total) / b.total;
    const filtOk = f.filtered[T - 1].every((p, s) => close(p, b.lastFiltered[s], 1e-10));
    const relVit = Math.abs(Math.exp(v.logProb) - b.best) / b.best;
    const pathOk = b.bestPaths.some((p) => p.join(",") === v.path.join(","));
    worst = Math.max(worst, relLik, relVit);
    if (relLik >= 1e-10 || !filtOk || relVit >= 1e-10 || !pathOk) failures++;
  }
  return {
    name: "2. Forward and Viterbi vs. listing every path",
    pass: failures === 0,
    detail: `500 random models, lengths 1-5: ${failures} failures; worst relative error ${worst.toExponential(1)}`,
  };
}

// Test 4: probabilities are valid, the hand-set model passes validation,
// and broken models are rejected.
function test4() {
  const model = handsetModel(); // throws if invalid
  const rng = makeRng(7);
  const obs = Array.from({ length: 300 }, () => Math.floor(rng() * 16));
  checkSanity(forwardScaled(model, obs).filtered);
  checkSanity(forwardLog(model, obs).filtered);

  const rejects = (bad) => { try { validateModel(bad); return false; } catch { return true; } };
  const badRow = model.A.map((r) => r.slice()); badRow[1][1] = 0.95; // row sums to 1.05
  const cases = [
    rejects({ ...model, init: [0.5, 0.5, 0, 0] }),        // a zero
    rejects({ ...model, A: badRow }),                      // row doesn't sum to 1
    rejects({ ...model, init: [1.1, -0.1, 0, 0] }),        // negative entry
  ];
  const rejected = cases.filter(Boolean).length;
  const pass = sanityFailures === 0 && rejected === cases.length;
  return {
    name: "4. Probabilities sum to 1; bad models rejected",
    pass,
    detail: `${sanityChecked} filtered vectors checked across all tests, ${sanityFailures} bad; ` +
      `hand-set model valid; ${rejected} of ${cases.length} broken models rejected`,
  };
}

// Test 5: 2,000-step sequences. Scaled and log versions must agree, and a plain
// (unscaled) forward is shown underflowing to 0 as a teaching example.
function test5() {
  const model = handsetModel();
  const rng = makeRng(99);
  const obs = Array.from({ length: 2000 }, () => Math.floor(rng() * 16));
  const a = forwardScaled(model, obs);
  const b = forwardLog(model, obs);
  checkSanity(a.filtered);
  let worst = Math.abs(a.logLik - b.logLik);
  a.filtered.forEach((p, t) => p.forEach((v, s) => { worst = Math.max(worst, Math.abs(v - b.filtered[t][s])); }));

  // Unscaled forward: multiply probabilities and never rescale.
  let alpha = model.init.map((p, s) => p * model.B[s][obs[0]]);
  for (let t = 1; t < obs.length; t++) {
    alpha = alpha.map((_, s) => alpha.reduce((acc, v, j) => acc + v * model.A[j][s], 0) * model.B[s][obs[t]]);
  }
  const unscaled = alpha.reduce((x, y) => x + y, 0);
  return {
    name: "5. Long sequence (2,000 steps): no underflow",
    pass: worst < 1e-8 && Number.isFinite(a.logLik),
    detail: `scaled vs log max difference ${worst.toExponential(1)} (log-likelihood ${a.logLik.toFixed(2)}); ` +
      `unscaled forward gives P(obs) = ${unscaled} (underflow)`,
  };
}

// Live (one action at a time) forward must match the batch version exactly.
function testLive() {
  const model = handsetModel();
  const rng = makeRng(3);
  const obs = Array.from({ length: 50 }, () => Math.floor(rng() * 16));
  const live = createLiveForward(model);
  const startOk = live.current().every((v, s) => v === model.init[s]);
  const f = forwardScaled(model, obs);
  const stepsOk = obs.every((o, t) => live.step(o).every((v, s) => v === f.filtered[t][s]));
  return {
    name: "Live forward matches batch forward",
    pass: startOk && stepsOk,
    detail: "starts at the initial distribution; exact match on a 50-step sequence",
  };
}

export function runHmmTests() {
  sanityChecked = 0;
  sanityFailures = 0;
  // Test 4 runs last because it reports the sanity checks gathered by the others.
  const [t1, t2, t5, tl] = [test1(), test2(), test5(), testLive()];
  return [t1, t2, test4(), t5, tl];
}
