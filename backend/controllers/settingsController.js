const db = require('../config/database');

exports.getSettings = async (req, res) => {
    try {
        const result = await db.query('SELECT setting_key, setting_value FROM site_settings');
        const settings = {};
        result.rows.forEach(row => {
            settings[row.setting_key] = row.setting_value;
        });
        res.json(settings);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener configuración' });
    }
};

exports.updateSettings = async (req, res) => {
    const settings = req.body;
    try {
        for (const [key, val] of Object.entries(settings)) {
            await db.query(
                'INSERT INTO site_settings (setting_key, setting_value) VALUES ($1, $2) ON CONFLICT (setting_key) DO UPDATE SET setting_value = $2',
                [key, val]
            );
        }
        res.json({ message: 'Configuración actualizada exitosamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al actualizar configuración' });
    }
};
