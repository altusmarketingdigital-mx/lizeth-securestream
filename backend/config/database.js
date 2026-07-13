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
