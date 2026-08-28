'use strict';

const { Router } = require('express');
const { requireUser } = require('../middleware/requireUser');
const { isExerciseVisible } = require('../lib/exerciseVisibility');
const {
  assertRowId,
  zcqlSelect,
  compact,
  numOrNull,
  isTrue,
  fetchWhere,
  toCatalystDateTime,
  fromCatalystDateTime,
  toIsoOrNull
} = require('../lib/db');

const router = Router();
router.use(requireUser);

// ---- data access helpers -------------------------------------------------

// Most recent prior time this exercise was actually performed by this user,
// used both to prefill new sets and to show "previous performance" next to
// the current ones. Ordered by CREATEDTIME (a sortable "YYYY-MM-DD HH:MM:SS"
// string) rather than an untested ORDER BY on a system column.
async function findPreviousSessionExercise(catalystApp, userId, exerciseId, excludeSessionExerciseId) {
  const query = `SELECT * FROM SessionExercise WHERE user_id = '${assertRowId(userId, 'userId')}' AND actual_exercise_id = '${assertRowId(exerciseId, 'exerciseId')}'`;
  const rows = await zcqlSelect(catalystApp, 'SessionExercise', query);
  const candidates = rows.filter((row) => row.ROWID !== excludeSessionExerciseId);
  candidates.sort((a, b) => (b.CREATEDTIME || '').localeCompare(a.CREATEDTIME || ''));
  return candidates[0] || null;
}

async function getPreviousPerformance(catalystApp, userId, exerciseId, excludeSessionExerciseId) {
  const previous = await findPreviousSessionExercise(catalystApp, userId, exerciseId, excludeSessionExerciseId);
  if (!previous) return null;
  const sets = await fetchWhere(catalystApp, 'SessionSet', 'session_exercise_id', previous.ROWID, 'order_index');
  return sets
    .filter((set) => isTrue(set.completed) && !isTrue(set.skipped))
    .map((set) => ({ type: set.set_type, weight: numOrNull(set.weight), reps: numOrNull(set.reps) }));
}

function exerciseRowToInfo(row) {
  return row ? { name: row.name, primaryMuscle: row.primary_muscle || null, equipment: row.equipment || null } : null;
}

function makeExerciseInfoLookup(catalystApp) {
  const cache = new Map();
  return async (exerciseId) => {
    if (!exerciseId) return null;
    if (cache.has(exerciseId)) return cache.get(exerciseId);
    const row = await catalystApp.datastore().table('Exercise').getRow(exerciseId).catch(() => null);
    const info = exerciseRowToInfo(row);
    cache.set(exerciseId, info);
    return info;
  };
}

async function loadSessionTree(catalystApp, session, userId) {
  const sessionExercises = await fetchWhere(catalystApp, 'SessionExercise', 'session_id', session.ROWID, 'actual_order');
  const getExerciseInfo = makeExerciseInfoLookup(catalystApp);
  const exerciseDTOs = [];

  for (const sessionExercise of sessionExercises) {
    const sets = await fetchWhere(catalystApp, 'SessionSet', 'session_exercise_id', sessionExercise.ROWID, 'order_index');
    const [actualInfo, plannedInfo, previousPerformance] = await Promise.all([
      getExerciseInfo(sessionExercise.actual_exercise_id),
      getExerciseInfo(sessionExercise.planned_exercise_id),
      getPreviousPerformance(catalystApp, userId, sessionExercise.actual_exercise_id, sessionExercise.ROWID)
    ]);
    exerciseDTOs.push(toSessionExerciseDTO(sessionExercise, sets.map(toSessionSetDTO), actualInfo, plannedInfo, previousPerformance));
  }

  return toSessionDTO(session, exerciseDTOs);
}

// ---- DTOs -----------------------------------------------------------------

function toSessionDTO(row, exercises) {
  return {
    id: row.ROWID,
    planId: row.plan_id || null,
    planWorkoutId: row.plan_workout_id || null,
    name: row.name_snapshot,
    status: row.status,
    startedTime: toIsoOrNull(row.started_time),
    completedTime: toIsoOrNull(row.completed_time),
    durationSeconds: numOrNull(row.duration_seconds),
    notes: row.notes || null,
    ...(exercises ? { exercises } : {})
  };
}

