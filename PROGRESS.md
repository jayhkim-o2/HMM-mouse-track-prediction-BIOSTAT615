# Progress

Live site: https://jayhkim-o2.github.io/HMM-mouse-track-prediction-BIOSTAT615/
Repository: https://github.com/jayhkim-o2/HMM-mouse-track-prediction-BIOSTAT615

## Steps and status (checkpoint doc, Section 1)

| # | Step | Status | Note |
|---|------|--------|------|
| 1 | Repo setup, docs, GitHub Pages deploy | Working | Live URL loads; Actions deploy succeeds |
| 2 | HMM core (forward, log forward, Viterbi, brute force) + tests 1, 2, 4, 5 | Working | All 5 pass in Node; browser `tests.html` to confirm on live site |
| 3 | Mock study site + recorder + download backup | Not started | Working in prototype |
| 4 | Mouse-intent module + action converter + test 7 | Not started | |
| 5 | Live demo panel (`?demo=1`) | Not started | |
| 6 | Saving visits to Google Sheet | Not started | |
| 7 | Simulated visitors (type 1, type 2) + recovery analysis | Not started | |
| 8 | Researcher dashboard | Not started | |
| 9 | Evaluation vs baselines; learned model (EM) | Not started | After checkpoint |
| 10 | README, report, video | Not started | After checkpoint |

## Questions for the instructor (checkpoint doc, Section 2)

- Is a placeholder `/dashboard/` page acceptable until step 8, or should the React build exist from the start?

## Work log

- 2026-11-14: Project folder set up with SPEC.md, CLAUDE.md, agent skill and prototypes.
- 2026-11-14: Step 1. Added folder skeleton (SPEC Sec. 4), README, `scripts/build-pages.sh` and
  `.github/workflows/deploy.yml`. Tested: build script produces the expected `_site/` locally;
  owner set Pages source to GitHub Actions, the deploy ran and the live URL loads. Fixed doc
  updates that had silently not been applied (see AI_USAGE). Next: step 2 (HMM core + tests).
- 2026-11-14: Step 2. Added `core/config.js`, `core/model_handset.js`, `core/hmm.js`, shared
  tests in `tests/hmm_tests.js`, browser page `tests.html`, Node runner `tests/run_node.mjs`
  (also run by the deploy workflow). Tested: tests 1, 2, 4, 5 and live-vs-batch all pass in
  Node; a deliberately broken forward step made tests 1, 2, 5 fail, then was reverted.
  Next: step 3 (study site).
