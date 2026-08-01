const db = require('../config/database');
const fs = require('fs');
const path = require('path');

const MOCK_VIDEOS = [
    {
        id: "v-mock1",
        title: "Masterclass: Fade Perfecto",
        description: "Aprende las técnicas más avanzadas para un degradado impecable con Lizeth.",
        price: "49.99",
        sale_price: "34.99",
        secure_slug: "fade-perfecto",
        currency: "USD",
        cover_image: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=600&q=80"
    },
    {
        id: "v-mock2",
        title: "Técnica de Afeitado Clásico y Toalla Caliente",
        description: "Ritual completo de afeitado profesional paso a paso.",
        price: "39.99",
        sale_price: null,
        secure_slug: "afeitado-clasico",
        currency: "USD",
        cover_image: "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=600&q=80"
    }
];

exports.getCatalog = async (req, res) => {
    try {
        const result = await db.query(`
            SELECT v.id, v.title, v.description, v.price, v.sale_price, v.secure_slug, v.currency,
                   (SELECT image_data FROM video_images vi WHERE vi.video_id = v.id ORDER BY created_at ASC LIMIT 1) as cover_image
            FROM videos v
            WHERE v.is_hidden = false 
              AND v.is_deleted = false 
              AND v.published_at <= CURRENT_TIMESTAMP
            ORDER BY v.created_at DESC
        `);
        if (result && result.rows && result.rows.length > 0) {
            res.json(result.rows);
        } else {
            res.json(MOCK_VIDEOS);
        }
    } catch (error) {
        res.json(MOCK_VIDEOS);
    }
};

exports.getImages = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query('SELECT id, image_data FROM video_images WHERE video_id = $1 ORDER BY created_at ASC', [id]);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener imágenes' });
    }
};

exports.getMyVideos = async (req, res) => {
    try {
        const userId = req.user ? req.user.id : null;
        if (!userId) {
            return res.json([]);
        }

        const result = await db.query(`
            SELECT DISTINCT ON (p.id) 
                   COALESCE(v.id::text, p.video_id) as id, 
                   COALESCE(v.title, 'Video Masterclass Barberette') as title, 
                   COALESCE(v.description, 'Contenido exclusivo desbloqueado para tu cuenta.') as description, 
                   COALESCE(v.secure_slug, p.video_id) as secure_slug,
                   COALESCE(v.price, p.amount, 49.99) as price,
                   p.purchase_date,
                   v.thumbnail_url,
                   (SELECT image_data FROM video_images vi WHERE vi.video_id = v.id ORDER BY created_at ASC LIMIT 1) as cover_image
            FROM purchases p
            LEFT JOIN videos v ON (p.video_id::text = v.id::text OR p.video_id::text = v.secure_slug::text)
            WHERE (
                p.user_id::text = $1::text 
                OR LOWER(p.user_id) = LOWER((SELECT email FROM users WHERE id::text = $1::text LIMIT 1))
            )
            AND (v.is_deleted IS NULL OR v.is_deleted = false)
            ORDER BY p.id, p.purchase_date DESC
        `, [userId]);

        res.json(result.rows);
    } catch (error) {
        console.error('Error en getMyVideos:', error);
        res.status(500).json({ error: 'Error al obtener mis videos' });
    }
};


exports.streamVideo = async (req, res) => {
    try {
        const { slug } = req.params;
        const userId = req.user.id;

        // Validar que el usuario compró el video O es admin (los admin ven todo)
        if (req.user.is_admin !== 1 && req.user.is_admin !== true && req.user.is_admin !== "1" && req.user.is_admin !== "true") {
            const purchaseCheck = await db.query(`
                SELECT p.id FROM purchases p 
                JOIN videos v ON (p.video_id::text = v.id::text OR p.video_id::text = v.secure_slug::text)
                WHERE (p.user_id::text = $1::text OR p.user_id = (SELECT email FROM users WHERE id::text = $1::text LIMIT 1)) 
                  AND v.secure_slug = $2
            `, [userId, slug]);
            
            if (purchaseCheck.rows.length === 0) {
                return res.status(403).json({ error: 'Debes comprar este video para reproducirlo' });
            }
        }

        const videoResult = await db.query('SELECT internal_storage_path FROM videos WHERE secure_slug = $1 AND is_deleted = false', [slug]);
        if (videoResult.rows.length === 0) {
            return res.status(404).json({ error: 'Video no encontrado' });
        }

        const videoPath = videoResult.rows[0].internal_storage_path;
        
        // Si el video es una URL externa (Drive, Vimeo, Dropbox, S3 manual, etc)
        if (videoPath.startsWith('http://') || videoPath.startsWith('https://')) {
            let finalUrl = videoPath;
            if (finalUrl.includes('dropbox.com')) {
                finalUrl = finalUrl.replace('dl=0?raw=1', 'raw=1').replace('dl=0', 'raw=1');
                if (!finalUrl.includes('raw=1')) {
                    finalUrl += (finalUrl.includes('?') ? '&raw=1' : '?raw=1');
                }
            }
            return res.redirect(finalUrl);
        }

        // Si el video fue subido a S3, la ruta será algo como "videos/uuid.mp4"
        if (videoPath.startsWith('videos/')) {
            const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
            const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
            
            const s3 = new S3Client({
                region: process.env.AWS_REGION || 'us-east-1',
                credentials: {
                    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
                }
            });

            const command = new GetObjectCommand({
                Bucket: process.env.AWS_BUCKET_NAME || 'my-bucket',
                Key: videoPath
            });

            // Generar URL válida por 4 horas para que el reproductor pueda hacer buffer
            const signedUrl = await getSignedUrl(s3, command, { expiresIn: 14400 });
            return res.redirect(signedUrl);
        }

        // Fallback local (Legacy)
        const resolvedPath = path.resolve(__dirname, '../../', videoPath);
        if (!fs.existsSync(resolvedPath)) {
            return res.status(404).json({ error: 'Video file not found locally or in S3' });
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
