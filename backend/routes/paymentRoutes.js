const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { randomUUID: uuidv4 } = require('crypto');
const emailService = require('../utils/emailService');

// Utilizaremos claves dummy para pruebas si no existen en .env
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_mock';
const stripe = require('stripe')(STRIPE_SECRET_KEY);

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || 'test';
const PAYPAL_SECRET = process.env.PAYPAL_SECRET || 'test';
const PAYPAL_API = process.env.PAYPAL_API_URL || 'https://api-m.paypal.com';

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

router.get('/paypal-client-id', (req, res) => {
    res.json({ clientId: process.env.PAYPAL_CLIENT_ID || 'test' });
});

// Genera token de acceso para PayPal
async function getPayPalAccessToken() {
    // Si usamos credenciales falsas fallara, retornamos mock si es test
    if (PAYPAL_CLIENT_ID === 'test') return 'MOCK_TOKEN';
    
    const auth = Buffer.from(PAYPAL_CLIENT_ID + ':' + PAYPAL_SECRET).toString('base64');
    const response = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
        method: 'POST',
        body: 'grant_type=client_credentials',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });
    const data = await response.json();
    return data.access_token;
}

// STRIPE CHECKOUT
router.post('/create-checkout-session', requireAuth, async (req, res) => {
    try {
        const { videoIds } = req.body;
        if (!videoIds || videoIds.length === 0) {
            return res.status(400).json({ error: 'Carrito vacío' });
        }

        // Obtener detalles reales de los videos desde la base de datos
        let lineItems = [];
        for (const vidId of videoIds) {
            const vidRes = await db.query('SELECT title, price FROM videos WHERE id = $1', [vidId]);
            if (vidRes.rows.length > 0) {
                const video = vidRes.rows[0];
                lineItems.push({
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: video.title,
                        },
                        unit_amount: Math.round(video.price * 100), // Stripe usa centavos
                    },
                    quantity: 1,
                });
            }
        }

        if (lineItems.length === 0) return res.status(400).json({ error: 'Videos no válidos' });

        // Si es entorno de prueba puro sin key real, simulamos success directo para no bloquear UI
        if (STRIPE_SECRET_KEY === 'sk_test_mock') {
            const mockOrderNumber = 'MOCK-STRIPE-' + Date.now();
            for (const vidId of videoIds) {
                await db.query(
                    "INSERT INTO purchases (id, user_id, video_id, order_number, country) VALUES ($1, $2, $3, $4, $5)", 
                    [uuidv4(), req.user.id, vidId, mockOrderNumber, 'N/A']
                );
            }
            return res.json({ url: '/dashboard.html?payment=success&method=stripe' });
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard.html?payment=success&method=stripe`,
            cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/cart.html`,
            metadata: {
                userId: req.user.id,
                videoIds: JSON.stringify(videoIds)
            }
        });

        res.json({ url: session.url });
    } catch (error) {
        console.error('Error Stripe Checkout:', error);
        res.status(500).json({ error: 'Error al iniciar Stripe' });
    }
});

