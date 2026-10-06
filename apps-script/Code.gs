/**
 * NRB World Event — Google Apps Script Backend (2-Day Event Edition)
 * ------------------------------------------------------------------
 * Supports 2-Day Event Pass Verification:
 *  - Style 1: Day 1 Only Pass
 *  - Style 2: Day 2 Only Pass
 *  - Style 3: Both Days (All Access)
 *
 * Supported Columns (Row 1):
 * ID | Name | Country | Pass Type | Day 1 Entry | Day 1 Time | Day 2 Entry | Day 2 Time | Gate | Checked By
 * (Also backwards-compatible with standard 8-column sheet)
 *
 * Web App Deployment Contract:
 *   Execute as: Me
 *   Who has access: Anyone
 */

const SHEET_ID = "108_Om2D_i_b4t_DxMEDoNmuMkWhS56aQHXz5HMp_rYA"; // NRB World Event Sheet
const SHEET_NAME = "Registrations";
const API_KEY = ""; // Optional secret key

const HEADERS_2DAY = [
  "ID",
  "Name",
  "Country",
  "Pass Type",
  "Day 1 Entry",
  "Day 1 Time",
  "Day 2 Entry",
  "Day 2 Time",
  "Gate",
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
      return checkin_(params.id, params.gate, params.checkedBy, params.day);
    case "newEntry":
      return newEntry_(
        params.id,
        params.name,
        params.country,
        params.passType,
        params.gate,
        params.checkedBy,
        params.day,
      );
    case "undoCheckin":
    case "undo":
    case "resetCheckin":
    case "reset":
    case "deleteCheckin":
    case "delete":
      return undoCheckin_(params.id, params.day);
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

function checkin_(id, gate, checkedBy, dayParam) {
  const key = normalizeId_(id);
  if (!key) return { ok: false, error: "Missing ID.", code: "config" };
  const targetDay = Number(dayParam) === 2 ? 2 : 1;

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const found = findById_(key);
    if (!found) return { ok: true, result: "not_registered", id: key };

    const attendee = found.attendee;
    const pass = String(attendee.passType || "Both Days");

    // Guard 1: Day validity
    if (targetDay === 1 && pass === "Day 2 Only") {
      return {
        ok: true,
        result: "invalid_day",
        attendee: attendee,
        reason: "This badge is valid for Day 2 only! Not permitted on Day 1.",
      };
    }
    if (targetDay === 2 && pass === "Day 1 Only") {
      return {
        ok: true,
        result: "invalid_day",
        attendee: attendee,
        reason: "This badge was valid for Day 1 only! Expired for Day 2.",
      };
    }

    // Guard 2: Already entered on target day
    const alreadyEnteredToday =
      targetDay === 1 ? attendee.day1Status === "ENTERED" : attendee.day2Status === "ENTERED";
    if (alreadyEnteredToday) {
      return { ok: true, result: "already", attendee: attendee };
    }

    const stamp = serverTimestamp_();
    const sheet = found.sheet;
    const numCols = sheet.getLastColumn();

    if (numCols >= 10) {
      // 10-column 2-Day format:
      // Col 5: Day 1 Entry, Col 6: Day 1 Time, Col 7: Day 2 Entry, Col 8: Day 2 Time, Col 9: Gate, Col 10: Checked By
      if (targetDay === 1) {
        sheet.getRange(found.row, 5).setValue("ENTERED");
        sheet.getRange(found.row, 6).setValue(stamp.display);
      } else {
        sheet.getRange(found.row, 7).setValue("ENTERED");
        sheet.getRange(found.row, 8).setValue(stamp.display);
      }
      sheet.getRange(found.row, 9).setValue(gate || "");
      sheet.getRange(found.row, 10).setValue(checkedBy || "");
    } else {
      // Standard 8-column layout
      sheet.getRange(found.row, 5).setValue("ENTERED");
      sheet.getRange(found.row, 6).setValue(stamp.display);
      sheet.getRange(found.row, 7).setValue(gate || "");
      sheet.getRange(found.row, 8).setValue(checkedBy || "");
    }
    SpreadsheetApp.flush();

    const updated = Object.assign({}, attendee, {
      entryStatus: "ENTERED",
      entryTime: stamp.iso,
      entryGate: gate || "",
      checkedBy: checkedBy || "",
    });
    if (targetDay === 1) {
      updated.day1Status = "ENTERED";
      updated.day1Time = stamp.iso;
    } else {
      updated.day2Status = "ENTERED";
      updated.day2Time = stamp.iso;
    }

    return { ok: true, result: "verified", attendee: updated };
  } finally {
    lock.releaseLock();
  }
}

function undoCheckin_(id, dayParam) {
  const key = normalizeId_(id);
  if (!key) return { ok: false, error: "Missing ID.", code: "config" };
  const targetDay = Number(dayParam) === 2 ? 2 : 1;

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const found = findById_(key);
    if (!found) return { ok: false, error: "Attendee ID not found in sheet.", code: "not_found" };

    const sheet = found.sheet;
    const numCols = sheet.getLastColumn();

    if (numCols >= 10) {
      if (targetDay === 1) {
        sheet.getRange(found.row, 5).setValue("NOT ENTERED");
        sheet.getRange(found.row, 6).setValue("");
      } else {
        sheet.getRange(found.row, 7).setValue("NOT ENTERED");
        sheet.getRange(found.row, 8).setValue("");
      }
    } else {
      sheet.getRange(found.row, 5).setValue("NOT ENTERED");
      sheet.getRange(found.row, 6).setValue("");
    }
    SpreadsheetApp.flush();

    const refreshed = findById_(key);
    return {
      ok: true,
      result: "undone",
      message: "Check-in undone successfully.",
      attendee: refreshed ? refreshed.attendee : null,
    };
  } finally {
    lock.releaseLock();
  }
}

