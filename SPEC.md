# SPEC.md: Survey-Mode Intent Predictor

**Audience:** the AI coding agent building this project.
**Owner:** one graduate student (solo), final project for a graduate statistical computing course, Track A (interactive web app).
**Checkpoint:** November 23, 2026. **Final deadline:** December 17, 2026.

The owner is still learning this material. Comment the code in plain language. When you make a choice this spec does not cover, write it down in `DECISIONS.md` with one sentence explaining why.

---

## 1. What we are building

1. **A mock study website** ("the site"). It is one long page laid out like a typical university survey-study site (structure inspired by https://smart.isr.umich.edu/). It uses a made-up study name, its own colors, and placeholder text. A visitor ends the visit by choosing one of three survey modes: **Web survey**, **AI phone interview**, or **Phone interview with a person**. No real survey happens.
2. **A recorder.** It logs what the visitor does, turns that into a short sequence of *actions*, and sends the visit to a Google Sheet.
3. **A predictor.** A 4-state hidden Markov model (HMM). The forward algorithm gives a live estimate after every action. The Viterbi algorithm gives the best hindsight path after the visit.
4. **Fake-visitor generators** for testing correctness and for evaluation.
5. **A researcher dashboard.** It shows each visit's actions over time, how the estimate changed, and how accurate each method was overall.
6. **Tests** in the browser, plus an independent Python version of the math for cross-checking.

## 2. Hard constraints

- **Do not copy anything from the real site.** No text, images, logos, code, phone numbers, or emails. Rebuild a similar *structure* only.
- A fixed banner at the top of every page of the site: **"This is a fake study created for a class project. No real survey will be conducted."**
- **The site is plain HTML, CSS, and JavaScript.** No framework and no build step. Only the dashboard uses React (with Vite).
- **The core math and action converter are framework-free JavaScript ES modules in `core/`.** The site, dashboard, simulators, and tests all import these same files. There must never be a second JS copy of this logic.
- **Desktop only.** The site needs a fine pointer (`matchMedia('(pointer: fine)')`) and a viewport of at least 1024×650. Otherwise, show a polite "please use a laptop or desktop" message and do not record.
- **No personal information is collected.** No names, emails, or typed free text. Visits use random IDs. Participants may enter a short code (`P1`–`P5`) that the owner gives them.
- **Real data is never committed to the public repo.** `data/real/` is listed in `.gitignore`.
- The site never calls itself a "research study." It is a "class project."

## 3. Glossary (plain language)

| Term | Meaning |
|---|---|
| Hidden state | What the visitor is leaning toward at a moment. We can't see it, only guess it. |
| Action / observation symbol | One item from a fixed list of 16 action types (Section 6). |
| Emission probability | How likely an action is, given the hidden state. |
| Transition probability | How likely the visitor is to move from one state to another between actions. |
| Forward algorithm | Computes the live estimate: state probabilities after each action, using only the past. |
| Viterbi | After the visit, finds the single most likely sequence of states. |
| Underflow | Products of many small probabilities round to 0. Avoid it with rescaling or log space. |
| Brier score | Squared error between predicted probabilities and the true outcome (one-hot). Lower is better. |

## 4. Repository layout and deployment

```
/site/            plain study site (index.html, styles.css, site.js, recorder.js, demo-panel.js)
/core/            framework-free ES modules
    hmm.js          forward (scaled), forward (log-space), viterbi, brute-force reference
    converter.js    raw log -> action sequence (streaming + batch, identical results)
    intent.js       owner's mouse-intent demo, ported (per-button probabilities)
    baselines.js    random, majority, closest-button, intent-only
    metrics.js      accuracy and Brier at offsets before the click
    config.js       every tunable number (Section 13)
    model_handset.js  hand-set HMM parameters (Section 7)
/dashboard/       React + Vite researcher page
/sim/             Node scripts: HMM sampler, scripted mouse agent, evaluation harness
/python/          independent Python HMM, comparison script, Sheet-CSV -> JSON exporter
/tests.html       browser test page (imports /core)
/apps-script/     Code.gs for the Google Sheet receiver (deployed manually by the owner)
/data/real/       gitignored
DECISIONS.md
```

**Deployment:** a GitHub Action, triggered on push to `main`, builds `dashboard/` with Vite and assembles the published output like this:

- `/` is the study site (`site/index.html` becomes the root `index.html`)
- `/core/`, `/tests.html`, and `/dashboard/`

Set the Vite `base` to `/<repo-name>/dashboard/`. A wrong base is the usual cause of a blank page on GitHub Pages. The site imports core with relative paths (for example `./core/hmm.js`), so make sure these paths work both locally (with a simple static server) and on Pages.

## 5. The study site

### 5.1 Visit flow

1. **Load.** Run the desktop check. If it fails, show the message and stop.
2. **Notice screen.** The visitor must click **"I agree, start"** before recording begins. The text:
   > This is a class project for [COURSE], not real research and not a real study. While you browse, this page records your scrolling, clicks, mouse movement and timing. It does not record anything you type, your name, or your email. Taking part is voluntary; you can close this tab at any time, and unfinished visits are thrown away. Only [OWNER] and the course instructor will see the data, and it will be deleted after [DELETION DATE].

   Leave `[COURSE]`, `[OWNER]`, and `[DELETION DATE]` as placeholders in `config.js`, and list them in the README.
3. **Optional role-play screen.** Show it only when the URL has `?rp=1`. It displays a persona (Section 9.3) and asks the visitor to choose as that person would. It also shows the visit number when `pid` is present.
4. **Browse.** Recording runs. Time zero is the moment "I agree" is clicked.
5. **Choice.** The visitor clicks one of the three mode buttons. A thank-you overlay appears ("Thanks! This is a class project, so no survey will follow."). The recording is finalized and sent (Section 10).
6. **Abandon.** If the tab is closed before a choice, nothing is sent.

**URL parameters:**

- `pid=P1..P9`: participant code
- `rp=1`: role-play mode
- `demo=1`: shows the live panel; visits are marked `mode: "demo"` and excluded from all analysis

Every visit records `mode` as one of `natural`, `roleplay`, or `demo`.

### 5.2 Sections (one long page, top to bottom)

- **Header:** the fake study name (placeholder: "Lakeshore Daily Life Study"), a simple text wordmark (no image logo), and in-page navigation links to each section.
- **About:** 3–4 placeholder paragraphs about the fake study.
- **FAQ:** 9–12 collapsible questions on general study topics: what the study is, who can join, how long it takes, privacy, stopping early, thank-you gift (placeholder). **The questions are not about the three modes.** This is deliberate. Each question has a stable ID (`faq-01`, …).
- **Participate:** a short neutral intro, then **three option cards in one horizontal row**. Each card has a title, a one-sentence neutral description of equal length, and a button. Button IDs: `opt-web`, `opt-ai`, `opt-person`. The person option card says "scheduled for a later time."
  - **Randomize the left-to-right order of the cards on each visit, and record the order.** This prevents "the left button gets picked most" from affecting results. If the owner disagrees, the order can be fixed with a config flag.
- **Contact:** placeholder text only. No real phone numbers or emails (use `555-0100`-style fake numbers or plain "[contact info]").
- **Footer:** repeat the fake-study disclaimer.

Visual style: clean and institutional, with its own palette (not the real site's colors). Use readable type and no external images, and keep it fast. All layout should stay stable after load, because the recorder measures element positions.

## 6. Recording and the action converter

### 6.1 Raw log (saved in full for every visit)

All times are in milliseconds since "I agree," taken from `performance.now()`. The recorder is plain JS. It pushes events into an array and must not do heavy work on each event.

| Event | Fields | Rate |
|---|---|---|
| `mouse` | t, clientX, clientY | throttled to ≤10 Hz; always log the sample at any click |
| `scroll` | t, scrollY | throttled to ≤10 Hz |
| `layout` | t, viewport w/h, page-coordinate rects of each section and the three buttons and cards, card order | at start and after every resize |
| `faq` | t, faq_id, open (bool) | on toggle |
| `card_hover` | t, option, enter/leave | on change |
| `visibility` | t, hidden (bool) | on change |
| `choice` | t, option | once, ends the visit |

The visit metadata includes: `visit_id` (random UUID), `schema_version`, `project_code` (a constant from config), `mode`, `pid`, `persona_id`, `card_order`, `user_agent`, and `started_at` (ISO date).

### 6.2 The 16 action types

| # | Symbol | Rule |
|---|---|---|
| 0 | `VIEW_ABOUT` | About is the section covering the largest share of the viewport, continuously for ≥2 s. Emit once each time it becomes dominant. |
| 1 | `VIEW_FAQ` | same rule, FAQ |
| 2 | `VIEW_PARTICIPATE` | same rule, Participate |
| 3 | `VIEW_CONTACT` | same rule, Contact |
| 4 | `OPEN_FAQ` | any FAQ question opened (which one is kept in the raw log only) |
| 5 | `PAUSE` | no mouse movement > 5 px, no scroll, no click for 10 s. Emit again for each further 10 s, max 3 per pause episode. |
| 6–8 | `HEAD_WEB`, `HEAD_AI`, `HEAD_PERSON` | the intent module's probability for that button is > 0.6, sustained for 500 ms. Re-emit only when the leading button changes. |
| 9–11 | `ZONE_WEB`, `ZONE_AI`, `ZONE_PERSON` | the pointer comes within 150 px of the button's rectangle (distance 0 if inside). Zones can overlap, so assign the pointer to the nearest button. Emit once per entry; to count as leaving, the pointer must go beyond 170 px (prevents flicker). |
| 12–14 | `REST_WEB`, `REST_AI`, `REST_PERSON` | the pointer stays inside the button's rectangle for ≥500 ms. Once per entry. |
| 15 | `SWITCH` | a zone entry for option *j* when the most recent zone entered was a different option *i*. Emit right after the `ZONE_j`. |

The `choice` click is **never** an action. It is the label. The converter must not emit anything from the choice event, and must not emit anything after it.

**Converter requirements:**

- The converter is a pure function of the raw log. It has two forms that give identical results: `convertStream` (feed one event at a time; used live on the site) and `convertBatch(rawLog)` (used by the dashboard, simulators, and tests). Each output action is `{t, symbol, detail}`.
- Distances are computed in client coordinates, using the layout rects shifted by the current `scrollY`.
- When several actions fall at the same `t`, use a fixed order: views, FAQ, pause, head, zone, switch, rest.

### 6.3 The intent module (`core/intent.js`)

The owner has a working demo that outputs a probability for each button from mouse movement. Port it into this interface:

```js
// Called with each mouse sample. Returns {web, ai, person} summing to 1.
createIntent(config) -> { update(sample, buttonRectsClient) -> probs, reset() }
```

If the demo can't be adapted in time, implement a temporary fallback: a softmax of (−distance/τ + κ·cos(angle between the mouse's direction of movement and the direction to the button)). Mark the fallback clearly in `DECISIONS.md`, and leave the owner's version as the intended one. The same module powers both the `HEAD_*` actions and the "intent-only" baseline.

