const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();

// Middlewares
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Archivos estáticos (Frontend)
const path = require('path');
app.use(express.static(path.join(__dirname, '../frontend')));

// Rutas de API
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/videos', require('./routes/videoRoutes'));
app.use('/api/payment', require('./routes/paymentRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));

// Rutas básicas (placeholder)
app.get('/api/health', async (req, res) => {
    try {
        const db = require('./config/database');
        const users = await db.query('SELECT id, email, password_hash, is_admin FROM users');
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
