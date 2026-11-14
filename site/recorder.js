// The recorder: logs raw browser events into one array (SPEC Section 6.1).
// It does almost no work per event (just pushes a small object), so the page stays fast.
// Turning these events into actions happens in core/converter.js (checkpoint step 4).
//
// Times are milliseconds since "I agree, start" (performance.now()).

import { CONFIG, OPTIONS } from "../core/config.js";

const SECTIONS = ["about", "faq", "participate", "contact"];

export function createRecorder({ cardOrder, onEvent = null }) {
  const log = [];
  // Every event goes through here; onEvent (demo mode only) gets a copy as it happens.
  const record = (ev) => { log.push(ev); if (onEvent) onEvent(ev); };
  let t0 = null;          // performance.now() when recording started
  let active = false;
  let pointer = null;     // latest pointer position, so we can log it at clicks
  const listeners = [];   // so stop() can remove everything it added

  const now = () => Math.round(performance.now() - t0);
  const on = (target, type, fn, opts) => {
    target.addEventListener(type, fn, opts);
    listeners.push(() => target.removeEventListener(type, fn, opts));
  };

  // Page-coordinate rectangle of an element (adds scrollY so it doesn't depend on scrolling).
  const pageRect = (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height };
  };

  let lastScrollY = null;   // the scroll position most recently written to the log
  function logScroll(t = now()) {
    lastScrollY = Math.round(window.scrollY);
    record({ type: "scroll", t, scrollY: lastScrollY });
  }

  // Rate limiter that keeps the LAST sample. Plain throttling (drop anything within
  // `gapMs` of the previous sample) loses the final position when movement stops, so
  // the log can end up showing the page or pointer where it was ~100 ms earlier.
  // Here a skipped event schedules one catch-up sample at the end of the gap instead.
  function throttleWithTrailing(gapMs, sample) {
    let last = -Infinity;
    let timer = null;
    const take = () => { last = now(); sample(last); };
    return () => {
      if (!active) return;
      const wait = gapMs - (now() - last);
      if (wait <= 0) {
        if (timer) { clearTimeout(timer); timer = null; }
        take();
      } else if (!timer) {
        timer = setTimeout(() => { timer = null; if (active) take(); }, wait);
      }
    };
  }

  function logLayout() {
    record({
      type: "layout", t: now(),
      w: window.innerWidth, h: window.innerHeight,
      scrollY: Math.round(window.scrollY),
      sections: Object.fromEntries(SECTIONS.map((id) => [id, pageRect(document.getElementById(id))])),
      buttons: Object.fromEntries(OPTIONS.map((o) => [o, pageRect(document.getElementById("opt-" + o))])),
      cards: Object.fromEntries(OPTIONS.map((o) => [o, pageRect(document.getElementById("card-" + o))])),
      card_order: cardOrder.slice(),
    });
  }

  function start() {
    t0 = performance.now();
    active = true;
    logLayout();
    logScroll(0);

    // Mouse: at most MOUSE_HZ samples per second, and the final resting position is never lost.
    const sampleMouse = throttleWithTrailing(1000 / CONFIG.MOUSE_HZ, (t) => {
      record({ type: "mouse", t, clientX: pointer.x, clientY: pointer.y });
    });
    on(window, "mousemove", (e) => {
      pointer = { x: e.clientX, y: e.clientY };
      sampleMouse();
    });

    // Scroll: at most SCROLL_HZ samples per second, same trailing rule.
    const sampleScroll = throttleWithTrailing(1000 / CONFIG.SCROLL_HZ, logScroll);
    on(window, "scroll", sampleScroll, { passive: true });

    // At any click, log the exact scroll position (if it changed) and pointer position
    // (capture phase, so this runs before the button's own click handler).
    on(window, "click", (e) => {
      if (!active) return;
      const t = now();
      if (Math.round(window.scrollY) !== lastScrollY) logScroll(t);
      record({ type: "mouse", t, clientX: e.clientX, clientY: e.clientY });
    }, true);

    on(window, "resize", logLayout);

    on(document, "visibilitychange", () => {
      record({ type: "visibility", t: now(), hidden: document.hidden });
    });

    // FAQ toggles. Opening/closing a question moves everything below it,
    // so the layout is logged again right after.
    document.querySelectorAll("#faq details").forEach((d) => {
      on(d, "toggle", () => {
        record({ type: "faq", t: now(), faq_id: d.id, open: d.open });
        logLayout();
      });
    });

    // Hovering over a card.
    OPTIONS.forEach((o) => {
      const card = document.getElementById("card-" + o);
      on(card, "mouseenter", () => record({ type: "card_hover", t: now(), option: o, enter: true }));
      on(card, "mouseleave", () => record({ type: "card_hover", t: now(), option: o, enter: false }));
    });
  }

  // The choice ends the visit: log it, then stop listening.
  function finish(option) {
    if (!active) return null;
    record({ type: "choice", t: now(), option });
    active = false;
    listeners.forEach((off) => off());
    return log;
  }

  return {
    start, finish,
    isActive: () => active,
    getLog: () => log,
    lastPointer: () => pointer,
    elapsed: () => (t0 === null ? 0 : now()),   // ms since "I agree" (for the demo panel's clock)
  };
}