## 7. The HMM

**States:** `0 = UNDECIDED`, `1 = LEAN_WEB`, `2 = LEAN_AI`, `3 = LEAN_PERSON`.
**Time steps:** one step per action (not per clock tick). `PAUSE` actions represent time passing.

### 7.1 Hand-set parameters (`core/model_handset.js`)

These are the owner's starting guesses. Every row must sum to 1, and a test checks this.

- **Initial:** `[0.97, 0.01, 0.01, 0.01]`
- **Transitions:**
  - From `UNDECIDED`: stay 0.85, to each lean 0.05.
  - From a lean: stay 0.90, back to `UNDECIDED` 0.04, to each other lean 0.03.
- **Emissions for `UNDECIDED`:**

| Symbol | Probability |
|---|---|
| `VIEW_ABOUT` | 0.14 |
| `VIEW_FAQ` | 0.14 |
| `VIEW_PARTICIPATE` | 0.12 |
| `VIEW_CONTACT` | 0.08 |
| `OPEN_FAQ` | 0.14 |
| `PAUSE` | 0.12 |
| each `HEAD_*` | 0.03 |
| each `ZONE_*` | 0.04 |
| each `REST_*` | 0.01 |
| `SWITCH` | 0.02 |

- **Emissions for `LEAN_X`** (X = its own method; "other" = the two other methods):

