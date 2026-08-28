'use strict';

const catalyst = require('zcatalyst-sdk-node');
const { getCurrentUser } = require('../getCurrentUser');

/**
 * Attaches req.currentUser from the authenticated Catalyst session, and
 * req.catalystApp so downstream route handlers don't each re-initialize it.
 * Never reads identity from the request body/query — see getCurrentUser.js.
 */
async function requireUser(req, res, next) {
  try {
    req.catalystApp = catalyst.initialize(req);
    req.currentUser = await getCurrentUser(req);
    next();
  } catch (err) {
    res.status(err.status || 401).json({ error: 'Not authenticated' });
  }
}

module.exports = { requireUser };
