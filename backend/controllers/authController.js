const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { randomUUID: uuidv4 } = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

exports.login = async (req, res) => {
    let { email, password } = req.body;
    email = email ? email.toLowerCase().trim() : '';
    
    try {
        // En producción: usar bcrypt.compare. Aquí simulamos el acceso directo
        const result = await db.query('SELECT * FROM users WHERE email = $1 LIMIT 1', [email]);
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }
        
        const user = result.rows[0];
        if (user.is_blocked) {
            return res.status(403).json({ error: 'Tu cuenta ha sido suspendida. Contacta a soporte.' });
        }
        
        // Comparación de hash usando bcrypt real
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        // 1. Generar nuevo Session Token (puede ser UUID puro o JWT)
        const sessionToken = jwt.sign(
            { id: user.id, email: user.email, is_admin: user.is_admin }, 
            JWT_SECRET, 
            { expiresIn: '8h' }
        );

        // 2. Actualizar la base de datos con el nuevo token, invalidando automáticamente el anterior
        await db.query('UPDATE users SET current_session_token = $1, last_login_ip = $2 WHERE id = $3', [
            sessionToken, req.ip, user.id
        ]);

        // 3. Enviar Cookie y respuesta
        res.cookie('sessionToken', sessionToken, { 
            httpOnly: true, 
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 8 * 60 * 60 * 1000 // 8 horas
        });

        res.json({
            message: 'Login exitoso',
            user: { id: user.id, email: user.email, has_premium: user.has_premium, is_admin: user.is_admin },
            token: sessionToken // Opcional, para que el frontend lo use en el header si no usa cookies
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

exports.logout = async (req, res) => {
    if (req.user) {
        await db.query('UPDATE users SET current_session_token = NULL WHERE id = $1', [req.user.id]);
    }
    res.clearCookie('sessionToken');
    res.json({ message: 'Logout exitoso' });
};

exports.forgotPassword = async (req, res) => {
    let { email } = req.body;
    email = email ? email.toLowerCase().trim() : '';
    if (!email) return res.status(400).json({ error: 'Email requerido' });

    try {
        const result = await db.query('SELECT id FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.json({ message: 'Si el correo existe, se enviará un enlace de recuperación.' });
        }

        const user = result.rows[0];
        const resetToken = require('crypto').randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 3600000); // 1 hora

        await db.query(
            'UPDATE users SET reset_password_token = $1, reset_password_expires = $2 WHERE id = $3',
            [resetToken, expiresAt, user.id]
        );

        const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password.html?token=${resetToken}`;
        
        const emailService = require('../utils/emailService');
        await emailService.sendMagicLink(email, resetUrl);

        res.json({ message: 'Si el correo existe, se enviará un enlace de recuperación.' });
    } catch (error) {
        console.error('Error en forgotPassword:', error);
        res.status(500).json({ error: 'Error procesando la solicitud' });
    }
};

exports.resetPassword = async (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: 'Datos inválidos o contraseña muy corta (min. 6)' });
    }

    try {
        const result = await db.query(
            'SELECT id FROM users WHERE reset_password_token = $1 AND reset_password_expires > NOW()',
            [token]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'El enlace de recuperación es inválido o ha expirado.' });
        }

        const user = result.rows[0];
        const passwordHash = await bcrypt.hash(newPassword, 10);

        await db.query(
            'UPDATE users SET password_hash = $1, reset_password_token = NULL, reset_password_expires = NULL, current_session_token = NULL WHERE id = $2',
            [passwordHash, user.id]
        );

        res.json({ message: 'Contraseña actualizada exitosamente. Ya puedes iniciar sesión.' });
    } catch (error) {
        console.error('Error en resetPassword:', error);
        res.status(500).json({ error: 'Error procesando la solicitud' });
    }
};

exports.changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    
    if (!req.user || !req.user.id) return res.status(401).json({ error: 'No autorizado' });
    if (!currentPassword || !newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: 'Datos inválidos o contraseña muy corta' });
    }

    try {
        const result = await db.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

        const user = result.rows[0];
        const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
        
        if (!validPassword) {
            return res.status(401).json({ error: 'La contraseña actual es incorrecta' });
        }

        const newPasswordHash = await bcrypt.hash(newPassword, 10);
        await db.query(
            'UPDATE users SET password_hash = $1, current_session_token = NULL WHERE id = $2',
            [newPasswordHash, req.user.id]
        );

        res.json({ message: 'Contraseña actualizada exitosamente. Tu sesión actual ha expirado por seguridad.' });
    } catch (error) {
        console.error('Error en changePassword:', error);
        res.status(500).json({ error: 'Error procesando la solicitud' });
    }
};
