// src/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');

// 1. Verificar si tiene un Token válido (esto ya deberías tenerlo, pero lo reforzamos)
exports.verificarToken = (req, res, next) => {
    const token = req.header('Authorization');
    if (!token) return res.status(401).json({ msg: 'Acceso denegado, falta el token' });

    try {
        // Asegúrate de que process.env.JWT_SECRET coincida con tu .env
        const verified = jwt.verify(token.replace("Bearer ", ""), process.env.JWT_SECRET);
        req.user = verified;
        next();
    } catch (error) {
        res.status(400).json({ msg: 'Token no válido' });
    }
};

// 2. Permitir SOLO a Jefes (Admin y Técnicos)
exports.esJefe = (req, res, next) => {
    // Asumiendo que tu token guarda el rol como 'rol' o 'role'
    if (req.user.rol === 'admin' || req.user.rol === 'tecnico') {
        next(); // Puede pasar
    } else {
        res.status(403).json({ msg: 'Acceso denegado: Solo para Administradores o Técnicos' });
    }
};