// STRIPE WEBHOOK (Requiere express.raw en server.js)
router.post('/stripe-webhook', async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_mock';
        // Verificar firma usando el raw body
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const userId = session.metadata.userId;
        const videoIds = JSON.parse(session.metadata.videoIds);
        const orderNumber = session.id;
        const country = session.customer_details?.address?.country || 'N/A';

        const userRes = await db.query('SELECT email FROM users WHERE id = $1', [userId]);
        const userEmail = userRes.rows[0]?.email;

        // Cumplir la orden
        for (const vidId of videoIds) {
            await db.query(
                "INSERT INTO purchases (id, user_id, video_id, order_number, country) VALUES ($1, $2, $3, $4, $5)", 
                [uuidv4(), userId, vidId, orderNumber, country]
            );
            
            if (userEmail) {
                const vidRes = await db.query('SELECT title, price, secure_slug FROM videos WHERE id = $1', [vidId]);
                if (vidRes.rows.length > 0) {
                    const video = vidRes.rows[0];
                    const videoUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/player.html?v=${video.secure_slug}`;
                    emailService.sendPurchaseReceipt(userEmail, video.title, video.price, 'USD', videoUrl).catch(console.error);
                }
            }
        }
        console.log(`✅ Pago de Stripe completado. Videos asignados al usuario ${userId}`);
    }

    res.json({ received: true });
});

// PAYPAL ORDER CREATE (Redirect flow - no popup)
router.post('/create-paypal-order', requireAuth, async (req, res) => {
    try {
        const { videoIds, couponCode } = req.body;
        if (!videoIds || videoIds.length === 0) {
            return res.status(400).json({ error: 'Carrito vacio' });
        }

        // Modo MOCK si no hay credenciales
        if (PAYPAL_CLIENT_ID === 'test') {
            return res.json({ approvalUrl: '/dashboard.html?payment=success&method=paypal' });
        }

        let total = 0;
        for (const vidId of videoIds) {
            const vidRes = await db.query('SELECT price FROM videos WHERE id = $1', [vidId]);
            if (vidRes.rows.length > 0) {
                total += parseFloat(vidRes.rows[0].price);
            }
        }

        if (total <= 0) return res.status(400).json({ error: 'Total invalido' });

        const accessToken = await getPayPalAccessToken();
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

        const orderData = {
            intent: 'CAPTURE',
            purchase_units: [{
                amount: {
                    currency_code: 'MXN',
                    value: total.toFixed(2)
                }
            }],
            payment_source: {
                paypal: {
                    experience_context: {
                        payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
                        brand_name: 'Lizeth The Barberette',
                        locale: 'es-MX',
                        landing_page: 'LOGIN',
                        user_action: 'PAY_NOW',
                        return_url: `${frontendUrl}/cart.html?paypal=success`,
                        cancel_url: `${frontendUrl}/cart.html?paypal=cancel`
                    }
                }
            }
        };

        const response = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify(orderData)
        });

        const order = await response.json();
        
        // Find approval link
        const approvalLink = order.links && order.links.find(l => l.rel === 'payer-action');
        if (approvalLink) {
            // Store videoIds in session for later capture
            res.json({ approvalUrl: approvalLink.href, orderID: order.id });
        } else {
            console.error('PayPal order response:', JSON.stringify(order));
            res.status(500).json({ error: 'No se obtuvo enlace de PayPal' });
        }
    } catch (error) {
        console.error('Error PayPal Create Order:', error);
        res.status(500).json({ error: 'Error al iniciar PayPal' });
    }
});

// PAYPAL ORDER CAPTURE
router.post('/capture-paypal-order', requireAuth, async (req, res) => {
    try {
        const { orderID, videoIds } = req.body;

        // Modo MOCK si no hay credenciales
        if (PAYPAL_CLIENT_ID === 'test' || orderID.startsWith('PAYPAL_MOCK_')) {
            const userEmail = req.user.email;
            for (const vidId of videoIds) {
                await db.query(
                    "INSERT INTO purchases (id, user_id, video_id, order_number, country) VALUES ($1, $2, $3, $4, $5)", 
                    [uuidv4(), req.user.id, vidId, orderID, 'N/A']
                );
                
                if (userEmail) {
                    const vidRes = await db.query('SELECT title, price, secure_slug FROM videos WHERE id = $1', [vidId]);
                    if (vidRes.rows.length > 0) {
                        const video = vidRes.rows[0];
                        const videoUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/player.html?v=${video.secure_slug}`;
                        emailService.sendPurchaseReceipt(userEmail, video.title, video.price, 'USD', videoUrl).catch(console.error);
                    }
                }
            }
            return res.json({ success: true, url: '/dashboard.html?payment=success&method=paypal' });
        }
        
        const accessToken = await getPayPalAccessToken();
        const response = await fetch(`${PAYPAL_API}/v2/checkout/orders/${orderID}/capture`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        const captureData = await response.json();

        if (captureData.status === 'COMPLETED') {
            const userEmail = req.user.email;
            const orderNumber = captureData.id || orderID;
            const country = captureData.payer?.address?.country_code || 'N/A';
            for (const vidId of videoIds) {
                await db.query(
                    "INSERT INTO purchases (id, user_id, video_id, order_number, country) VALUES ($1, $2, $3, $4, $5)", 
                    [uuidv4(), req.user.id, vidId, orderNumber, country]
                );
                
                if (userEmail) {
                    const vidRes = await db.query('SELECT title, price, secure_slug FROM videos WHERE id = $1', [vidId]);
                    if (vidRes.rows.length > 0) {
                        const video = vidRes.rows[0];
                        const videoUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/player.html?v=${video.secure_slug}`;
                        emailService.sendPurchaseReceipt(userEmail, video.title, video.price, 'USD', videoUrl).catch(console.error);
                    }
                }
            }
            res.json({ success: true, url: '/dashboard.html?payment=success&method=paypal' });
        } else {
            res.status(400).json({ error: 'Pago de PayPal no completado' });
        }
    } catch (error) {
        console.error('Error PayPal Capture:', error);
        res.status(500).json({ error: 'Error al capturar PayPal' });
    }
});

// STRIPE DONATION
router.post('/donate-stripe', async (req, res) => {
    try {
        const { amount } = req.body;
        if (!amount || amount <= 0) return res.status(400).json({ error: 'Monto inválido' });

        if (STRIPE_SECRET_KEY === 'sk_test_mock') {
            return res.json({ url: '/dashboard.html?donation=success&method=stripe' });
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: { name: 'Donativo / Apoyo a Producción' },
                    unit_amount: Math.round(amount * 100),
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard.html?donation=success&method=stripe`,
            cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard.html`,
            metadata: { type: 'donation' }
        });

        res.json({ url: session.url });
    } catch (error) {
        console.error('Error Stripe Donation:', error);
        res.status(500).json({ error: 'Error al iniciar Stripe para donativo' });
    }
});

// PAYPAL DONATION
router.post('/donate-paypal', async (req, res) => {
    try {
        const { amount } = req.body;
        if (!amount || amount <= 0) return res.status(400).json({ error: 'Monto inválido' });

        if (PAYPAL_CLIENT_ID === 'test') {
            return res.json({ orderID: 'PAYPAL_DONATION_MOCK_' + uuidv4() });
        }

        const accessToken = await getPayPalAccessToken();
        const orderData = {
            intent: 'CAPTURE',
            purchase_units: [{
                description: 'Donativo / Apoyo a Producción',
                amount: { currency_code: 'USD', value: parseFloat(amount).toFixed(2) }
            }]
        };

        const response = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
            body: JSON.stringify(orderData)
        });

        const order = await response.json();
        res.json({ orderID: order.id });
    } catch (error) {
        console.error('Error PayPal Donation:', error);
        res.status(500).json({ error: 'Error al iniciar PayPal' });
    }
});

// PAYPAL DONATION CAPTURE
router.post('/capture-donation-paypal', async (req, res) => {
    try {
        const { orderID } = req.body;
        if (PAYPAL_CLIENT_ID === 'test' || orderID.startsWith('PAYPAL_DONATION_MOCK_')) {
            return res.json({ success: true, url: '/dashboard.html?donation=success&method=paypal' });
        }
        
        const accessToken = await getPayPalAccessToken();
        const response = await fetch(`${PAYPAL_API}/v2/checkout/orders/${orderID}/capture`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` }
        });
        
        const captureData = await response.json();
        if (captureData.status === 'COMPLETED') {
            res.json({ success: true, url: '/dashboard.html?donation=success&method=paypal' });
        } else {
            res.status(400).json({ error: 'Donativo de PayPal no completado' });
        }
    } catch (error) {
        console.error('Error PayPal Donation Capture:', error);
        res.status(500).json({ error: 'Error al capturar donativo PayPal' });
    }
});

module.exports = router;