function newEntry_(id, name, country, passTypeParam, gate, checkedBy, dayParam) {
  const key = normalizeId_(id);
  const person = String(name || "").trim();
  const from = String(country || "").trim();
  const pass = String(passTypeParam || "Both Days");
  const targetDay = Number(dayParam) === 2 ? 2 : 1;

  if (!key || !person || !from) {
    return { ok: false, error: "ID, name, and country are required.", code: "config" };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const found = findById_(key);
    if (found) {
      return checkin_(key, gate, checkedBy, targetDay);
    }

    const stamp = serverTimestamp_();
    const sheet = ensureSheet_();
    const numCols = sheet.getLastColumn();

    if (numCols >= 10) {
      sheet.appendRow([
        key,
        person,
        from,
        pass,
        targetDay === 1 ? "ENTERED" : "NOT ENTERED",
        targetDay === 1 ? stamp.display : "",
        targetDay === 2 ? "ENTERED" : "NOT ENTERED",
        targetDay === 2 ? stamp.display : "",
        gate || "",
        checkedBy || "",
      ]);
    } else {
      sheet.appendRow([
        key,
        person,
        from,
        pass,
        "ENTERED",
        stamp.display,
        gate || "",
        checkedBy || "",
      ]);
    }
    SpreadsheetApp.flush();

    return {
      ok: true,
      result: "verified",
      attendee: {
        id: key,
        name: person,
        country: from,
        passType: pass,
        registrationStatus: "NEW ENTRY",
        entryStatus: "ENTERED",
        entryTime: stamp.iso,
        day1Status: targetDay === 1 ? "ENTERED" : "NOT ENTERED",
        day1Time: targetDay === 1 ? stamp.iso : null,
        day2Status: targetDay === 2 ? "ENTERED" : "NOT ENTERED",
        day2Time: targetDay === 2 ? stamp.iso : null,
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
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn() || 1).getValues()[0];
  const missing = !header[0] || String(header[0]).toUpperCase() !== "ID";
  if (missing) {
    sheet.getRange(1, 1, 1, HEADERS_2DAY.length).setValues([HEADERS_2DAY]);
    sheet.getRange(1, 1, 1, HEADERS_2DAY.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function readAll_() {
  const sheet = ensureSheet_();
  const lastRow = sheet.getLastRow();
  const lastCol = Math.max(8, sheet.getLastColumn());
  if (lastRow < 2) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
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
  const lastCol = Math.max(8, sheet.getLastColumn());
  if (lastRow < 2) return null;
  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
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

  const rawCol3 = String(row[3] || "").trim();
  const pass = parsePassType_(rawCol3);

  let d1Status = "NOT ENTERED";
  let d1Time = "";
  let d2Status = "NOT ENTERED";
  let d2Time = "";
  let gate = "";
  let checkedBy = "";

  if (row.length >= 10) {
    d1Status = String(row[4] || "").toUpperCase() === "ENTERED" ? "ENTERED" : "NOT ENTERED";
    d1Time = formatCellTime_(row[5]);
    d2Status = String(row[6] || "").toUpperCase() === "ENTERED" ? "ENTERED" : "NOT ENTERED";
    d2Time = formatCellTime_(row[7]);
    gate = row[8] ? String(row[8]) : "";
    checkedBy = row[9] ? String(row[9]) : "";
  } else {
    // 8-column layout
    const entered = String(row[4] || "").toUpperCase() === "ENTERED";
    d1Status = entered ? "ENTERED" : "NOT ENTERED";
    d1Time = formatCellTime_(row[5]);
    gate = row[6] ? String(row[6]) : "";
    checkedBy = row[7] ? String(row[7]) : "";
  }

  const overallEntered = d1Status === "ENTERED" || d2Status === "ENTERED";

  return {
    id: id,
    name: String(row[1] || "").trim(),
    country: String(row[2] || "").trim(),
    passType: pass,
    registrationStatus: "REGISTERED",
    entryStatus: overallEntered ? "ENTERED" : "NOT ENTERED",
    entryTime: d2Time || d1Time,
    day1Status: d1Status,
    day1Time: d1Time,
    day2Status: d2Status,
    day2Time: d2Time,
    entryGate: gate,
    checkedBy: checkedBy,
  };
}

function parsePassType_(val) {
  const s = String(val || "").toLowerCase();
  if (s.indexOf("1") !== -1 && s.indexOf("2") === -1 && s.indexOf("both") === -1) {
    return "Day 1 Only";
  }
  if (s.indexOf("2") !== -1 && s.indexOf("1") === -1 && s.indexOf("both") === -1) {
    return "Day 2 Only";
  }
  return "Both Days";
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
