const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// --- HELPER: Función para validar formato de email ---
const esEmailValido = (email) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
};

// 1. REGISTRAR NUEVO USUARIO
exports.registrarUsuario = async (req, res) => {
    const { username, password, nombres, apellidos, email, id_rol } = req.body;

    try {
        if (!username || !password || !nombres || !email) {
            return res.status(400).json({ message: '⚠️ Faltan datos obligatorios (username, password, nombres, email).' });
        }

        if (!esEmailValido(email)) {
            return res.status(400).json({ message: '⛔ El formato del correo electrónico no es válido.' });
        }

        if (password.length < 6) {
            return res.status(400).json({ message: '⛔ La contraseña debe tener al menos 6 caracteres.' });
        }

        const sqlCheck = "SELECT * FROM usuarios WHERE username = $1 OR email = $2";
        const checkResult = await db.query(sqlCheck, [username, email]);

        if (checkResult.rows.length > 0) {
            return res.status(400).json({ message: '⛔ El usuario o el correo ya están registrados.' });
        }
        
        const passwordHash = await bcrypt.hash(password, 10);
        const sqlInsert = `
            INSERT INTO usuarios (id_rol, username, password_hash, nombres, apellidos, email, activo)
            VALUES ($1, $2, $3, $4, $5, $6, TRUE)
            RETURNING id_usuario, username, email;
        `;
        
        const rolFinal = id_rol || 2; // Por defecto rol 2 (técnico/invitado)
        const result = await db.query(sqlInsert, [rolFinal, username, passwordHash, nombres, apellidos, email]);

        res.json({
            message: '✅ Usuario registrado exitosamente',
            usuario: result.rows[0]
        });

    } catch (error) {
        console.error("Error en Registro:", error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// 2. LOGIN DE USUARIO (CON PROTECCIÓN DE ROL PARA FRONTEND Y BACKEND)
exports.login = async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ message: '⚠️ Ingresa usuario y contraseña' });
    }

    try {
        // Buscamos al usuario real y unimos con la tabla roles
        const sql = `
            SELECT u.*, r.nombre_rol 
            FROM usuarios u 
            JOIN roles r ON u.id_rol = r.id_rol 
            WHERE u.username = $1 AND u.activo = TRUE
        `;
        const result = await db.query(sql, [username]);

        if (result.rows.length === 0) {
            return res.status(401).json({ message: '⛔ Usuario no encontrado' });
        }

        const usuarioBD = result.rows[0];

        // Validamos la contraseña con bcrypt
        const passwordValido = await bcrypt.compare(password, usuarioBD.password_hash);
        if (!passwordValido) {
            return res.status(401).json({ message: '⛔ Contraseña incorrecta' });
        }

        // Generamos el Token incluyendo el rol (Protección de Backend)
        const token = jwt.sign(
            { 
                id: usuarioBD.id_usuario, 
                rol: usuarioBD.nombre_rol // Incluimos el rol en el token
            }, 
            'SECRETO_SUPER_SECRETO', 
            { expiresIn: '8h' }
        );

        // RESPUESTA AL FRONTEND: Cumple el paso 3 para el *ngIf
        res.json({ 
            message: '✅ Bienvenido', 
            token, 
            usuario: { 
                id: usuarioBD.id_usuario,
                nombre: usuarioBD.nombres, 
                rol: usuarioBD.nombre_rol, // Este es el que lee tu app.ts para esAdmin
                email: usuarioBD.email 
            } 
        });

    } catch (error) {
        console.error("Error en login:", error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};