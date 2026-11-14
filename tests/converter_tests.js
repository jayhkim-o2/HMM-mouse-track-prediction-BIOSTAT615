// Converter tests (SPEC Section 14, test 7). Hand-made raw logs, each with one exact expected
// output. Every case is also run through the streaming converter (with ticks every 100 ms,
// like the site) to check it gives exactly the same actions as the batch converter.

import { convertBatch, createConverterStream } from "../core/converter.js";

// A fixed page at 1440 x 900, in page coordinates {x, y, w, h}.
// Participate's buttons sit at page y 2330-2380, so at scrollY = 1700 they are at
// client y 630-680, near the bottom of the screen.
const LAYOUT = {
  type: "layout", t: 0, w: 1440, h: 900, scrollY: 0,
  sections: {
    about: { x: 340, y: 100, w: 760, h: 1000 },
    faq: { x: 340, y: 1100, w: 760, h: 900 },
    participate: { x: 340, y: 2000, w: 760, h: 500 },
    contact: { x: 340, y: 2500, w: 760, h: 300 },
  },
  buttons: {
    web: { x: 300, y: 2330, w: 200, h: 50 },
    ai: { x: 620, y: 2330, w: 200, h: 50 },
    person: { x: 940, y: 2330, w: 200, h: 50 },
  },
  cards: {
    web: { x: 280, y: 2160, w: 240, h: 240 },
    ai: { x: 600, y: 2160, w: 240, h: 240 },
    person: { x: 920, y: 2160, w: 240, h: 240 },
  },
  card_order: ["web", "ai", "person"],
};
const start = () => [LAYOUT, { type: "scroll", t: 0, scrollY: 0 }];
const mouse = (t, x, y) => ({ type: "mouse", t, clientX: x, clientY: y });
const scroll = (t, y) => ({ type: "scroll", t, scrollY: y });
const choice = (t, option) => ({ type: "choice", t, option });

// Mouse samples every 100 ms along a straight line.
function line(t0, from, to, steps) {
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    out.push(mouse(t0 + i * 100, Math.round(from[0] + f * (to[0] - from[0])), Math.round(from[1] + f * (to[1] - from[1]))));
  }
  return out;
}

// Run a log through the stream, ticking every 100 ms between events (as the site does).
function convertStreamWithTicks(log) {
  const s = createConverterStream();
  const out = [];
  let clock = 0;
  for (const ev of log) {
    while (clock + 100 < ev.t) { clock += 100; out.push(...s.tick(clock)); }
    out.push(...s.push(ev));
    clock = Math.max(clock, ev.t);
  }
  out.push(...s.finish());
  return out;
}
const sameActions = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const names = (actions) => actions.map((a) => a.symbol);

// ---------- The cases ----------
const CASES = [];

// 1. Straight onto the web button.
// Jump to Participate quickly (no About view), wait for VIEW_PARTICIPATE, then move straight
// down onto the web button, rest on it for 0.7 s, and click.
{
  const log = [...start(), scroll(300, 1700),
    mouse(3000, 400, 150),
    ...line(3100, [400, 160], [400, 655], 15),   // arrives at 4600
    mouse(5300, 401, 655),                       // tiny wiggle while resting (< 5 px)
    choice(5400, "web")];
  CASES.push({
    name: "straight onto the web button",
    log,
    check: (acts) => {
      const got = names(acts).join(", ");
      const want = "VIEW_PARTICIPATE, HEAD_WEB, ZONE_WEB, REST_WEB";
      return { pass: got === want, detail: `got ${got || "(nothing)"}; expected ${want}` };
    },
  });
}

