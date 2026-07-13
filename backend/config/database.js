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

        await pool.query(`
            CREATE TABLE IF NOT EXISTS coupons (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                code VARCHAR(50) UNIQUE NOT NULL,
                discount_percentage INT NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);

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