| Symbol | Probability |
|---|---|
| `VIEW_ABOUT` | 0.03 |
| `VIEW_FAQ` | 0.03 |
| `VIEW_PARTICIPATE` | 0.05 |
| `VIEW_CONTACT` | 0.03 |
| `OPEN_FAQ` | 0.04 |
| `PAUSE` | 0.06 |
| `HEAD_X` | 0.14 |
| each other `HEAD_*` | 0.03 |
| `ZONE_X` | 0.16 |
| each other `ZONE_*` | 0.04 |
| `REST_X` | 0.18 |
| each other `REST_*` | 0.02 |
| `SWITCH` | 0.10 |

### 7.2 From states to the displayed choice guess

`P(choice = k) = P(LEAN_k) + P(UNDECIDED) · base_k`, where `base` is `[1/3, 1/3, 1/3]` for now. It's a config value that can later be set to observed choice frequencies. This is what the "60% web / 30% AI / 10% person" label shows.

### 7.3 Algorithms (`core/hmm.js`)

- `forwardScaled(model, symbols)` returns, for each step, the filtered state probabilities, the scale factors, and the log-likelihood. It normalizes at every step.
- `forwardLog(model, symbols)` is the same algorithm in log space, using log-sum-exp. It's used to cross-check the scaled version.
- `viterbi(model, symbols)` works in log space and returns the best path and its log-probability. Ties go to the lower state index (deterministic).
- `bruteForce(model, symbols)` lists every possible path. It is used only in tests, with ≤5 steps.
- `createLiveForward(model)` is an incremental version for the site: `step(symbol) -> filtered probabilities`. It must match `forwardScaled` exactly.
- Before the first action, the estimate equals the initial distribution.
- No zeros anywhere. Validate the model on load: rows sum to 1 (within 1e-9), all entries > 0.

