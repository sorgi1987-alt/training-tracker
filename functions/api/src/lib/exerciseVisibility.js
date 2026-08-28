'use strict';

// An exercise row is visible to a user if it's a system exercise (no owner)
// or if they own it. Shared between the exercise library routes and plan
// routes (which need to validate an exercise reference on creation).
function isExerciseVisible(row, userId) {
  return Boolean(row) && (!row.owner_user_id || row.owner_user_id === userId);
}

function isActiveRow(row) {
  return row.is_active === true || row.is_active === 'true';
}

// The system exercise library is a curated ~100-200 rows (spec section 48),
// so fetching everything visible to this caller and filtering in memory is
// simpler and safer than building raw ZCQL search queries, with no
// meaningful performance cost at this scale.
async function fetchVisibleExercises(catalystApp, userId) {
  const table = catalystApp.datastore().table('Exercise');
  const rows = [];
  let nextToken;
  let more = true;

  while (more) {
    const { data, next_token, more_records } = await table.getPagedRows({
      nextToken,
      maxRows: 300
    });
    rows.push(...data);
    more = more_records;
    nextToken = next_token;
  }

  return rows.filter((row) => isActiveRow(row) && isExerciseVisible(row, userId));
}

module.exports = { isExerciseVisible, isActiveRow, fetchVisibleExercises };
