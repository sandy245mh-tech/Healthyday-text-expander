const express = require('express');
const router = express.Router();
const orgController = require('./org.controller');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.use(requireAuth);

// GET is accessible by Agents and Admins
router.get('/cans', orgController.getAllCans);

// Write operations are Admin-only
router.post('/cans', requireAdmin, orgController.createCan);
router.put('/cans/:id', requireAdmin, orgController.updateCan);
router.delete('/cans/:id', requireAdmin, orgController.deleteCan);

router.post('/cans/:id/publish', requireAdmin, orgController.publishCan);

module.exports = router;
