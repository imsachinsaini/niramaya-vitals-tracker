const SHEET_NAME = "Vitals";
const HEADERS = [
  "id",
  "patient",
  "measuredAt",
  "systolic",
  "diastolic",
  "spo2",
  "pulse",
  "temperature",
  "notes",
  "updatedAt"
];

function doGet(event) {
  try {
    const params = event.parameter || {};

    if (!params.action || params.action === "ping") {
      return jsonOrJsonp({
        ok: true,
        message: "Niramaya sync endpoint is running."
      }, params.callback);
    }

    assertAccess(params.accessCode);

    if (params.action === "read") {
      return jsonOrJsonp({
        ok: true,
        entries: readEntries(getSheet())
      }, params.callback);
    }

    return jsonOrJsonp({
      ok: false,
      error: "Unsupported action."
    }, params.callback);
  } catch (error) {
    return jsonOrJsonp({
      ok: false,
      error: error.message
    }, event.parameter && event.parameter.callback);
  }
}

function doPost(event) {
  try {
    const body = event.parameter && event.parameter.payload
      ? JSON.parse(event.parameter.payload)
      : JSON.parse(event.postData.contents || "{}");
    assertAccess(body.accessCode);

    if (body.action !== "sync") {
      throw new Error("Unsupported action.");
    }

    const sheet = getSheet();
    const existing = readEntries(sheet);
    const merged = mergeEntries(existing, body.entries || []);
    writeEntries(sheet, merged);

    return jsonOutput({
      ok: true,
      entries: merged
    });
  } catch (error) {
    return jsonOutput({
      ok: false,
      error: error.message
    });
  }
}

function assertAccess(accessCode) {
  const expected = PropertiesService.getScriptProperties().getProperty("NIRAMAYA_ACCESS_CODE");
  if (!expected) {
    throw new Error("NIRAMAYA_ACCESS_CODE script property is not set.");
  }
  if (String(accessCode || "") !== expected) {
    throw new Error("Invalid access code.");
  }
}

function getSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(SHEET_NAME);

  const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
  const currentHeaders = headerRange.getValues()[0];
  const hasHeaders = currentHeaders.some(Boolean);
  if (!hasHeaders) {
    headerRange.setValues([HEADERS]);
    sheet.setFrozenRows(1);
  }
  sheet.getRange("C:C").setNumberFormat("@");
  sheet.getRange("J:J").setNumberFormat("@");
  return sheet;
}

function readEntries(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  return sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues()
    .filter((row) => row[0])
    .map((row) => objectFromRow(row));
}

function mergeEntries(existing, incoming) {
  const byId = {};

  existing.forEach((entry) => {
    byId[entry.id] = entry;
  });

  incoming.map(normalizeEntry).forEach((entry) => {
    const current = byId[entry.id];
    if (!current || new Date(entry.updatedAt) >= new Date(current.updatedAt)) {
      byId[entry.id] = entry;
    }
  });

  return Object.values(byId).sort((a, b) => new Date(a.measuredAt) - new Date(b.measuredAt));
}

function normalizeEntry(entry) {
  return {
    id: String(entry.id || Utilities.getUuid()),
    patient: String(entry.patient || "Unnamed patient"),
    measuredAt: String(entry.measuredAt || new Date().toISOString()),
    systolic: Number(entry.systolic || 0),
    diastolic: Number(entry.diastolic || 0),
    spo2: Number(entry.spo2 || 0),
    pulse: Number(entry.pulse || 0),
    temperature: entry.temperature === "" || entry.temperature == null ? "" : Number(entry.temperature),
    notes: String(entry.notes || ""),
    updatedAt: String(entry.updatedAt || new Date().toISOString())
  };
}

function objectFromRow(row) {
  return normalizeEntry({
    id: row[0],
    patient: row[1],
    measuredAt: row[2],
    systolic: row[3],
    diastolic: row[4],
    spo2: row[5],
    pulse: row[6],
    temperature: row[7],
    notes: row[8],
    updatedAt: row[9]
  });
}

function writeEntries(sheet, entries) {
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length).clearContent();
  }

  if (!entries.length) return;

  const rows = entries.map((entry) => HEADERS.map((key) => entry[key]));
  sheet.getRange(2, 1, rows.length, HEADERS.length).setValues(rows);
}

function jsonOutput(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonOrJsonp(payload, callback) {
  if (callback) {
    return ContentService
      .createTextOutput(String(callback) + "(" + JSON.stringify(payload) + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return jsonOutput(payload);
}
