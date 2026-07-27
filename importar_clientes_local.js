require('dotenv').config({ path: './.env' });
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { Pool, neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');

// Configurar WebSockets para el driver serverless (esto evita que el firewall bloquee el puerto 5432)
neonConfig.webSocketConstructor = ws;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        console.log("Conectando a la base de datos...");
        await pool.query('SELECT 1');
        
        let filePath = './clientes.csv';
        if (!fs.existsSync(filePath)) {
            filePath = './backend/clientes.csv';
            if (!fs.existsSync(filePath)) {
                console.error("ERROR: No se encontró el archivo clientes.csv en la carpeta del proyecto.");
                console.error("Por favor, asegúrate de que el archivo se llame 'clientes.csv' y esté en la carpeta 'Proyecto Liz_Pablo'.");
                process.exit(1);
            }
        }
        
        console.log(`Leyendo archivo CSV: ${filePath}`);
        const text = fs.readFileSync(filePath, 'utf-8');
        
        const rows = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(r => r.trim() !== '');
        if (rows.length < 2) {
            console.error("ERROR: El archivo parece vacío o no tiene suficientes filas.");
            process.exit(1);
        }
        
        const headerLine = rows[0];
        const delimiter = headerLine.includes('\t') ? '\t' : ',';
        const headers = headerLine.split(delimiter).map(h => h.trim().toLowerCase());
        
        const emailIdx = headers.indexOf('email') !== -1 ? headers.indexOf('email') : headers.findIndex(h => h.includes('mail'));
        const fnIdx = headers.indexOf('first_name') !== -1 ? headers.indexOf('first_name') : headers.findIndex(h => h.includes('name') && !h.includes('last'));
        const lnIdx = headers.indexOf('last_name');
        
        if (emailIdx === -1) {
            console.error("ERROR: No se encontró la columna de email.");
            process.exit(1);
        }
        
        console.log(`Columnas detectadas -> Email: ${emailIdx}, Nombre: ${fnIdx}, Apellido: ${lnIdx}`);
        
        const genericPassword = 'CursosLizeth2026!';
        console.log(`Generando hash para la contraseña genérica (${genericPassword})...`);
        const genericHash = await bcrypt.hash(genericPassword, 10);
        
        let importedCount = 0;
        let duplicateCount = 0;
        
        console.log(`Comenzando importación de ${rows.length - 1} usuarios...`);
        
        for (let i = 1; i < rows.length; i++) {
            const cols = rows[i].split(delimiter).map(c => c.trim().replace(/^"|"$/g, ''));
            const email = cols[emailIdx];
            if (!email) continue;
            
            let name = '';
            if (fnIdx !== -1 && cols[fnIdx]) name += cols[fnIdx];
            if (lnIdx !== -1 && cols[lnIdx]) name += ' ' + cols[lnIdx];
            name = name.trim();
            
            const check = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
            if (check.rows.length > 0) {
                duplicateCount++;
                continue;
            }
            
            await pool.query(
                'INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3)', 
                [email.toLowerCase(), name, genericHash]
            );
            importedCount++;
            
            if (i % 50 === 0) {
                console.log(`Progreso: ${i} filas procesadas... (Importados: ${importedCount}, Duplicados: ${duplicateCount})`);
            }
        }
        
        console.log(`\n¡IMPORTACIÓN COMPLETADA ÉXITOSAMENTE!`);
        console.log(`Total Importados: ${importedCount}`);
        console.log(`Total Omitidos (ya existían): ${duplicateCount}`);
        process.exit(0);
        
    } catch (err) {
        console.error("Error fatal durante la importación:");
        console.error(err);
        process.exit(1);
    }
}

run();
