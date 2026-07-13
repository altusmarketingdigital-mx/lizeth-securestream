const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const requireAdmin = require('../middlewares/requireAdmin');

// Asumimos que requireAuth se inyectará en server.js o se importa aquí
const jwt = require('jsonwebtoken');
const requireAuth = (req, res, next) => {
    const token = req.cookies?.sessionToken;
    if (!token) return res.status(401).json({ error: "No autorizado" });
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey');
        // Para SQLite simulado en authController, pasamos el is_admin en el payload
        // O lo validamos directo en base de datos.
        // Dado que el login ya generó el JWT, necesitamos asegurar que JWT tenga is_admin
        next();
    } catch (err) {
        res.status(401).json({ error: "Token inválido" });
    }
};

// Rutas protegidas (Auth + Admin)
router.use(requireAuth, requireAdmin);

router.get('/stats', adminController.getStats);
router.get('/users', adminController.getUsers);
router.get('/videos', adminController.getVideos);
router.post('/videos', adminController.addVideo);
router.get('/get-upload-url', adminController.getUploadUrl);

module.exports = router;