### 7.4 Learned parameters (after the checkpoint)

The owner calls this "option C." Keep the hand-set *structure*: start in `UNDECIDED`, same allowed transitions. Then fit the emission probabilities, and optionally the transition values, by EM (expectation-maximization) on training visits. The final step is constrained to the state matching the visitor's actual choice. Add smoothing (pseudocount α = 1, configurable). Evaluate the learned model leave-one-person-out on real visits, and on separate seeds for simulated visits. Save the results as `model_learned.json`, and compare them with the hand-set model in the dashboard.

## 8. Evaluation

### 8.1 Methods compared

1. **Random:** always 1/3 each.
2. **Majority:** always predicts the most frequent choice in the training data, with probabilities equal to the training frequencies.
3. **Closest button:** probabilities are a softmax of (−distance to each button rectangle / τ). The value of τ is tuned on a tuning set, never on test data.
4. **Intent-only:** the intent module's probabilities, on their own.
5. **HMM (hand-set)**, and later **HMM (learned)**: the choice guess from Section 7.2.

### 8.2 When and how to score

- **Scoring times:** score every method at **10, 5, 3, 2, and 1 second before the choice click**. Each method's estimate at time *t* is based only on data up to *t* (for the HMM, the estimate after the last action at or before *t*).
- **Short visits:** if a visit is shorter than an offset, skip it at that offset, and always report *n* for every offset.
- **Measures:** **accuracy** (whether the top guess is right) and **Brier score**.
- **Uncertainty:** report 95% bootstrap intervals. Resample visits for simulated data, and resample *participants* for real data.

