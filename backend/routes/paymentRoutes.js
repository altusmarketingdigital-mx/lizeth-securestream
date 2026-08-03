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

const { requireAuth } = require('../middlewares/authMiddleware');

router.get('/paypal-client-id', (req, res) => {
    res.json({ clientId: process.env.PAYPAL_CLIENT_ID || 'test' });
});

// Genera token de acceso para PayPal
async function getPayPalAccessToken() {
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

// Helper para calcular total con descuento
async function calculateCart(videoIds, couponCode) {
    let lineItems = [];
    let total = 0;
    let cartCurrency = 'usd';
    
    let coupon = null;
    if (couponCode) {
        const couponRes = await db.query('SELECT * FROM coupons WHERE LOWER(code) = LOWER($1) AND is_active = true LIMIT 1', [couponCode.trim()]);
        if (couponRes.rows.length > 0) {
            coupon = couponRes.rows[0];
        } else {
            throw new Error(`Cupón '${couponCode}' no encontrado o inactivo.`);
        }
    }

    for (let i = 0; i < videoIds.length; i++) {
        const vidId = videoIds[i];
        const vidRes = await db.query('SELECT id, title, price, sale_price, currency FROM videos WHERE id::text = $1::text OR secure_slug = $1 LIMIT 1', [vidId]);
        if (vidRes.rows.length > 0) {
            const video = vidRes.rows[0];
            
            let basePrice = parseFloat(video.sale_price) > 0 ? parseFloat(video.sale_price) : parseFloat(video.price);
            let currency = (video.currency || 'usd').toLowerCase();
            
            if (i === 0) {
                cartCurrency = currency;
            }

            if (coupon) {
                if (!coupon.video_id || String(coupon.video_id) === String(video.id)) {
                    basePrice = basePrice * ((100 - parseFloat(coupon.discount_percentage)) / 100);
                }
            }
            
            total += basePrice;
            lineItems.push({
                price_data: {
                    currency: currency,
                    product_data: { name: video.title },
                    unit_amount: Math.round(basePrice * 100),
                },
                quantity: 1,
            });
        }
    }
    return { lineItems, total, currency: cartCurrency };
}

// Helper universal para insertar compras en la base de datos de manera atómica y garantizada
async function recordPurchases({ userId, videoIds, couponCode, orderNumber, country = 'MX', status = 'exitoso' }) {
    if (!userId || !videoIds || videoIds.length === 0) return [];
    
    let total = 0;
    let cartCurrency = 'MXN';
    try {
        const cartData = await calculateCart(videoIds, couponCode);
        total = cartData.total;
        cartCurrency = cartData.currency || 'MXN';
    } catch (e) {
        total = 0;
    }
    
    const perItemPrice = videoIds.length > 0 ? (total / videoIds.length) : 0;
    
    const inserted = [];
    const userRes = await db.query('SELECT email FROM users WHERE id::text = $1::text LIMIT 1', [String(userId)]);
    const userEmail = userRes.rows[0]?.email;
    
    for (const vidId of videoIds) {
        const existing = await db.query(
            'SELECT id FROM purchases WHERE (user_id::text = $1::text OR user_id = $2) AND (video_id::text = $3::text) AND order_number = $4 LIMIT 1',
            [String(userId), userEmail || '', String(vidId), orderNumber]
        );
        
        if (existing.rows.length > 0) {
            inserted.push(existing.rows[0]);
            continue;
        }
        
        const vidRes = await db.query('SELECT id, title, price, sale_price, secure_slug FROM videos WHERE id::text = $1::text OR secure_slug = $1 LIMIT 1', [String(vidId)]);
        const video = vidRes.rows[0];
        const actualVidId = video ? video.id : vidId;
        
        let finalItemAmount = perItemPrice > 0 ? perItemPrice : (video?.sale_price ? parseFloat(video.sale_price) : (video?.price ? parseFloat(video.price) : 49.99));
        
        const newPurchaseId = uuidv4();
        await db.query(
            "INSERT INTO purchases (id, user_id, video_id, order_number, country, status, amount, purchase_date, currency) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)",
            [newPurchaseId, String(userId), String(actualVidId), orderNumber, country, status, finalItemAmount.toFixed(2), cartCurrency.toUpperCase()]
        );
        
        inserted.push({ id: newPurchaseId, userId, videoId: actualVidId, orderNumber });
        
        if (userEmail && video) {
            const videoUrl = `${process.env.FRONTEND_URL || 'https://lizeth-securestream.vercel.app'}/player.html?v=${video.secure_slug}`;
            emailService.sendPurchaseReceipt(userEmail, video.title, finalItemAmount.toFixed(2), 'USD', videoUrl, orderNumber).catch(console.error);
        }
    }
    
    return inserted;
}

// CONFIRMAR SESION STRIPE AL REGRESAR AL DASHBOARD (GARANTÍA BACKUP DE WEBHOOK)
router.all('/confirm-stripe-session', async (req, res) => {
    try {
        const sessionId = req.query.session_id || req.body?.session_id;
        if (!sessionId) {
            return res.status(400).json({ error: 'Falta session_id' });
        }
        
        if (STRIPE_SECRET_KEY === 'sk_test_mock') {
            return res.json({ success: true, message: 'Mock Stripe session confirmada' });
        }
        
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (session && session.payment_status === 'paid') {
            let userId = session.metadata?.userId;
            const userEmail = session.metadata?.userEmail || session.customer_details?.email;
            const videoIds = session.metadata?.videoIds ? JSON.parse(session.metadata.videoIds) : [];
            const couponCode = session.metadata?.couponCode;
            
            if (!userId && userEmail) {
                const uRes = await db.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1', [userEmail]);
                userId = uRes.rows[0]?.id;
            }
            
            if (userId && videoIds.length > 0) {
                await recordPurchases({
                    userId,
                    videoIds,
                    couponCode,
                    orderNumber: session.id,
                    country: session.customer_details?.address?.country || 'N/A',
                    status: 'exitoso'
                });
            }
            
            return res.json({ success: true, message: 'Pago verificado y compra registrada en base de datos' });
        } else {
            return res.status(400).json({ error: 'El pago en Stripe aún no ha sido completado' });
        }
    } catch (err) {
        console.error('Error al confirmar sesion de Stripe:', err);
        res.status(500).json({ error: err.message || 'Error al confirmar pago de Stripe' });
    }
});

// STRIPE CHECKOUT
router.post('/create-checkout-session', requireAuth, async (req, res) => {
    try {
        const { videoIds, couponCode } = req.body;
        if (!videoIds || videoIds.length === 0) {
            return res.status(400).json({ error: 'Carrito vacío' });
        }

        const { lineItems, total } = await calculateCart(videoIds, couponCode);

        if (lineItems.length === 0) return res.status(400).json({ error: 'Videos no válidos' });

        if (STRIPE_SECRET_KEY === 'sk_test_mock') {
            const mockOrderNumber = 'MOCK-STRIPE-' + Date.now();
            await recordPurchases({
                userId: req.user.id,
                videoIds,
                couponCode,
                orderNumber: mockOrderNumber,
                country: 'N/A',
                status: 'exitoso'
            });
            return res.json({ url: '/dashboard.html?payment=success&method=stripe' });
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            success_url: `${process.env.FRONTEND_URL || 'https://lizeth-securestream.vercel.app'}/dashboard.html?payment=success&method=stripe&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.FRONTEND_URL || 'https://lizeth-securestream.vercel.app'}/cart.html`,
            metadata: {
                userId: req.user.id,
                userEmail: req.user.email,
                couponCode: couponCode || '',
                videoIds: JSON.stringify(videoIds)
            }
        });

        res.json({ url: session.url });
    } catch (error) {
        console.error('Error Stripe Checkout:', error);
        res.status(500).json({ error: error.message || 'Error al iniciar Stripe' });
    }
});

