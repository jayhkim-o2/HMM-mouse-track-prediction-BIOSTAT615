# AI usage: how this project was built with agents

## Tools
- Planning and grilling session: Claude Opus 5.5, chat in claude.ai (course prompt template).
- Prototypes (proof-of-concept page, mouse-intent demo): Claude Opus 5.5 in claude.ai.
- Building the project: Claude Code with Claude Opus 5.5, run in this repo on Windows.

## Workflow
- `SPEC.md` (from the grilling session) is the brief; `CLAUDE.md` and the project skill
  `.claude/skills/survey-mode-builder` tell the agent how to work, test, document and deploy.
- Tasks are given one checkpoint step at a time; each step is checked in the browser
  (`tests.html`, the live site, `?demo=1`) before moving on.

## Division of labor
- Owner: writes the spec and makes the decisions, does browser setup (GitHub Pages, Apps Script), tests by hand.
- Agent: writes code, scripts and docs one step at a time, and runs local checks.

## Verification
- `tests.html` (browser) and `node tests/run_node.mjs` (terminal, and on every deploy) run the
  same SPEC tests: hand-worked example, brute force on 500 random models, sanity/validation,
  2,000-step scaled-vs-log agreement, live-vs-batch.
- The tests were checked by planting a bug and confirming they fail.
- Converter (test 7): hand-made raw logs with exact expected actions, plus stream = batch.
- Still to come: Python cross-check (test 3).

## Reflection
(write at the end)

## Lab notebook (one entry per session, newest last)

- 2026-10/11 (claude.ai): Explored project ideas; built a cursor-intent HMM demo.
  [EPISODE] First version assumed people aim at box centers, so a diagonal toward B was read as
  A. Caught by testing it myself; fixed by aiming at the radio buttons. A second trial then
  failed because I clicked the box, not the circle; fixed by scoring the whole box plus a
  closeness term. Lesson: test the agent's model on your own behavior.
- 2026-11-14: Proof-of-concept page with the full 4-state HMM; in-browser checks (hand-worked
  example, brute force on 500 random models, 2,000-step underflow test) all pass. Set up repo
  folder, CLAUDE.md and agent skill.
- 2026-11-14 (Claude Code): Prompt: "Use the survey-mode-builder skill. Read SPEC.md, then do
  checkpoint step 1: repo skeleton, README, and the GitHub Pages deploy workflow. Update
  PROGRESS.md and AI_USAGE.md, then commit and push." Produced: SPEC Sec. 4 folders with
  placeholders, README, a shared `scripts/build-pages.sh` (used by CI and local preview), and
  `.github/workflows/deploy.yml`. Verified: build script output checked locally; owner enabled
  Pages and confirmed the live page loads and the Actions run succeeds.
  [EPISODE] Failure: the agent updated the docs with a `python` script, but on this Windows
  machine `python` was the Microsoft Store stub, which printed "Python" and did nothing. The
  agent missed this and reported the docs as updated, so the first commit shipped with
  PROGRESS/DECISIONS/AI_USAGE unchanged. Caught when the next edit showed the step 1 row still
  "Not started". Fixed by redoing the edits with the editor tool and checking the file
  contents. Lesson: after any edit made by a script, check the file itself, not just that the
  command ran.
- 2026-11-14 (Claude Code): Prompt: "go ahead with step 2. But remind me how the HMM works."
  Agent explained the HMM in plain terms, then ported the prototype's math into `core/hmm.js`
  with three additions the prototype lacked: forward returns scale factors, test 1 checks the
  un-normalized alphas, and test 2 checks that Viterbi's path is one of the brute-force best
  paths (not just that the probability matches).
  [EPISODE] Verification of the tests themselves: the agent swapped A[j][s] to A[s][j] in the
  forward step on purpose. Tests 1, 2 and 5 failed as they should; test 4 and live-vs-batch
  still passed, which is expected (the broken version still gives valid probabilities, and
  live and batch share the same broken step). Reverted and confirmed all green. Shows the
  tests can catch a realistic indexing bug.
  Live check: owner first saw the old placeholder (browser cache); after a hard refresh the
  deployed `tests.html` showed all 5 PASS with the same numbers as Node.