function toSessionExerciseDTO(row, sets, actualInfo, plannedInfo, previousPerformance) {
  return {
    id: row.ROWID,
    sessionId: row.session_id,
    plannedExerciseId: row.planned_exercise_id || null,
    plannedExerciseName: plannedInfo?.name ?? null,
    actualExerciseId: row.actual_exercise_id,
    actualExerciseName: actualInfo?.name ?? null,
    actualExerciseEquipment: actualInfo?.equipment ?? null,
    plannedOrder: numOrNull(row.planned_order),
    actualOrder: numOrNull(row.actual_order) ?? 0,
    substituted: isTrue(row.substituted),
    skipped: isTrue(row.skipped),
    notes: row.notes || null,
    // Snapshot from the plan at session-start time (spec section 2) — the
    // rest timer's default duration, independent of later plan edits.
    restSeconds: numOrNull(row.rest_seconds),
    previousPerformance: previousPerformance || [],
    sets: sets || []
  };
}

function toSessionSetDTO(row) {
  return {
    id: row.ROWID,
    orderIndex: numOrNull(row.order_index) ?? 0,
    type: row.set_type,
    weight: numOrNull(row.weight),
    reps: numOrNull(row.reps),
    rir: numOrNull(row.rir),
    rpe: numOrNull(row.rpe),
    duration: numOrNull(row.duration),
    distance: numOrNull(row.distance),
    completed: isTrue(row.completed),
    skipped: isTrue(row.skipped),
    notes: row.notes || null,
    // Snapshot of the planned target range (spec section 16) — advisory
    // progression suggestions compare actual reps against this, never
    // against the plan's current (possibly since-edited) targets.
    targetRepsMin: numOrNull(row.target_reps_min),
    targetRepsMax: numOrNull(row.target_reps_max)
  };
}

// ---- ownership chain --------------------------------------------------

router.param('sessionId', async (req, res, next, sessionId) => {
  try {
    assertRowId(sessionId, 'sessionId');
    const session = await req.catalystApp.datastore().table('WorkoutSession').getRow(sessionId).catch(() => null);
    if (!session || session.user_id !== req.currentUser.userId) {
      return res.status(404).json({ error: 'Session not found' });
    }
    req.session = session;
    next();
  } catch (err) {
    next(err);
  }
});

router.param('sessionExerciseId', async (req, res, next, sessionExerciseId) => {
  try {
    assertRowId(sessionExerciseId, 'sessionExerciseId');
    const sessionExercise = await req.catalystApp.datastore().table('SessionExercise').getRow(sessionExerciseId).catch(() => null);
    if (!sessionExercise || sessionExercise.session_id !== req.session.ROWID) {
      return res.status(404).json({ error: 'Session exercise not found' });
    }
    req.sessionExercise = sessionExercise;
    next();
  } catch (err) {
    next(err);
  }
});

router.param('setId', async (req, res, next, setId) => {
  try {
    assertRowId(setId, 'setId');
    const sessionSet = await req.catalystApp.datastore().table('SessionSet').getRow(setId).catch(() => null);
    if (!sessionSet || sessionSet.session_exercise_id !== req.sessionExercise.ROWID) {
      return res.status(404).json({ error: 'Set not found' });
    }
    req.sessionSet = sessionSet;
    next();
  } catch (err) {
    next(err);
  }
});

// ---- session-level routes -------------------------------------------------

