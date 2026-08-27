'use strict';

// Shared by exercise duplicate-detection now and JSON-import matching later
// (see spec section 7) — keep the normalization rule in one place.
function normalizeName(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

module.exports = { normalizeName };
