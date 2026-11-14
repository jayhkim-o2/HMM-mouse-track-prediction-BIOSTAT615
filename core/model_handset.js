// The hand-set HMM parameters: the owner's starting guesses (SPEC Section 7.1).
// States: 0 UNDECIDED, 1 LEAN_WEB, 2 LEAN_AI, 3 LEAN_PERSON.
// A model is { init, A, B }:
//   init[s]   = probability of starting in state s
//   A[i][j]   = probability of moving from state i to state j between actions
//   B[s][k]   = probability that state s produces action symbol k (order in config.js SYMBOLS)

import { validateModel } from "./hmm.js";

export function handsetModel() {
  const init = [0.97, 0.01, 0.01, 0.01];

  // Transitions. UNDECIDED: stay 0.85, each lean 0.05.
  // A lean: stay 0.90, back to UNDECIDED 0.04, each other lean 0.03.
  const A = [[0.85, 0.05, 0.05, 0.05]];
  for (let lean = 1; lean <= 3; lean++) {
    const row = [0.04, 0.03, 0.03, 0.03];
    row[lean] = 0.90;
    A.push(row);
  }

  // Emissions for UNDECIDED: mostly browsing actions.
  //             VIEW_ab VIEW_faq VIEW_part VIEW_con OPEN_FAQ PAUSE
  const undecided = [0.14, 0.14, 0.12, 0.08, 0.14, 0.12,
    0.03, 0.03, 0.03,   // HEAD_web, HEAD_ai, HEAD_person
    0.04, 0.04, 0.04,   // ZONE_*
    0.01, 0.01, 0.01,   // REST_*
    0.02];              // SWITCH
  const B = [undecided];

  // Emissions for LEAN_X: actions aimed at button X become much more likely.
  for (let x = 0; x < 3; x++) {
    const row = [0.03, 0.03, 0.05, 0.03, 0.04, 0.06];
    for (let k = 0; k < 3; k++) row.push(k === x ? 0.14 : 0.03); // HEAD_*
    for (let k = 0; k < 3; k++) row.push(k === x ? 0.16 : 0.04); // ZONE_*
    for (let k = 0; k < 3; k++) row.push(k === x ? 0.18 : 0.02); // REST_*
    row.push(0.10);                                              // SWITCH
    B.push(row);
  }

  const model = { init, A, B };
  validateModel(model); // throws if any row doesn't sum to 1 or has a zero
  return model;
}
