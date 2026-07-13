const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

exports.login = async (req, res) => {
    const { email, password } = req.body;
    
    try {
        // En producción: usar bcrypt.compare. Aquí simulamos el acceso directo
        const result = await db.query('SELECT * FROM users WHERE email = $1 LIMIT 1', [email]);
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }
        
        const user = result.rows[0];
        
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
