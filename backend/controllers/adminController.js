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
        
        res.json({
            totalUsers: usersResult.rows[0].count,
            totalVideos: videosResult.rows[0].count
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
};

exports.getUsers = async (req, res) => {
    try {
        const result = await db.query('SELECT id, email, has_premium, is_admin, last_login_ip, created_at, is_blocked FROM users ORDER BY created_at DESC');
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
