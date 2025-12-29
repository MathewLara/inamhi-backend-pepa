const db = require('../config/db');

// --- HELPER: Auditoría ---
const auditar = async (req, accion, tabla, idAfectado, datosNuevos, datosAnteriores = null) => {
    try {
        const idUsuario = req.usuario ? req.usuario.id : 1; 
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '0.0.0.0';
        await db.query(
            `INSERT INTO auditoria_logs (id_usuario, accion, tabla_afectada, id_registro_afectado, datos_nuevos, datos_anteriores, ip_origen) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [idUsuario, accion, tabla, idAfectado, datosNuevos, datosAnteriores, ip]
        );
    } catch (e) { console.error("⚠️ Error auditoría:", e.message); }
};

// 1. OBTENER CATALOGOS
exports.getCatalogos = async (req, res) => {
    try {
        const procesos = await db.query('SELECT * FROM cat_tipos_proceso WHERE activo = true');
        const direcciones = await db.query('SELECT * FROM cat_direcciones WHERE activo = true');
        res.json({ tiposProceso: procesos.rows, direcciones: direcciones.rows });
    } catch (error) { res.status(500).json({ error: 'Error catálogos' }); }
};

// 2. OBTENER TDRs (AQUÍ ESTÁ LA CORRECCIÓN DE DESCARGA)
exports.getTDRs = async (req, res) => {
    try {
        const sql = `
            SELECT t.*, 
                   cat.nombre_proceso, 
                   dir.nombre_direccion,
                   est.nombre_estado, est.color_hex,

                   -- INFORME NECESIDAD
                   -- Nombre bonito para mostrar (Ej: Angel.pdf)
                   (SELECT nombre_original FROM repositorio_archivos 
                    WHERE id_tdr_vinculado = t.id_tdr AND (id_tipo_documento = 1 OR mime_type = 'necesidad') 
                    ORDER BY id_archivo DESC LIMIT 1) as nombre_archivo_necesidad,
                   
                   -- Nombre REAL para descargar (Ej: a8551...Angel.pdf)
                   (SELECT ruta_almacenamiento FROM repositorio_archivos 
                    WHERE id_tdr_vinculado = t.id_tdr AND (id_tipo_documento = 1 OR mime_type = 'necesidad') 
                    ORDER BY id_archivo DESC LIMIT 1) as ruta_necesidad,

                   (SELECT id_archivo FROM repositorio_archivos 
                    WHERE id_tdr_vinculado = t.id_tdr AND (id_tipo_documento = 1 OR mime_type = 'necesidad') 
                    ORDER BY id_archivo DESC LIMIT 1) as id_archivo_necesidad,

                   -- DOCUMENTO TDR
                   (SELECT nombre_original FROM repositorio_archivos 
                    WHERE id_tdr_vinculado = t.id_tdr AND (id_tipo_documento = 2 OR mime_type = 'tdr') 
                    ORDER BY id_archivo DESC LIMIT 1) as nombre_archivo_tdr,

                   (SELECT ruta_almacenamiento FROM repositorio_archivos 
                    WHERE id_tdr_vinculado = t.id_tdr AND (id_tipo_documento = 2 OR mime_type = 'tdr') 
                    ORDER BY id_archivo DESC LIMIT 1) as ruta_tdr,

                   (SELECT id_archivo FROM repositorio_archivos 
                    WHERE id_tdr_vinculado = t.id_tdr AND (id_tipo_documento = 2 OR mime_type = 'tdr') 
                    ORDER BY id_archivo DESC LIMIT 1) as id_archivo_tdr

            FROM tdr t
            LEFT JOIN cat_tipos_proceso cat ON t.id_tipo_proceso = cat.id_tipo_proceso
            LEFT JOIN cat_direcciones dir ON t.id_direccion_solicitante = dir.id_direccion
            LEFT JOIN cat_estados_tdr est ON t.id_estado = est.id_estado
            WHERE t.eliminado_logico = false  
            ORDER BY t.id_tdr DESC
        `;
        const result = await db.query(sql);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener TDRs' });
    }
};

// 3. CREAR TDR
exports.createTDR = async (req, res) => {
    const d = req.body;
    try {
        const numero_tdr = d.numero_tdr || `TDR-${Date.now()}`;
        const sql = `INSERT INTO tdr (numero_tdr, anio_fiscal, id_tipo_proceso, id_direccion_solicitante, id_usuario_responsable, usuario_registro_id, id_estado, objeto_contratacion, presupuesto_referencial, fecha_inicio_contrato, fecha_fin_contrato) VALUES ($1, $2, $3, $4, $5, $5, 1, $6, $7, $8, $9) RETURNING *`;
        const values = [numero_tdr, d.anio_fiscal || 2025, d.id_tipo_proceso || 1, d.id_direccion_solicitante || 1, d.id_usuario || 1, d.objeto_contratacion, d.presupuesto_referencial || 0, d.fecha_inicio_contrato, d.fecha_fin_contrato];
        const result = await db.query(sql, values);
        await auditar(req, 'CREAR', 'TDR', result.rows[0].id_tdr, { numero: numero_tdr });
        res.json({ message: 'TDR creado', tdr: result.rows[0] });
    } catch (error) { res.status(500).json({ error: error.message }); }
};

// 4. ACTUALIZAR TDR
exports.updateTDR = async (req, res) => {
    const { id } = req.params;
    const d = req.body;
    try {
        const sql = `UPDATE tdr SET objeto_contratacion=$1, presupuesto_referencial=$2, fecha_inicio_contrato=$3, fecha_fin_contrato=$4, id_tipo_proceso=$5, id_direccion_solicitante=$6 WHERE id_tdr=$7 RETURNING *`;
        const result = await db.query(sql, [d.objeto_contratacion, d.presupuesto_referencial, d.fecha_inicio_contrato, d.fecha_fin_contrato, d.id_tipo_proceso, d.id_direccion_solicitante, id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'No encontrado' });
        await auditar(req, 'ACTUALIZAR', 'TDR', id, d);
        res.json({ message: 'Actualizado', tdr: result.rows[0] });
    } catch (error) { res.status(500).json({ error: 'Error actualizar' }); }
};

// 5. ELIMINAR TDR
exports.deleteTDR = async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('UPDATE tdr SET eliminado_logico = true WHERE id_tdr = $1', [id]);
        await auditar(req, 'ELIMINAR', 'TDR', id, { estado: 'Eliminado Lógico' });
        res.json({ message: 'Eliminado' });
    } catch (error) { res.status(500).json({ error: 'Error eliminar' }); }
};

// 6. GET BY ID
exports.getTdrById = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.query('SELECT * FROM tdr WHERE id_tdr = $1', [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
        res.json(result.rows[0]);
    } catch (error) { res.status(500).json({ error: 'Error servidor' }); }
};