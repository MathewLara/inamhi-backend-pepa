const pool = require('../config/db');

const obtenerAuditoria = async (req, res) => {
    try {
        const { busqueda, fechaInicio, fechaFin, mostrarEliminados } = req.query;

        // 1. Base de la consulta
        let query = `
            SELECT 
                a.id_log,
                a.fecha_evento,
                a.accion,
                a.tabla_afectada,
                a.ip_origen,
                a.navegador_info,
                u.username,
                u.nombres || ' ' || u.apellidos as nombre_usuario_responsable,
                a.datos_nuevos,
                a.datos_anteriores
            FROM auditoria_logs a
            LEFT JOIN usuarios u ON a.id_usuario = u.id_usuario
            WHERE 1=1
        `;

        const values = [];
        let counter = 1;

        // 2. Filtros
        if (busqueda) {
            query += ` AND (
                a.accion ILIKE $${counter} OR
                a.tabla_afectada ILIKE $${counter} OR
                u.username ILIKE $${counter} OR
                u.nombres ILIKE $${counter} OR
                u.apellidos ILIKE $${counter} OR
                a.datos_nuevos::text ILIKE $${counter} OR 
                a.datos_anteriores::text ILIKE $${counter}
            )`;
            values.push(`%${busqueda}%`);
            counter++;
        }

        if (fechaInicio) {
            query += ` AND DATE(a.fecha_evento) >= $${counter}`;
            values.push(fechaInicio);
            counter++;
        }

        if (fechaFin) {
            query += ` AND DATE(a.fecha_evento) <= $${counter}`;
            values.push(fechaFin);
            counter++;
        }

        if (mostrarEliminados === 'true') {
            query += ` AND a.accion = 'ELIMINAR'`;
        }

        // Ordenamiento
        query += ` ORDER BY a.fecha_evento DESC LIMIT 100`;

        const result = await pool.query(query, values);

        return res.status(200).json({
            ok: true,
            data: result.rows
        });

    } catch (error) {
        console.error('Error en obtenerAuditoria:', error);
        return res.status(500).json({
            ok: false,
            mensaje: 'Error al obtener registros de auditoría'
        });
    }
};

// ¡ESTA ES LA PARTE QUE SEGURAMENTE TE FALTA!
module.exports = {
    obtenerAuditoria
};