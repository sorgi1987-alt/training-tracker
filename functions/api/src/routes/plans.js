'use strict';

const { Router } = require('express');
const { requireUser } = require('../middleware/requireUser');
const { isExerciseVisible } = require('../lib/exerciseVisibility');
const { assertRowId, zcqlSelect, compact, numOrNull, fetchWhere, toIsoOrNull } = require('../lib/db');

const router = Router();
router.use(requireUser);

// ---- data access helpers -------------------------------------------------

const fetchOrdered = fetchWhere;

function exerciseRowToInfo(row) {
  return row ? { name: row.name, primaryMuscle: row.primary_muscle || null, equipment: row.equipment || null } : null;
}

// Fetches an Exercise row's display info, caching per-request so a plan with
// the same exercise repeated across workouts doesn't refetch it each time.
function makeExerciseInfoLookup(catalystApp) {
  const cache = new Map();
  return async (exerciseId) => {
    if (cache.has(exerciseId)) return cache.get(exerciseId);
    const row = await catalystApp.datastore().table('Exercise').getRow(exerciseId).catch(() => null);
    const info = exerciseRowToInfo(row);
    cache.set(exerciseId, info);
    return info;
  };
}

async function loadPlanTree(catalystApp, plan) {
  const workouts = await fetchOrdered(catalystApp, 'PlanWorkout', 'plan_id', plan.ROWID);
  const workoutDTOs = [];
  const getExerciseInfo = makeExerciseInfoLookup(catalystApp);

  for (const workout of workouts) {
    const exercises = await fetchOrdered(catalystApp, 'PlanExercise', 'plan_workout_id', workout.ROWID);
    const exerciseDTOs = [];

    for (const exercise of exercises) {
      const sets = await fetchOrdered(catalystApp, 'PlanSet', 'plan_exercise_id', exercise.ROWID);
      const info = await getExerciseInfo(exercise.exercise_id);
      exerciseDTOs.push(toPlanExerciseDTO(exercise, sets.map(toPlanSetDTO), info));
    }

    workoutDTOs.push(toWorkoutDTO(workout, exerciseDTOs));
  }

  return toPlanDTO(plan, workoutDTOs);
}

// A plan may only ever have one active row at a time; activating one
// deactivates any other the same user has active (spec section 4).
async function deactivateOtherActivePlans(catalystApp, userId, exceptPlanId) {
  const query = `SELECT * FROM TrainingPlan WHERE user_id = '${assertRowId(userId, 'userId')}' AND status = 'active'`;
  const actives = await zcqlSelect(catalystApp, 'TrainingPlan', query);
  const toUpdate = actives.filter((p) => p.ROWID !== exceptPlanId).map((p) => ({ ROWID: p.ROWID, status: 'draft' }));
  if (toUpdate.length) {
    await catalystApp.datastore().table('TrainingPlan').updateRows(toUpdate);
  }
}

// ---- DTOs -----------------------------------------------------------------

function toPlanDTO(row, workouts) {
  return {
    id: row.ROWID,
    name: row.name,
    description: row.description || null,
    durationWeeks: numOrNull(row.duration_weeks),
    startDate: row.start_date || null,
    status: row.status,
    schemaVersion: row.schema_version || '1.0',
    planVersion: numOrNull(row.plan_version) ?? 1,
    createdTime: toIsoOrNull(row.CREATEDTIME),
    modifiedTime: toIsoOrNull(row.MODIFIEDTIME),
    ...(workouts ? { workouts } : {})
  };
}

function toWorkoutDTO(row, exercises) {
  return {
    id: row.ROWID,
    planId: row.plan_id,
    name: row.name,
    description: row.description || null,
    orderIndex: numOrNull(row.order_index) ?? 0,
    notes: row.notes || null,
    estimatedDurationMin: numOrNull(row.estimated_duration_min),
    exercises: exercises || []
  };
}

function toPlanExerciseDTO(row, sets, exerciseInfo) {
  return {
    id: row.ROWID,
    workoutId: row.plan_workout_id,
    exerciseId: row.exercise_id,
    exerciseName: exerciseInfo?.name ?? null,
    exercisePrimaryMuscle: exerciseInfo?.primaryMuscle ?? null,
    exerciseEquipment: exerciseInfo?.equipment ?? null,
    orderIndex: numOrNull(row.order_index) ?? 0,
    notes: row.notes || null,
    restSeconds: numOrNull(row.rest_seconds),
    progression: row.progression_json ? JSON.parse(row.progression_json) : null,
    sets: sets || []
  };
}

