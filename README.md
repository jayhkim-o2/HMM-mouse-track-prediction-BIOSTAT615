# Survey-Mode Intent Predictor

A BIOSTAT 615 final project. It's a **mock study website** that watches how a visitor browses,
then uses a **hidden Markov model (HMM)** to guess, live, which of three survey modes they will
pick: **Web survey**, **AI phone interview**, or **Phone interview with a person**.

> This is a fake study made for a class project. No real survey is conducted.

- **Live site:** https://jayhkim-o2.github.io/HMM-mouse-track-prediction-BIOSTAT615/
- **Tests:** https://jayhkim-o2.github.io/HMM-mouse-track-prediction-BIOSTAT615/tests.html
- **Dashboard:** https://jayhkim-o2.github.io/HMM-mouse-track-prediction-BIOSTAT615/dashboard/

**Status:** in progress. See [PROGRESS.md](PROGRESS.md) for what works today. Sections below
marked *(coming)* describe parts that aren't built yet.

## What it is and who it's for

Survey researchers often let people choose how to answer a survey. This tool explores whether a
visitor's browsing behavior (scrolling, mouse movement, hovering, pausing) on the study's
landing page can predict that choice before the click. It's meant for researchers who are
curious about mode choice, and for students learning HMMs on a concrete problem.

## Statistical method

- Raw browser events are turned into a sequence of 16 **action** types, for example
  "viewed the FAQ", "pointer entered the zone around the Web button", or "paused 10 s".
- A 4-state HMM (`UNDECIDED`, `LEAN_WEB`, `LEAN_AI`, `LEAN_PERSON`) treats each action as an
  emission from the visitor's hidden leaning.
- The **forward algorithm** gives the live estimate after every action. It runs with
  per-step rescaling, and a log-space (log-sum-exp) version is used to cross-check it, so long
  visits don't underflow.
- **Viterbi** (in log space) gives the most likely sequence of leanings after the visit.
- Mouse-direction intent is based on the mouse-tracking literature (for example, the
  *mousetrap* R package and its trajectory measures).

References:
- Rabiner, L. R. (1989). A tutorial on hidden Markov models and selected applications in speech
  recognition. *Proceedings of the IEEE*, 77(2), 257–286.
- Kieslich, P. J., & Henninger, F. (2017). Mousetrap: An integrated, open-source mouse-tracking
  package. *Behavior Research Methods*, 49(5), 1652–1667.
- Freeman, J. B., & Ambady, N. (2010). MouseTracker: Software for studying real-time mental
  processing using a computer mouse-tracking method. *Behavior Research Methods*, 42(1), 226–241.

## How to use it

### A visit

1. Open the live site on a laptop or desktop (it needs a mouse or trackpad and a window of
   at least 1024 × 650; otherwise it shows a message and records nothing).
2. Read the notice and click **"I agree, start"**. Recording starts at that moment.
3. Browse the About, FAQ and Participate sections, then click one of the three mode
   buttons. The card order is shuffled on every visit.
4. The thank-you box says "Your recording was saved" once the visit reaches the Google
   Sheet. If saving fails, a **Download my recording** button appears instead, and the
   visit is retried automatically the next time the site is opened in that browser.

Closing the tab before choosing throws the visit away; nothing is sent.

### URL options

Add these to the end of the site address (combine them with `&`):

| Option | What it does |
|---|---|
| `?pid=P2` | Tags the visit with a participant code (`P1`–`P9`; anything else is ignored). |
| `?rp=1` | Role-play mode: after "I agree", the visitor is shown a persona and asked to choose as that person would. |
| `?demo=1` | Shows the live model panel. Demo visits are marked `mode: "demo"` and left out of all analysis. |

Every visit is recorded with a `mode` of `natural`, `roleplay` or `demo`.

### Role-play visits with volunteers

Give each volunteer one link with their code, and have them use it for every visit:

```
https://jayhkim-o2.github.io/HMM-mouse-track-prediction-BIOSTAT615/?rp=1&pid=P2
```

You don't assign personas yourself. On each visit the site picks one at random from the list
in `core/config.js` (`PERSONAS`), skipping ones that browser has already shown to that `pid`,
and starts over once all have been used. The screen reads, for example: *"Participant P2,
visit 3. Please browse the site and choose as this person would: A retiree who prefers
talking to a person."* The visit records `pid` and `persona_id` (e.g. `"retiree"`).

The "already shown" list is kept in the volunteer's browser, so visits from a second device
or a private window can repeat a persona. `persona_id` is always recorded, so you can still
tell which persona each visit had. To change the personas, edit `PERSONAS` in
`core/config.js`, and don't rename an `id` once real visits have used it.

