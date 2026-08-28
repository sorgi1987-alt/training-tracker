'use strict';

const { Router } = require('express');
const { requireUser } = require('../middleware/requireUser');
const { normalizeName } = require('../lib/normalizeName');
const { isExerciseVisible, isActiveRow, fetchVisibleExercises } = require('../lib/exerciseVisibility');
const { assertRowId, zcqlSelect, numOrNull, isTrue, fetchWhere, toIsoOrNull } = require('../lib/db');

const router = Router();
router.use(requireUser);

function toExerciseDTO(row) {
  return {
    id: row.ROWID,
    name: row.name,
    primaryMuscle: row.primary_muscle || null,
    secondaryMuscles: row.secondary_muscles ? row.secondary_muscles.split(',').filter(Boolean) : [],
    equipment: row.equipment || null,
    category: row.category || null,
    instructions: row.instructions || null,
    metricType: row.metric_type,
    scope: row.scope,
    isOwn: Boolean(row.owner_user_id)
  };
}

router.get('/', async (req, res, next) => {
  try {
    const catalystApp = req.catalystApp;
    const rows = await fetchVisibleExercises(catalystApp, req.currentUser.userId);

    const q = (req.query.q ?? '').toString().trim().toLowerCase();
    const filtered = q ? rows.filter((row) => row.name.toLowerCase().includes(q)) : rows;
    filtered.sort((a, b) => a.name.localeCompare(b.name));

    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    res.json({ exercises: filtered.slice(0, limit).map(toExerciseDTO) });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const catalystApp = req.catalystApp;
    const table = catalystApp.datastore().table('Exercise');
    const row = await table.getRow(req.params.id).catch(() => null);

    if (!row || !isActiveRow(row) || !isExerciseVisible(row, req.currentUser.userId)) {
      return res.status(404).json({ error: 'Exercise not found' });
    }

    res.json({ exercise: toExerciseDTO(row) });
  } catch (err) {
    next(err);
  }
});

