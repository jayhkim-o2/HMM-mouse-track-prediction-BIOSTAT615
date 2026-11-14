// HMM algorithms (SPEC Section 7.3). Plain functions, no framework.
// A model is { init, A, B } (see model_handset.js). `symbols` is an array of action indices.

import { CONFIG } from "./config.js";

const sum = (arr) => arr.reduce((a, b) => a + b, 0);

// Check a model before using it: every row sums to 1 (within 1e-9) and every entry is > 0.
// Throws an Error explaining what's wrong; returns true if the model is fine.
export function validateModel(model) {
  const checkRow = (row, name) => {
    if (!Array.isArray(row) || row.length === 0) throw new Error(`Invalid model: ${name} is empty`);
    if (!row.every((v) => Number.isFinite(v) && v > 0)) throw new Error(`Invalid model: ${name} has a zero, negative or non-number entry`);
    if (Math.abs(sum(row) - 1) > 1e-9) throw new Error(`Invalid model: ${name} sums to ${sum(row)}, not 1`);
  };
  const n = model.init.length;
  checkRow(model.init, "init");
  if (model.A.length !== n || model.B.length !== n) throw new Error("Invalid model: A and B need one row per state");
  model.A.forEach((row, i) => {
    if (row.length !== n) throw new Error(`Invalid model: A[${i}] has the wrong length`);
    checkRow(row, `A[${i}]`);
  });
  const m = model.B[0].length;
  model.B.forEach((row, i) => {
    if (row.length !== m) throw new Error(`Invalid model: B[${i}] has the wrong length`);
    checkRow(row, `B[${i}]`);
  });
  return true;
}

// Log-sum-exp: computes log(sum(exp(values))) without underflow,
// by pulling out the largest value first.
export function logSumExp(values) {
  const mx = Math.max(...values);
  if (mx === -Infinity) return -Infinity;
  let s = 0;
  for (const v of values) s += Math.exp(v - mx);
  return mx + Math.log(s);
}

// One forward step. `prev` is the previous filtered vector, or null for the first action.
// Returns the un-normalized forward values for this step.
//   predict: spread yesterday's probabilities through the transitions
//   weigh:   multiply by how likely each state was to produce this action
function forwardStep(model, prev, symbol) {
  const n = model.init.length;
  const alpha = new Array(n);
  for (let s = 0; s < n; s++) {
    let pred = 0;
    if (prev === null) pred = model.init[s];
    else for (let j = 0; j < n; j++) pred += prev[j] * model.A[j][s];
    alpha[s] = pred * model.B[s][symbol];
  }
  return alpha;
}

// Forward algorithm with rescaling at every step.
// Returns:
//   filtered[t] = P(state at step t | actions 1..t), each sums to 1
//   scales[t]   = the number we divided by at step t (= P(action t | actions before it))
//   logLik      = log P(all actions) = sum of log(scales)
export function forwardScaled(model, symbols) {
  const filtered = [];
  const scales = [];
  let logLik = 0;
  let prev = null;
  for (const symbol of symbols) {
    const alpha = forwardStep(model, prev, symbol);
    const c = sum(alpha);
    scales.push(c);
    logLik += Math.log(c);
    prev = alpha.map((v) => v / c);
    filtered.push(prev);
  }
  return { filtered, scales, logLik };
}

// The same forward algorithm done with logarithms instead of rescaling.
// Used to cross-check forwardScaled. Same outputs except scales.
export function forwardLog(model, symbols) {
  const n = model.init.length;
  const filtered = [];
  let logAlpha = null;
  for (const symbol of symbols) {
    const next = new Array(n);
    for (let s = 0; s < n; s++) {
      const logPred = logAlpha === null
        ? Math.log(model.init[s])
        : logSumExp(logAlpha.map((v, j) => v + Math.log(model.A[j][s])));
      next[s] = logPred + Math.log(model.B[s][symbol]);
    }
    logAlpha = next;
    const z = logSumExp(logAlpha);
    filtered.push(logAlpha.map((v) => Math.exp(v - z)));
  }
  return { filtered, logLik: logAlpha === null ? 0 : logSumExp(logAlpha) };
}

