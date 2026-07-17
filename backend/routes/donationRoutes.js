const express = require('express');
const router = express.Router();
const donationController = require('../controllers/donationController');
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

router.post('/', donationController.createDonation);
router.get('/', requireAuth, requireAdmin, donationController.getDonations);

module.exports = router;
