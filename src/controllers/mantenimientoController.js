const db = require('../config/db'); 

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

// 1. OBTENER LISTA
exports.getMantenimientos = async (req, res) => {
    try {
        const sql = 'SELECT * FROM soporte_mantenimientos ORDER BY fecha_reporte DESC';
        const result = await db.query(sql);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener mantenimientos' });
    }
};

// 2. CREAR NUEVO REPORTE
exports.createMantenimiento = async (req, res) => {
    try {
        const { 
            nombre_equipo, descripcion_fallo, fecha_reporte, tecnico_sugerido, id_usuario_reporta 
        } = req.body;
        
        const fechaFinal = fecha_reporte || new Date();
        const usuarioFinal = id_usuario_reporta || 1; 

        const sql = `
            INSERT INTO soporte_mantenimientos 
            (nombre_equipo, descripcion_fallo, fecha_reporte, tecnico_asignado, estado, id_usuario_reporta)
            VALUES ($1, $2, $3, $4, 'PENDIENTE', $5)
            RETURNING *
        `;
        
        const values = [nombre_equipo, descripcion_fallo, fechaFinal, tecnico_sugerido || 'No especificado', usuarioFinal];

        const result = await db.query(sql, values);
        
        // 🚨 AUDITORIA: CREAR
        const nuevoM = result.rows[0];
        await auditar(req, 'CREAR', 'MANTENIMIENTOS', nuevoM.id_mantenimiento, {
            equipo: nuevoM.nombre_equipo,
            fallo: nuevoM.descripcion_fallo,
            tecnico: nuevoM.tecnico_asignado
        });

        res.json(result.rows[0]);

    } catch (error) {
        console.error("🔥 Error al crear reporte:", error.message);
        res.status(500).json({ error: 'Error al crear reporte en BD' });
    }
};

// 3. ACTUALIZAR ESTADO
exports.updateEstado = async (req, res) => {
    try {
        const { id } = req.params;
        const { nuevoEstado } = req.body;

        const oldData = await db.query('SELECT * FROM soporte_mantenimientos WHERE id_mantenimiento = $1', [id]);

        let sql = 'UPDATE soporte_mantenimientos SET estado = $1 WHERE id_mantenimiento = $2';
        if (nuevoEstado === 'FINALIZADO' || nuevoEstado === 'Reparado') {
            sql = 'UPDATE soporte_mantenimientos SET estado = $1, fecha_resolucion = NOW() WHERE id_mantenimiento = $2';
        }
        
        await db.query(sql, [nuevoEstado, id]);

        // 🚨 AUDITORIA: ACTUALIZAR ESTADO
        await auditar(req, 'ACTUALIZAR', 'MANTENIMIENTOS', id, 
            { estado: nuevoEstado },
            oldData.rows[0] ? { estado: oldData.rows[0].estado } : null
        );

        res.json({ message: 'Estado actualizado correctamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al actualizar estado' });
    }
};