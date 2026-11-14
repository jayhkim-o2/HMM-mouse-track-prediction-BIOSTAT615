// Action converter (SPEC Section 6.2): raw event log -> sequence of {t, symbol, detail}.
//
// Two forms with identical results:
//   convertBatch(rawLog)        -> actions   (dashboard, simulators, tests)
//   createConverterStream()     -> { push(event), tick(t), finish() }   (live, on the site)
//
// How it works: events are read in time order. Rules that need time to pass
// ("About has filled the screen for 2 s", "10 s with no activity", "resting on a button
// for 0.5 s", "heading for a button for 0.5 s") set a DEADLINE. A deadline fires at its
// exact time unless something cancels it first. Because deadlines fire at exact times,
// it doesn't matter whether events arrive all at once or one at a time.
//
// Actions that share the same time come out in a fixed order:
//   views, FAQ, pause, head, zone, switch, rest.
// The choice event is the label, never an action: nothing at or after it is emitted.

import { CONFIG, OPTIONS, SYM } from "./config.js";
import { createIntent, rectDistance } from "./intent.js";

const SECTIONS = ["about", "faq", "participate", "contact"];

// Order for actions at the same time (lower comes first).
const RANK = {
  VIEW_ABOUT: 0, VIEW_FAQ: 0, VIEW_PARTICIPATE: 0, VIEW_CONTACT: 0,
  OPEN_FAQ: 1, PAUSE: 2,
  HEAD_WEB: 3, HEAD_AI: 3, HEAD_PERSON: 3,
  ZONE_WEB: 4, ZONE_AI: 4, ZONE_PERSON: 4,
  SWITCH: 5,
  REST_WEB: 6, REST_AI: 6, REST_PERSON: 6,
};

