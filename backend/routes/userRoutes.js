const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { requireAuth } = require('../middlewares/authMiddleware');

router.get('/purchases', requireAuth, async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                p.id, 
                p.purchase_date, 
                p.order_number,
                p.country,
                p.status,
                COALESCE(v.title, 'Video Masterclass Barberette') as title, 
                COALESCE(p.amount, v.price, 49.99) as price 
            FROM purchases p
            LEFT JOIN videos v ON (p.video_id::text = v.id::text OR p.video_id::text = v.secure_slug::text)
            WHERE (p.user_id::text = $1::text OR p.user_id = (SELECT email FROM users WHERE id::text = $1::text LIMIT 1))
            ORDER BY p.purchase_date DESC
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
        const exists = await db.query('SELECT id FROM users WHERE email = $1', [email]);
        if (exists.rows.length > 0) {
            return res.status(400).json({ error: 'El correo ya está en uso' });
        }

        await db.query('UPDATE users SET email = $1, current_session_token = NULL WHERE id = $2', [email, req.user.id]);
        
        res.json({ message: 'Correo actualizado exitosamente. Por favor, inicia sesión nuevamente.' });
    } catch (error) {
        console.error('Error changing email:', error);
        res.status(500).json({ error: 'Error al cambiar el correo' });
    }
});

module.exports = router;