function toPlanSetDTO(row) {
  return {
    id: row.ROWID,
    orderIndex: numOrNull(row.order_index) ?? 0,
    type: row.set_type,
    targetReps: numOrNull(row.target_reps),
    targetRepsMin: numOrNull(row.target_reps_min),
    targetRepsMax: numOrNull(row.target_reps_max),
    targetRIR: numOrNull(row.target_rir),
    targetRPE: numOrNull(row.target_rpe),
    targetWeight: numOrNull(row.target_weight),
    duration: numOrNull(row.duration),
    distance: numOrNull(row.distance),
    notes: row.notes || null
  };
}

// ---- ownership chain --------------------------------------------------
// Each param handler verifies the resource belongs to the already-verified
// parent in the URL (and, at the top, to the authenticated user) — so every
// route below can trust req.plan / req.workout / req.planExercise / req.planSet.

router.param('planId', async (req, res, next, planId) => {
  try {
    assertRowId(planId, 'planId');
    const plan = await req.catalystApp.datastore().table('TrainingPlan').getRow(planId).catch(() => null);
    if (!plan || plan.user_id !== req.currentUser.userId) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    req.plan = plan;
    next();
  } catch (err) {
    next(err);
  }
});

router.param('workoutId', async (req, res, next, workoutId) => {
  try {
    assertRowId(workoutId, 'workoutId');
    const workout = await req.catalystApp.datastore().table('PlanWorkout').getRow(workoutId).catch(() => null);
    if (!workout || workout.plan_id !== req.plan.ROWID) {
      return res.status(404).json({ error: 'Workout not found' });
    }
    req.workout = workout;
    next();
  } catch (err) {
    next(err);
  }
});

router.param('planExerciseId', async (req, res, next, planExerciseId) => {
  try {
    assertRowId(planExerciseId, 'planExerciseId');
    const planExercise = await req.catalystApp.datastore().table('PlanExercise').getRow(planExerciseId).catch(() => null);
    if (!planExercise || planExercise.plan_workout_id !== req.workout.ROWID) {
      return res.status(404).json({ error: 'Plan exercise not found' });
    }
    req.planExercise = planExercise;
    next();
  } catch (err) {
    next(err);
  }
});

router.param('setId', async (req, res, next, setId) => {
  try {
    assertRowId(setId, 'setId');
    const planSet = await req.catalystApp.datastore().table('PlanSet').getRow(setId).catch(() => null);
    if (!planSet || planSet.plan_exercise_id !== req.planExercise.ROWID) {
      return res.status(404).json({ error: 'Set not found' });
    }
    req.planSet = planSet;
    next();
  } catch (err) {
    next(err);
  }
});

// ---- plan-level routes ------------------------------------------------

router.get('/', async (req, res, next) => {
  try {
    const userId = assertRowId(req.currentUser.userId, 'userId');
    const rows = await zcqlSelect(req.catalystApp, 'TrainingPlan', `SELECT * FROM TrainingPlan WHERE user_id = '${userId}'`);
    rows.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    res.json({ plans: rows.map((row) => toPlanDTO(row)) });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const durationWeeks = Number(req.body?.durationWeeks);
    if (!name) return res.status(400).json({ error: 'name is required' });
    if (!Number.isFinite(durationWeeks) || durationWeeks <= 0) {
      return res.status(400).json({ error: 'durationWeeks must be a positive number' });
    }

    const inserted = await req.catalystApp.datastore().table('TrainingPlan').insertRow(
      compact({
        user_id: req.currentUser.userId,
        name,
        description: req.body?.description || '',
        duration_weeks: durationWeeks,
        start_date: req.body?.startDate || null,
        status: 'draft',
        schema_version: '1.0',
        plan_version: 1
      })
    );

    res.status(201).json({ plan: toPlanDTO(inserted) });
  } catch (err) {
    next(err);
  }
});

router.get('/:planId', async (req, res, next) => {
  try {
    res.json({ plan: await loadPlanTree(req.catalystApp, req.plan) });
  } catch (err) {
    next(err);
  }
});

const PLAN_FIELD_MAP = { name: 'name', description: 'description', durationWeeks: 'duration_weeks', startDate: 'start_date' };

router.patch('/:planId', async (req, res, next) => {
  try {
    const patch = { ROWID: req.plan.ROWID };
    for (const [key, column] of Object.entries(PLAN_FIELD_MAP)) {
      if (req.body?.[key] !== undefined) patch[column] = req.body[key];
    }
    const updated = await req.catalystApp.datastore().table('TrainingPlan').updateRow(patch);
    res.json({ plan: toPlanDTO(updated) });
  } catch (err) {
    next(err);
  }
});

