const db = require('../config/database');
const fs = require('fs');
const path = require('path');

exports.getCatalog = async (req, res) => {
    try {
        const result = await db.query('SELECT id, title, description, price, secure_slug FROM videos ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener catálogo' });
    }
};

exports.getMyVideos = async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await db.query(`
            SELECT v.id, v.title, v.description, v.secure_slug 
            FROM videos v
            JOIN purchases p ON v.id = p.video_id
            WHERE p.user_id = $1
            ORDER BY p.purchase_date DESC
        `, [userId]);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener mis videos' });
    }
};

exports.streamVideo = async (req, res) => {
    try {
        const { slug } = req.params;
        const userId = req.user.id;

        // Validar que el usuario compró el video O es admin (los admin ven todo)
        if (req.user.is_admin !== 1) {
            const purchaseCheck = await db.query(`
                SELECT p.id FROM purchases p 
                JOIN videos v ON p.video_id = v.id 
                WHERE p.user_id = $1 AND v.secure_slug = $2
            `, [userId, slug]);
            
            if (purchaseCheck.rows.length === 0) {
                return res.status(403).json({ error: 'Debes comprar este video para reproducirlo' });
            }
        }

        const videoResult = await db.query('SELECT internal_storage_path FROM videos WHERE secure_slug = $1', [slug]);
        if (videoResult.rows.length === 0) {
            return res.status(404).json({ error: 'Video no encontrado' });
        }

        const videoPath = videoResult.rows[0].internal_storage_path;
        
        const resolvedPath = path.resolve(__dirname, '../../', videoPath);
        if (!fs.existsSync(resolvedPath)) {
            console.log(`[Warning] Video file not found locally: ${resolvedPath}`);
        }

        // Lógica de streaming segura
        const stat = fs.statSync(resolvedPath);
        const fileSize = stat.size;
        const range = req.headers.range;

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = (end - start) + 1;
            const file = fs.createReadStream(resolvedPath, { start, end });
            const head = {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': 'video/mp4',
            };
            res.writeHead(206, head);
            file.pipe(res);
        } else {
            const head = {
                'Content-Length': fileSize,
                'Content-Type': 'video/mp4',
            };
            res.writeHead(200, head);
            fs.createReadStream(resolvedPath).pipe(res);
        }

    } catch (error) {
        console.error('Error al hacer stream:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};
