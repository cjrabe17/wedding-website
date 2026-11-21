/**
 * RSVP backend for idointhedesert.com
 *
 * Lives in the wedding Google Sheet (Extensions → Apps Script) and is deployed
 * as a Web app. See README.md in this folder.
 *
 *  - Guest list: read from the "Guests" tab (columns: Party, Name).
 *    Guests with the same Party value RSVP together. A row named "Plus one"
 *    (or +1) gives that party a plus one.
 *  - RSVPs: written to the "RSVPs" tab, one row per guest.
 *
 * The guest list is never sent to the website in full. A lookup only returns
 * the party of the person whose name was typed.
 */

var GUESTS_SHEET = 'Guests';
var RSVP_SHEET = 'RSVPs';
var GUEST_HEADERS = ['Party', 'Name'];
var RSVP_HEADERS = [
  'Submitted', 'Submission ID', 'Party', 'Responded by',
  'Guest', 'Type', 'Attending', 'Dietary / notes', 'Note for the couple'
];
var PLUS_ONE = '+1';
var MAX_LEN = 1000;

// ── Requests ────────────────────────────────────────────────────────────────

// GET ?action=lookup&name=Smith → { ok, matches: [{ guest, party: [names…] }] }
// GET (no params)               → health check
function doGet(e) {
  try {
    var params = (e && e.parameter) || {};
    if (params.action === 'lookup') {
      return json_({ ok: true, matches: findByName_(params.name || '') });
    }
    return json_({ ok: true, message: 'RSVP endpoint is running.' });
  } catch (err) {
    return json_({ ok: false, error: errMsg_(err) });
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var data = JSON.parse(e.postData.contents);
    if (!data || !Array.isArray(data.guests) || data.guests.length === 0) {
      throw new Error('Invalid RSVP: guests missing');
    }
    checkAgainstGuestList_(data);

    var sheet = getSheet_(RSVP_SHEET, RSVP_HEADERS);
    var now = new Date();
    var id = Utilities.getUuid().slice(0, 8);
    var rows = data.guests.map(function (g) {
      return [
        now, id, clean_(data.party), clean_(data.respondedBy),
        clean_(g.name), g.plusOne ? 'Plus one' : 'Invited', g.attending ? 'Yes' : 'No',
        clean_(g.notes), clean_(data.note)
      ];
    });
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, RSVP_HEADERS.length).setValues(rows);
    return json_({ ok: true, id: id });
  } catch (err) {
    return json_({ ok: false, error: errMsg_(err) });
  } finally {
    lock.releaseLock();
  }
}

// ── Guest list ──────────────────────────────────────────────────────────────

// Returns an array of parties, each an array of names (plus ones as "+1").
function getParties_() {
  var sheet = getSheet_(GUESTS_SHEET, GUEST_HEADERS);
  var range = sheet.getDataRange();
  var values = range.getValues().slice(1);
  var formulas = range.getFormulas().slice(1);
  var order = [], byKey = {};
  values.forEach(function (row, i) {
    var party = String(row[0]).trim();
    var name = String(row[1]).trim().replace(/\s+/g, ' ');
    if (isPlusOneCell_(name, formulas[i][1])) name = PLUS_ONE;
    if (!name) return;
    var key = party || ('__row' + i); // no party → their own party of one
    if (!byKey[key]) { byKey[key] = []; order.push(key); }
    byKey[key].push(name);
  });
  return order.map(function (k) { return byKey[k]; });
}

function isPlusOne_(name) { return name === PLUS_ONE; }

// Typing +1 into a cell makes Sheets store the formula =+1 (value 1), so accept
// that as well as the text "+1", "Plus one", "Plus 1" and "Plus-one".
function isPlusOneCell_(text, formula) {
  if (String(formula).replace(/\s/g, '') === '=+1') return true;
  return /^(\+1|plus[\s-]*(one|1))$/i.test(text);
}
function norm_(s) { return String(s).toLowerCase().trim(); }

function findByName_(input) {
  var q = norm_(input);
  if (!q || isPlusOne_(q)) return [];
  var matches = [];
  getParties_().forEach(function (party) {
    party.forEach(function (guest) {
      if (isPlusOne_(guest)) return;
      if (nameMatches_(guest, q)) {
        matches.push({ guest: guest, party: party });
      }
    });
  });
  return matches;
}

// True if q is the full name, any single word of it (hyphenated parts count
// separately), or the first/last few words, e.g. "de la cruz" or "maria de".
function nameMatches_(guest, q) {
  q = q.replace(/\s+/g, ' ');
  var full = norm_(guest);
  return full === q ||
    full.split(/[\s-]+/).indexOf(q) !== -1 ||
    (' ' + full).slice(-(q.length + 1)) === ' ' + q ||
    full.indexOf(q + ' ') === 0;
}

// Rejects RSVPs that don't line up with a real party on the guest list.
function checkAgainstGuestList_(data) {
  var responder = norm_(data.respondedBy);
  var party = getParties_().filter(function (p) {
    return p.some(function (g) { return norm_(g) === responder; });
  })[0];
  if (!party) throw new Error('Not on the guest list');

  var invited = party.filter(function (g) { return !isPlusOne_(g); }).map(norm_);
  var plusOnes = party.length - invited.length;
  var sentPlusOnes = 0;
  data.guests.forEach(function (g) {
    if (g.plusOne) sentPlusOnes++;
    else if (invited.indexOf(norm_(g.name)) === -1) throw new Error('Guest not in this party');
  });
  if (sentPlusOnes > plusOnes) throw new Error('Too many plus ones');
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function getSheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Trim, cap length, and stop guest-typed text from being run as a formula.
function clean_(v) {
  var s = String(v == null ? '' : v).trim().slice(0, MAX_LEN);
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}

function errMsg_(err) { return String((err && err.message) || err); }

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