// Status changes go through dedicated actions rather than a raw PATCH so the
// "only one active plan" invariant can never be bypassed by a stray PATCH.
router.post('/:planId/activate', async (req, res, next) => {
  try {
    await deactivateOtherActivePlans(req.catalystApp, req.currentUser.userId, req.plan.ROWID);
    const updated = await req.catalystApp.datastore().table('TrainingPlan').updateRow({ ROWID: req.plan.ROWID, status: 'active' });
    res.json({ plan: toPlanDTO(updated) });
  } catch (err) {
    next(err);
  }
});

router.post('/:planId/archive', async (req, res, next) => {
  try {
    const updated = await req.catalystApp.datastore().table('TrainingPlan').updateRow({ ROWID: req.plan.ROWID, status: 'archived' });
    res.json({ plan: toPlanDTO(updated) });
  } catch (err) {
    next(err);
  }
});

router.post('/:planId/complete', async (req, res, next) => {
  try {
    // Advisory only (spec section 4) — a completed plan stays fully usable:
    // still editable, activatable again, duplicable.
    const updated = await req.catalystApp.datastore().table('TrainingPlan').updateRow({ ROWID: req.plan.ROWID, status: 'completed' });
    res.json({ plan: toPlanDTO(updated) });
  } catch (err) {
    next(err);
  }
});

router.post('/:planId/duplicate', async (req, res, next) => {
  try {
    const { catalystApp, plan } = req;
    const planTable = catalystApp.datastore().table('TrainingPlan');
    const workoutTable = catalystApp.datastore().table('PlanWorkout');
    const exerciseTable = catalystApp.datastore().table('PlanExercise');
    const setTable = catalystApp.datastore().table('PlanSet');

    const newPlan = await planTable.insertRow(
      compact({
        user_id: req.currentUser.userId,
        name: `${plan.name} (copy)`,
        description: plan.description || '',
        duration_weeks: numOrNull(plan.duration_weeks),
        start_date: null,
        status: 'draft',
        schema_version: plan.schema_version || '1.0',
        plan_version: numOrNull(plan.plan_version) ?? 1
      })
    );

    const workouts = await fetchOrdered(catalystApp, 'PlanWorkout', 'plan_id', plan.ROWID);
    for (const workout of workouts) {
      const newWorkout = await workoutTable.insertRow(
        compact({
          plan_id: newPlan.ROWID,
          name: workout.name,
          description: workout.description || '',
          order_index: numOrNull(workout.order_index) ?? 0,
          notes: workout.notes || '',
          estimated_duration_min: numOrNull(workout.estimated_duration_min)
        })
      );

      const exercises = await fetchOrdered(catalystApp, 'PlanExercise', 'plan_workout_id', workout.ROWID);
      for (const exercise of exercises) {
        const newExercise = await exerciseTable.insertRow(
          compact({
            plan_workout_id: newWorkout.ROWID,
            exercise_id: exercise.exercise_id,
            order_index: numOrNull(exercise.order_index) ?? 0,
            notes: exercise.notes || '',
            rest_seconds: numOrNull(exercise.rest_seconds),
            progression_json: exercise.progression_json || null
          })
        );

        const sets = await fetchOrdered(catalystApp, 'PlanSet', 'plan_exercise_id', exercise.ROWID);
        if (sets.length) {
          await setTable.insertRows(
            sets.map((set) =>
              compact({
                plan_exercise_id: newExercise.ROWID,
                order_index: numOrNull(set.order_index) ?? 0,
                set_type: set.set_type,
                target_reps: numOrNull(set.target_reps),
                target_reps_min: numOrNull(set.target_reps_min),
                target_reps_max: numOrNull(set.target_reps_max),
                target_rir: numOrNull(set.target_rir),
                target_rpe: numOrNull(set.target_rpe),
                target_weight: numOrNull(set.target_weight),
                duration: numOrNull(set.duration),
                distance: numOrNull(set.distance),
                notes: set.notes || ''
              })
            )
          );
        }
      }
    }

    res.status(201).json({ plan: await loadPlanTree(catalystApp, newPlan) });
  } catch (err) {
    next(err);
  }
});

// ---- workout routes -----------------------------------------------------