### 8.3 Datasets

| Dataset | Source | Used for |
|---|---|---|
| Type 1 sims | sampled from the HMM itself | correctness and recovery only; **never** used for claims that one method beats another |
| Type 2 sims | scripted mouse agent (9.2) | main comparison, at hesitation levels {0, 0.25, 0.5, 0.75, 1} |
| Real visits | owner's 3–5 participants, ~5 visits each | reality check, plus 2–3 worked examples; small-sample caveats on everything |

Type 2 sims use separate random seeds for the tuning set and the test set. Everything is reproducible from a seed.

### 8.4 Outputs

`sim/evaluate.mjs` writes `results/*.json` (read by the dashboard) and `results/*.csv` (for the report). Main figure: accuracy versus seconds before the click, one line per method, one panel per hesitation level. Main table: Brier score at each offset.

## 9. Fake-visitor generators (`sim/`, Node, seeded RNG)

### 9.1 Type 1: HMM sampler

This samples state and action sequences from a model, plus fake time gaps between actions (exponential, mean 1.5 s, configurable). It ends with a `choice` equal to the final state's lean. If the final state is `UNDECIDED`, it samples the choice from `base`. It outputs the true state path as well, for the recovery check.

### 9.2 Type 2: scripted mouse agent

This produces a **raw log** (mouse, scroll, layout, faq, choice events) that goes through the same `convertBatch`, using a fixed layout snapshot taken from the real site at 1440×900 (store it in `sim/layout_1440x900.json`). Its settings:

- **Chosen mode:** drawn from configurable base rates.
- **Browse depth:** how many sections are visited and how many FAQ questions opened, with random dwell times.
- **Hesitation h ∈ [0, 1]:** controls the number of pauses near the Participate section, the probability of drifting toward a non-chosen option (and how far), and how many back-and-forth movements happen between two options before committing.
- **Movement:** a smooth path toward each target (any standard smooth-path model is fine, such as minimum-jerk or a damped pursuit), with positional noise.

The agent also records its own "true intent timeline" (which option it is heading to at each moment). This is for display only, not for scoring the HMM, because it comes from a different model.

### 9.3 Personas for role-play visits (`config.js`, editable)

Provide 8 or more short personas, for example:

- a night-shift nurse who dislikes phone calls
- a retiree who prefers talking to a person
- a busy parent who wants to finish on their own schedule
- a student curious about AI
- someone worried about privacy
- someone with a slow internet connection
- someone who types slowly
- a person who wants it over with quickly

Pick a persona at random per role-play visit, and avoid repeats within the same `pid` if possible. Record the `persona_id`.

## 10. Saving data (Google Sheet via Apps Script)

- `apps-script/Code.gs` contains a `doPost(e)`. It parses the JSON and validates it: `project_code` matches, `schema_version` is known, and the body is under 1 MB. Then it appends rows and returns `{"ok": true, "visit_id": ...}`. Invalid posts are rejected and get no row.
- **Columns:** `received_at`, `visit_id`, `part`, `n_parts`, `mode`, `pid`, `persona_id`, `choice`, `json_chunk`. Split the JSON into chunks of at most 45,000 characters, because a cell holds 50,000.
- **The site sends with** `fetch(url, {method: 'POST', body: JSON.stringify(payload)})` and **no custom headers**. The default `text/plain` content type avoids a CORS preflight (an extra permission check the browser makes before some requests), which Apps Script does not handle. Put the URL in `config.js`. Include setup steps in the README: create the Sheet, paste the script, deploy as a web app ("execute as me," "anyone can access"), and copy the URL.
- **Backup:** keep the payload in `localStorage` until an `ok` response arrives. If sending fails or times out after 10 s, show a **"Download my recording"** button that saves the same JSON format. Clear the stored copy once the send is confirmed.
- **Sharing:** the owner gives the instructor view-only access to the Sheet.
- **Getting data into the dashboard:** the owner downloads the Sheet as CSV. `python/export_visits.py` reassembles the chunks, drops invalid and `demo` rows, and writes `data/real/visits.json`. The dashboard loads real data **only** through a file picker or drag-and-drop, and keeps it in the browser's memory. Simulated data is bundled with the dashboard.

