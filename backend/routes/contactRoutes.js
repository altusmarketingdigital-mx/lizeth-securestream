const express = require('express');
const router = express.Router();
const emailService = require('../utils/emailService');

router.post('/', async (req, res) => {
    const { name, email, reason, message } = req.body;
    
    if (!name || !email || !reason || !message) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    try {
        const success = await emailService.sendContactMessage(name, email, reason, message);
        
        if (success) {
            res.json({ message: 'Mensaje enviado exitosamente. Nos pondremos en contacto contigo pronto.' });
        } else {
            res.status(500).json({ error: 'Hubo un problema al enviar tu mensaje. Inténtalo de nuevo más tarde.' });
        }
    } catch (error) {
        console.error('Error enviando contacto:', error);
        res.status(500).json({ error: 'Error del servidor al procesar el mensaje' });
    }
});

module.exports = router;