router.post('/:planId/workouts/reorder', async (req, res, next) => {
  try {
    const { catalystApp, plan } = req;
    const orderedIds = Array.isArray(req.body?.workoutIds) ? req.body.workoutIds.map(String) : [];
    const siblings = await fetchOrdered(catalystApp, 'PlanWorkout', 'plan_id', plan.ROWID);
    const siblingIds = new Set(siblings.map((w) => w.ROWID));

    if (orderedIds.length !== siblings.length || !orderedIds.every((id) => siblingIds.has(id))) {
      return res.status(400).json({ error: "workoutIds must include exactly this plan's current workouts" });
    }

    await catalystApp.datastore().table('PlanWorkout').updateRows(orderedIds.map((id, index) => ({ ROWID: id, order_index: index })));
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.post('/:planId/workouts', async (req, res, next) => {
  try {
    const { catalystApp, plan } = req;
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!name) return res.status(400).json({ error: 'name is required' });

    const siblings = await fetchOrdered(catalystApp, 'PlanWorkout', 'plan_id', plan.ROWID);
    const inserted = await catalystApp.datastore().table('PlanWorkout').insertRow(
      compact({
        plan_id: plan.ROWID,
        name,
        description: req.body?.description || '',
        order_index: siblings.length,
        notes: req.body?.notes || '',
        estimated_duration_min: req.body?.estimatedDurationMin ?? null
      })
    );

    res.status(201).json({ workout: toWorkoutDTO(inserted, []) });
  } catch (err) {
    next(err);
  }
});

const WORKOUT_FIELD_MAP = { name: 'name', description: 'description', notes: 'notes', estimatedDurationMin: 'estimated_duration_min' };

router.patch('/:planId/workouts/:workoutId', async (req, res, next) => {
  try {
    const patch = { ROWID: req.workout.ROWID };
    for (const [key, column] of Object.entries(WORKOUT_FIELD_MAP)) {
      if (req.body?.[key] !== undefined) patch[column] = req.body[key];
    }
    const updated = await req.catalystApp.datastore().table('PlanWorkout').updateRow(patch);
    res.json({ workout: toWorkoutDTO(updated, []) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:planId/workouts/:workoutId', async (req, res, next) => {
  try {
    const { catalystApp, workout } = req;
    const exerciseTable = catalystApp.datastore().table('PlanExercise');
    const setTable = catalystApp.datastore().table('PlanSet');

    const exercises = await fetchOrdered(catalystApp, 'PlanExercise', 'plan_workout_id', workout.ROWID);
    for (const exercise of exercises) {
      const sets = await fetchOrdered(catalystApp, 'PlanSet', 'plan_exercise_id', exercise.ROWID);
      for (const set of sets) await setTable.deleteRow(set.ROWID);
      await exerciseTable.deleteRow(exercise.ROWID);
    }

    await catalystApp.datastore().table('PlanWorkout').deleteRow(workout.ROWID);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ---- plan-exercise routes -------------------------------------------------

router.post('/:planId/workouts/:workoutId/exercises/reorder', async (req, res, next) => {
  try {
    const { catalystApp, workout } = req;
    const orderedIds = Array.isArray(req.body?.exerciseIds) ? req.body.exerciseIds.map(String) : [];
    const siblings = await fetchOrdered(catalystApp, 'PlanExercise', 'plan_workout_id', workout.ROWID);
    const siblingIds = new Set(siblings.map((e) => e.ROWID));

    if (orderedIds.length !== siblings.length || !orderedIds.every((id) => siblingIds.has(id))) {
      return res.status(400).json({ error: "exerciseIds must include exactly this workout's current exercises" });
    }

    await catalystApp.datastore().table('PlanExercise').updateRows(orderedIds.map((id, index) => ({ ROWID: id, order_index: index })));
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.post('/:planId/workouts/:workoutId/exercises', async (req, res, next) => {
  try {
    const { catalystApp, workout, currentUser } = req;
    const exerciseId = req.body?.exerciseId;
    if (!exerciseId) return res.status(400).json({ error: 'exerciseId is required' });
    assertRowId(exerciseId, 'exerciseId');

    const exerciseRow = await catalystApp.datastore().table('Exercise').getRow(exerciseId).catch(() => null);
    if (!isExerciseVisible(exerciseRow, currentUser.userId)) {
      return res.status(400).json({ error: 'Unknown exercise' });
    }

    const siblings = await fetchOrdered(catalystApp, 'PlanExercise', 'plan_workout_id', workout.ROWID);
    const inserted = await catalystApp.datastore().table('PlanExercise').insertRow(
      compact({
        plan_workout_id: workout.ROWID,
        exercise_id: exerciseId,
        order_index: siblings.length,
        notes: req.body?.notes || '',
        rest_seconds: req.body?.restSeconds ?? null,
        progression_json: req.body?.progression ? JSON.stringify(req.body.progression) : null
      })
    );

    res.status(201).json({ exercise: toPlanExerciseDTO(inserted, [], exerciseRowToInfo(exerciseRow)) });
  } catch (err) {
    next(err);
  }
});

router.patch('/:planId/workouts/:workoutId/exercises/:planExerciseId', async (req, res, next) => {
  try {
    const { catalystApp, planExercise, currentUser } = req;
    const patch = { ROWID: planExercise.ROWID };

    if (req.body?.notes !== undefined) patch.notes = req.body.notes;
    if (req.body?.restSeconds !== undefined) patch.rest_seconds = req.body.restSeconds;
    if (req.body?.progression !== undefined) patch.progression_json = JSON.stringify(req.body.progression);
    if (req.body?.exerciseId !== undefined) {
      assertRowId(req.body.exerciseId, 'exerciseId');
      const exerciseRow = await catalystApp.datastore().table('Exercise').getRow(req.body.exerciseId).catch(() => null);
      if (!isExerciseVisible(exerciseRow, currentUser.userId)) {
        return res.status(400).json({ error: 'Unknown exercise' });
      }
      // Substituting here changes the plan's own template — see spec
      // section 10 for the distinct session-level substitution (Phase 4),
      // which never touches the plan.
      patch.exercise_id = req.body.exerciseId;
    }

    const updated = await catalystApp.datastore().table('PlanExercise').updateRow(patch);
    const exerciseRow = await catalystApp.datastore().table('Exercise').getRow(updated.exercise_id).catch(() => null);
    res.json({ exercise: toPlanExerciseDTO(updated, [], exerciseRowToInfo(exerciseRow)) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:planId/workouts/:workoutId/exercises/:planExerciseId', async (req, res, next) => {
  try {
    const { catalystApp, planExercise } = req;
    const setTable = catalystApp.datastore().table('PlanSet');
    const sets = await fetchOrdered(catalystApp, 'PlanSet', 'plan_exercise_id', planExercise.ROWID);
    for (const set of sets) await setTable.deleteRow(set.ROWID);
    await catalystApp.datastore().table('PlanExercise').deleteRow(planExercise.ROWID);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ---- plan-set routes --------------------------------------------------

const SET_FIELD_MAP = {
  type: 'set_type',
  targetReps: 'target_reps',
  targetRepsMin: 'target_reps_min',
  targetRepsMax: 'target_reps_max',
  targetRIR: 'target_rir',
  targetRPE: 'target_rpe',
  targetWeight: 'target_weight',
  duration: 'duration',
  distance: 'distance',
  notes: 'notes'
};

router.post('/:planId/workouts/:workoutId/exercises/:planExerciseId/sets', async (req, res, next) => {
  try {
    const { catalystApp, planExercise } = req;
    const siblings = await fetchOrdered(catalystApp, 'PlanSet', 'plan_exercise_id', planExercise.ROWID);
    const inserted = await catalystApp.datastore().table('PlanSet').insertRow(
      compact({
        plan_exercise_id: planExercise.ROWID,
        order_index: siblings.length,
        set_type: req.body?.type || 'working',
        target_reps: req.body?.targetReps ?? null,
        target_reps_min: req.body?.targetRepsMin ?? null,
        target_reps_max: req.body?.targetRepsMax ?? null,
        target_rir: req.body?.targetRIR ?? null,
        target_rpe: req.body?.targetRPE ?? null,
        target_weight: req.body?.targetWeight ?? null,
        duration: req.body?.duration ?? null,
        distance: req.body?.distance ?? null,
        notes: req.body?.notes || ''
      })
    );

    res.status(201).json({ set: toPlanSetDTO(inserted) });
  } catch (err) {
    next(err);
  }
});

router.patch('/:planId/workouts/:workoutId/exercises/:planExerciseId/sets/:setId', async (req, res, next) => {
  try {
    const patch = { ROWID: req.planSet.ROWID };
    for (const [key, column] of Object.entries(SET_FIELD_MAP)) {
      if (req.body?.[key] !== undefined) patch[column] = req.body[key];
    }
    const updated = await req.catalystApp.datastore().table('PlanSet').updateRow(patch);
    res.json({ set: toPlanSetDTO(updated) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:planId/workouts/:workoutId/exercises/:planExerciseId/sets/:setId', async (req, res, next) => {
  try {
    await req.catalystApp.datastore().table('PlanSet').deleteRow(req.planSet.ROWID);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
