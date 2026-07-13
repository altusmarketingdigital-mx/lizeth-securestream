const express = require('express');
const router = express.Router();
const videoController = require('../controllers/videoController');
const enforceSingleSession = require('../middlewares/singleSession');

// Middleware manual de autenticación (valida el token)
const requireAuth = (req, res, next) => {
    const token = req.cookies?.sessionToken;
    if (!token) return res.status(401).json({ error: "No autorizado" });
    const jwt = require('jsonwebtoken');
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey');
        req.user = decoded; // { id, email }
        next();
    } catch (err) {
        res.status(401).json({ error: "Token inválido" });
    }
};

router.get('/catalog', videoController.getCatalog);
router.get('/my-videos', requireAuth, videoController.getMyVideos);
router.get('/stream/:slug', requireAuth, enforceSingleSession, videoController.streamVideo);

module.exports = router;
