// Runs one visit on the study site (SPEC Section 5.1):
// desktop check -> notice -> (role-play screen) -> browse while recording -> choice -> thank you.
// Sending to the Google Sheet is added in checkpoint step 6; for now every visit is
// kept in localStorage and offered as a download.

import { CONFIG, OPTIONS } from "../core/config.js";
import { createRecorder } from "./recorder.js";

const $ = (id) => document.getElementById(id);

// ---------- URL parameters ----------
const params = new URLSearchParams(location.search);
const rawPid = (params.get("pid") || "").toUpperCase();
const pid = /^P[1-9]$/.test(rawPid) ? rawPid : null;   // only P1..P9 are accepted
const isDemo = params.get("demo") === "1";
const isRoleplay = params.get("rp") === "1";
const mode = isDemo ? "demo" : isRoleplay ? "roleplay" : "natural";

// ---------- Small helpers for localStorage (it can be blocked, so never let it crash) ----------
function storeGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
function storeSet(key, value) { try { localStorage.setItem(key, value); return true; } catch { return false; } }

// ---------- Desktop check (SPEC Section 2) ----------
function isDesktop() {
  return window.matchMedia("(pointer: fine)").matches
    && window.innerWidth >= CONFIG.DESKTOP_MIN_WIDTH
    && window.innerHeight >= CONFIG.DESKTOP_MIN_HEIGHT;
}

// ---------- Cards, in random order ----------
const CARD_TEXT = {
  web: { title: "Web survey", desc: "Answer the questions online, on your own, whenever it suits you." },
  ai: { title: "AI phone interview", desc: "Answer the questions out loud with an automated voice on a call." },
  person: { title: "Phone interview with a person", desc: "Answer with a trained interviewer on a call scheduled for a later time." },
};

function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {   // Fisher-Yates shuffle
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const cardOrder = CONFIG.RANDOMIZE_CARD_ORDER ? shuffled(OPTIONS) : OPTIONS.slice();

for (const o of cardOrder) {
  const card = document.createElement("div");
  card.className = "card";
  card.id = "card-" + o;
  card.innerHTML = `<h3></h3><p></p><button type="button" id="opt-${o}">Choose this option</button>`;
  card.querySelector("h3").textContent = CARD_TEXT[o].title;
  card.querySelector("p").textContent = CARD_TEXT[o].desc;
  $("cards").appendChild(card);
}

// ---------- Role-play persona (only with ?rp=1) ----------
// Avoid giving the same pid the same persona twice, using a list kept in localStorage.
function pickPersona() {
  const key = "smip_personas_" + (pid || "nopid");
  let used = [];
  try { used = JSON.parse(storeGet(key) || "[]"); } catch { used = []; }
  let pool = CONFIG.PERSONAS.filter((p) => !used.includes(p.id));
  if (pool.length === 0) { pool = CONFIG.PERSONAS; used = []; }   // all used: start over
  const persona = pool[Math.floor(Math.random() * pool.length)];
  storeSet(key, JSON.stringify([...used, persona.id]));
  return { persona, visitNumber: used.length + 1 };
}

// ---------- Visit metadata (SPEC Section 6.1) ----------
const meta = {
  visit_id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + "-" + String(Math.random()).slice(2),
  schema_version: CONFIG.SCHEMA_VERSION,
  config_version: CONFIG.CONFIG_VERSION,
  project_code: CONFIG.PROJECT_CODE,
  mode,
  pid,
  persona_id: null,
  card_order: cardOrder,
  user_agent: navigator.userAgent,
  started_at: null,
};

// Demo mode only: load the live panel. Outside demo mode this file is never even downloaded.
let demoPanel = null;
const recorder = createRecorder({
  cardOrder,
  onEvent: isDemo ? (ev) => demoPanel && demoPanel.onEvent(ev) : null,
});
if (isDemo) {
  const { createDemoPanel } = await import("./demo-panel.js");
  demoPanel = createDemoPanel({ getElapsed: () => recorder.elapsed() });
}

// ---------- Flow ----------
function showNotice() {
  $("noticeText").textContent =
    `This is a class project for ${CONFIG.COURSE}, not real research and not a real study. ` +
    "While you browse, this page records your scrolling, clicks, mouse movement and timing. " +
    "It does not record anything you type, your name, or your email. Taking part is voluntary; " +
    "you can close this tab at any time, and unfinished visits are thrown away. " +
    `Only ${CONFIG.OWNER} and the course instructor will see the data, and it will be deleted after ${CONFIG.DELETION_DATE}.`;
  $("notice").hidden = false;
}

function startRecording() {
  meta.started_at = new Date().toISOString();
  recorder.start();   // time zero is now
}

if (!isDesktop()) {
  // Fail the check: show the message and never record.
  $("minsize").textContent = `${CONFIG.DESKTOP_MIN_WIDTH} × ${CONFIG.DESKTOP_MIN_HEIGHT}`;
  $("cursize").textContent = `Your window is ${window.innerWidth} × ${window.innerHeight}` +
    (window.matchMedia("(pointer: fine)").matches ? "." : ", and no mouse or trackpad was detected.");
  $("nodesktop").hidden = false;
} else {
  showNotice();
}

$("agree").addEventListener("click", () => {
  $("notice").hidden = true;
  if (isRoleplay) {
    const { persona, visitNumber } = pickPersona();
    meta.persona_id = persona.id;
    $("rpPersona").textContent = persona.text;
    $("rpVisit").textContent = pid ? `Participant ${pid}, visit ${visitNumber}` : "";
    $("roleplay").hidden = false;
  }
  // SPEC: time zero is the moment "I agree" is clicked, so start now even in role-play.
  startRecording();
});
$("rpStart").addEventListener("click", () => { $("roleplay").hidden = true; });

// ---------- Choice ----------
let payload = null;
for (const o of OPTIONS) {
  $("opt-" + o).addEventListener("click", () => {
    const rawLog = recorder.finish(o);
    if (!rawLog) return;            // not recording (e.g. clicked twice)
    payload = { ...meta, choice: o, raw_log: rawLog };

    // Backup: keep the visit in localStorage until it's confirmed sent (step 6).
    const saved = storeSet("smip_pending_" + meta.visit_id, JSON.stringify(payload));
    $("sendStatus").textContent = saved
      ? "Your recording is saved in this browser. Sending to the project sheet isn't set up yet, so you can download it below."
      : "Sending to the project sheet isn't set up yet, so please download your recording below.";
    $("download").hidden = false;
    $("thanks").hidden = false;
  });
}

// "Download my recording": saves the same JSON that will be sent.
$("download").addEventListener("click", () => {
  if (!payload) return;
  const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `visit_${meta.visit_id}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