router.get('/', async (req, res, next) => {
  try {
    const userId = assertRowId(req.currentUser.userId, 'userId');
    let query = `SELECT * FROM WorkoutSession WHERE user_id = '${userId}'`;
    if (typeof req.query.status === 'string') {
      query += ` AND status = '${req.query.status.replace(/[^a-z_]/g, '')}'`;
    }
    if (typeof req.query.planId === 'string') {
      query += ` AND plan_id = '${assertRowId(req.query.planId, 'planId')}'`;
    }
    if (typeof req.query.planWorkoutId === 'string') {
      query += ` AND plan_workout_id = '${assertRowId(req.query.planWorkoutId, 'planWorkoutId')}'`;
    }
    const rows = await zcqlSelect(req.catalystApp, 'WorkoutSession', query);
    rows.sort((a, b) => (b.started_time || '').localeCompare(a.started_time || ''));

    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    res.json({ sessions: rows.slice(0, limit).map((row) => toSessionDTO(row)) });
  } catch (err) {
    next(err);
  }
});

// Starting a workout snapshots the plan workout's exercises/sets at this
// exact moment (spec section 2) — later edits to the plan must never affect
// this session. Supports an ad-hoc session (no planWorkoutId) too.
router.post('/', async (req, res, next) => {
  try {
    const { catalystApp, currentUser } = req;
    const planWorkoutId = req.body?.planWorkoutId;

    let plan = null;
    let planWorkout = null;
    if (planWorkoutId) {
      assertRowId(planWorkoutId, 'planWorkoutId');
      planWorkout = await catalystApp.datastore().table('PlanWorkout').getRow(planWorkoutId).catch(() => null);
      if (!planWorkout) return res.status(400).json({ error: 'Unknown workout' });
      plan = await catalystApp.datastore().table('TrainingPlan').getRow(planWorkout.plan_id).catch(() => null);
      if (!plan || plan.user_id !== currentUser.userId) {
        return res.status(404).json({ error: 'Workout not found' });
      }
    }

    const session = await catalystApp.datastore().table('WorkoutSession').insertRow(
      compact({
        user_id: currentUser.userId,
        plan_id: plan ? plan.ROWID : null,
        plan_workout_id: planWorkout ? planWorkout.ROWID : null,
        name_snapshot: planWorkout ? planWorkout.name : typeof req.body?.name === 'string' && req.body.name.trim() ? req.body.name.trim() : 'Custom Workout',
        status: 'in_progress',
        started_time: toCatalystDateTime(),
        notes: ''
      })
    );

    if (planWorkout) {
      const planExercises = await fetchWhere(catalystApp, 'PlanExercise', 'plan_workout_id', planWorkout.ROWID);
      const sessionExerciseTable = catalystApp.datastore().table('SessionExercise');
      const sessionSetTable = catalystApp.datastore().table('SessionSet');

      for (const [index, planExercise] of planExercises.entries()) {
        const sessionExercise = await sessionExerciseTable.insertRow(
          compact({
            user_id: currentUser.userId,
            session_id: session.ROWID,
            planned_exercise_id: planExercise.exercise_id,
            actual_exercise_id: planExercise.exercise_id,
            planned_order: index,
            actual_order: index,
            substituted: false,
            skipped: false,
            notes: '',
            rest_seconds: numOrNull(planExercise.rest_seconds)
          })
        );

        const planSets = await fetchWhere(catalystApp, 'PlanSet', 'plan_exercise_id', planExercise.ROWID);
        if (planSets.length) {
          const previous = await getPreviousPerformance(catalystApp, currentUser.userId, planExercise.exercise_id, null);
          await sessionSetTable.insertRows(
            planSets.map((planSet, setIndex) =>
              compact({
                session_exercise_id: sessionExercise.ROWID,
                order_index: setIndex,
                set_type: planSet.set_type,
                weight: previous?.[setIndex]?.weight ?? numOrNull(planSet.target_weight),
                completed: false,
                skipped: false,
                notes: '',
                target_reps_min: numOrNull(planSet.target_reps_min),
                target_reps_max: numOrNull(planSet.target_reps_max)
              })
            )
          );
        }
      }
    }

    res.status(201).json({ session: await loadSessionTree(catalystApp, session, currentUser.userId) });
  } catch (err) {
    next(err);
  }
});

router.get('/:sessionId', async (req, res, next) => {
  try {
    res.json({ session: await loadSessionTree(req.catalystApp, req.session, req.currentUser.userId) });
  } catch (err) {
    next(err);
  }
});

