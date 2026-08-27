'use strict';

const { Router } = require('express');
const { requireUser } = require('../middleware/requireUser');

const router = Router();

// Unauthenticated liveness check.
router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Proves identity is derived server-side: returns whoever Catalyst says is
// authenticated for this request, never anything the client could spoof.
router.get('/health/whoami', requireUser, (req, res) => {
  res.json({ user: req.currentUser });
});

module.exports = router;
