/**
 * Gateflow — Google Apps Script backend
 * -------------------------------------
 * Bind this script to your registration spreadsheet (Extensions → Apps Script)
 * or paste the spreadsheet ID into SHEET_ID below for a standalone project.
 *
 * Deploy: Deploy → New deployment → Type: Web app
 *   Execute as: Me
 *   Who has access: Anyone
 *
 * Then paste the web app URL into Gateflow → Setup.
 *
 * Columns (row 1):
 * ID | Name | Country | Registration Status | Entry Status | Entry Time | Entry Gate | Checked By
 */

const SHEET_ID = "108_Om2D_i_b4t_DxMEDoNmuMkWhS56aQHXz5HMp_rYA"; // NRB World Event Google Sheet
const SHEET_NAME = "Registrations";
const API_KEY = ""; // optional. If set, the app must send the same key.

const HEADERS = [
  "ID",
  "Name",
  "Country",
  "Registration Status",
  "Entry Status",
  "Entry Time",
  "Entry Gate",
  "Checked By",
];

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const params = (e && e.parameter) || {};
  const callback = params.callback;
  try {
    if (API_KEY && params.key !== API_KEY) {
      return respond_({ ok: false, error: "Invalid API key.", code: "auth" }, callback);
    }
    const action = String(params.action || "health");
    const payload = dispatch_(action, params);
    return respond_(payload, callback);
  } catch (error) {
    return respond_(
      { ok: false, error: String(error && error.message ? error.message : error), code: "server" },
      callback,
    );
  }
}

function dispatch_(action, params) {
  switch (action) {
    case "health":
      return health_();
    case "list":
      return list_();
    case "ids":
      return ids_();
    case "lookup":
      return lookup_(params.id);
    case "checkin":
      return checkin_(params.id, params.gate, params.checkedBy);
    case "newEntry":
      return newEntry_(params.id, params.name, params.country, params.gate, params.checkedBy);
    case "setup":
      return { ok: true, sheet: ensureSheet_().getName(), headers: HEADERS };
    default:
      return { ok: false, error: "Unknown action: " + action, code: "config" };
  }
}

function health_() {
  const sheet = ensureSheet_();
  return {
    ok: true,
    now: new Date().toISOString(),
    sheet: sheet.getName(),
    rows: Math.max(0, sheet.getLastRow() - 1),
  };
}

function list_() {
  const attendees = readAll_();
  return { ok: true, attendees: attendees };
}

function ids_() {
  const attendees = readAll_();
  return { ok: true, ids: attendees.map(function (row) { return row.id; }) };
}

function lookup_(id) {
  const key = normalizeId_(id);
  if (!key) return { ok: false, error: "Missing ID.", code: "config" };
  const row = findById_(key);
  if (!row) return { ok: true, found: false, id: key };
  return { ok: true, found: true, attendee: row.attendee };
}

function checkin_(id, gate, checkedBy) {
  const key = normalizeId_(id);
  if (!key) return { ok: false, error: "Missing ID.", code: "config" };

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const found = findById_(key);
    if (!found) return { ok: true, result: "not_registered", id: key };
    if (found.attendee.entryStatus === "ENTERED") {
      return { ok: true, result: "already", attendee: found.attendee };
    }
    const stamp = serverTimestamp_();
    const sheet = found.sheet;
    sheet.getRange(found.row, 5).setValue("ENTERED");
    sheet.getRange(found.row, 6).setValue(stamp.display);
    sheet.getRange(found.row, 7).setValue(gate || "");
    sheet.getRange(found.row, 8).setValue(checkedBy || "");
    SpreadsheetApp.flush();
    const attendee = Object.assign({}, found.attendee, {
      entryStatus: "ENTERED",
      entryTime: stamp.iso,
      entryGate: gate || "",
      checkedBy: checkedBy || "",
    });
    return { ok: true, result: "verified", attendee: attendee };
  } finally {
    lock.releaseLock();
  }
}

