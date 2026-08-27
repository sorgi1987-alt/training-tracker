'use strict';

const catalyst = require('zcatalyst-sdk-node');

/**
 * Derives the authenticated Catalyst user for this request. This is the only
 * place user identity is ever read — every data-access call must go through
 * it instead of trusting anything the client sends.
 *
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<{ zuid: string, userId: string, email: string, firstName: string, lastName: string }>}
 */
async function getCurrentUser(req) {
  const catalystApp = catalyst.initialize(req);
  const currentUser = await catalystApp.userManagement().getCurrentUser();

  if (!currentUser) {
    const err = new Error('No authenticated user on this request');
    err.status = 401;
    throw err;
  }

  return {
    zuid: currentUser.zuid,
    userId: currentUser.user_id,
    email: currentUser.email_id,
    firstName: currentUser.first_name,
    lastName: currentUser.last_name
  };
}

module.exports = { getCurrentUser };
