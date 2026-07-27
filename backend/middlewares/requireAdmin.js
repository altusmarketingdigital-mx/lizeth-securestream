const requireAdmin = (req, res, next) => {
    // req.user viene del middleware auth previo
    if (req.user && (req.user.is_admin === 1 || req.user.is_admin === true || req.user.is_admin === "1" || req.user.is_admin === "true")) {
        next();
    } else {
        res.status(403).json({ error: 'Acceso denegado. Se requieren privilegios de administrador.' });
    }
};

module.exports = requireAdmin;
