require('dotenv').config({ path: './.env' });
const { Pool, neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');

neonConfig.webSocketConstructor = ws;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        console.log("Conectando a la base de datos (Neon vía WebSockets)...");
        await pool.query('SELECT 1');
        
        console.log("Eliminando historial de compras de los clientes...");
        await pool.query('DELETE FROM purchases WHERE user_id IN (SELECT id FROM users WHERE is_admin = false OR is_admin IS NULL)');
        
        console.log("Eliminando todos los clientes (usuarios que no son administradores)...");
        
        // Ejecutar borrado seguro (sólo usuarios normales, protegiendo al admin)
        const result = await pool.query('DELETE FROM users WHERE is_admin = false OR is_admin IS NULL RETURNING id');
        
        console.log(`¡Éxito! Se eliminaron ${result.rowCount} clientes de la base de datos.`);
        console.log("Ahora puedes ejecutar la importación desde 0.");
        
        process.exit(0);
    } catch (err) {
        console.error("Error al borrar clientes:", err);
        process.exit(1);
    }
}

run();
