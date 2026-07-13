const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { verifyToken, verifyAdmin } = require('../middlewares/authMiddleware');

router.get('/', settingsController.getSettings);
router.put('/', verifyToken, verifyAdmin, settingsController.updateSettings);

module.exports = router;
