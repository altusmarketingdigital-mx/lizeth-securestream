const db = require('../config/database');

const enforceSingleSession = async (req, res, next) => {
    try {
        const clientToken = req.headers.authorization?.split(' ')[1] || req.cookies?.sessionToken;

        if (!clientToken) {
            return res.status(401).json({ error: "Token de sesión no proporcionado." });
        }

        // Se espera que otro middleware previo haya decodificado el JWT y asignado req.user
        if (!req.user || !req.user.id) {
            return res.status(401).json({ error: "Usuario no autenticado en el contexto." });
        }

        const query = 'SELECT current_session_token FROM users WHERE id = $1 LIMIT 1';
        const result = await db.query(query, [req.user.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Usuario no encontrado." });
        }

        const activeServerToken = result.rows[0].current_session_token;

        if (clientToken !== activeServerToken) {
            res.clearCookie('sessionToken', { httpOnly: true, secure: true });
            return res.status(401).json({ 
                error: "Sesión invalidada", 
                message: "Has iniciado sesión en otro dispositivo. Por seguridad, esta sesión ha expirado." 
            });
        }

        next();
    } catch (error) {
        console.error("Error en validación de sesión única:", error);
        return res.status(500).json({ error: "Error interno del servidor." });
    }
};

module.exports = enforceSingleSession;
