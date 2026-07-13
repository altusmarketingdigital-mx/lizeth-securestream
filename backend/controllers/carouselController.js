const db = require('../config/database');
const { randomUUID: uuidv4 } = require('crypto');

exports.getImages = async (req, res) => {
    try {
        const result = await db.query('SELECT id, image_data, title, link_url FROM carousel_images ORDER BY created_at ASC');
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener imágenes del carrusel' });
    }
};

exports.addImage = async (req, res) => {
    const { image_data, title, link_url } = req.body;
    if (!image_data) {
        return res.status(400).json({ error: 'Falta la imagen' });
    }
    try {
        const id = uuidv4();
        await db.query('INSERT INTO carousel_images (id, image_data, title, link_url) VALUES ($1, $2, $3, $4)', [id, image_data, title || null, link_url || null]);
        res.json({ id, message: 'Imagen agregada exitosamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al agregar imagen' });
    }
};

exports.deleteImage = async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM carousel_images WHERE id = $1', [id]);
        res.json({ message: 'Imagen eliminada exitosamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al eliminar imagen' });
    }
};
