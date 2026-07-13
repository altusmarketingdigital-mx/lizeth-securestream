const express = require('express');
const router = express.Router();
const carouselController = require('../controllers/carouselController');
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

// Rutas públicas (Cliente)
router.get('/', carouselController.getImages);

// Rutas protegidas (Administrador)
router.use(requireAuth, requireAdmin);
router.post('/', carouselController.addImage);
router.delete('/:id', carouselController.deleteImage);

module.exports = router;
