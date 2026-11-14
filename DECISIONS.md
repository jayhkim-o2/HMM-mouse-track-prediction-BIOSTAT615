# Decisions

Choices not covered by SPEC.md, one line each with the reason.

- 2026-11-14: Mouse-intent module only scores buttons while the Participate buttons are on screen, so far-away buttons do not create false HEAD_* actions while reading About.
- 2026-11-14: One script (`scripts/build-pages.sh`) assembles `_site/` for both the deploy and local preview, so local paths match the live site exactly.
- 2026-11-14: Site pages refer to assets with root-relative paths like `./site/styles.css` and `./core/hmm.js`, because `site/index.html` is published as the root page.
- 2026-11-14: Until `dashboard/package.json` exists, the deploy publishes a placeholder `/dashboard/` page, so no npm dependencies are added before step 8.
- 2026-11-14: Test logic lives in `tests/hmm_tests.js`, shared by `tests.html` and `tests/run_node.mjs`, so the browser and terminal run identical checks.
- 2026-11-14: The deploy workflow runs the Node tests first and stops if any fail, so broken math never goes live.
- 2026-11-14: `core/` and `tests/` each have a one-line `package.json` (`"type": "module"`) so Node treats their `.js` files as ES modules; browsers ignore it.
- 2026-11-14: `createLiveForward` also has `current()` (initial distribution before any action) and `reset()`, which the demo panel will need.
- 2026-11-14: `bruteForce` treats paths within a 1e-12 relative tolerance of the best as ties, so test 2 can check that Viterbi's path is one of the best paths.
- 2026-11-14: The site uses system fonts only (no web fonts), so the layout doesn't shift after load while the recorder measures positions.
- 2026-11-14: A `layout` event is also logged after every FAQ toggle, because opening a question moves every section and button below it.
- 2026-11-14: The `layout` event also stores `scrollY` at that moment, so the converter can check its client/page coordinate shift.
- 2026-11-14: A `mouse` sample is logged at every click, through a capture-phase listener, so the click position is in the log before the `choice` event.
- 2026-11-14: The desktop check runs once at page load; if it fails, the visitor has to reload after resizing, which keeps the flow simple.
- 2026-11-14: `pid` values outside `P1`–`P9` are ignored (recorded as null), so typos never create stray participant IDs.
- 2026-11-14: Persona no-repeat is tracked per `pid` in localStorage, and restarts once all personas have been used.
- 2026-11-14: Until sending exists (step 6), every finished visit shows "Download my recording" and stays in localStorage under `smip_pending_<visit_id>`.
- 2026-11-14: `core/intent.js` is the owner's demo model, not the SPEC fallback, with the demo's slider defaults (κ = 2, stay 0.98, closeness 1, τ = 150 px, 3 px minimum move) moved into `config.js`.
- 2026-11-14: Time-based rules (section dwell, pause, head sustain, rest) are deadlines that fire at their exact time, so `convertStream` and `convertBatch` agree no matter how often the stream is ticked.
- 2026-11-14: The stream has a `tick(t)` method; the site calls it about every 100 ms so a PAUSE shows up live even when no events arrive.
- 2026-11-14: Actions at exactly the choice time are dropped too (only actions strictly before the click count), so a pointer sample logged at the click can't create an action.
- 2026-11-14: Same-time actions are held back until time moves on, then released in the SPEC order; live actions can arrive up to one tick late.
- 2026-11-14: Activity that resets the pause timer = a mouse move over 5 px, a scroll, or an FAQ toggle (the raw log has no generic click event); card hovers and tab visibility don't count.
- 2026-11-14: Zones and rest are re-checked on scroll and layout events too, because a still pointer can end up over a button when the page moves under it.
- 2026-11-14: Dominant section = largest share of the viewport height (ties go to the earlier section); the sticky header isn't subtracted.
- 2026-11-14: `.gitattributes` forces LF endings on `.sh`/`.yml` files, because Windows CRLF endings make bash scripts fail.
