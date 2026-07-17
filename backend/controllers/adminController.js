const db = require('../config/database');
const { randomUUID: uuidv4 } = require('crypto');
const bcrypt = require('bcryptjs');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// Configuración S3 (AWS o Cloudflare R2)
const s3 = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
    },
    // endpoint: process.env.AWS_ENDPOINT // Descomentar si se usa Cloudflare R2
});

exports.getUploadUrl = async (req, res) => {
    try {
        const { fileName, fileType } = req.query;
        if (!fileName || !fileType) return res.status(400).json({ error: 'Faltan parámetros' });

        const extension = fileName.split('.').pop();
        const safeFileName = `videos/${uuidv4()}.${extension}`;

        const command = new PutObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME || 'my-bucket',
            Key: safeFileName,
            ContentType: fileType
        });

        // La URL expira en 1 hora
        const signedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

        res.json({ uploadUrl: signedUrl, fileKey: safeFileName });
    } catch (error) {
        console.error('Error generando Presigned URL:', error);
        res.status(500).json({ error: 'Error interno de almacenamiento' });
    }
};

exports.getStats = async (req, res) => {
    try {
        const usersResult = await db.query('SELECT COUNT(*) as count FROM users');
        const videosResult = await db.query('SELECT COUNT(*) as count FROM videos');
        
        const salesQuery = `
            SELECT p.purchase_date, v.price as video_price
            FROM purchases p
            JOIN videos v ON p.video_id = v.id
        `;
        const salesResult = await db.query(salesQuery);
        
        const now = new Date();
        const todayStr = now.toLocaleDateString();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        let revToday = 0;
        let revMonth = 0;
        let revYear = 0;

        salesResult.rows.forEach(s => {
            const date = new Date(s.purchase_date);
            const price = parseFloat(s.video_price) || 0;
            
            if (date.toLocaleDateString() === todayStr) {
                revToday += price;
            }
            if (date.getMonth() === currentMonth && date.getFullYear() === currentYear) {
                revMonth += price;
            }
            if (date.getFullYear() === currentYear) {
                revYear += price;
            }
        });

        res.json({
            totalUsers: usersResult.rows[0].count,
            totalVideos: videosResult.rows[0].count,
            revToday,
            revMonth,
            revYear
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
};

exports.getUsers = async (req, res) => {
    try {
        const result = await db.query('SELECT id, name, email, has_premium, is_admin, last_login_ip, created_at, is_blocked FROM users ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener usuarios' });
    }
};

exports.getVideos = async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM videos ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener videos' });
    }
};

exports.addVideo = async (req, res) => {
    const { title, description, internal_storage_path, price, images } = req.body;
    
    // Generamos un slug seguro aleatorio para la URL de streaming
    const secure_slug = 'v-' + Math.random().toString(36).substring(2, 9);
    const videoPrice = parseFloat(price) || 0;
    const videoId = uuidv4();
    
    try {
        await db.query('BEGIN');

        await db.query(
            'INSERT INTO videos (id, title, description, price, secure_slug, internal_storage_path) VALUES ($1, $2, $3, $4, $5, $6)',
            [videoId, title, description, videoPrice, secure_slug, internal_storage_path]
        );

        if (images && Array.isArray(images) && images.length > 0) {
            // Limit to 10 images
            const imagesToProcess = images.slice(0, 10);
            for (const imgBase64 of imagesToProcess) {
                await db.query(
                    'INSERT INTO video_images (id, video_id, image_data) VALUES ($1, $2, $3)',
                    [uuidv4(), videoId, imgBase64]
                );
            }
        }

        await db.query('COMMIT');
        res.json({ message: 'Video agregado exitosamente', slug: secure_slug });
    } catch (error) {
        await db.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ error: 'Error al registrar video' });
    }
};

exports.getSales = async (req, res) => {
    try {
        const query = `
            SELECT p.id as purchase_id, p.purchase_date, p.order_number, p.country,
                   u.email as user_email, u.name as user_name, 
                   v.title as video_title, v.price as video_price
            FROM purchases p
            JOIN users u ON p.user_id = u.id
            JOIN videos v ON p.video_id = v.id
            ORDER BY p.purchase_date DESC
        `;
        const result = await db.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener ventas:', error);
        res.status(500).json({ error: 'Error al obtener historial de ventas' });
    }
};

exports.toggleUserBlock = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query('SELECT is_blocked FROM users WHERE id = $1', [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

        const isCurrentlyBlocked = result.rows[0].is_blocked;
        const newStatus = !isCurrentlyBlocked;

        if (newStatus) {
            await db.query('UPDATE users SET is_blocked = $1, current_session_token = NULL WHERE id = $2', [newStatus, id]);
        } else {
            await db.query('UPDATE users SET is_blocked = $1 WHERE id = $2', [newStatus, id]);
        }

        res.json({ message: newStatus ? 'Usuario bloqueado exitosamente' : 'Usuario desbloqueado exitosamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al cambiar estado del usuario' });
    }
};

exports.regenerateUserPassword = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query('SELECT id FROM users WHERE id = $1', [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

        const newPassword = require('crypto').randomBytes(4).toString('hex');
        const hash = await bcrypt.hash(newPassword, 10);

        await db.query('UPDATE users SET password_hash = $1, current_session_token = NULL WHERE id = $2', [hash, id]);

        res.json({ message: 'Contraseña regenerada', newPassword });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al regenerar contraseña' });
    }
};

exports.updateUserName = async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        
        if (!name) return res.status(400).json({ error: 'El nombre no puede estar vacío' });
        
        const result = await db.query('UPDATE users SET name = $1 WHERE id = $2 RETURNING id', [name, id]);
        
        if (result.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
        
        res.json({ message: 'Nombre actualizado exitosamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al actualizar nombre' });
    }
};

exports.importUsers = async (req, res) => {
    try {
        const { users, pwdOption } = req.body;
        if (!users || !Array.isArray(users)) {
            return res.status(400).json({ error: 'Lista de usuarios inválida' });
        }

        let importedCount = 0;
        let duplicateCount = 0;

        // Optimización: si usamos contraseña genérica, calculamos el hash una sola vez.
        let genericHash = null;
        if (pwdOption !== 'random') {
            genericHash = await bcrypt.hash('CursosLizeth2026!', 10);
        }

        for (const user of users) {
            if (!user.email) continue;
            const email = user.email.toLowerCase().trim();
            const name = user.name ? user.name.trim() : null;

            // Verificar existencia
            const check = await db.query('SELECT id FROM users WHERE email = $1', [email]);
            if (check.rows.length > 0) {
                duplicateCount++;
                continue;
            }

            // Generar password
            let hash;
            if (pwdOption === 'random') {
                const rawPassword = require('crypto').randomBytes(16).toString('hex');
                hash = await bcrypt.hash(rawPassword, 10);
            } else {
                hash = genericHash;
            }
            
            await db.query(
                'INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3)', 
                [email, name, hash]
            );
            importedCount++;
        }

        res.json({ message: 'Importación completada', imported: importedCount, duplicates: duplicateCount });
    } catch (error) {
        console.error('Error importando usuarios:', error);
        res.status(500).json({ error: 'Error al importar usuarios' });
    }
};