export function createConverterStream(config = CONFIG) {
  const intent = createIntent(config);

  // ----- What we know about the page right now -----
  let layout = null;      // latest layout event (page-coordinate rects)
  let scrollY = 0;
  let pointer = null;     // {x, y} in client coordinates
  let ended = false;
  let now = 0;            // time of the latest processed event or tick

  // ----- Rule state -----
  let dominant = null, dominantSince = 0, viewDone = false;          // section views
  let lastActivity = 0, pauseCount = 0, anchor = null;               // pauses
  let headCand = null, headSince = 0, lastHead = null;               // heading
  let zone = null, lastZoneEntered = null;                           // zones + switch
  let restOn = null, restSince = 0, restDone = false;                // resting

  // ----- Output buffering (so same-time actions can be put in the fixed order) -----
  let pending = [];       // actions not yet released (all at time >= `released`)
  const emit = (t, symbol, detail = null) => pending.push({ t, symbol, detail, seq: pending.length });

  // Release every pending action with time < t (or all, when t is Infinity), sorted.
  function release(t) {
    const out = pending.filter((a) => a.t < t);
    pending = pending.filter((a) => a.t >= t);
    out.sort((a, b) => a.t - b.t || RANK[a.symbol] - RANK[b.symbol] || a.seq - b.seq);
    return out.map(({ t: time, symbol, detail }) => ({ t: time, symbol, detail }));
  }

  // ----- Geometry helpers -----
  // A layout rect is in page coordinates {x, y, w, h}; turn it into client coordinates.
  const toClient = (r) => ({ left: r.x, top: r.y - scrollY, right: r.x + r.w, bottom: r.y + r.h - scrollY });
  const buttonRects = () => Object.fromEntries(OPTIONS.map((o) => [o, toClient(layout.buttons[o])]));
  const buttonsOnScreen = (rects) => OPTIONS.some((o) => rects[o].bottom > 0 && rects[o].top < layout.h);

  // Which section covers the largest share of the viewport (ties: earlier section).
  function dominantSection() {
    if (!layout) return null;
    let best = null, bestShare = 0;
    for (const s of SECTIONS) {
      const r = toClient(layout.sections[s]);
      const share = Math.max(0, Math.min(r.bottom, layout.h) - Math.max(r.top, 0)) / layout.h;
      if (share > bestShare) { best = s; bestShare = share; }
    }
    return best;
  }

  // ----- Deadlines -----
  // Each returns the time it would fire, or Infinity if it isn't armed.
  const deadlines = {
    view: () => (dominant !== null && !viewDone ? dominantSince + config.SECTION_DWELL_MS : Infinity),
    pause: () => (pauseCount < config.PAUSE_MAX_REPEAT ? lastActivity + config.PAUSE_MS * (pauseCount + 1) : Infinity),
    head: () => (headCand !== null && headCand !== lastHead ? headSince + config.HEAD_SUSTAIN_MS : Infinity),
    rest: () => (restOn !== null && !restDone ? restSince + config.REST_MS : Infinity),
  };
  const fire = {
    view: (t) => { viewDone = true; emit(t, "VIEW_" + dominant.toUpperCase(), dominant); },
    pause: (t) => { pauseCount++; emit(t, "PAUSE"); },
    head: (t) => { lastHead = headCand; emit(t, "HEAD_" + headCand.toUpperCase(), headCand); },
    rest: (t) => { restDone = true; emit(t, "REST_" + restOn.toUpperCase(), restOn); },
  };

  // Fire every deadline whose time is <= limit (or < limit when strict), earliest first.
  function runDeadlines(limit, strict = false) {
    for (;;) {
      let name = null, when = Infinity;
      for (const [k, f] of Object.entries(deadlines)) {
        const d = f();
        if (d < when) { when = d; name = k; }
      }
      if (name === null || (strict ? when >= limit : when > limit)) return;
      fire[name](when);
    }
  }

  // ----- Rules that react to the current state at time t -----
  function updateDominant(t) {
    const d = dominantSection();
    if (d !== dominant) { dominant = d; dominantSince = t; viewDone = false; }
  }

  function updatePointerRules(t) {
    if (!layout || !pointer) return;
    const rects = buttonRects();
    const dist = Object.fromEntries(OPTIONS.map((o) => [o, rectDistance(pointer.x, pointer.y, rects[o])]));

    // Zones: assign the pointer to the nearest button; leave only beyond ZONE_EXIT_PX.
    let nearest = OPTIONS[0];
    for (const o of OPTIONS) if (dist[o] < dist[nearest]) nearest = o;
    if (zone !== null && dist[zone] > config.ZONE_EXIT_PX) zone = null;
    if (dist[nearest] <= config.ZONE_PX && nearest !== zone) {
      zone = nearest;
      emit(t, "ZONE_" + nearest.toUpperCase(), nearest);
      if (lastZoneEntered !== null && lastZoneEntered !== nearest) {
        emit(t, "SWITCH", `${lastZoneEntered}->${nearest}`);
      }
      lastZoneEntered = nearest;
    }

    // Resting: inside a button's rectangle (distance 0).
    const inside = OPTIONS.find((o) => dist[o] === 0) ?? null;
    if (inside !== restOn) { restOn = inside; restSince = t; restDone = false; }
  }

  function updateIntent(t) {
    if (!layout || !pointer) return;
    const rects = buttonRects();
    const probs = intent.update(pointer, buttonsOnScreen(rects) ? rects : null);
    let lead = OPTIONS[0];
    for (const o of OPTIONS) if (probs[o] > probs[lead]) lead = o;
    if (probs[lead] > config.HEAD_THRESHOLD) {
      if (headCand !== lead) { headCand = lead; headSince = t; }
    } else {
      headCand = null;
    }
  }

  const markActivity = (t) => { lastActivity = t; pauseCount = 0; };

  // ----- Public interface -----
  function push(ev) {
    if (ended) return [];
    const t = ev.t;
    if (ev.type === "choice") {
      runDeadlines(t, true);   // only things strictly before the click
      ended = true;
      return release(Infinity).filter((a) => a.t < t);
    }
    runDeadlines(t);
    now = Math.max(now, t);

    switch (ev.type) {
      case "layout":
        layout = ev;
        if (typeof ev.scrollY === "number") scrollY = ev.scrollY;
        updateDominant(t);
        updatePointerRules(t);
        break;
      case "scroll":
        scrollY = ev.scrollY;
        markActivity(t);
        updateDominant(t);
        updatePointerRules(t);   // the buttons moved under a still pointer
        break;
      case "mouse": {
        pointer = { x: ev.clientX, y: ev.clientY };
        if (!anchor || Math.hypot(pointer.x - anchor.x, pointer.y - anchor.y) > config.PAUSE_MOVE_PX) {
          anchor = pointer;
          markActivity(t);
        }
        updateIntent(t);
        updatePointerRules(t);
        break;
      }
      case "faq":
        markActivity(t);         // opening or closing a question is a click
        if (ev.open) emit(t, "OPEN_FAQ", ev.faq_id);
        break;
      default:
        break;                   // card_hover, visibility: kept in the raw log only
    }
    return release(t);
  }

  // Let time pass with no event (the site calls this every ~100 ms so pauses show up live).
  function tick(t) {
    if (ended || t < now) return [];
    runDeadlines(t);
    now = t;
    return release(t);
  }

  // End of the log without a choice: release whatever is left.
  function finish() {
    ended = true;
    return release(Infinity);
  }

  return { push, tick, finish };
}

// Batch form: run the whole log through the stream.
export function convertBatch(rawLog, config = CONFIG) {
  const stream = createConverterStream(config);
  const out = [];
  for (const ev of rawLog) out.push(...stream.push(ev));
  out.push(...stream.finish());
  return out;
}

// Action list -> symbol indices for the HMM.
export const toSymbols = (actions) => actions.map((a) => SYM[a.symbol]);