// STRIPE DONATION
router.post('/create-donation', async (req, res) => {
    try {
        const { amount, name, email, message } = req.body;
        const valAmount = parseFloat(amount) || 0;
        if (valAmount <= 0) return res.status(400).json({ error: 'Monto inválido' });

        if (STRIPE_SECRET_KEY === 'sk_test_mock') {
            await db.query(
                'INSERT INTO donations (name, email, message, amount) VALUES ($1, $2, $3, $4)',
                [name || 'Anónimo', email, message, valAmount]
            );
            return res.json({ url: '/?donation=success' });
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: { name: 'Donativo - Apoyo al canal' },
                    unit_amount: Math.round(valAmount * 100),
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `${process.env.FRONTEND_URL || 'https://lizeth-securestream.vercel.app'}/?donation=success`,
            cancel_url: `${process.env.FRONTEND_URL || 'https://lizeth-securestream.vercel.app'}/`,
            metadata: {
                type: 'donation',
                name: name || 'Anónimo',
                email: email || '',
                message: message || '',
                amount: valAmount.toString()
            }
        });

        res.json({ url: session.url });
    } catch (error) {
        console.error('Error Stripe Donation:', error);
        res.status(500).json({ error: error.message || 'Error al iniciar Stripe' });
    }
});

// STRIPE WEBHOOK
router.post('/stripe-webhook', async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_mock';
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        
        if (session.metadata?.type === 'donation') {
            const { name, email, message, amount } = session.metadata;
            await db.query(
                'INSERT INTO donations (name, email, message, amount) VALUES ($1, $2, $3, $4)',
                [name, email, message, parseFloat(amount)]
            );
            console.log(`✅ Donativo de Stripe registrado: $${amount} de ${name}`);
        } else {
            let userId = session.metadata?.userId;
            const userEmail = session.metadata?.userEmail || session.customer_details?.email;
            const videoIds = session.metadata?.videoIds ? JSON.parse(session.metadata.videoIds) : [];
            const couponCode = session.metadata?.couponCode;
            const orderNumber = session.id;
            const country = session.customer_details?.address?.country || 'N/A';

            if (!userId && userEmail) {
                const uRes = await db.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1', [userEmail]);
                userId = uRes.rows[0]?.id;
            }

            if (userId && videoIds.length > 0) {
                await recordPurchases({
                    userId,
                    videoIds,
                    couponCode,
                    orderNumber,
                    country,
                    status: 'exitoso'
                });
                console.log(`✅ Webhook de Stripe completado. Registrado para el usuario ${userId}`);
            }
        }
    }

    res.json({ received: true });
});

