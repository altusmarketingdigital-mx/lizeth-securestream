const express = require('express');
const router = express.Router();
const db = require('../config/database');
const requireAdmin = require('../middlewares/requireAdmin');
const { randomUUID: uuidv4 } = require('crypto');
const jwt = require('jsonwebtoken');

const requireAuth = (req, res, next) => {
    const token = req.cookies?.sessionToken;
    if (!token) return res.status(401).json({ error: "No autorizado" });
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey');
        next();
    } catch (err) {
        res.status(401).json({ error: "Token inválido" });
    }
};

// --- RUTAS DE CLIENTE ---

// Validar un cupón
router.post('/validate', requireAuth, async (req, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Código requerido' });

    try {
        const result = await db.query('SELECT * FROM coupons WHERE code = $1 LIMIT 1', [code.trim().toUpperCase()]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Cupón no encontrado' });
        }
        
        const coupon = result.rows[0];
        
        if (!coupon.is_active) {
            return res.status(400).json({ error: 'Este cupón ya no es válido' });
        }
        
        res.json({ discount_percentage: coupon.discount_percentage, code: coupon.code });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al validar el cupón' });
    }
});


// --- RUTAS DE ADMINISTRADOR ---
router.use(requireAuth, requireAdmin);

// Obtener todos los cupones
router.get('/', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM coupons ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener cupones' });
    }
});

// Crear un nuevo cupón
router.post('/', async (req, res) => {
    const { code, discount_percentage } = req.body;
    
    if (!code || !discount_percentage) {
        return res.status(400).json({ error: 'Código y porcentaje son requeridos' });
    }
    
    try {
        const cleanCode = code.trim().toUpperCase();
        
        // Verificar si ya existe
        const check = await db.query('SELECT id FROM coupons WHERE code = $1', [cleanCode]);
        if (check.rows.length > 0) {
            return res.status(400).json({ error: 'Este código ya existe' });
        }
        
        await db.query(
            'INSERT INTO coupons (id, code, discount_percentage, is_active) VALUES ($1, $2, $3, true)',
            [uuidv4(), cleanCode, parseInt(discount_percentage)]
        );
        
        res.json({ message: 'Cupón creado exitosamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al crear cupón' });
    }
});

// Alternar estado activo/inactivo de un cupón
router.put('/:id/toggle', async (req, res) => {
    const { id } = req.params;
    const { is_active } = req.body;
    
    try {
        await db.query('UPDATE coupons SET is_active = $1 WHERE id = $2', [is_active, id]);
        res.json({ message: 'Estado actualizado' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al actualizar cupón' });
    }
});

module.exports = router;
