const db = require('../config/database');

const DEFAULT_SETTINGS = {
    'hero_title': "Hi, I'm Lizeth, <br>The Barberette...",
    'hero_subtitle': "and I'd love to shave your head.. no guard, no hair left... BALD!!!",
    'hero_body': "So, be prepared, sweetie, I'll be with you in a minute.. Please, take a sit!",
    'hero_btn_text': "ENTER THE SHOP",
    'hero_card_title': "Premium Content",
    'hero_card_badge1': "Exclusive",
    'hero_card_badge2': "Protected",
    'hero_card_image': "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=600&q=80",
    'footer_text': "Monetizing knowledge with extreme security.<br>No guard, no hair left... BALD!!!",
    'donation_text': "Apoya nuestro contenido con un donativo",
    'is_maintenance_mode': "false",
    'logo_url': "/assets/img/logo.png"
};

exports.getSettings = async (req, res) => {
    try {
        const result = await db.query('SELECT setting_key, setting_value FROM site_settings');
        const settings = { ...DEFAULT_SETTINGS };
        if (result && result.rows) {
            result.rows.forEach(row => {
                settings[row.setting_key] = row.setting_value;
            });
        }
        res.json(settings);
    } catch (error) {
        res.json(DEFAULT_SETTINGS);
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