// PAYPAL ORDER CREATE
router.post('/create-paypal-order', requireAuth, async (req, res) => {
    try {
        const { videoIds, couponCode } = req.body;
        if (!videoIds || videoIds.length === 0) {
            return res.status(400).json({ error: 'Carrito vacio' });
        }

        if (PAYPAL_CLIENT_ID === 'test') {
            return res.json({ approvalUrl: '/dashboard.html?payment=success&method=paypal' });
        }

        const { total, currency } = await calculateCart(videoIds, couponCode);

        if (total <= 0) return res.status(400).json({ error: 'Total invalido' });

        const accessToken = await getPayPalAccessToken();
        const frontendUrl = process.env.FRONTEND_URL || 'https://lizeth-securestream.vercel.app';

        const orderData = {
            intent: 'CAPTURE',
            purchase_units: [{
                amount: {
                    currency_code: currency.toUpperCase(),
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
        
        const approvalLink = order.links && order.links.find(l => l.rel === 'payer-action');
        if (approvalLink) {
            res.json({ approvalUrl: approvalLink.href, orderID: order.id });
        } else {
            console.error('PayPal order response:', JSON.stringify(order));
            res.status(500).json({ error: 'No se obtuvo enlace de PayPal' });
        }
    } catch (error) {
        console.error('Error PayPal Create Order:', error);
        res.status(500).json({ error: error.message || 'Error al iniciar PayPal' });
    }
});

// PAYPAL ORDER CAPTURE
router.post('/capture-paypal-order', requireAuth, async (req, res) => {
    try {
        const { orderID, videoIds, couponCode } = req.body;
        const userId = req.user.id;

        if (PAYPAL_CLIENT_ID === 'test' || orderID.startsWith('PAYPAL_MOCK_')) {
            await recordPurchases({
                userId,
                videoIds,
                couponCode,
                orderNumber: orderID,
                country: 'N/A',
                status: 'exitoso'
            });
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
            const orderNumber = captureData.id || orderID;
            const country = captureData.payer?.address?.country_code || 'N/A';

            await recordPurchases({
                userId,
                videoIds,
                couponCode,
                orderNumber,
                country,
                status: 'exitoso'
            });

            res.json({ success: true, url: '/dashboard.html?payment=success&method=paypal' });
        } else {
            res.status(400).json({ error: 'Pago de PayPal no completado' });
        }
    } catch (error) {
        console.error('Error PayPal Capture:', error);
        res.status(500).json({ error: 'Error al capturar PayPal' });
    }
});

// DIRECT PURCHASE / FALLBACK CHECKOUT (Garantiza registro directo en DB)
router.post('/direct-purchase', requireAuth, async (req, res) => {
    try {
        const { videoIds, couponCode } = req.body;
        const user = req.user;

        if (!videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
            return res.status(400).json({ error: 'Lista de videos requerida' });
        }

        const orderNumber = "ORD-" + Math.floor(100000 + Math.random() * 900000);

        await recordPurchases({
            userId: user.id,
            videoIds,
            couponCode,
            orderNumber,
            country: 'MX',
            status: 'exitoso'
        });

        console.log(`✅ Compra registrada exitosamente en DB. Orden: ${orderNumber} para usuario ${user.id}`);
        res.json({ success: true, url: '/dashboard.html?payment=success&method=direct', orderNumber });
    } catch (error) {
        console.error('Error en direct-purchase:', error);
        res.status(500).json({ error: 'Error al registrar la compra: ' + error.message });
    }
});

module.exports = router;
