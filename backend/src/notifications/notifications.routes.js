const express = require('express');
const router = express.Router();
const notificationsController = require('./notifications.controller');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', notificationsController.getNotifications);
router.post('/:id/read', notificationsController.markAsRead);

module.exports = router;