- 2026-11-14 (Claude Code): Prompt: "Go ahead with step 3." Agent built `site/` from the
  prototype's layout and handlers, with SPEC fixes: the desktop check now refuses instead of
  only warning, no web fonts (stable layout), recorder keeps only the raw log (actions belong
  in `core/`, step 4), layout re-logged after FAQ toggles.
  Wrong turn: the agent wrote an automated headless-Edge click-through test and tried to run
  it on the owner's computer, which needed the command sandbox turned off. The owner declined:
  they only care that it runs from GitHub. The agent then checked the deployed files instead;
  the owner then did a live role-play visit and shared the downloaded JSON, which the agent
  checked field by field (metadata, card order, layout after FAQ toggles, choice last).
  [EPISODE] Caught by the owner, not the agent: a large empty gap under About. The agent had
  carried over the prototype's `#about { min-height: 85vh }`; on the owner's 1209 px-tall
  window that stretched four paragraphs to ~1030 px. Fixed by removing the rule. (Lesson for
  the click-through above:) ask how the owner wants
  something verified before setting up heavy local tooling.
- 2026-11-14 (Claude Code): Prompt: "Go ahead" (step 4). Agent read the owner's
  `cursor_intent_demo.html`, explained it as a small HMM over "which button is aimed at", and
  ported it into `core/intent.js` with the demo's slider defaults. Wrote `core/converter.js`
  around exact-time deadlines so the live stream and the batch version can't disagree.
  [EPISODE] Tests that passed too easily: all converter tests passed on the first run, so the
  agent planted two bugs. Letting actions through at the click time was caught. Leaving the
  intent module on while the buttons are off screen was NOT caught, because no test covered
  that DECISIONS.md rule. Added a case (straight movement toward a button while reading
  About gives no HEAD); the planted bug then failed it, and the real code passed. Lesson: a
  green test suite only means something once you've seen it go red.
- 2026-11-14 (Claude Code): Prompt: "Go ahead" (step 5). Agent added an event hook to the
  recorder and `site/demo-panel.js`, which is loaded only with `?demo=1`. It reuses the
  prototype's panel design but feeds it from the shared `core/` converter and live forward,
  so there's no second copy of the logic. Caught before shipping: a 340 px panel would have
  covered the right card at 1440 px wide; narrowed to 300 px. Not verified in a browser by the
  agent (the owner prefers checking on the live site); owner check pending.
- 2026-11-14 (Claude Code): Owner shared a downloaded `?demo=1` visit. Reading the log, the
  agent noticed the click was at client y = 720 but the logged scroll position put the Web
  button at y = 801-854, which is impossible.
  [EPISODE] Bug found from real data: the recorder's throttle dropped any scroll event within
  100 ms of the previous one, including the last one when the page came to rest. So the logged
  scroll position (1099) was about 80 px short of the real one (about 1180, the bottom of the
  page). The same flaw hit mouse samples. None of the tests could catch it, because they start
  from hand-made logs and never exercise the recorder. Fixed with a throttle that keeps a
  trailing sample, plus a scroll sample at every click. Also: the visit started at
  scrollY 1104 because the browser restored the old position; every visit now starts at the
  top. Owner also asked mid-step to change PAUSE from 10 s to 3 s; the agent pointed out the
  side effects (cap is now 9 s; the hand-set emissions assumed 10 s pauses), changed the
  config, and rewrote the SPEC 25 s test to compute its expected count from the config.
- 2026-11-14 (Claude Code): Owner shared a second demo visit and asked whether earlier states
  matter. Agent explained that the forward algorithm carries the filtered belief forward
  through the transitions (0.90 stay is the model's memory), the Markov property (only the
  current vector is kept), and that Viterbi also uses later evidence. Checked the log: the
  click falls inside the logged Person button position. Noticed `config_version: 1`, meaning
  the browser had cached the pre-change site; owner reminded to hard refresh.
