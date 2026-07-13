const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_mock');

const requireAuth = (req, res, next) => {
    const token = req.cookies?.sessionToken;
    if (!token) return res.status(401).json({ error: "No autorizado" });
    const jwt = require('jsonwebtoken');
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey');
        next();
    } catch (err) {
        res.status(401).json({ error: "Token inválido" });
    }
};

// STRIPE CHECKOUT
router.post('/create-checkout-session', requireAuth, async (req, res) => {
    try {
        const { videoIds } = req.body;
        if (!videoIds || videoIds.length === 0) {
            return res.status(400).json({ error: 'Carrito vacío' });
        }

        // Si tenemos clave real, creamos sesión. De lo contrario simulamos éxito.
        if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.startsWith('sk_')) {
            // Lógica real de Stripe (requiere buscar precios en BD)
            // Por ahora, simulamos el éxito de la compra para el prototipo
        }

        for (const vidId of videoIds) {
            await db.query(
                "INSERT INTO purchases (id, user_id, video_id) VALUES (?, ?, ?)", 
                [uuidv4(), req.user.id, vidId]
            );
        }
        
        res.json({ url: '/dashboard.html?payment=success&method=stripe' });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al procesar el pago con Stripe' });
    }
});

// PAYPAL ORDER CREATE
router.post('/create-paypal-order', requireAuth, async (req, res) => {
    try {
        const { videoIds } = req.body;
        if (!videoIds || videoIds.length === 0) {
            return res.status(400).json({ error: 'Carrito vacío' });
        }

        // Aquí iría la integración con @paypal/checkout-server-sdk
        // Simulamos la creación de orden devolviendo un ID falso
        res.json({ orderID: 'PAYPAL_MOCK_' + uuidv4() });
    } catch (error) {
        res.status(500).json({ error: 'Error al procesar pago con PayPal' });
    }
});

// PAYPAL ORDER CAPTURE
router.post('/capture-paypal-order', requireAuth, async (req, res) => {
    try {
        const { orderID, videoIds } = req.body;
        
        // Simulación de captura exitosa
        for (const vidId of videoIds) {
            await db.query(
                "INSERT INTO purchases (id, user_id, video_id) VALUES (?, ?, ?)", 
                [uuidv4(), req.user.id, vidId]
            );
        }
        
        res.json({ success: true, url: '/dashboard.html?payment=success&method=paypal' });
    } catch (error) {
        res.status(500).json({ error: 'Error al capturar pago con PayPal' });
    }
});

module.exports = router;
