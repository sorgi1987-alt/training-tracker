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

module.exports = { assertRowId, zcqlSelect, notFound, forbidden, compact, numOrNull };
