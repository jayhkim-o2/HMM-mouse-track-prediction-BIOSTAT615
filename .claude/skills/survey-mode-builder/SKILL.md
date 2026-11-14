---
name: survey-mode-builder
description: How to build, test, document and deploy the BIOSTAT 615 survey-mode intent predictor (mock study site, HMM, dashboard) in this repo. Use for any coding, testing, git, GitHub Pages, checkpoint or progress-logging work on this project.
---

# Survey-mode builder

You are the coding agent for a student's BIOSTAT 615 final project. `SPEC.md` is the plan.
The student is learning, so after each piece of work explain in 2–4 plain sentences what you
did and why, and keep code comments plain.

## Start of every session

1. Read `SPEC.md` (at least the sections relevant to the task) and `PROGRESS.md`.
2. Run `git status` and `git pull` so you start from the latest code.
3. Tell the student which step from the status table you are working on.

## How to work

- Work in small steps. Each step should end with something the student can open or run.
- Put all math and the action converter in `core/` as plain ES modules. The site, tests,
  simulators and dashboard import those same files. Never keep a second copy of the logic.
- The site (`site/`) is plain HTML/CSS/JS with no build step. Only `dashboard/` uses React + Vite.
- Every tunable number goes in `core/config.js`.
- Reuse ideas from `reference/proof_of_concept.html` (its HMM and tests already pass) and
  `reference/cursor_intent_demo.html` (the owner's intent model for `core/intent.js`).
- Check correctness, don't assume it: after changing `core/`, open/run `tests.html` and report
  pass/fail. The checkpoint needs SPEC tests 1, 2, 4, 5 and 7 green.
- To preview locally, run a static server from the repo root, e.g. `npx serve .` or
  `python -m http.server 8000`, then open the printed address. ES modules do not load from
  `file://`.
- Ask before: deleting files, rewriting history, changing `SPEC.md`, or adding a dependency.
- Never commit `data/real/` or anything with participant data. Never copy content from the real
  study site.

## Documentation duties (the course grades these)

Keep these files current; update them in the same commit as the work:

1. **`PROGRESS.md`** — the step/status table. Status is exactly one of **Working**,
   **Not working** (with one line on what goes wrong), or **Not started**. This table is pasted
   into Section 1 of the checkpoint Google Doc, so keep it to 5–10 steps, one line each.
   Below the table keep a dated **Work log**: one bullet per session (date, what changed,
   what was tested, what's next).
2. **`DECISIONS.md`** — every choice SPEC.md does not cover, one line each with a one-sentence
   reason (the spec requires this).
3. **`PROGRESS.md` → Questions for the instructor** — note anything the student is stuck on or
   unsure about (scope, method, hosting, using the agent). This feeds Section 2
   ("Feedback requested") of the checkpoint doc.
4. **`README.md`** (graded) — must cover: what the tool is and who it is for; the statistical
   method (HMM, forward algorithm in scaled/log space, Viterbi; cite Rabiner 1989 and the
   mousetrap / mouse-tracking literature); how to use it (live URL + a usage walkthrough,
   including `?demo=1` and the dashboard); how correctness was verified (the tests in SPEC
   Section 14 and their results); credits for any third-party code/data with licenses; how to
   run locally from a fresh clone; the Apps Script setup steps (SPEC Section 10); and the
   placeholders `[COURSE]`, `[OWNER]`, `[DELETION DATE]`.
5. **`AI_USAGE.md`** (the agentic-workflow lab notebook) — at the END of every session, append a
   dated entry: what the student asked for (paste or paraphrase the prompt), what you produced,
   what was wrong or had to be fixed and how it was caught, and how it was verified. Be honest
   about mistakes: the course explicitly wants at least one failure or wrong turn documented.
   Tag the strongest entries `[EPISODE]` so 3–5 can be pulled into the final write-up and video.
   Keep the top sections (Tools, Workflow, Division of labor, Verification, Reflection) up to date.
6. **`LICENSE`** — MIT, must stay in the repo.

## Git

- Keep the agent co-author line on commits; the course values history that shows the agentic
  workflow. Commit often across the semester, never one giant final commit.

- Commit after each working step with a short, clear message, then `git push`.
- Pushing to `main` is what the instructor (GitHub `hyunminkang`) sees and what deploys the site,
  so push at least once per session. The checkpoint is graded from the commit history as of
  Nov 23, 11:59 PM ET.

## Deployment (GitHub Pages)

- Add `.github/workflows/deploy.yml` that on push to `main` builds `dashboard/` (Vite `base` =
  `/HMM-mouse-track-prediction-BIOSTAT615/dashboard/`) and assembles: `site/index.html` → root
  `index.html` plus `site/` assets, `core/`, `tests.html`, `dashboard/`. Deploy with the official
  `actions/upload-pages-artifact` + `actions/deploy-pages` actions.
- The student must set **Settings → Pages → Source: GitHub Actions** once in the browser.
- After a push, check the Actions tab result and open the live site
  `https://jayhkim-o2.github.io/HMM-mouse-track-prediction-BIOSTAT615/` (and `?demo=1`).
  A blank dashboard almost always means a wrong Vite `base`.

## Checkpoint order of work (due Nov 23)

Do these in order; stop and report after each:
1. Repo skeleton + `PROGRESS.md`, `DECISIONS.md`, `README.md`, deploy workflow; push.
2. `core/config.js`, `core/model_handset.js`, `core/hmm.js` + `tests.html` (tests 1, 2, 4, 5).
3. `site/` with all sections, banner, notice, desktop check, card shuffle, recorder, download backup.
4. `core/intent.js` + `core/converter.js` (stream and batch) + converter tests (test 7).
5. `?demo=1` live panel.
6. `apps-script/Code.gs` + sending with localStorage backup; student deploys it and pastes URL
   into `config.js`.
7. Type 1 sampler in `sim/` + recovery analysis.
8. Basic dashboard: visit list and three-part chart for one visit.

If time runs short, steps 1–5 are the priority; mark the rest honestly in `PROGRESS.md`.

## After the checkpoint (final due Thu Dec 17, 3:30 PM ET, 80 points)

Graded: working deployed app (40), repo quality + README + LICENSE + real history (20),
5–10 min video (20). Remaining SPEC work: type 2 agent, baselines, metrics, evaluation, Python
cross-check, learned model, replay and summary pages.

When the student asks for the **final check**, go through this and report each item:
- Fresh-clone test: clone into a new empty folder and follow README run instructions exactly.
- The live URL, `tests.html`, `?demo=1`, and `/dashboard/` all load (remind the student to also
  check in an incognito window).
- README covers what / why / how to use / how verified / credits; LICENSE present.
- No private data, credentials, API keys, or `data/real/` anywhere in the repo or its history
  (search the history, e.g. `git log --all -p` for "data/real" and key-like strings).
- AI_USAGE.md has 3–5 concrete episodes including at least one failure.
- Help draft a video outline: problem (~1 min), live demo of the deployed site with `?demo=1`
  and the dashboard (~3 min), agentic workflow with one success and one caught failure plus a
  short clip of a Claude Code session (~2–3 min), limitations and lessons (~1 min).

Canvas needs three links: repo URL, video URL, deployed URL.
