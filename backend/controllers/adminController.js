const db = require('../config/database');
const { randomUUID: uuidv4 } = require('crypto');
const bcrypt = require('bcryptjs');
const { S3Client, PutObjectCommand, PutBucketCorsCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const emailService = require('../utils/emailService');

// Configuración S3 (AWS o Cloudflare R2)
const s3 = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
    },
    endpoint: process.env.AWS_ENDPOINT // Necesario para Cloudflare R2
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

exports.getDropboxToken = async (req, res) => {
    try {
        const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args)).catch(() => global.fetch(...args));
        const auth = Buffer.from(`${process.env.DROPBOX_APP_KEY}:${process.env.DROPBOX_APP_SECRET}`).toString('base64');
        
        const response = await fetch('https://api.dropbox.com/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${auth}`
            },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: process.env.DROPBOX_REFRESH_TOKEN
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            console.error('Dropbox token error:', data);
            return res.status(500).json({ error: 'Error obteniendo token de Dropbox', details: data });
        }
        
        res.json({ accessToken: data.access_token });
    } catch (error) {
        console.error('Error in getDropboxToken:', error);
        res.status(500).json({ error: 'Error interno de servidor al obtener token de Dropbox' });
    }
};
exports.fixCors = async (req, res) => {
    try {
        const command = new PutBucketCorsCommand({
            Bucket: process.env.AWS_BUCKET_NAME || 'my-bucket',
            CORSConfiguration: {
                CORSRules: [
                    {
                        AllowedHeaders: ["*"],
                        AllowedMethods: ["PUT", "POST", "GET", "HEAD"],
                        AllowedOrigins: ["*"],
                        ExposeHeaders: []
                    }
                ]
            }
        });
        await s3.send(command);
        res.json({ message: 'CORS configurado exitosamente. Ya puedes intentar subir el video nuevamente.' });
    } catch (error) {
        console.error('Error configurando CORS:', error);
        res.status(500).json({ error: 'Error configurando CORS automáticamente.', details: error.message });
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
        const result = await db.query('SELECT id, name, email, has_premium, is_admin, role, permissions, last_login_ip, created_at, is_blocked FROM users ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener usuarios' });
    }
};

exports.createUser = async (req, res) => {
    try {
        const { name, email, password, role, permissions } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Faltan campos obligatorios' });
        
        const existing = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
        if (existing.rows.length > 0) return res.status(400).json({ error: 'El email ya está registrado' });
        
        const hash = await bcrypt.hash(password, 10);
        const isAdmin = (role && role !== 'client') ? true : false;
        const permsJSON = permissions ? JSON.stringify(permissions) : '[]';
        
        await db.query(
            'INSERT INTO users (name, email, password_hash, role, is_admin, permissions) VALUES ($1, $2, $3, $4, $5, $6::jsonb)',
            [name, email.toLowerCase().trim(), hash, role || 'client', isAdmin, permsJSON]
        );
        
        res.json({ success: true, message: 'Usuario creado exitosamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al crear usuario' });
    }
};

exports.updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, role, permissions, password } = req.body;
        
        const isAdmin = (role && role !== 'client') ? true : false;
        const permsJSON = permissions ? JSON.stringify(permissions) : '[]';
        
        if (password) {
            const bcrypt = require('bcryptjs');
            const hash = await bcrypt.hash(password, 10);
            await db.query(
                'UPDATE users SET name = $1, email = $2, role = $3, is_admin = $4, permissions = $5::jsonb, password_hash = $6 WHERE id = $7',
                [name, email.toLowerCase().trim(), role, isAdmin, permsJSON, hash, id]
            );
        } else {
            await db.query(
                'UPDATE users SET name = $1, email = $2, role = $3, is_admin = $4, permissions = $5::jsonb WHERE id = $6',
                [name, email.toLowerCase().trim(), role, isAdmin, permsJSON, id]
            );
        }
        
        res.json({ success: true, message: 'Usuario actualizado exitosamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al actualizar usuario' });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Optionally delete purchases, or let them cascade. 
        // For now just delete the user.
        await db.query('DELETE FROM users WHERE id = $1', [id]);
        
        res.json({ success: true, message: 'Usuario eliminado exitosamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al eliminar usuario' });
    }
};

exports.getVideos = async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM videos WHERE is_deleted = false ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener videos' });
    }
};

