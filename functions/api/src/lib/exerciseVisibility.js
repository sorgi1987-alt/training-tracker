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

module.exports = { isExerciseVisible, isActiveRow };