// Exercise history and PRs are derived from actual sessions, never from
// plans (spec section 14/15). `history` returns the 10 most recent
// performances for display; personalRecords are computed across the full
// history, not just the displayed slice.
router.get('/:id/history', async (req, res, next) => {
  try {
    const catalystApp = req.catalystApp;
    const exerciseId = assertRowId(req.params.id, 'id');
    const exerciseRow = await catalystApp.datastore().table('Exercise').getRow(exerciseId).catch(() => null);
    if (!exerciseRow || !isActiveRow(exerciseRow) || !isExerciseVisible(exerciseRow, req.currentUser.userId)) {
      return res.status(404).json({ error: 'Exercise not found' });
    }

    const userId = assertRowId(req.currentUser.userId, 'userId');
    const query = `SELECT * FROM SessionExercise WHERE user_id = '${userId}' AND actual_exercise_id = '${exerciseId}'`;
    const sessionExercises = await zcqlSelect(catalystApp, 'SessionExercise', query);
    sessionExercises.sort((a, b) => (b.CREATEDTIME || '').localeCompare(a.CREATEDTIME || ''));

    const history = [];
    let highestWeight = null;
    let repsAtHighestWeight = null;
    let bestEstimated1RM = null;
    let highestSessionVolume = null;

    for (const [index, sessionExercise] of sessionExercises.entries()) {
      const session = await catalystApp.datastore().table('WorkoutSession').getRow(sessionExercise.session_id).catch(() => null);
      if (!session) continue;

      const sets = await fetchWhere(catalystApp, 'SessionSet', 'session_exercise_id', sessionExercise.ROWID, 'order_index');
      const performedSets = sets
        .filter((set) => isTrue(set.completed) && !isTrue(set.skipped))
        .map((set) => ({ weight: numOrNull(set.weight), reps: numOrNull(set.reps), type: set.set_type }));
      if (performedSets.length === 0) continue;

      let sessionVolume = 0;
      for (const set of performedSets) {
        if (set.weight == null || set.reps == null) continue;
        sessionVolume += set.weight * set.reps;

        if (highestWeight === null || set.weight > highestWeight) {
          highestWeight = set.weight;
          repsAtHighestWeight = set.reps;
        } else if (set.weight === highestWeight && set.reps > (repsAtHighestWeight ?? 0)) {
          repsAtHighestWeight = set.reps;
        }

        // Epley formula (documented per spec section 15).
        const estimated1RM = Math.round(set.weight * (1 + set.reps / 30) * 10) / 10;
        if (bestEstimated1RM === null || estimated1RM > bestEstimated1RM) {
          bestEstimated1RM = estimated1RM;
        }
      }

      if (sessionVolume > 0 && (highestSessionVolume === null || sessionVolume > highestSessionVolume)) {
        highestSessionVolume = Math.round(sessionVolume * 10) / 10;
      }

      if (index < 10) {
        history.push({ sessionId: session.ROWID, date: toIsoOrNull(session.started_time), sets: performedSets });
      }
    }

    res.json({
      history,
      personalRecords: {
        highestWeight,
        repsAtHighestWeight,
        bestEstimated1RM,
        estimated1RMFormula: 'Epley: weight × (1 + reps ÷ 30)',
        highestSessionVolume
      }
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const catalystApp = req.catalystApp;
    const normalized = normalizeName(name);
    const visible = await fetchVisibleExercises(catalystApp, req.currentUser.userId);
    const duplicate = visible.find((row) => normalizeName(row.name) === normalized);
    if (duplicate) {
      return res.status(409).json({
        error: 'An exercise with this name already exists',
        exercise: toExerciseDTO(duplicate)
      });
    }

    const table = catalystApp.datastore().table('Exercise');
    const secondaryMuscles = Array.isArray(req.body?.secondaryMuscles) ? req.body.secondaryMuscles.join(',') : '';
    const inserted = await table.insertRow({
      owner_user_id: req.currentUser.userId,
      name,
      primary_muscle: req.body?.primaryMuscle || '',
      secondary_muscles: secondaryMuscles,
      equipment: req.body?.equipment || '',
      category: req.body?.category || '',
      instructions: req.body?.instructions || '',
      metric_type: req.body?.metricType || 'reps_weight',
      scope: 'user',
      is_active: true
    });

    res.status(201).json({ exercise: toExerciseDTO(inserted) });
  } catch (err) {
    next(err);
  }
});

const PATCHABLE_FIELDS = {
  name: 'name',
  primaryMuscle: 'primary_muscle',
  secondaryMuscles: 'secondary_muscles',
  equipment: 'equipment',
  category: 'category',
  instructions: 'instructions',
  metricType: 'metric_type',
  isActive: 'is_active'
};

router.patch('/:id', async (req, res, next) => {
  try {
    const catalystApp = req.catalystApp;
    const table = catalystApp.datastore().table('Exercise');
    const row = await table.getRow(req.params.id).catch(() => null);

    if (!row) return res.status(404).json({ error: 'Exercise not found' });
    if (!row.owner_user_id || row.owner_user_id !== req.currentUser.userId) {
      return res.status(403).json({ error: "Cannot modify a system exercise or another user's exercise" });
    }

    const patch = { ROWID: row.ROWID };
    for (const [key, column] of Object.entries(PATCHABLE_FIELDS)) {
      if (req.body?.[key] === undefined) continue;
      patch[column] = key === 'secondaryMuscles' && Array.isArray(req.body[key]) ? req.body[key].join(',') : req.body[key];
    }

    const updated = await table.updateRow(patch);
    res.json({ exercise: toExerciseDTO(updated) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const catalystApp = req.catalystApp;
    const table = catalystApp.datastore().table('Exercise');
    const row = await table.getRow(req.params.id).catch(() => null);

    if (!row) return res.status(404).json({ error: 'Exercise not found' });
    if (!row.owner_user_id || row.owner_user_id !== req.currentUser.userId) {
      return res.status(403).json({ error: "Cannot delete a system exercise or another user's exercise" });
    }

    // Soft delete: historical plans/sessions may still reference this
    // exercise (see spec section 35), so it must never be hard-deleted.
    await table.updateRow({ ROWID: row.ROWID, is_active: false });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
