'use strict';

// Catalyst ROWIDs are numeric strings. Route params that should be a ROWID
// are validated against this before ever being interpolated into a ZCQL
// query — since only digits pass, there is no injection surface.
function assertRowId(value, label = 'id') {
  const str = String(value ?? '');
  if (!/^\d+$/.test(str)) {
    const err = new Error(`Invalid ${label}`);
    err.status = 400;
    throw err;
  }
  return str;
}

// ZCQL results come back as [{ TableName: { col, ROWID, ... } }] — unwrap.
async function zcqlSelect(catalystApp, tableName, query) {
  const rows = await catalystApp.zcql().executeZCQLQuery(query);
  return rows.map((row) => row[tableName]);
}

function notFound(message) {
  const err = new Error(message);
  err.status = 404;
  return err;
}

function forbidden(message) {
  const err = new Error(message);
  err.status = 403;
  return err;
}

// Drops null/undefined properties so optional numeric/date columns are left
// unset on insert rather than sent as an empty string (which some Catalyst
// column types reject).
function compact(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== null && v !== undefined));
}

function numOrNull(value) {
  return value === undefined || value === null || value === '' ? null : Number(value);
}

function isTrue(value) {
  return value === true || value === 'true';
}

// Fetches every row in tableName whose whereColumn equals whereId, ordered
// by orderColumn ascending. orderColumn is always a fixed literal from our
// own code (never request input), so it's safe to interpolate directly.
async function fetchWhere(catalystApp, tableName, whereColumn, whereId, orderColumn = 'order_index') {
  const id = assertRowId(whereId, whereColumn);
  const query = `SELECT * FROM ${tableName} WHERE ${whereColumn} = '${id}' ORDER BY ${orderColumn} ASC`;
  return zcqlSelect(catalystApp, tableName, query);
}

// Catalyst `datetime` columns reject ISO 8601 (`Date#toISOString()`) — the
// docs specify writes need exactly "YYYY-MM-DD HH:MM:SS" (no milliseconds)
// in the project's own timezone (Europe/Madrid for this project). Reads
// (e.g. CREATEDTIME) come back with a trailing ":mmm" — that's a read-only
// display format, not accepted on write; fromCatalystDateTime below
// tolerates both.
function toCatalystDateTime(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
    .formatToParts(date)
    .reduce((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

function madridOffsetMinutes(utcGuessMs) {
  // Compare at whole-second precision on both sides — mixing a
  // millisecond-precision instant against a seconds-only reconstruction
  // corrupts the result by that many milliseconds (offsets are always a
  // clean number of minutes in reality).
  const flooredMs = Math.floor(utcGuessMs / 1000) * 1000;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Madrid',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
    .formatToParts(new Date(flooredMs))
    .reduce((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});
  const asIfUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return Math.round((asIfUtc - flooredMs) / 60000);
}

// Reverses toCatalystDateTime: the stored string is Madrid wall-clock time,
// not UTC, so a plain `new Date(value)` would misparse it.
function fromCatalystDateTime(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})(?::(\d{3}))?$/.exec(value || '');
  if (!match) return new Date(value);
  const [year, month, day, hour, minute, second, ms] = match.slice(1).map((part) => Number(part) || 0);
  const naiveUtcMs = Date.UTC(year, month - 1, day, hour, minute, second, ms);
  const offsetMinutes = madridOffsetMinutes(naiveUtcMs);
  return new Date(naiveUtcMs - offsetMinutes * 60000);
}

// The frontend only ever sees proper ISO strings — Catalyst's own datetime
// format is a backend-only implementation detail.
function toIsoOrNull(value) {
  if (!value) return null;
  const date = fromCatalystDateTime(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

module.exports = {
  assertRowId,
  zcqlSelect,
  notFound,
  forbidden,
  compact,
  numOrNull,
  isTrue,
  fetchWhere,
  toCatalystDateTime,
  fromCatalystDateTime,
  toIsoOrNull
};
