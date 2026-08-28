'use strict';

const SUPPORTED_SCHEMA_VERSION = '1.0';
const VALID_SET_TYPES = ['warmup', 'working', 'backoff', 'dropset', 'failure', 'other'];

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Validates a parsed plan-import JSON document against schema 1.0 (spec
// sections 23/25/26). Returns a flat list of human-readable error messages
// — empty means the document is safe to preview/match exercises against.
// Never touches the Data Store; malformed JSON itself is caught by the
// caller's JSON.parse before this runs.
function validatePlanImport(doc) {
  const errors = [];

  if (!isPlainObject(doc)) {
    return { errors: ['The top level of the JSON must be an object.'] };
  }

  if (doc.schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
    errors.push(`Unsupported schema version "${doc.schemaVersion}" — this app supports "${SUPPORTED_SCHEMA_VERSION}".`);
  }

  if (typeof doc.name !== 'string' || !doc.name.trim()) {
    errors.push('Missing plan name.');
  }

  if (typeof doc.durationWeeks !== 'number' || !Number.isFinite(doc.durationWeeks) || doc.durationWeeks <= 0) {
    errors.push('durationWeeks must be a positive number.');
  }

  if (doc.startDate !== undefined && doc.startDate !== null) {
    if (typeof doc.startDate !== 'string' || Number.isNaN(new Date(doc.startDate).getTime())) {
      errors.push('startDate is not a valid date.');
    }
  }

  const workouts = Array.isArray(doc.workouts) ? doc.workouts : null;
  if (!workouts) {
    errors.push('workouts must be an array.');
    return { errors };
  }

  workouts.forEach((workout, workoutIndex) => {
    const workoutLabel = `Workout ${workoutIndex + 1}`;
    if (!isPlainObject(workout)) {
      errors.push(`${workoutLabel}: must be an object.`);
      return;
    }
    if (typeof workout.name !== 'string' || !workout.name.trim()) {
      errors.push(`${workoutLabel}: missing workout name.`);
    }

    const exercises = workout.exercises !== undefined ? workout.exercises : [];
    if (!Array.isArray(exercises)) {
      errors.push(`${workoutLabel}: exercises must be an array.`);
      return;
    }

    exercises.forEach((exercise, exerciseIndex) => {
      const exerciseLabel = `${workoutLabel} > Exercise ${exerciseIndex + 1}`;
      if (!isPlainObject(exercise)) {
        errors.push(`${exerciseLabel}: must be an object.`);
        return;
      }
      if (typeof exercise.exercise !== 'string' || !exercise.exercise.trim()) {
        errors.push(`${exerciseLabel}: missing exercise name.`);
      }

      const sets = exercise.sets !== undefined ? exercise.sets : [];
      if (!Array.isArray(sets)) {
        errors.push(`${exerciseLabel}: sets must be an array.`);
        return;
      }

      sets.forEach((set, setIndex) => {
        const setLabel = `${exerciseLabel} > Set ${setIndex + 1}`;
        if (!isPlainObject(set)) {
          errors.push(`${setLabel}: must be an object.`);
          return;
        }
        if (set.type !== undefined && !VALID_SET_TYPES.includes(set.type)) {
          errors.push(`${setLabel}: invalid set type "${set.type}".`);
        }
        if (
          set.targetRepsMin !== undefined &&
          set.targetRepsMax !== undefined &&
          Number(set.targetRepsMin) > Number(set.targetRepsMax)
        ) {
          errors.push(`${setLabel}: invalid target repetition range (min greater than max).`);
        }
      });
    });
  });

  return { errors };
}

module.exports = { validatePlanImport, SUPPORTED_SCHEMA_VERSION, VALID_SET_TYPES };
