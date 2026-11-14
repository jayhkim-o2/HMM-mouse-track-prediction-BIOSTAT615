// Every tunable number for the project lives here (SPEC Section 13).
// Change values here, never by hard-coding them in other files.

export const CONFIG = {
  // Bump this whenever a value below changes; every visit records it.
  CONFIG_VERSION: 2,        // v2: PAUSE_MS 10000 -> 3000 (owner, 2026-11-14)

  // --- Turning raw events into actions (SPEC Section 6.2) ---
  SECTION_DWELL_MS: 2000,   // a section must fill most of the screen this long to count as viewed
  PAUSE_MS: 3000,           // this long with no activity = one PAUSE action (SPEC said 10000; owner chose 3000)
  PAUSE_MAX_REPEAT: 3,      // at most this many PAUSEs in a row for one long pause
  PAUSE_MOVE_PX: 5,         // mouse moves smaller than this don't end a pause
  ZONE_PX: 150,             // pointer this close to a button = entered its zone
  ZONE_EXIT_PX: 170,        // must go this far away to count as leaving (stops flicker)
  REST_MS: 500,             // pointer inside a button this long = REST action
  HEAD_THRESHOLD: 0.6,      // intent probability needed for a HEAD action
  HEAD_SUSTAIN_MS: 500,     // ...held for this long

  // Intent module (owner's demo, ported; SPEC Section 6.3). Defaults = the demo's sliders.
  INTENT_KAPPA: 2,          // weight on "moving toward the button"
  INTENT_STAY: 0.98,        // chance the aimed-at button stays the same between movements
  INTENT_CLOSENESS: 1,      // weight on "close to the button"
  INTENT_TAU: 150,          // distance scale in pixels
  INTENT_MIN_MOVE_PX: 3,    // shorter movements have no reliable direction and are skipped

  // --- Recording rates ---
  MOUSE_HZ: 10,
  SCROLL_HZ: 10,

  // --- Evaluation (SPEC Section 8) ---
  SCORE_OFFSETS_S: [10, 5, 3, 2, 1],   // seconds before the click when methods are scored
  BASE_CHOICE: [1 / 3, 1 / 3, 1 / 3],  // how an UNDECIDED visitor splits among web/ai/person

  // --- Site behavior ---
  RANDOMIZE_CARD_ORDER: true,
  DESKTOP_MIN_WIDTH: 1024,
  DESKTOP_MIN_HEIGHT: 650,

  // --- Sending data (SPEC Section 10) ---
  SEND_TIMEOUT_MS: 10000,
  CHUNK_CHARS: 45000,
  PROJECT_CODE: "BIOSTAT615-SMIP",
  SCHEMA_VERSION: 1,
  // Owner's deployed Apps Script web app (receives visits; anyone can POST, nobody can read).
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbygutUgsi9fiNWfFyes4gj-jA0fLnBfWeReQKQQFnVm2FFyJk5i61lkzDMqrA65BFFx/exec",

  // --- Notice placeholders (fill in before real visits) ---
  COURSE: "[COURSE]",
  OWNER: "[OWNER]",
  DELETION_DATE: "[DELETION DATE]",

  // --- Role-play personas (SPEC Section 9.3); edit freely ---
  PERSONAS: [
    { id: "nurse", text: "A night-shift nurse who dislikes phone calls." },
    { id: "retiree", text: "A retiree who prefers talking to a person." },
    { id: "parent", text: "A busy parent who wants to finish on their own schedule." },
    { id: "student", text: "A student curious about AI." },
    { id: "privacy", text: "Someone worried about privacy." },
    { id: "slownet", text: "Someone with a slow internet connection." },
    { id: "slowtyper", text: "Someone who types slowly." },
    { id: "quick", text: "A person who wants it over with quickly." },
  ],
};

// The 16 action symbols, in index order (SPEC Section 6.2).
export const SYMBOLS = [
  "VIEW_ABOUT", "VIEW_FAQ", "VIEW_PARTICIPATE", "VIEW_CONTACT", "OPEN_FAQ", "PAUSE",
  "HEAD_WEB", "HEAD_AI", "HEAD_PERSON",
  "ZONE_WEB", "ZONE_AI", "ZONE_PERSON",
  "REST_WEB", "REST_AI", "REST_PERSON",
  "SWITCH",
];

// Look up a symbol's index by name, e.g. SYM.PAUSE === 5.
export const SYM = Object.fromEntries(SYMBOLS.map((s, i) => [s, i]));

// The three survey modes, in the order used everywhere (choice guesses, BASE_CHOICE).
export const OPTIONS = ["web", "ai", "person"];

// Hidden state names, in index order (SPEC Section 7).
export const STATES = ["UNDECIDED", "LEAN_WEB", "LEAN_AI", "LEAN_PERSON"];
