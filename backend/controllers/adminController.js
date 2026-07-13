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
    const { title, description, internal_storage_path, price } = req.body;
    
    // Generamos un slug seguro aleatorio para la URL de streaming
    const secure_slug = 'v-' + Math.random().toString(36).substring(2, 9);
    const videoPrice = parseFloat(price) || 0;
    
    try {
        await db.query(
            'INSERT INTO videos (id, title, description, price, secure_slug, internal_storage_path) VALUES ($1, $2, $3, $4, $5, $6)',
            [uuidv4(), title, description, videoPrice, secure_slug, internal_storage_path]
        );
        res.json({ message: 'Video agregado exitosamente', slug: secure_slug });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al registrar video' });
    }
};
