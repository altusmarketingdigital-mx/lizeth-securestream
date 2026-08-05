const jwt = require('jsonwebtoken');
const db = require('../config/database');
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

const requireAuth = async (req, res, next) => {
    try {
        const clientToken = req.cookies?.sessionToken || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : null);

        let decoded = null;
        if (clientToken) {
            try {
                decoded = jwt.verify(clientToken, JWT_SECRET);
            } catch (err) {
                // Token inválido o expirado por firma JWT
            }
        }

        let userId = decoded?.id;
        let userEmail = req.body?.userEmail || req.body?.email;

        if (!userId && userEmail) {
            const uRes = await db.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1', [userEmail.trim()]);
            if (uRes.rows.length > 0) {
                userId = uRes.rows[0].id;
            }
        }

        if (!userId) {
            return res.status(401).json({ error: "No autorizado. Inicia sesión para continuar." });
        }

        // Consultar token activo y estado en la Base de Datos
        const userRes = await db.query(
            'SELECT id, name, email, is_admin, has_premium, is_blocked, current_session_token FROM users WHERE id::text = $1::text LIMIT 1',
            [String(userId)]
        );

        if (userRes.rows.length === 0) {
            res.clearCookie('sessionToken');
            return res.status(401).json({ error: "Usuario no encontrado." });
        }

        const user = userRes.rows[0];

        if (user.is_blocked) {
            res.clearCookie('sessionToken');
            return res.status(403).json({ error: "Cuenta suspendida. Contacta a soporte." });
        }

        // VALIDACIÓN ESTRICTA DE SESIÓN ÚNICA POR DISPOSITIVO
        if (clientToken && user.current_session_token && clientToken !== user.current_session_token) {
            res.clearCookie('sessionToken');
            return res.status(401).json({
                code: 'SINGLE_DEVICE_SESSION_EXPIRED',
                error: 'Sesión finalizada por inicio en otro dispositivo',
                message: 'Has iniciado sesión en otro dispositivo. Por seguridad, esta sesión ha sido cerrada.'
            });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('Error en requireAuth middleware:', error);
        res.status(500).json({ error: 'Error de autenticación en servidor' });
    }
};

module.exports = { requireAuth };
