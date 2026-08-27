'use strict';

const { Router } = require('express');
const { requireUser } = require('../middleware/requireUser');

/**
 * Placeholder router for a resource whose real implementation lands in a
 * later phase. Still requires auth so the eventual real routes don't change
 * the security shape of the API.
 */
function notImplementedRouter(resourceName) {
  const router = Router();
  router.use(requireUser);
  router.use((req, res) => {
    res.status(501).json({ error: `${resourceName} is not implemented yet` });
  });
  return router;
}

module.exports = { notImplementedRouter };