exports.addVideo = async (req, res) => {
    const { title, description, internal_storage_path, price, images, sale_price, is_hidden, published_at, currency } = req.body;
    
    // Generamos un slug seguro aleatorio para la URL de streaming
    const secure_slug = 'v-' + Math.random().toString(36).substring(2, 9);
    const videoPrice = parseFloat(price) || 0;
    const sPrice = sale_price ? parseFloat(sale_price) : null;
    const hidden = is_hidden === true || is_hidden === 'true';
    const pubDate = published_at || new Date().toISOString();
    const curr = currency || 'MXN';
    const videoId = uuidv4();
    
    try {
        await db.query('BEGIN');

        await db.query(
            'INSERT INTO videos (id, title, description, price, secure_slug, internal_storage_path, sale_price, is_hidden, published_at, currency) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
            [videoId, title, description, videoPrice, secure_slug, internal_storage_path, sPrice, hidden, pubDate, curr]
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
        res.status(500).json({ error: 'Error al registrar video', details: error.message });
    }
};

exports.updateVideo = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, internal_storage_path, price, sale_price, is_hidden, published_at, currency, images } = req.body;
        
        const videoPrice = parseFloat(price) || 0;
        const sPrice = sale_price ? parseFloat(sale_price) : null;
        const hidden = is_hidden === true || is_hidden === 'true';
        const pubDate = published_at || new Date().toISOString();
        const curr = currency || 'MXN';
        
        await db.query('BEGIN');

        if (internal_storage_path) {
            await db.query(
                'UPDATE videos SET title = $1, description = $2, price = $3, internal_storage_path = $4, sale_price = $5, is_hidden = $6, published_at = $7, currency = $8 WHERE id = $9',
                [title, description, videoPrice, internal_storage_path, sPrice, hidden, pubDate, curr, id]
            );
        } else {
            await db.query(
                'UPDATE videos SET title = $1, description = $2, price = $3, sale_price = $4, is_hidden = $5, published_at = $6, currency = $7 WHERE id = $8',
                [title, description, videoPrice, sPrice, hidden, pubDate, curr, id]
            );
        }

        // Si se envían nuevas imágenes, eliminamos las viejas y guardamos las nuevas
        if (images && Array.isArray(images) && images.length > 0) {
            await db.query('DELETE FROM video_images WHERE video_id = $1', [id]);
            const imagesToProcess = images.slice(0, 10);
            for (const imgBase64 of imagesToProcess) {
                await db.query(
                    'INSERT INTO video_images (id, video_id, image_data) VALUES ($1, $2, $3)',
                    [uuidv4(), id, imgBase64]
                );
            }
        }

        await db.query('COMMIT');
        res.json({ success: true, message: 'Video actualizado exitosamente' });
    } catch (error) {
        await db.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ error: 'Error al actualizar video', details: error.message });
    }
};

exports.deleteVideo = async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('UPDATE videos SET is_deleted = true WHERE id = $1', [id]);
        res.json({ success: true, message: 'Video ocultado/eliminado exitosamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al eliminar video' });
    }
};

exports.getSales = async (req, res) => {
    try {
        const query = `
            SELECT p.id as purchase_id, p.purchase_date, p.order_number, p.country, p.status, p.amount,
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

exports.getSalesAnalytics = async (req, res) => {
    try {
        const query = `
            SELECT 
                COUNT(*) as total_units,
                SUM(amount) as total_revenue
            FROM purchases
            WHERE status = 'exitoso'
        `;
        const result = await db.query(query);
        const data = result.rows[0];
        res.json({
            total_units: parseInt(data.total_units || 0),
            total_revenue: parseFloat(data.total_revenue || 0)
        });
    } catch (error) {
        console.error('Error al obtener analíticas de ventas:', error);
        res.status(500).json({ error: 'Error al obtener analíticas' });
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
        const result = await db.query('SELECT id, email, name FROM users WHERE id = $1', [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
        const user = result.rows[0];

        const newPassword = require('crypto').randomBytes(4).toString('hex');
        const hash = await bcrypt.hash(newPassword, 10);

        await db.query('UPDATE users SET password_hash = $1, current_session_token = NULL WHERE id = $2', [hash, id]);
        
        // Enviar correo al usuario de forma asíncrona (no bloqueante)
        if (user.email) {
            emailService.sendNewPassword(user.email, user.name, newPassword).catch(err => console.error('Error enviando correo:', err));
        }

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
