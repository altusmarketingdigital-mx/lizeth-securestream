const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();

// Middlewares
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
// Webhook de Stripe necesita el body raw para verificar la firma
app.use('/api/payment/stripe-webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());

// Archivos estáticos (Frontend)
const path = require('path');
app.use(express.static(path.join(__dirname, '../frontend')));

// Rutas de API
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/videos', require('./routes/videoRoutes'));
app.use('/api/payment', require('./routes/paymentRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/coupons', require('./routes/couponRoutes'));
app.use('/api/carousel', require('./routes/carouselRoutes'));
app.use('/api/settings', require('./routes/settingsRoutes'));
app.use('/api/user', require('./routes/userRoutes'));
app.use('/api/contact', require('./routes/contactRoutes'));

// Rutas directas (sin router por simplicidad)
const currencyController = require('./controllers/currencyController');
app.get('/api/currency/rates', currencyController.getRates);

// Rutas básicas (placeholder)
app.get('/api/health', async (req, res) => {
    try {
        const db = require('./config/database');
        const bcrypt = require('bcryptjs');
        const hash = bcrypt.hashSync('password123', 10);
        
        // Forzar inserción si no existen
        await db.query("INSERT INTO users (email, password_hash, has_premium, is_admin) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING", ['cliente@barberette.com', hash, false, false]);
        await db.query("INSERT INTO users (email, password_hash, has_premium, is_admin) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING", ['admin@barberette.com', hash, true, true]);
        
        const users = await db.query('SELECT id, email, is_admin FROM users');
        res.json({ status: 'ok', users: users.rows });
    } catch (e) {
        res.json({ status: 'error', message: e.message });
    }
});

// Iniciar servidor (Solo en local, Vercel usa el módulo exportado)
if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Servidor seguro corriendo en el puerto ${PORT}`);
    });
}

module.exports = app;
