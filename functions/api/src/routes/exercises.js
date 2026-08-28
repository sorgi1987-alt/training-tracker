'use strict';

const { Router } = require('express');
const { requireUser } = require('../middleware/requireUser');
const { normalizeName } = require('../lib/normalizeName');
const { isExerciseVisible, isActiveRow } = require('../lib/exerciseVisibility');
const { assertRowId, zcqlSelect, numOrNull, isTrue, fetchWhere, toIsoOrNull } = require('../lib/db');

const router = Router();
router.use(requireUser);

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

// Exercise history is derived from actual sessions, never from plans (spec
// section 14). Up to the 10 most recent times this user performed this
// exercise, most recent first, skipped sets excluded.
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
    for (const sessionExercise of sessionExercises.slice(0, 10)) {
      const session = await catalystApp.datastore().table('WorkoutSession').getRow(sessionExercise.session_id).catch(() => null);
      if (!session) continue;

      const sets = await fetchWhere(catalystApp, 'SessionSet', 'session_exercise_id', sessionExercise.ROWID, 'order_index');
      const loggedSets = sets
        .filter((set) => !isTrue(set.skipped))
        .map((set) => ({ weight: numOrNull(set.weight), reps: numOrNull(set.reps), type: set.set_type }));
      if (loggedSets.length === 0) continue;

      history.push({ sessionId: session.ROWID, date: toIsoOrNull(session.started_time), sets: loggedSets });
    }

    res.json({ history });
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
