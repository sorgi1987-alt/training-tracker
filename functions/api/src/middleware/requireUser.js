'use strict';

const { getCurrentUser } = require('../getCurrentUser');

/**
 * Attaches req.currentUser from the authenticated Catalyst session.
 * Never reads identity from the request body/query — see getCurrentUser.js.
 */
async function requireUser(req, res, next) {
  try {
    req.currentUser = await getCurrentUser(req);
    next();
  } catch (err) {
    res.status(err.status || 401).json({ error: 'Not authenticated' });
  }
}

module.exports = { requireUser };