// 2. Zig-zag between AI and person: zone entries alternate, with a SWITCH after each change.
{
  const log = [...start(), scroll(300, 1700), mouse(3000, 720, 655)];
  let t = 3000;
  const xs = [1040, 720, 1040, 720];
  for (const x of xs) { t += 300; log.push(mouse(t, x, 655)); }
  log.push(choice(t + 200, "ai"));
  CASES.push({
    name: "zig-zag between AI and person",
    log,
    check: (acts) => {
      const got = names(acts).filter((s) => s.startsWith("ZONE") || s === "SWITCH").join(", ");
      const want = "ZONE_AI, ZONE_PERSON, SWITCH, ZONE_AI, SWITCH, ZONE_PERSON, SWITCH, ZONE_AI, SWITCH";
      return { pass: got === want, detail: `zone/switch actions: ${got}` };
    },
  });
}

// 3. 25 seconds without moving: PAUSE at 10 s and 20 s, so exactly 2.
{
  const log = [...start(), mouse(0, 700, 400), choice(25000, "web")];
  CASES.push({
    name: "25 s still gives exactly 2 PAUSEs",
    log,
    check: (acts) => {
      const pauses = acts.filter((a) => a.symbol === "PAUSE");
      return { pass: pauses.length === 2, detail: `${pauses.length} PAUSE at t = ${pauses.map((a) => a.t).join(", ")} ms` };
    },
  });
}

// 4. Fast scroll past About in under 2 s: About was on screen only 1.2 s, so no VIEW_ABOUT.
{
  const log = [...start(), scroll(600, 400), scroll(1200, 1200), mouse(1300, 700, 400), choice(4000, "web")];
  CASES.push({
    name: "fast scroll past About gives no VIEW_ABOUT",
    log,
    check: (acts) => {
      const got = names(acts);
      return { pass: !got.includes("VIEW_ABOUT") && got.includes("VIEW_FAQ"), detail: `got ${got.join(", ")}` };
    },
  });
}

// 5. The choice click is never an action, and nothing after it counts.
// The pointer jumps onto the AI button at the same moment as the click, and more events
// follow the click; none of them may produce an action.
{
  const before = [...start(), scroll(300, 1700), mouse(3000, 400, 150), mouse(3500, 400, 160)];
  const log = [...before, mouse(4000, 720, 655), choice(4000, "ai"),
    mouse(4100, 1040, 655), scroll(4200, 1800), mouse(20000, 1040, 655)];
  const withoutChoice = [...before];
  CASES.push({
    name: "the choice click gives no action",
    log,
    check: (acts) => {
      const ref = convertBatch(withoutChoice).filter((a) => a.t < 4000);
      const pass = acts.every((a) => a.t < 4000) && sameActions(acts, ref);
      return { pass, detail: `${acts.length} actions, all before the click (${names(acts).join(", ") || "none"})` };
    },
  });
}

// 6. (DECISIONS.md rule) While the buttons are off screen, intent is switched off, so even a
// long, straight movement toward the web button's column while reading About gives no HEAD.
{
  const log = [...start(), mouse(500, 400, 100), ...line(600, [400, 110], [400, 850], 20), choice(4000, "web")];
  CASES.push({
    name: "no HEAD actions while the buttons are off screen",
    log,
    check: (acts) => {
      const heads = names(acts).filter((s) => s.startsWith("HEAD"));
      return { pass: heads.length === 0, detail: `got ${names(acts).join(", ") || "(nothing)"}` };
    },
  });
}

export function runConverterTests() {
  const results = CASES.map((c) => {
    const acts = convertBatch(c.log);
    const r = c.check(acts);
    return { name: "7. Converter: " + c.name, pass: r.pass, detail: r.detail };
  });
  // Streaming gives the same answer as batch on every case.
  const mismatches = CASES.filter((c) => !sameActions(convertBatch(c.log), convertStreamWithTicks(c.log)));
  results.push({
    name: "7. Converter: convertStream gives the same result as convertBatch",
    pass: mismatches.length === 0,
    detail: mismatches.length === 0
      ? `identical on all ${CASES.length} cases (stream ticked every 100 ms)`
      : `differs on: ${mismatches.map((c) => c.name).join("; ")}`,
  });
  return results;
}

// Exported so other scripts can reuse the fixture.
export { LAYOUT as TEST_LAYOUT };