## 11. Live panel on the site (demo mode only)

When `?demo=1` is set, the site shows a small floating panel (plain JS, drawn with SVG or canvas) containing:

- the four-band stacked chart of state probabilities over time
- action tick marks along the bottom
- the current choice-guess label

The panel updates after every action and is fed by `createLiveForward`. Outside demo mode, the panel code must not run.

## 12. Researcher dashboard (React)

- **Visit list:** filter by dataset (type 1, type 2, real) and mode. Columns: ID, pid, persona, length, number of actions, choice, the HMM's guess at 3 s before the click (✓/✗).
- **Visit detail:** a three-part chart on one shared time axis:
  1. Stacked area of the four state probabilities (forward). The x-axis can be toggled between time and action number.
  2. Action tick marks with labels on hover.
  3. A Viterbi state strip underneath.

  Also on this page: the choice-guess label at the cursor position, a marker at the final choice, and, for type 2 sims, the agent's true intent timeline as an extra strip.
- **After the checkpoint:**
  - **Replay:** a miniature page outline with the mouse trail, section highlights, and button zones, plus a play/pause button and a slider that moves the cursor on the chart.
  - **Summary page:** the accuracy curves and Brier table from `results/*.json`, with method toggles and hesitation panels.

Draw the charts with lightweight SVG components. Note the library choice in `DECISIONS.md`.

## 13. Config (`core/config.js`): everything tunable lives here

`SECTION_DWELL_MS=2000`, `PAUSE_MS=10000`, `PAUSE_MAX_REPEAT=3`, `PAUSE_MOVE_PX=5`, `ZONE_PX=150`, `ZONE_EXIT_PX=170`, `REST_MS=500`, `HEAD_THRESHOLD=0.6`, `HEAD_SUSTAIN_MS=500`, `MOUSE_HZ=10`, `SCROLL_HZ=10`, `SCORE_OFFSETS_S=[10,5,3,2,1]`, `BASE_CHOICE=[1/3,1/3,1/3]`, `RANDOMIZE_CARD_ORDER=true`, `SEND_TIMEOUT_MS=10000`, `CHUNK_CHARS=45000`, `PROJECT_CODE`, `SCHEMA_VERSION=1`, `APPS_SCRIPT_URL`, `COURSE`, `OWNER`, `DELETION_DATE`, the persona list, and the desktop minimums. Record every visit's config version in its metadata.

## 14. Correctness tests

`tests.html` runs in the browser and shows pass/fail for each test. Tests 1, 2, 4, 5, and 7 must pass at the checkpoint.

1. **Hand-worked example.** 2 states (A, B), symbols {x, y}.
   - Initial = [0.6, 0.4]; transitions A→[0.7, 0.3], B→[0.4, 0.6]; emissions A: x 0.9, y 0.1; B: x 0.2, y 0.8. Observations: x, y, x.
   - Expected forward values (before normalizing): α₁ = (0.54, 0.08), α₂ = (0.041, 0.168), α₃ = (0.08631, 0.02262).
   - P(observations) = 0.10893. Filtered P(A) at steps 1–3 = 0.87097, 0.19617, 0.79234.
   - Viterbi path: **A, B, A**, with probability 0.046656.
   - The owner should also verify these by hand for the report.
