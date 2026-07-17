const db = require('../config/database');

exports.createDonation = async (req, res) => {
    try {
        const { name, email, message, amount } = req.body;
        const valAmount = parseFloat(amount) || 0;
        
        await db.query(
            'INSERT INTO donations (name, email, message, amount) VALUES ($1, $2, $3, $4)',
            [name, email, message, valAmount]
        );
        
        res.status(201).json({ success: true, message: 'Donativo registrado exitosamente' });
    } catch (error) {
        console.error('Error al crear donativo:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

exports.getDonations = async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM donations ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener donativos:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};
