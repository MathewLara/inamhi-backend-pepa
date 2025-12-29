const db = require('../config/db');
const bcrypt = require('bcryptjs'); // Asegúrate de tenerlo instalado (npm install bcryptjs)

// --- HELPER: Función rápida para auditoría ---
const auditar = async (req, accion, tabla, idAfectado, datosNuevos, datosAnteriores = null) => {
    try {
        const idUsuario = req.usuario ? req.usuario.id : 1; 
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '0.0.0.0';
        
        await db.query(
            `INSERT INTO auditoria_logs 
            (id_usuario, accion, tabla_afectada, id_registro_afectado, datos_nuevos, datos_anteriores, ip_origen) 
            VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [idUsuario, accion, tabla, idAfectado, datosNuevos, datosAnteriores, ip]
        );
    } catch (e) { console.error("⚠️ Error guardando auditoría:", e.message); }
};

// 1. OBTENER USUARIOS (GET)
exports.getUsuarios = async (req, res) => {
    try {
        const sql = `
            SELECT u.id_usuario, u.nombres, u.apellidos, u.username, u.email, u.activo, u.cargo,
                   r.nombre_rol, u.id_rol
            FROM usuarios u
            LEFT JOIN roles r ON u.id_rol = r.id_rol
            WHERE u.eliminado = false
            ORDER BY u.id_usuario DESC
        `;
        const result = await db.query(sql);
        res.json(result.rows);
    } catch (error) {
        console.error("Error getUsuarios:", error);
        res.status(500).json({ error: 'Error al cargar lista de usuarios' });
    }
};

// 2. CREAR USUARIO (POST)
exports.createUsuario = async (req, res) => {
    try {
        const { nombres, apellidos, username, email, password, id_rol, cargo } = req.body;

        // Validación básica
        if (!username || !password) {
            return res.status(400).json({ error: 'Usuario y contraseña son obligatorios' });
        }

        // Encriptar contraseña
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        const sql = `
            INSERT INTO usuarios (nombres, apellidos, username, email, password_hash, id_rol, cargo, activo, eliminado)
            VALUES ($1, $2, $3, $4, $5, $6, $7, true, false)
            RETURNING *
        `;
        const values = [nombres, apellidos, username, email, hash, id_rol || 2, cargo || 'Funcionario'];

        const result = await db.query(sql, values);
        const newUser = result.rows[0];

        // 🚨 Auditoría
        await auditar(req, 'CREAR', 'USUARIOS', newUser.id_usuario, {
            username: newUser.username,
            nombre_rol: (id_rol == 1 ? 'Administrador' : 'Técnico'),
            nombres: `${newUser.nombres} ${newUser.apellidos}`
        });

        res.json({ message: 'Usuario creado', usuario: newUser });

    } catch (error) {
        console.error("Error createUsuario:", error);
        res.status(500).json({ error: 'Error al crear usuario. El usuario o correo ya existen.' });
    }
};

// 3. ACTUALIZAR USUARIO (PUT) - VERSIÓN INTELIGENTE
exports.updateUsuario = async (req, res) => {
    const { id } = req.params;
    const { nombres, apellidos, email, id_rol, cargo, password } = req.body;

    try {
        // PASO 1: Buscamos cómo está el usuario AHORA
        const currentResult = await db.query('SELECT * FROM usuarios WHERE id_usuario = $1', [id]);
        
        if (currentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const currentUser = currentResult.rows[0];

        // PASO 2: Si el frontend manda vacío, usamos lo que ya tenía
        const newNombres = nombres || currentUser.nombres;
        const newApellidos = apellidos || currentUser.apellidos;
        const newEmail = email || currentUser.email;
        const newRol = id_rol || currentUser.id_rol;
        const newCargo = cargo || currentUser.cargo;

        let sql, values;
        
        // PASO 3: ¿Mandaron contraseña nueva?
        if (password && password.trim() !== '') {
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash(password, salt);
            sql = `
                UPDATE usuarios 
                SET nombres=$1, apellidos=$2, email=$3, id_rol=$4, cargo=$5, password_hash=$6
                WHERE id_usuario=$7 RETURNING *
            `;
            values = [newNombres, newApellidos, newEmail, newRol, newCargo, hash, id];
        } else {
            sql = `
                UPDATE usuarios 
                SET nombres=$1, apellidos=$2, email=$3, id_rol=$4, cargo=$5
                WHERE id_usuario=$6 RETURNING *
            `;
            values = [newNombres, newApellidos, newEmail, newRol, newCargo, id];
        }

        const result = await db.query(sql, values);

        // 🚨 Auditoría
        await auditar(req, 'ACTUALIZAR', 'USUARIOS', id, 
            { nombres: `${newNombres} ${newApellidos}`, cargo: newCargo }, 
            { nombres: `${currentUser.nombres} ${currentUser.apellidos}`, cargo: currentUser.cargo }
        );

        res.json({ message: 'Usuario actualizado correctamente', usuario: result.rows[0] });

    } catch (error) {
        console.error("Error updateUsuario:", error);
        res.status(500).json({ error: 'Error al actualizar usuario' });
    }
};

// 4. ELIMINAR USUARIO (DELETE)
exports.deleteUsuario = async (req, res) => {
    const { id } = req.params;
    try {
        const oldData = await db.query('SELECT * FROM usuarios WHERE id_usuario = $1', [id]);

        // Borrado lógico
        const sql = 'UPDATE usuarios SET eliminado = true, activo = false WHERE id_usuario = $1 RETURNING *';
        const result = await db.query(sql, [id]);

        if (result.rowCount === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

        // 🚨 Auditoría
        if(oldData.rows.length > 0) {
            await auditar(req, 'ELIMINAR', 'USUARIOS', id, null, {
                username: oldData.rows[0].username,
                nombre_rol: 'Usuario del Sistema'
            });
        }

        res.json({ message: 'Usuario eliminado correctamente' });
    } catch (error) {
        console.error("Error deleteUsuario:", error);
        res.status(500).json({ error: 'Error al eliminar usuario' });
    }
};
// 5. CAMBIAR SOLO CONTRASEÑA (CORREGIDO PARA 'nuevaPassword')
exports.updatePassword = async (req, res) => {
    const { id } = req.params;
    
    console.log(`🔐 [BACKEND] Intentando cambiar clave al usuario ID: ${id}`);
    console.log("📦 [BACKEND] Datos recibidos:", req.body);

    // 👇 AQUÍ ESTABA EL ERROR: Faltaba leer 'nuevaPassword'
    const password = req.body.nuevaPassword || req.body.password || req.body.newPassword || req.body.clave;

    try {
        // Validamos que la contraseña exista y sea texto
        if (!password || String(password).trim() === '') {
            console.error("❌ [BACKEND] Error: No se encontró la contraseña en el cuerpo de la petición.");
            return res.status(400).json({ 
                error: 'La contraseña es obligatoria. El backend espera: nuevaPassword, password o clave.' 
            });
        }

        // 1. Encriptar la nueva clave
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        // 2. Actualizar solo el campo password_hash
        const sql = 'UPDATE usuarios SET password_hash = $1 WHERE id_usuario = $2 RETURNING username';
        const result = await db.query(sql, [hash, id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        // 3. Auditoría
        await auditar(req, 'ACTUALIZAR', 'USUARIOS', id, { accion: 'Cambio de contraseña' });

        console.log("✅ [BACKEND] ¡Clave cambiada con éxito!");
        res.json({ message: 'Contraseña actualizada correctamente' });

    } catch (error) {
        console.error("Error updatePassword:", error);
        res.status(500).json({ error: 'Error al cambiar la contraseña' });
    }
};