### Live demo

Open the site with `?demo=1`. A panel in the bottom-right corner shows, after every action:
the four hidden-state probabilities as colored bands over time, a tick for each action
(hover to see its name), and the current guess (e.g. "60% Web / 30% AI / 10% Person").
After the click it adds the Viterbi path as a strip and says whether the last guess was
right. **Hide** collapses the panel.

### Dashboard *(coming)*

`/dashboard/` will show recorded and simulated visits.

## How correctness is checked

The same tests run in two places: in the browser at
[`tests.html`](https://jayhkim-o2.github.io/HMM-mouse-track-prediction-BIOSTAT615/tests.html),
and in the terminal with `node tests/run_node.mjs`. The deploy workflow also runs them on
every push and stops the deploy if any fail. All 12 pass (as of 2026-11-14):

| SPEC test | What it checks | Result |
|---|---|---|
| 1. Hand-worked example | 2-state model, observations x, y, x: forward values α, P(obs) = 0.10893, filtered P(A) = 0.87097, 0.19617, 0.79234, Viterbi path A, B, A with probability 0.046656 | Pass |
| 2. Brute force | 500 random 4-state, 16-symbol models, lengths 1–5: forward and Viterbi match listing every path | Pass (worst relative error 5 × 10⁻¹⁵) |
| 4. Sanity | Every filtered vector sums to 1 with no negatives or NaN; broken models are rejected | Pass (4,067 vectors; 3 of 3 broken models rejected) |
| 5. Long sequences | 2,000 steps: rescaled and log-space forward agree; an unscaled forward underflows to 0 | Pass (max difference 5 × 10⁻¹¹) |
| (live) | The live, one-action-at-a-time forward matches the batch version exactly | Pass |
| 7. Converter | Hand-made raw logs with exact expected actions: straight onto a button, zig-zag with SWITCH, staying still (PAUSE count from the config), fast scroll past About, the click is never an action, no HEAD while buttons are off screen; streaming = batch | Pass (7 checks) |

The tests themselves were checked by planting bugs on purpose (e.g. swapping the transition
matrix's rows and columns) and confirming that tests fail; see [AI_USAGE.md](AI_USAGE.md).
Still to come: the independent Python cross-check (test 3) and the recovery analysis (test 6).

## Run it locally from a fresh clone

You need Git, Bash (Git Bash on Windows) and Python 3 or Node.

```bash
git clone https://github.com/jayhkim-o2/HMM-mouse-track-prediction-BIOSTAT615.git
cd HMM-mouse-track-prediction-BIOSTAT615
bash scripts/build-pages.sh          # assembles _site/, same as the live deploy
python -m http.server 8000 -d _site  # or: npx serve _site
```

Then open http://localhost:8000/. The pages use ES modules, which don't load from `file://`,
so a local server is required. Run the build script again after you edit anything.

## Deployment

`.github/workflows/deploy.yml` runs `scripts/build-pages.sh` on each push to `main` and
publishes `_site/` with the official GitHub Pages actions. One-time setup: in the GitHub repo,
go to **Settings → Pages → Source: GitHub Actions**.

## Google Sheet setup (Apps Script)

1. Create a Google Sheet. Use an account that can publish public web apps; some university
   Google accounts only allow "Anyone within [university]", which blocks visitors.
2. Open **Extensions → Apps Script**, replace the editor contents with `apps-script/Code.gs`,
   and save.
3. **Deploy → New deployment**, click the gear next to "Select type" → **Web app**.
   Set "Execute as: Me" and "Who has access: Anyone", then **Deploy** and authorize (on the
   "Google hasn't verified this app" screen: Advanced → Go to the project → Allow).
4. Check it: open the web app URL (ends in `/exec`) in a private window. You should see
   `{"ok":true,...}`, not a login page.
5. Copy the URL into `APPS_SCRIPT_URL` in `core/config.js`.
6. After changing the script later: **Deploy → Manage deployments → edit → Version: New
   version → Deploy**. The URL stays the same; an un-redeployed edit is not live.

## Notice placeholders

The visitor notice (SPEC Section 5.1) has three placeholders, set in `core/config.js`:

| Placeholder | Current value |
|---|---|
| `[COURSE]` | BIOSTAT 615 |
| `[OWNER]` | Jay Kim |
| `[DELETION DATE]` | December 17, 2027 (one year after the final submission) |

If you reuse this project, change these three values first.

## Credits and license

The code is © 2026 Jay Kim, released under the [MIT License](LICENSE). Built with help from
Claude Code; see [AI_USAGE.md](AI_USAGE.md). Third-party code and data will be listed here with
their licenses as they're added (none so far).
