// src/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');

// 1. Verificar Token (Versión mejorada y robusta)
exports.verificarToken = (req, res, next) => {
    // 1. Obtener la cabecera
    const authHeader = req.header('Authorization');
    
    if (!authHeader) {
        return res.status(401).json({ msg: 'Acceso denegado, falta el token' });
    }

    try {
        // 2. LIMPIEZA TOTAL DEL TOKEN
        // Primero quitamos la palabra "Bearer " (case insensitive por si acaso)
        let token = authHeader.replace(/^Bearer\s+/i, "");
        
        // Luego quitamos comillas dobles o simples que hayan podido quedar
        token = token.replace(/['"]+/g, '').trim();

        // (Opcional) Ver en consola qué estamos verificando
        // console.log("Token limpio recibido:", token);

        // 3. Verificar
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        req.user = verified;
        next();

    } catch (error) {
        // IMPORTANTE: Imprimir el error real en la consola del servidor (VS Code)
        console.log("Error al verificar token:", error.message);
        
        // Responder al cliente
        res.status(400).json({ msg: 'Token no válido', error: error.message });
    }
};

// ... la función esJefe la dejas igual ...
exports.esJefe = (req, res, next) => {
    if (req.user && (req.user.rol === 'admin' || req.user.rol === 'tecnico')) {
        next();
    } else {
        res.status(403).json({ msg: 'Acceso denegado: Solo para Administradores o Técnicos' });
    }
};