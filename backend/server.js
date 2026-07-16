const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// Geo-blocking Middleware (India & Indonesia)
app.use((req, res, next) => {
    const country = req.headers['x-vercel-ip-country'];
    if (country === 'IN' || country === 'ID') {
        return res.status(403).send('<h1>Access Denied / Acceso Denegado</h1><p>Sorry, this content is not available in your region.</p>');
    }
    next();
});

// Middlewares
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
// Webhook de Stripe necesita el body raw para verificar la firma
app.use('/api/payment/stripe-webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());

// Seguridad y Rate Limiting
app.use(helmet({
    contentSecurityPolicy: false, // Desactivado para no romper iframes/scripts externos como PayPal o Stripe
    crossOriginEmbedderPolicy: false
}));

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 30, // 30 intentos
    message: { error: 'Demasiados intentos de inicio de sesión. Por favor, intenta más tarde.' }
});

// SEO Dinámico para Cursos (Open Graph)
const fs = require('fs');
const path = require('path');
const db = require('./config/database');
app.get('/curso/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        const result = await db.query('SELECT title, description, price, cover_url FROM videos WHERE secure_slug = $1', [slug]);
        
        const playerHtmlPath = path.join(__dirname, '../frontend/player.html');
        let htmlData = fs.readFileSync(playerHtmlPath, 'utf8');

        if (result.rows.length > 0) {
            const video = result.rows[0];
            const metaTags = `
                <title>${video.title} | Lizeth The Barberette</title>
                <meta property="og:title" content="${video.title}" />
                <meta property="og:description" content="${video.description || 'Aprende las mejores técnicas de barbería.'}" />
                <meta property="og:image" content="${video.cover_url}" />
                <meta property="og:type" content="video.other" />
            `;
            htmlData = htmlData.replace('<head>', `<head>\n${metaTags}`);
        }
        
        res.send(htmlData);
    } catch (err) {
        console.error('Error en SEO Dinámico:', err);
        res.sendFile(path.join(__dirname, '../frontend/player.html'));
    }
});

// Archivos estáticos (Frontend)
app.use(express.static(path.join(__dirname, '../frontend')));

// Rutas de API
app.use('/api/auth', authLimiter, require('./routes/authRoutes'));
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
