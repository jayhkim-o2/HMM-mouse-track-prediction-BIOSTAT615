// The recorder: logs raw browser events into one array (SPEC Section 6.1).
// It does almost no work per event (just pushes a small object), so the page stays fast.
// Turning these events into actions happens in core/converter.js (checkpoint step 4).
//
// Times are milliseconds since "I agree, start" (performance.now()).

import { CONFIG, OPTIONS } from "../core/config.js";

const SECTIONS = ["about", "faq", "participate", "contact"];

export function createRecorder({ cardOrder }) {
  const log = [];
  let t0 = null;          // performance.now() when recording started
  let active = false;
  let lastMouse = -Infinity;
  let lastScroll = -Infinity;
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

  function logLayout() {
    log.push({
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
    log.push({ type: "scroll", t: 0, scrollY: Math.round(window.scrollY) });

    // Mouse: at most MOUSE_HZ samples per second.
    on(window, "mousemove", (e) => {
      pointer = { x: e.clientX, y: e.clientY };
      const t = now();
      if (t - lastMouse < 1000 / CONFIG.MOUSE_HZ) return;
      lastMouse = t;
      log.push({ type: "mouse", t, clientX: e.clientX, clientY: e.clientY });
    });

    // Always log the exact pointer position at any click (capture phase, before other handlers).
    on(window, "click", (e) => {
      if (!active) return;
      log.push({ type: "mouse", t: now(), clientX: e.clientX, clientY: e.clientY });
    }, true);

    // Scroll: at most SCROLL_HZ samples per second.
    on(window, "scroll", () => {
      const t = now();
      if (t - lastScroll < 1000 / CONFIG.SCROLL_HZ) return;
      lastScroll = t;
      log.push({ type: "scroll", t, scrollY: Math.round(window.scrollY) });
    }, { passive: true });

    on(window, "resize", logLayout);

    on(document, "visibilitychange", () => {
      log.push({ type: "visibility", t: now(), hidden: document.hidden });
    });

    // FAQ toggles. Opening/closing a question moves everything below it,
    // so the layout is logged again right after.
    document.querySelectorAll("#faq details").forEach((d) => {
      on(d, "toggle", () => {
        log.push({ type: "faq", t: now(), faq_id: d.id, open: d.open });
        logLayout();
      });
    });

    // Hovering over a card.
    OPTIONS.forEach((o) => {
      const card = document.getElementById("card-" + o);
      on(card, "mouseenter", () => log.push({ type: "card_hover", t: now(), option: o, enter: true }));
      on(card, "mouseleave", () => log.push({ type: "card_hover", t: now(), option: o, enter: false }));
    });
  }

  // The choice ends the visit: log it, then stop listening.
  function finish(option) {
    if (!active) return null;
    log.push({ type: "choice", t: now(), option });
    active = false;
    listeners.forEach((off) => off());
    return log;
  }

  return { start, finish, isActive: () => active, getLog: () => log, lastPointer: () => pointer };
}
