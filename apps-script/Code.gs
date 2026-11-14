// Google Apps Script receiver for the Survey-Mode Intent Predictor (SPEC Section 10).
// Paste this whole file into the Apps Script editor of the project's Google Sheet,
// then Deploy -> New deployment -> (gear) Web app, Execute as: Me, Who has access: Anyone.
//
// The study site POSTs one visit as JSON. This script checks it, splits the JSON into
// chunks (a Sheet cell holds at most 50,000 characters), and appends one row per chunk.
// Invalid posts are rejected and add no rows.

// Must match core/config.js. (Not a secret: it only filters out stray or junk posts.)
var PROJECT_CODE = "BIOSTAT615-SMIP";
var KNOWN_SCHEMA_VERSIONS = [1];
var MAX_BODY_CHARS = 1000000;   // about 1 MB
var CHUNK_CHARS = 45000;
var VALID_MODES = ["natural", "roleplay", "demo"];
var VALID_CHOICES = ["web", "ai", "person"];
var HEADER = ["received_at", "visit_id", "part", "n_parts", "mode", "pid", "persona_id", "choice", "json_chunk"];

function doPost(e) {
  try {
    var body = (e && e.postData && e.postData.contents) || "";
    if (body.length === 0) return reply({ ok: false, error: "empty body" });
    if (body.length > MAX_BODY_CHARS) return reply({ ok: false, error: "body over 1 MB" });

    var visit;
    try { visit = JSON.parse(body); } catch (err) { return reply({ ok: false, error: "not valid JSON" }); }

    // Validation: anything that fails is rejected with no row written.
    if (visit.project_code !== PROJECT_CODE) return reply({ ok: false, error: "wrong project_code" });
    if (KNOWN_SCHEMA_VERSIONS.indexOf(visit.schema_version) === -1) return reply({ ok: false, error: "unknown schema_version" });
    if (typeof visit.visit_id !== "string" || visit.visit_id.length < 8 || visit.visit_id.length > 64) {
      return reply({ ok: false, error: "bad visit_id" });
    }
    if (VALID_MODES.indexOf(visit.mode) === -1) return reply({ ok: false, error: "bad mode" });
    if (VALID_CHOICES.indexOf(visit.choice) === -1) return reply({ ok: false, error: "bad choice" });
    if (!Array.isArray(visit.raw_log)) return reply({ ok: false, error: "missing raw_log" });

    // Only one write at a time, so rows from two visits never interleave.
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
      if (sheet.getLastRow() === 0) sheet.appendRow(HEADER);

      // If this visit was already saved (the site retried after a lost reply), don't save it twice.
      if (alreadySaved(sheet, visit.visit_id)) return reply({ ok: true, visit_id: visit.visit_id, duplicate: true });

      var nParts = Math.max(1, Math.ceil(body.length / CHUNK_CHARS));
      var receivedAt = new Date().toISOString();
      var rows = [];
      for (var i = 0; i < nParts; i++) {
        rows.push([
          receivedAt, visit.visit_id, i + 1, nParts, visit.mode,
          visit.pid || "", visit.persona_id || "", visit.choice,
          body.substring(i * CHUNK_CHARS, (i + 1) * CHUNK_CHARS),
        ]);
      }
      // Write all chunks in one call. Cells are formatted as plain text first so Sheets
      // never turns a JSON chunk into a number or date.
      var range = sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, HEADER.length);
      range.setNumberFormat("@");
      range.setValues(rows);
    } finally {
      lock.releaseLock();
    }
    return reply({ ok: true, visit_id: visit.visit_id });
  } catch (err) {
    return reply({ ok: false, error: "server error: " + err });
  }
}

// Opening the web app URL in a browser shows this; handy to check the deployment works.
function doGet() {
  return reply({ ok: true, message: "Survey-mode receiver is running. Visits are sent here by POST." });
}

function alreadySaved(sheet, visitId) {
  var last = sheet.getLastRow();
  if (last < 2) return false;
  var ids = sheet.getRange(2, 2, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (ids[i][0] === visitId) return true;
  return false;
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