// Viterbi in log space: the single most likely sequence of hidden states.
// Ties go to the lower state index, so the answer is always the same.
// Returns { path, logProb }.
export function viterbi(model, symbols) {
  const n = model.init.length;
  if (symbols.length === 0) return { path: [], logProb: 0 };

  // delta[s] = log-probability of the best path that ends in state s at the current step
  let delta = model.init.map((p, s) => Math.log(p) + Math.log(model.B[s][symbols[0]]));
  const backPointers = []; // backPointers[t][s] = best previous state for state s at step t+1

  for (let t = 1; t < symbols.length; t++) {
    const next = new Array(n);
    const bp = new Array(n);
    for (let s = 0; s < n; s++) {
      let best = -Infinity;
      let bestPrev = 0;
      for (let j = 0; j < n; j++) {
        const v = delta[j] + Math.log(model.A[j][s]);
        if (v > best) { best = v; bestPrev = j; } // strict ">" keeps the lower index on ties
      }
      next[s] = best + Math.log(model.B[s][symbols[t]]);
      bp[s] = bestPrev;
    }
    delta = next;
    backPointers.push(bp);
  }

  // Pick the best final state, then walk the back pointers to rebuild the path.
  let s = 0;
  for (let i = 1; i < n; i++) if (delta[i] > delta[s]) s = i;
  const logProb = delta[s];
  const path = [s];
  for (let t = backPointers.length - 1; t >= 0; t--) {
    s = backPointers[t][s];
    path.unshift(s);
  }
  return { path, logProb };
}

// List every possible state path and add them up. Only for tests with <= 5 steps
// (4 states, 5 steps = 1,024 paths). Returns the total probability, the final-step
// filtered probabilities, the best path probability and every path that achieves it.
export function bruteForce(model, symbols) {
  const n = model.init.length;
  const T = symbols.length;
  if (T > 5) throw new Error("bruteForce is only for sequences of 5 steps or fewer");
  let total = 0;
  let best = -1;
  let bestPaths = [];
  const lastMarginal = new Array(n).fill(0);
  const path = new Array(T);

  function visit(t, p) {
    if (t === T) {
      total += p;
      lastMarginal[path[T - 1]] += p;
      // Paths within a tiny relative tolerance of the best are counted as ties.
      if (p > best * (1 + 1e-12)) { best = p; bestPaths = [path.slice()]; }
      else if (p >= best * (1 - 1e-12)) bestPaths.push(path.slice());
      return;
    }
    for (let s = 0; s < n; s++) {
      path[t] = s;
      const move = t === 0 ? model.init[s] : model.A[path[t - 1]][s];
      visit(t + 1, p * move * model.B[s][symbols[t]]);
    }
  }
  if (T > 0) visit(0, 1);
  return { total, lastFiltered: lastMarginal.map((v) => v / total), best, bestPaths };
}

// Live version for the site: call step(symbol) after each action.
// Before the first action, current() is the initial distribution.
// Uses the same forwardStep as forwardScaled, so results match exactly.
export function createLiveForward(model) {
  validateModel(model);
  let prev = null;
  return {
    step(symbol) {
      const alpha = forwardStep(model, prev, symbol);
      const c = sum(alpha);
      prev = alpha.map((v) => v / c);
      return prev;
    },
    current() {
      return prev === null ? model.init.slice() : prev;
    },
    reset() { prev = null; },
  };
}

// Turn filtered state probabilities into the displayed choice guess (SPEC Section 7.2):
// P(choice = k) = P(LEAN_k) + P(UNDECIDED) * base_k, for k = web, ai, person.
export function choiceGuess(filtered, base = CONFIG.BASE_CHOICE) {
  return base.map((b, k) => filtered[k + 1] + filtered[0] * b);
}
