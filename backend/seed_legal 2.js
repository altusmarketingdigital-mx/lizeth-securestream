const db = require('./config/database');

async function seedLegal() {
    const defaultTerms = `<h1>Terms and Conditions</h1><p>Welcome to Lizeth The Barberette. These terms apply to your use of our platform.</p>`;
    const defaultPrivacy = `<h1>Privacy Policy</h1><p>We respect your privacy. All your data is encrypted.</p>`;
    const defaultRefunds = `<h1>Refund Policy</h1><p>All sales are final.</p>`;

    const data = {
        'page_terms_en': defaultTerms,
        'page_terms_es': `<h1>Términos y Condiciones</h1><p>Bienvenido a Lizeth The Barberette. Estos términos aplican al uso de nuestra plataforma.</p>`,
        'page_privacy_en': defaultPrivacy,
        'page_privacy_es': `<h1>Política de Privacidad</h1><p>Respetamos tu privacidad. Todos tus datos están encriptados.</p>`,
        'page_refunds_en': defaultRefunds,
        'page_refunds_es': `<h1>Política de Reembolsos</h1><p>Todas las ventas son finales.</p>`
    };

    try {
        for (const [key, val] of Object.entries(data)) {
            await db.query(
                'INSERT INTO site_settings (setting_key, setting_value) VALUES ($1, $2) ON CONFLICT (setting_key) DO NOTHING',
                [key, val]
            );
        }
        console.log('Legal pages seeded successfully.');
    } catch (e) {
        console.error('Error seeding legal pages:', e);
    } finally {
        process.exit();
    }
}

seedLegal();
