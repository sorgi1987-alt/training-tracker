'use strict';

const { normalizeName } = require('./normalizeName');
const { fetchVisibleExercises } = require('./exerciseVisibility');

// Builds a lookup index once per import request (spec section 7): exact
// name match first, then alias, then normalized name. Never used to
// silently create duplicates — callers surface an unmatched name for the
// user to resolve instead.
async function buildExerciseMatchIndex(catalystApp, userId) {
  const exercises = await fetchVisibleExercises(catalystApp, userId);
  const visibleIds = new Set(exercises.map((row) => row.ROWID));

  const exactByLower = new Map();
  const normalizedById = new Map();
  for (const row of exercises) {
    exactByLower.set(row.name.toLowerCase(), row);
    normalizedById.set(normalizeName(row.name), row);
  }

  const aliasTable = catalystApp.datastore().table('ExerciseAlias');
  const aliasRows = [];
  let nextToken;
  let more = true;
  while (more) {
    const { data, next_token, more_records } = await aliasTable.getPagedRows({ nextToken, maxRows: 300 });
    aliasRows.push(...data);
    more = more_records;
    nextToken = next_token;
  }

  const byId = new Map(exercises.map((row) => [row.ROWID, row]));
  const aliasByNormalized = new Map();
  for (const alias of aliasRows) {
    if (!visibleIds.has(alias.exercise_id)) continue;
    aliasByNormalized.set(normalizeName(alias.alias_name), byId.get(alias.exercise_id));
  }

  return { exactByLower, normalizedById, aliasByNormalized };
}

// Returns { exercise, matchType } where matchType is 'exact' | 'alias' |
// 'normalized', or { exercise: null, matchType: null } if nothing matched.
function matchExerciseName(index, rawName) {
  const trimmed = String(rawName || '').trim();
  if (!trimmed) return { exercise: null, matchType: null };

  const exact = index.exactByLower.get(trimmed.toLowerCase());
  if (exact) return { exercise: exact, matchType: 'exact' };

  const normalized = normalizeName(trimmed);
  const alias = index.aliasByNormalized.get(normalized);
  if (alias) return { exercise: alias, matchType: 'alias' };

  const byNormalizedName = index.normalizedById.get(normalized);
  if (byNormalizedName) return { exercise: byNormalizedName, matchType: 'normalized' };

  return { exercise: null, matchType: null };
}

module.exports = { buildExerciseMatchIndex, matchExerciseName };
