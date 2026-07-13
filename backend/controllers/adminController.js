const db = require('../config/database');
const { randomUUID: uuidv4 } = require('crypto');

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
        const result = await db.query('SELECT id, email, has_premium, is_admin, last_login_ip, created_at FROM users ORDER BY created_at DESC');
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
