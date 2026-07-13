const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const requireAdmin = require('../middlewares/requireAdmin');
const jwt = require('jsonwebtoken');

const requireAuth = (req, res, next) => {
    const token = req.cookies?.sessionToken;
    if (!token) return res.status(401).json({ error: "No autorizado" });
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey');
        next();
    } catch (err) {
        res.status(401).json({ error: "Token inválido" });
    }
};

router.get('/', settingsController.getSettings);
router.put('/', requireAuth, requireAdmin, settingsController.updateSettings);

module.exports = router;