router.patch('/:sessionId', async (req, res, next) => {
  try {
    const patch = { ROWID: req.session.ROWID };
    if (req.body?.notes !== undefined) patch.notes = req.body.notes;
    const updated = await req.catalystApp.datastore().table('WorkoutSession').updateRow(patch);
    res.json({ session: toSessionDTO(updated) });
  } catch (err) {
    next(err);
  }
});

function computeDurationSeconds(startedTime) {
  const start = fromCatalystDateTime(startedTime).getTime();
  if (Number.isNaN(start)) return null;
  return Math.max(0, Math.round((Date.now() - start) / 1000));
}

router.post('/:sessionId/finish', async (req, res, next) => {
  try {
    const updated = await req.catalystApp.datastore().table('WorkoutSession').updateRow({
      ROWID: req.session.ROWID,
      status: 'completed',
      completed_time: toCatalystDateTime(),
      duration_seconds: computeDurationSeconds(req.session.started_time)
    });
    res.json({ session: toSessionDTO(updated) });
  } catch (err) {
    next(err);
  }
});

router.post('/:sessionId/abandon', async (req, res, next) => {
  try {
    const updated = await req.catalystApp.datastore().table('WorkoutSession').updateRow({
      ROWID: req.session.ROWID,
      status: 'abandoned',
      completed_time: toCatalystDateTime(),
      duration_seconds: computeDurationSeconds(req.session.started_time)
    });
    res.json({ session: toSessionDTO(updated) });
  } catch (err) {
    next(err);
  }
});

// ---- session-exercise routes ------------------------------------------

