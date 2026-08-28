'use strict';

const { Router } = require('express');
const { requireUser } = require('../middleware/requireUser');
const { assertRowId, zcqlSelect, compact, numOrNull, toCatalystDateTime, toIsoOrNull } = require('../lib/db');

const router = Router();
router.use(requireUser);

// Deliberately just weight + note + timestamp for v1 (spec section 22) —
// the model leaves room for other measurement types later without needing
// this table's shape to change.
function toMeasurementDTO(row) {
  return {
    id: row.ROWID,
    recordedTime: toIsoOrNull(row.recorded_time),
    weight: numOrNull(row.weight),
    note: row.note || null
  };
}

router.param('measurementId', async (req, res, next, measurementId) => {
  try {
    assertRowId(measurementId, 'measurementId');
    const row = await req.catalystApp.datastore().table('BodyMeasurement').getRow(measurementId).catch(() => null);
    if (!row || row.user_id !== req.currentUser.userId) {
      return res.status(404).json({ error: 'Measurement not found' });
    }
    req.measurement = row;
    next();
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const userId = assertRowId(req.currentUser.userId, 'userId');
    const rows = await zcqlSelect(req.catalystApp, 'BodyMeasurement', `SELECT * FROM BodyMeasurement WHERE user_id = '${userId}'`);
    rows.sort((a, b) => (b.recorded_time || '').localeCompare(a.recorded_time || ''));
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    res.json({ measurements: rows.slice(0, limit).map(toMeasurementDTO) });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const weight = Number(req.body?.weight);
    if (!Number.isFinite(weight) || weight <= 0) {
      return res.status(400).json({ error: 'weight must be a positive number' });
    }
    const recordedTime = req.body?.recordedTime ? new Date(req.body.recordedTime) : new Date();
    if (Number.isNaN(recordedTime.getTime())) {
      return res.status(400).json({ error: 'Invalid recordedTime' });
    }

    const inserted = await req.catalystApp.datastore().table('BodyMeasurement').insertRow(
      compact({
        user_id: req.currentUser.userId,
        recorded_time: toCatalystDateTime(recordedTime),
        weight,
        note: req.body?.note || ''
      })
    );

    res.status(201).json({ measurement: toMeasurementDTO(inserted) });
  } catch (err) {
    next(err);
  }
});

router.patch('/:measurementId', async (req, res, next) => {
  try {
    const patch = { ROWID: req.measurement.ROWID };
    if (req.body?.weight !== undefined) patch.weight = Number(req.body.weight);
    if (req.body?.note !== undefined) patch.note = req.body.note;
    if (req.body?.recordedTime !== undefined) {
      const date = new Date(req.body.recordedTime);
      if (Number.isNaN(date.getTime())) return res.status(400).json({ error: 'Invalid recordedTime' });
      patch.recorded_time = toCatalystDateTime(date);
    }
    const updated = await req.catalystApp.datastore().table('BodyMeasurement').updateRow(patch);
    res.json({ measurement: toMeasurementDTO(updated) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:measurementId', async (req, res, next) => {
  try {
    await req.catalystApp.datastore().table('BodyMeasurement').deleteRow(req.measurement.ROWID);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
