const express = require('express');
const router = express.Router();
const { success } = require('../utils/response');

/**
 * GET /health
 * Simple health-check endpoint.
 */
router.get('/health', (req, res) => {
  return success(res, {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  }, 'Cloud Text Expander API is running');
});

module.exports = router;