function newEntry_(id, name, country, gate, checkedBy) {
  const key = normalizeId_(id);
  const person = String(name || "").trim();
  const from = String(country || "").trim();
  if (!key || !person || !from) {
    return { ok: false, error: "ID, name, and country are required.", code: "config" };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const found = findById_(key);
    if (found && found.attendee.entryStatus === "ENTERED") {
      return { ok: true, result: "already", attendee: found.attendee };
    }
    const stamp = serverTimestamp_();
    const sheet = ensureSheet_();
    if (found) {
      sheet.getRange(found.row, 2).setValue(person);
      sheet.getRange(found.row, 3).setValue(from);
      sheet.getRange(found.row, 5).setValue("ENTERED");
      sheet.getRange(found.row, 6).setValue(stamp.display);
      sheet.getRange(found.row, 7).setValue(gate || "");
      sheet.getRange(found.row, 8).setValue(checkedBy || "");
      SpreadsheetApp.flush();
      const attendee = Object.assign({}, found.attendee, {
        name: person,
        country: from,
        entryStatus: "ENTERED",
        entryTime: stamp.iso,
        entryGate: gate || "",
        checkedBy: checkedBy || "",
      });
      return { ok: true, result: "verified", attendee: attendee };
    }
    sheet.appendRow([
      key,
      person,
      from,
      "NEW ENTRY",
      "ENTERED",
      stamp.display,
      gate || "",
      checkedBy || "",
    ]);
    SpreadsheetApp.flush();
    return {
      ok: true,
      result: "verified",
      attendee: {
        id: key,
        name: person,
        country: from,
        registrationStatus: "NEW ENTRY",
        entryStatus: "ENTERED",
        entryTime: stamp.iso,
        entryGate: gate || "",
        checkedBy: checkedBy || "",
      },
    };
  } finally {
    lock.releaseLock();
  }
}

function getSpreadsheet_() {
  if (SHEET_ID) return SpreadsheetApp.openById(SHEET_ID);
  const active = SpreadsheetApp.getActive();
  if (active) return active;
  throw new Error("Set SHEET_ID at the top of Code.gs or bind this script to a spreadsheet.");
}

function ensureSheet_() {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  const lastCol = Math.max(sheet.getLastColumn(), HEADERS.length);
  const header = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const missing = !header[0] || String(header[0]).toUpperCase() !== "ID";
  if (missing) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  if (lastCol) {
    /* keep existing extra columns untouched */
  }
  return sheet;
}

function readAll_() {
  const sheet = ensureSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
  const out = [];
  for (let i = 0; i < values.length; i++) {
    const attendee = rowToAttendee_(values[i]);
    if (attendee) out.push(attendee);
  }
  return out;
}

function findById_(id) {
  const sheet = ensureSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const values = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
  for (let i = 0; i < values.length; i++) {
    const attendee = rowToAttendee_(values[i]);
    if (attendee && attendee.id === id) {
      return { sheet: sheet, row: i + 2, attendee: attendee };
    }
  }
  return null;
}

function rowToAttendee_(row) {
  const id = normalizeId_(row[0]);
  if (!id) return null;
  const registration = String(row[3] || "REGISTERED").toUpperCase();
  const entry = String(row[4] || "NOT ENTERED").toUpperCase();
  return {
    id: id,
    name: String(row[1] || "").trim(),
    country: String(row[2] || "").trim(),
    registrationStatus: registration === "NEW ENTRY" ? "NEW ENTRY" : "REGISTERED",
    entryStatus: entry === "ENTERED" ? "ENTERED" : "NOT ENTERED",
    entryTime: formatCellTime_(row[5]),
    entryGate: row[6] ? String(row[6]) : "",
    checkedBy: row[7] ? String(row[7]) : "",
  };
}

function formatCellTime_(value) {
  if (!value) return "";
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value)) {
    return value.toISOString();
  }
  return String(value);
}

function serverTimestamp_() {
  const ss = getSpreadsheet_();
  const tz = ss.getSpreadsheetTimeZone() || "UTC";
  const now = new Date();
  return {
    iso: now.toISOString(),
    display: Utilities.formatDate(now, tz, "yyyy-MM-dd HH:mm:ss"),
  };
}

function normalizeId_(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function respond_(obj, callback) {
  const json = JSON.stringify(obj);
  if (callback) {
    return ContentService.createTextOutput(callback + "(" + json + ")")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}
