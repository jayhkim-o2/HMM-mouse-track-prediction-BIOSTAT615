// Mouse-intent module (SPEC Section 6.3): which button is the pointer heading for?
// Ported from the owner's demo (reference/cursor_intent_demo.html), which is itself a
// small HMM: the hidden state is "the button being aimed at".
//
// For each mouse movement (at least INTENT_MIN_MOVE_PX long), each button gets a score:
//   KAPPA * (best cosine between the movement direction and the direction to any of
//            15 points spread over the button's box)
//   - CLOSENESS * (distance from the pointer to the button's box) / TAU
// The score is used as a log-emission. Between movements, the aim stays the same with
// probability INTENT_STAY, otherwise it moves to one of the other buttons.
// Aiming at the whole box (not just the center) was the owner's fix after testing it on
// themselves: people aim at whatever part of a box is closest, not its center.

import { CONFIG, OPTIONS } from "./config.js";
import { logSumExp } from "./hmm.js";

// Distance from point (x, y) to a rectangle {left, top, right, bottom}; 0 if inside.
export function rectDistance(x, y, r) {
  const dx = Math.max(r.left - x, 0, x - r.right);
  const dy = Math.max(r.top - y, 0, y - r.bottom);
  return Math.hypot(dx, dy);
}

// Points on the button's box that the movement might be aimed at.
const FX = [0, 0.25, 0.5, 0.75, 1];
const FY = [0, 0.5, 1];

// createIntent(config) -> { update(sample, buttonRectsClient) -> {web, ai, person}, reset() }
//   sample            = { x, y } pointer position in client coordinates
//   buttonRectsClient = { web: {left, top, right, bottom}, ai: ..., person: ... }, or null
//                       when the buttons aren't on screen (then intent resets to even odds)
export function createIntent(config = CONFIG) {
  const K = OPTIONS.length;
  const logStay = Math.log(config.INTENT_STAY);
  const logMove = Math.log((1 - config.INTENT_STAY) / (K - 1));
  let logBelief;   // log-probabilities of aiming at each button
  let last;        // previous pointer position used for a movement

  const asProbs = () => {
    const p = logBelief.map(Math.exp);
    return Object.fromEntries(OPTIONS.map((o, k) => [o, p[k]]));
  };

  function reset() {
    logBelief = new Array(K).fill(Math.log(1 / K));
    last = null;
  }
  reset();

  function update(sample, rects) {
    if (!rects) {                 // buttons off screen: forget, start fresh next time
      reset();
      last = { x: sample.x, y: sample.y };
      return asProbs();
    }
    if (!last) { last = { x: sample.x, y: sample.y }; return asProbs(); }

    const dx = sample.x - last.x;
    const dy = sample.y - last.y;
    const d = Math.hypot(dx, dy);
    if (d < config.INTENT_MIN_MOVE_PX) return asProbs();   // too small to have a direction

    // Score each button (the log-emission for "aiming at this button").
    const scores = OPTIONS.map((o) => {
      const r = rects[o];
      let bestCos = -1;
      for (const fx of FX) {
        for (const fy of FY) {
          const vx = r.left + fx * (r.right - r.left) - last.x;
          const vy = r.top + fy * (r.bottom - r.top) - last.y;
          const n = Math.hypot(vx, vy) || 1;
          bestCos = Math.max(bestCos, (dx * vx + dy * vy) / (d * n));
        }
      }
      return config.INTENT_KAPPA * bestCos
        - config.INTENT_CLOSENESS * rectDistance(sample.x, sample.y, r) / config.INTENT_TAU;
    });

    // One forward step in log space: predict (stay or move), then weigh by the score.
    const next = OPTIONS.map((_, s) =>
      logSumExp(logBelief.map((a, j) => a + (j === s ? logStay : logMove))) + scores[s]);
    const z = logSumExp(next);
    logBelief = next.map((v) => v - z);
    last = { x: sample.x, y: sample.y };
    return asProbs();
  }

  return { update, reset };
}