2. **Brute force.** For 500 random 4-state, 16-symbol models (all entries > 0), with sequence lengths 1–5: `forwardScaled` log-likelihood = `bruteForce` total (relative error < 1e-10). The filtered probabilities at the last step match. Viterbi's path probability equals the brute-force maximum, and its path is one of the maximizing paths.
3. **Python cross-check** (after the checkpoint). `python/hmm_check.py` is written independently, using NumPy and no JS. JS exports a cases file with models, sequences, and outputs; `python/compare.py` checks that filtered probabilities, log-likelihoods, and Viterbi paths agree within 1e-9.
4. **Sanity on every run.** Each filtered vector sums to 1 (within 1e-9), has no negative entries, and has no `NaN`. The model validation from 7.3 is also tested, including that an invalid model gets rejected.
5. **Long sequences.** On 2,000-step random sequences, `forwardScaled` and `forwardLog` agree within 1e-8, with no underflow. An *unscaled* forward is shown, as a teaching example, to underflow to 0.
6. **Recovery** (an analysis, not a pass/fail test). On type 1 sims, report the percentage of time steps where Viterbi recovers the true state. Also report how that changes as the emissions are made noisier (mixed toward uniform).
7. **Converter.** Use hand-made raw logs, each checking for one exact output sequence:
   - straight onto the web button → `VIEW_PARTICIPATE, HEAD_WEB, ZONE_WEB, REST_WEB`
   - zig-zag between AI and person → zone entries alternating with `SWITCH`
   - 25 s still → exactly 2 `PAUSE`s
   - fast scroll past About in under 2 s → no `VIEW_ABOUT`
   - the choice click → no action
   - `convertStream` gives the same result as `convertBatch` on all cases

   Also test that `createLiveForward` matches `forwardScaled`.

## 15. Milestones

### Checkpoint, November 23 (must work, deployed on GitHub Pages)

| Dates | Deliverable |
|---|---|
| Oct 20–26 | Site with all sections, banner, notice screen, desktop check, card randomization, raw recorder, download backup |
| Oct 27–Nov 2 | `converter.js` and converter tests; Apps Script receiver; send with backup; `export_visits.py` |
| Nov 3–9 | `hmm.js` (scaled, log, Viterbi, brute force, live), hand-set model, tests 1, 2, 4, 5 |
| Nov 10–16 | Demo-mode live panel; type 1 sampler; recovery analysis |
| Nov 17–23 | Basic dashboard (visit list and three-part chart for one visit); buffer time |

**Checkpoint acceptance criteria:**

- A visit made on the deployed site appears as a row in the Sheet.
- `tests.html` is all green.
- `?demo=1` shows the estimate changing live.
- The dashboard shows forward bands and the Viterbi strip for a recorded visit and for a type 1 sim.

**Recruitment:** the owner asks volunteers around November 9, once the site and recording work.

### After the checkpoint, through December 17

| Dates | Deliverable |
|---|---|
| Nov 24–30 | Type 2 scripted agent; `baselines.js`, `metrics.js`, `evaluate.mjs`; first comparison results (lighter week, Thanksgiving) |
| Dec 1–7 | Real role-play visits collected; Python cross-check (test 3); summary page |
| Dec 8–13 | Learned model (7.4) with leave-one-person-out; replay view; 2–3 worked real examples |
| Dec 14–17 | Freeze code; final figures and tables; README; report |

### Only if time allows (future extensions)

- Ungrouped actions (one symbol per FAQ question).
- Type 2 agent movement built from pieces of real mouse traces.
- A larger state model (decision stage × lean, about 9 states).
- Feeding intent probabilities into the HMM directly instead of using thresholds.
- Mobile and touch support.

## 16. Open items the owner fills in

Fill these in before the first deployment:

- The study name and colors.
- The FAQ text.
- `COURSE`, `OWNER`, and `DELETION_DATE`.
- The location of the owner's mouse-intent demo code, for porting into `core/intent.js`.
- Review of the persona list.
- Review of the hand-set numbers in Section 7.1, which are starting guesses.
- Whether to keep card-order randomization (recommended).
