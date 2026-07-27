const express = require('express');
const router = express.Router();
const db = require('../config/database');

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

router.get('/purchases', requireAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                p.id, 
                p.created_at, 
                v.title, 
                v.price 
            FROM purchases p
            JOIN videos v ON p.video_id = v.id
            WHERE p.user_id = $1
            ORDER BY p.created_at DESC
        `, [req.user.id]);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching purchases:', error);
        res.status(500).json({ error: 'Error al obtener historial de compras' });
    }
});

router.post('/change-email', requireAuth, async (req, res) => {
    const { newEmail } = req.body;
    const email = newEmail ? newEmail.toLowerCase().trim() : '';
    
    if (!email || !email.includes('@')) {
        return res.status(400).json({ error: 'Correo inválido' });
    }

    try {
        // Verificar si el correo ya está en uso por otro usuario
        const exists = await db.query('SELECT id FROM users WHERE email = $1', [email]);
        if (exists.rows.length > 0) {
            return res.status(400).json({ error: 'El correo ya está en uso' });
        }

        // Para esta iteración (Fase 2), permitiremos el cambio directo, 
        // pero obligamos a reloguear como medida de seguridad
        await db.query('UPDATE users SET email = $1, current_session_token = NULL WHERE id = $2', [email, req.user.id]);
        
        res.json({ message: 'Correo actualizado exitosamente. Por favor, inicia sesión nuevamente.' });
    } catch (error) {
        console.error('Error changing email:', error);
        res.status(500).json({ error: 'Error al cambiar el correo' });
    }
});

module.exports = router;
