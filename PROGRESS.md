# Progress

Live site: https://jayhkim-o2.github.io/HMM-mouse-track-prediction-BIOSTAT615/
Repository: https://github.com/jayhkim-o2/HMM-mouse-track-prediction-BIOSTAT615

## Steps and status (checkpoint doc, Section 1)

| # | Step | Status | Note |
|---|------|--------|------|
| 1 | Repo setup, docs, GitHub Pages deploy | Working | Live URL loads; Actions deploy succeeds |
| 2 | HMM core (forward, log forward, Viterbi, brute force) + tests 1, 2, 4, 5 | Working | All 5 pass in Node and on live `tests.html` |
| 3 | Mock study site + recorder + download backup | Working | Owner's live role-play visit recorded and downloaded correctly |
| 4 | Mouse-intent module + action converter + test 7 | Working | Owner's intent model ported; 6 converter cases + stream = batch pass in Node and on live `tests.html` |
| 5 | Live demo panel (`?demo=1`) | Working | Owner ran live `?demo=1` visits; probabilities moved sensibly |
| 6 | Saving visits to Google Sheet | Working | Owner's live visit got "saved" (script replies ok only after writing rows) |
| 7 | Simulated visitors (type 1, type 2) + recovery analysis | Not started | |
| 8 | Researcher dashboard | Not started | |
| 9 | Evaluation vs baselines; learned model (EM) | Not started | After checkpoint |
| 10 | README, report, video | Not started | After checkpoint |

## Questions for the instructor (checkpoint doc, Section 2)

None.

(Only questions the owner genuinely wants the instructor's input on go here; design calls
the owner can make are recorded in DECISIONS.md instead.)

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
- 2026-11-14: Step 3. Built `site/` (index.html, styles.css, site.js, recorder.js): all
  sections, banner, notice with config placeholders, desktop check, `?rp=1` persona screen,
  shuffled cards, raw recorder (SPEC 6.1 events), thank-you overlay, localStorage backup and
  "Download my recording". Owner did a live `?rp=1&pid=P1` visit; the downloaded JSON had
  correct metadata, shuffled card order, layout after each FAQ toggle, and the choice last.
  Owner spotted a big empty gap under About: a leftover `min-height: 85vh` rule; removed.
- 2026-11-14: Step 4. `core/intent.js` (owner's cursor-intent HMM ported, demo's default
  settings) and `core/converter.js` (batch + stream, deadline-based so both agree exactly).
  Test 7 in `tests/converter_tests.js`: the 5 SPEC cases, one extra case (no HEAD while
  buttons are off screen), and stream = batch. Tested: all 12 tests pass in Node; two planted
  bugs checked (the second was missed until the extra case was added). Next: step 5 (`?demo=1`).
- 2026-11-14: Step 5. `site/demo-panel.js`: loaded only with `?demo=1`; live converter stream
  (ticked every 100 ms) feeds `createLiveForward`; draws stacked state bands over time, action
  ticks (hover for name), choice-guess bars, action list, and after the click the Viterbi
  strip with a right/wrong note. Tested: syntax check and all 12 Node tests. Owner's first
  demo visit exposed a recorder throttle bug (lost final scroll position; fixed). Owner set
  PAUSE to 3 s. Second demo visit: the probabilities moved sensibly, and the click falls
  inside the logged button position (that visit still ran the cached config v1).
- 2026-11-14: Step 6. `apps-script/Code.gs` written; owner deployed it. Setup problems along
  the way: an empty first deployment, a stray library in the project, and access limited to
  signed-in users (the URL redirected to a login page). Checked: GET from a logged-out client
  returns ok; invalid project code and non-JSON posts are rejected. Site now sends with a
  10 s timeout, keeps a localStorage backup until "ok", shows the download button on
  failure, and retries pending visits on the next load. Owner's live demo visit showed
  "Your recording was saved." Next: step 7 (type 1 sampler + recovery analysis).
  Next: step 4 (intent + converter + test 7).