router.post('/:sessionId/exercises/reorder', async (req, res, next) => {
  try {
    const { catalystApp, session } = req;
    const orderedIds = Array.isArray(req.body?.sessionExerciseIds) ? req.body.sessionExerciseIds.map(String) : [];
    const siblings = await fetchWhere(catalystApp, 'SessionExercise', 'session_id', session.ROWID, 'actual_order');
    const siblingIds = new Set(siblings.map((row) => row.ROWID));

    if (orderedIds.length !== siblings.length || !orderedIds.every((id) => siblingIds.has(id))) {
      return res.status(400).json({ error: "sessionExerciseIds must include exactly this session's current exercises" });
    }

    await catalystApp.datastore().table('SessionExercise').updateRows(orderedIds.map((id, index) => ({ ROWID: id, actual_order: index })));
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// Adding an exercise mid-workout that wasn't part of the plan (spec section
// 12: "add an unplanned exercise").
router.post('/:sessionId/exercises', async (req, res, next) => {
  try {
    const { catalystApp, session, currentUser } = req;
    const exerciseId = req.body?.exerciseId;
    if (!exerciseId) return res.status(400).json({ error: 'exerciseId is required' });
    assertRowId(exerciseId, 'exerciseId');

    const exerciseRow = await catalystApp.datastore().table('Exercise').getRow(exerciseId).catch(() => null);
    if (!isExerciseVisible(exerciseRow, currentUser.userId)) {
      return res.status(400).json({ error: 'Unknown exercise' });
    }

    const siblings = await fetchWhere(catalystApp, 'SessionExercise', 'session_id', session.ROWID, 'actual_order');
    const inserted = await catalystApp.datastore().table('SessionExercise').insertRow(
      compact({
        user_id: currentUser.userId,
        session_id: session.ROWID,
        planned_exercise_id: null,
        actual_exercise_id: exerciseId,
        actual_order: siblings.length,
        substituted: false,
        skipped: false,
        notes: req.body?.notes || '',
        rest_seconds: req.body?.restSeconds ?? null
      })
    );

    const previousPerformance = await getPreviousPerformance(catalystApp, currentUser.userId, exerciseId, inserted.ROWID);
    res.status(201).json({ exercise: toSessionExerciseDTO(inserted, [], exerciseRowToInfo(exerciseRow), null, previousPerformance) });
  } catch (err) {
    next(err);
  }
});

router.patch('/:sessionId/exercises/:sessionExerciseId', async (req, res, next) => {
  try {
    const { catalystApp, sessionExercise, currentUser } = req;
    const patch = { ROWID: sessionExercise.ROWID };

    if (req.body?.notes !== undefined) patch.notes = req.body.notes;
    if (req.body?.skipped !== undefined) patch.skipped = Boolean(req.body.skipped);
    if (req.body?.restSeconds !== undefined) patch.rest_seconds = req.body.restSeconds;
    if (req.body?.exerciseId !== undefined) {
      assertRowId(req.body.exerciseId, 'exerciseId');
      const exerciseRow = await catalystApp.datastore().table('Exercise').getRow(req.body.exerciseId).catch(() => null);
      if (!isExerciseVisible(exerciseRow, currentUser.userId)) {
        return res.status(400).json({ error: 'Unknown exercise' });
      }
      // Substitution affects only this session, never the originating plan
      // (spec section 10) — the plan's PlanExercise row is never touched.
      patch.actual_exercise_id = req.body.exerciseId;
      patch.substituted = req.body.exerciseId !== (sessionExercise.planned_exercise_id || req.body.exerciseId);
    }

    const updated = await catalystApp.datastore().table('SessionExercise').updateRow(patch);
    const sets = await fetchWhere(catalystApp, 'SessionSet', 'session_exercise_id', updated.ROWID, 'order_index');
    const [actualInfo, plannedInfo, previousPerformance] = await Promise.all([
      exerciseRowToInfo(await catalystApp.datastore().table('Exercise').getRow(updated.actual_exercise_id).catch(() => null)),
      updated.planned_exercise_id
        ? exerciseRowToInfo(await catalystApp.datastore().table('Exercise').getRow(updated.planned_exercise_id).catch(() => null))
        : null,
      getPreviousPerformance(catalystApp, currentUser.userId, updated.actual_exercise_id, updated.ROWID)
    ]);

    res.json({ exercise: toSessionExerciseDTO(updated, sets.map(toSessionSetDTO), actualInfo, plannedInfo, previousPerformance) });
  } catch (err) {
    next(err);
  }
});

// ---- session-set routes -------------------------------------------------

router.post('/:sessionId/exercises/:sessionExerciseId/sets', async (req, res, next) => {
  try {
    const { catalystApp, sessionExercise } = req;
    const siblings = await fetchWhere(catalystApp, 'SessionSet', 'session_exercise_id', sessionExercise.ROWID, 'order_index');
    const inserted = await catalystApp.datastore().table('SessionSet').insertRow(
      compact({
        session_exercise_id: sessionExercise.ROWID,
        order_index: siblings.length,
        set_type: req.body?.type || 'working',
        weight: req.body?.weight ?? null,
        reps: req.body?.reps ?? null,
        completed: false,
        skipped: false,
        notes: ''
      })
    );
    res.status(201).json({ set: toSessionSetDTO(inserted) });
  } catch (err) {
    next(err);
  }
});

const SET_FIELD_MAP = {
  type: 'set_type',
  weight: 'weight',
  reps: 'reps',
  rir: 'rir',
  rpe: 'rpe',
  duration: 'duration',
  distance: 'distance',
  completed: 'completed',
  skipped: 'skipped',
  notes: 'notes'
};

router.patch('/:sessionId/exercises/:sessionExerciseId/sets/:setId', async (req, res, next) => {
  try {
    const patch = { ROWID: req.sessionSet.ROWID };
    for (const [key, column] of Object.entries(SET_FIELD_MAP)) {
      if (req.body?.[key] !== undefined) patch[column] = req.body[key];
    }
    const updated = await req.catalystApp.datastore().table('SessionSet').updateRow(patch);
    res.json({ set: toSessionSetDTO(updated) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:sessionId/exercises/:sessionExerciseId/sets/:setId', async (req, res, next) => {
  try {
    await req.catalystApp.datastore().table('SessionSet').deleteRow(req.sessionSet.ROWID);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
