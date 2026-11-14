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

## How to use it *(coming)*

1. Open the live site on a laptop or desktop and click **"I agree, start"**.
2. Browse the About, FAQ and Participate sections, then pick a mode.
3. Add `?demo=1` to the URL to see the live estimate panel (demo visits aren't analyzed).
4. Open `/dashboard/` to look at recorded and simulated visits.

## How correctness is checked *(coming)*

`tests.html` runs the tests from SPEC Section 14 in the browser: a hand-worked example,
brute-force comparison on 500 random models, sanity checks, 2,000-step underflow test, and
converter tests. Results will be recorded here.

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

## Google Sheet setup (Apps Script) *(coming)*

1. Create a Google Sheet.
2. Open **Extensions → Apps Script** and paste in `apps-script/Code.gs`.
3. **Deploy → New deployment → Web app**, with "Execute as: Me" and "Who has access: Anyone".
4. Copy the web app URL into `APPS_SCRIPT_URL` in `core/config.js`.

## Placeholders to fill in

These are set in `core/config.js` and appear in the visitor notice:
`[COURSE]`, `[OWNER]`, `[DELETION DATE]`.

## Credits and license

The code is © 2026 Jay Kim, released under the [MIT License](LICENSE). Built with help from
Claude Code; see [AI_USAGE.md](AI_USAGE.md). Third-party code and data will be listed here with
their licenses as they're added (none so far).
