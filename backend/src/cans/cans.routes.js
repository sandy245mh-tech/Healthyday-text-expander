const express = require('express');
const router = express.Router();
const cansController = require('./cans.controller');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', cansController.getAllCans);
router.post('/', cansController.createCan);
router.get('/:id', cansController.getCan);
router.put('/:id', cansController.updateCan);
router.delete('/:id', cansController.deleteCan);

module.exports = router;
