'use strict';

const express = require('express');
const healthRouter = require('./routes/health');
const exercisesRouter = require('./routes/exercises');
const plansRouter = require('./routes/plans');
const sessionsRouter = require('./routes/sessions');
const { notImplementedRouter } = require('./routes/notImplemented');

const app = express();
app.use(express.json());

app.use(healthRouter);
app.use('/plans', plansRouter);
app.use('/exercises', exercisesRouter);
app.use('/sessions', sessionsRouter);
app.use('/measurements', notImplementedRouter('measurements'));

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: 'Internal server error' });
});

module.exports = app;
