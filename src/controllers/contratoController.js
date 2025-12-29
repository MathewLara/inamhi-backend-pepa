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

// 1. OBTENER CATÁLOGOS
exports.getCatalogos = async (req, res) => {
    try {
        const areas = await db.query("SELECT id_direccion, nombre_direccion FROM cat_direcciones WHERE activo = true ORDER BY nombre_direccion ASC");
        const supervisores = await db.query("SELECT id_usuario, nombres || ' ' || apellidos as nombre_completo FROM usuarios WHERE activo = true");
        res.json({ areas: areas.rows, supervisores: supervisores.rows });
    } catch (error) {
        res.status(500).json({ error: 'Error al cargar listas desplegables' });
    }
};

// 2. LISTAR CONTRATOS
exports.getContratos = async (req, res) => {
    try {
        const sql = `
            SELECT c.*, 
                   dir.nombre_direccion, 
                   u.nombres || ' ' || u.apellidos as nombre_supervisor
            FROM contratos_profesionales c
            LEFT JOIN cat_direcciones dir ON c.id_direccion_solicitante = dir.id_direccion
            LEFT JOIN usuarios u ON c.id_usuario_supervisor = u.id_usuario
            ORDER BY c.id_contrato DESC
        `;
        const result = await db.query(sql);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Error al listar contratos' });
    }
};

// 3. OBTENER UN CONTRATO POR ID
exports.getContratoById = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.query('SELECT * FROM contratos_profesionales WHERE id_contrato = $1', [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Contrato no encontrado' });
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Error al buscar contrato' });
    }
};

// 4. CREAR CONTRATO
exports.createContrato = async (req, res) => {
    const d = req.body;
    try {
        const numContrato = d.numero || `CTR-${Date.now()}`;
        const idAreaSafe = (d.idArea === "" || d.idArea === "undefined") ? null : d.idArea;
        const idSupervisorSafe = (d.idSupervisor === "" || d.idSupervisor === "undefined") ? null : d.idSupervisor;

        const sql = `
            INSERT INTO contratos_profesionales 
            (numero_contrato, cedula_profesional, nombre_completo_profesional, 
             honorarios_mensuales, fecha_inicio, fecha_fin, id_direccion_solicitante, 
             id_usuario_supervisor, objeto_contrato, estado)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'VIGENTE')
            RETURNING *
        `;
        
        const values = [numContrato, d.cedula, d.nombre, d.honorarios, d.inicio, d.fin, idAreaSafe, idSupervisorSafe, d.objeto_contrato];
        
        const result = await db.query(sql, values);
        
        // 🚨 AUDITORIA: CREAR
        const nuevoC = result.rows[0];
        await auditar(req, 'CREAR', 'CONTRATOS', nuevoC.id_contrato, {
            numero_contrato: nuevoC.numero_contrato,
            nombre_profesional: nuevoC.nombre_completo_profesional,
            cargo: nuevoC.objeto_contrato
        });

        res.status(201).json(nuevoC);
    } catch (error) {
        console.error("Error Crear:", error); 
        res.status(500).json({ error: 'Error al crear contrato' });
    }
};

// 5. ACTUALIZAR CONTRATO
exports.updateContrato = async (req, res) => {
    const { id } = req.params;
    const d = req.body;
    try {
        const oldData = await db.query('SELECT * FROM contratos_profesionales WHERE id_contrato = $1', [id]);

        const sql = `
            UPDATE contratos_profesionales SET
                nombre_completo_profesional = $1,
                honorarios_mensuales = $2,
                fecha_inicio = $3,
                fecha_fin = $4,
                id_direccion_solicitante = $5,
                id_usuario_supervisor = $6,
                objeto_contrato = $7
            WHERE id_contrato = $8
            RETURNING *
        `;
        const values = [d.nombre, d.honorarios, d.inicio, d.fin, d.idArea, d.idSupervisor, d.objeto_contrato, id];
        
        const result = await db.query(sql, values);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Contrato no encontrado' });
        
        // 🚨 AUDITORIA: ACTUALIZAR
        await auditar(req, 'ACTUALIZAR', 'CONTRATOS', id, 
            { nombre_profesional: d.nombre, honorarios: d.honorarios },
            oldData.rows[0] ? { nombre_profesional: oldData.rows[0].nombre_completo_profesional, honorarios: oldData.rows[0].honorarios_mensuales } : null
        );

        res.json({ message: 'Actualizado correctamente', contrato: result.rows[0] });
    } catch (error) {
        console.error("Error Update:", error);
        res.status(500).json({ error: 'Error al actualizar' });
    }
};

// 6. ELIMINAR CONTRATO
exports.deleteContrato = async (req, res) => {
    const { id } = req.params;
    try {
        const oldData = await db.query('SELECT * FROM contratos_profesionales WHERE id_contrato = $1', [id]);

        const result = await db.query("DELETE FROM contratos_profesionales WHERE id_contrato = $1", [id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Contrato no encontrado' });

        // 🚨 AUDITORIA: ELIMINAR
        if(oldData.rows.length > 0) {
            await auditar(req, 'ELIMINAR', 'CONTRATOS', id, null, {
                numero_contrato: oldData.rows[0].numero_contrato,
                nombre_profesional: oldData.rows[0].nombre_completo_profesional
            });
        }

        res.json({ message: 'Eliminado correctamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'No se puede eliminar (tiene registros asociados)' });
    }
};