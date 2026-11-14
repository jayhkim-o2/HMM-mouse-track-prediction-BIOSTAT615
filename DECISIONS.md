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
- 2026-11-14: `.gitattributes` forces LF endings on `.sh`/`.yml` files, because Windows CRLF endings make bash scripts fail.
