const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('neon.tech') 
        ? { rejectUnauthorized: false } 
        : false
});

pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
});

async function initializeDatabase() {
    if (!process.env.DATABASE_URL) {
        console.warn('⚠️ WARNING: No DATABASE_URL provided. Database initialization skipped.');
        return;
    }

    try {
        await pool.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                has_premium BOOLEAN DEFAULT FALSE,
                is_admin BOOLEAN DEFAULT FALSE,
                current_session_token VARCHAR(255), 
                last_login_ip INET,
                stripe_customer_id VARCHAR(100) UNIQUE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Ensure name column exists for users
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255);`);
        await pool.query(`ALTER TABLE users ALTER COLUMN current_session_token TYPE TEXT;`);
        
        // Ensure role column exists
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'client';`);
        
        // Ensure permissions column exists
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]'::jsonb;`);
        
        // Update existing admins to have admin role if not set
        await pool.query(`UPDATE users SET role = 'Administrador' WHERE is_admin = true AND role = 'client';`);
        
        // Asignar todos los permisos a los administradores existentes si su JSON está vacío
        await pool.query(`UPDATE users SET permissions = '["manage_users", "manage_clients", "manage_videos", "view_sales", "manage_coupons", "manage_settings"]'::jsonb WHERE is_admin = true AND permissions = '[]'::jsonb;`);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS videos (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                title VARCHAR(255) NOT NULL,
                description TEXT,
                price NUMERIC(10, 2) DEFAULT 0.00,
                secure_slug VARCHAR(100) UNIQUE NOT NULL, 
                internal_storage_path VARCHAR(500) NOT NULL, 
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Ensure video columns exist
        await pool.query(`ALTER TABLE videos ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT false;`);
        await pool.query(`ALTER TABLE videos ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;`);
        await pool.query(`ALTER TABLE videos ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;`);
        await pool.query(`ALTER TABLE videos ADD COLUMN IF NOT EXISTS sale_price NUMERIC(10, 2) DEFAULT NULL;`);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS purchases (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID NOT NULL,
                video_id UUID NOT NULL,
                purchase_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (video_id) REFERENCES videos(id)
            );
        `);

        // Añadir nuevas columnas si no existen
        await pool.query(`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS order_number VARCHAR(100);`);
        await pool.query(`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS country VARCHAR(50);`);
        await pool.query(`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'exitoso';`);
        await pool.query(`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS amount NUMERIC(10, 2) DEFAULT 0.00;`);
        
        // Retroactivamente poner un amount en base al precio del video para purchases antiguos (opcional, pero útil)
        await pool.query(`
            UPDATE purchases 
            SET amount = v.price 
            FROM videos v 
            WHERE purchases.video_id = v.id AND purchases.amount = 0.00;
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS coupons (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                code VARCHAR(50) UNIQUE NOT NULL,
                discount_percentage DECIMAL(5,2) NOT NULL,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS video_images (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
                image_data TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Carrusel
        await pool.query(`
            CREATE TABLE IF NOT EXISTS carousel_images (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                image_data TEXT NOT NULL,
                title VARCHAR(255),
                link_url VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        
        try {
            await pool.query(`ALTER TABLE carousel_images ADD COLUMN IF NOT EXISTS title VARCHAR(255);`);
            await pool.query(`ALTER TABLE carousel_images ADD COLUMN IF NOT EXISTS link_url VARCHAR(255);`);
        } catch(e) {
            console.log('Error adding columns to carousel_images:', e.message);
        }

        // Cupones con soporte para video específico
        try {
            await pool.query(`ALTER TABLE coupons ADD COLUMN IF NOT EXISTS video_id UUID REFERENCES videos(id) ON DELETE CASCADE;`);
        } catch(e) {
            console.log('Error modifying coupons:', e.message);
        }

        // Recuperación de Contraseña y Bloqueo
        try {
            await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_password_token VARCHAR(255);`);
            await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_password_expires TIMESTAMP WITH TIME ZONE;`);
            await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false;`);
            await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255);`);
        } catch(e) {
            console.log('Error adding password reset/block/name columns to users:', e.message);
        }

        // Configuración de sitio y donaciones
        await pool.query(`ALTER TABLE videos ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'MXN';`);
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS donations (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                name VARCHAR(255),
                email VARCHAR(255),
                message TEXT,
                amount NUMERIC(10, 2) DEFAULT 0.00,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Configuraciones de Sitio (CMS)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS site_settings (
                setting_key VARCHAR(100) PRIMARY KEY,
                setting_value TEXT
            );
        `);

        // Insertar valores por defecto para el CMS si la tabla está vacía
        const settingsCount = await pool.query('SELECT count(*) FROM site_settings');
        if (settingsCount.rows[0].count === '0') {
            const defaults = {
                'hero_title': "Hi, I'm Lizeth, <br>The Barberette...",
                'hero_subtitle': "and I'd love to shave your head.. no guard, no hair left... BALD!!!",
                'hero_body': "So, be prepared, sweetie, I'll be with you in a minute.. Please, take a sit!",
                'hero_btn_text': "ENTER THE SHOP",
                'hero_card_title': "Premium Content",
                'hero_card_badge1': "Exclusive",
                'hero_card_badge2': "Protected",
                'hero_card_image': "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=600&q=80",
                'footer_text': "Monetizing knowledge with extreme security.<br>No guard, no hair left... BALD!!!",
                'donation_text': "Apoya nuestro contenido con un donativo",
                'is_maintenance_mode': "false",
                'logo_url': "/assets/img/logo.png"
            };
            
            for (const [key, val] of Object.entries(defaults)) {
                await pool.query('INSERT INTO site_settings (setting_key, setting_value) VALUES ($1, $2)', [key, val]);
            }
        } else {
            // Asegurar que existan las nuevas llaves en bases existentes
            await pool.query(`INSERT INTO site_settings (setting_key, setting_value) VALUES ('is_maintenance_mode', 'false') ON CONFLICT DO NOTHING;`);
            await pool.query(`INSERT INTO site_settings (setting_key, setting_value) VALUES ('donation_text', 'Apoya nuestro contenido con un donativo') ON CONFLICT DO NOTHING;`);
        }

        console.log('✅ Base de datos inicializada correctamente');
        const bcrypt = require('bcryptjs');
        const hash = bcrypt.hashSync('password123', 10);

        // Insertar usuario cliente
        const clientCheck = await pool.query("SELECT * FROM users WHERE email = $1", ['cliente@barberette.com']);
        if (clientCheck.rows.length === 0) {
            await pool.query(
                "INSERT INTO users (email, password_hash, has_premium, is_admin) VALUES ($1, $2, $3, $4)",
                ['cliente@barberette.com', hash, false, false]
            );
        }

        // Insertar usuario administrador
        const adminCheck = await pool.query("SELECT * FROM users WHERE email = $1", ['admin@barberette.com']);
        if (adminCheck.rows.length === 0) {
            await pool.query(
                "INSERT INTO users (email, password_hash, has_premium, is_admin) VALUES ($1, $2, $3, $4)",
                ['admin@barberette.com', hash, true, true]
            );
        }

        // Insertar video de prueba si no hay videos
        const videoCheck = await pool.query("SELECT id FROM videos");
        if (videoCheck.rows.length === 0) {
            const videoId = require('crypto').randomUUID();
            await pool.query(
                "INSERT INTO videos (id, title, description, price, secure_slug, internal_storage_path) VALUES ($1, $2, $3, $4, $5, $6)",
                [videoId, 'Masterclass: Fade Perfecto', 'Aprende las técnicas más avanzadas para un degradado impecable.', 49.99, 'v-mock123', '/videos/fade.mp4']
            );
            
            // Asignar el video al cliente para que vea algo en su biblioteca
            const cliente = await pool.query("SELECT id FROM users WHERE email = 'cliente@barberette.com'");
            if (cliente.rows.length > 0) {
                await pool.query(
                    "INSERT INTO purchases (id, user_id, video_id) VALUES ($1, $2, $3)",
                    [require('crypto').randomUUID(), cliente.rows[0].id, videoId]
                );
            }
        }

        console.log('✅ Base de datos PostgreSQL inicializada correctamente');
    } catch (err) {
        console.error('❌ Error inicializando base de datos:', err);
    }
}

// Inicializar la base de datos de manera asíncrona al arrancar el servidor
initializeDatabase();

// Exportar un wrapper de query para que los controladores no tengan que cambiar su sintaxis
module.exports = {
    query: (text, params) => pool.query(text, params),
    pool
};
