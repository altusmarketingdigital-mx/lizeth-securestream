const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;
const dbPath = isVercel ? path.join('/tmp', 'database.sqlite') : path.resolve(__dirname, '../db/database.sqlite');
const dbDir = isVercel ? '/tmp' : path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
    try {
        fs.mkdirSync(dbDir, { recursive: true });
    } catch (e) {
        console.error("Error creando directorio DB:", e);
    }
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error abriendo base de datos SQLite', err);
    } else {
        console.log('Conectado a la base de datos SQLite');
        initializeDatabase();
    }
});

function initializeDatabase() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            has_premium INTEGER DEFAULT 0,
            is_admin INTEGER DEFAULT 0,
            current_session_token TEXT, 
            last_login_ip TEXT,
            stripe_customer_id TEXT UNIQUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS videos (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            price REAL DEFAULT 0,
            secure_slug TEXT UNIQUE NOT NULL, 
            internal_storage_path TEXT NOT NULL, 
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS purchases (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            video_id TEXT NOT NULL,
            purchase_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (video_id) REFERENCES videos(id)
        )`);

        const { v4: uuidv4 } = require('uuid');
        const bcrypt = require('bcrypt');
        const hash = bcrypt.hashSync('password123', 10);

        // Insertar usuario cliente
        db.get("SELECT * FROM users WHERE email = 'cliente@barberette.com'", (err, row) => {
            if (!row) {
                db.run(
                    "INSERT INTO users (id, email, password_hash, has_premium, is_admin) VALUES (?, ?, ?, ?, ?)",
                    [uuidv4(), 'cliente@barberette.com', hash, 0, 0]
                );
            }
        });

        // Insertar usuario administrador
        db.get("SELECT * FROM users WHERE email = 'admin@barberette.com'", (err, row) => {
            if (!row) {
                db.run(
                    "INSERT INTO users (id, email, password_hash, has_premium, is_admin) VALUES (?, ?, ?, ?, ?)",
                    [uuidv4(), 'admin@barberette.com', hash, 1, 1]
                );
            }
        });
    });
}

// Wrapper para soportar promesas y emular el comportamiento de pg
module.exports = {
    query: (text, params) => {
        return new Promise((resolve, reject) => {
            // Reemplazar $1, $2 (sintaxis pg) por ? (sintaxis sqlite)
            let sqliteText = text;
            if(params) {
                params.forEach((_, i) => {
                    sqliteText = sqliteText.replace(`$${i+1}`, '?');
                });
            }

            if (sqliteText.trim().toUpperCase().startsWith('SELECT')) {
                db.all(sqliteText, params || [], (err, rows) => {
                    if (err) reject(err);
                    else resolve({ rows });
                });
            } else {
                db.run(sqliteText, params || [], function(err) {
                    if (err) reject(err);
                    else resolve({ rowCount: this.changes });
                });
            }
        });
    }
};
