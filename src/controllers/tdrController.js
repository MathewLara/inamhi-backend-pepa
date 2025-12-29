const db = require('../config/db');

// --- HELPER: Función rápida para guardar en auditoría ---
const auditar = async (req, accion, tabla, idAfectado, datosNuevos, datosAnteriores = null) => {
    try {
        const idUsuario = req.usuario ? req.usuario.id : 1; // ID 1 por defecto si no hay token
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '0.0.0.0';
        
        await db.query(
            `INSERT INTO auditoria_logs 
            (id_usuario, accion, tabla_afectada, id_registro_afectado, datos_nuevos, datos_anteriores, ip_origen) 
            VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [idUsuario, accion, tabla, idAfectado, datosNuevos, datosAnteriores, ip]
        );
    } catch (e) {
        console.error("⚠️ Error guardando auditoría:", e.message);
        // No detenemos el flujo principal si falla la auditoría
    }
};

// 1. OBTENER CATALOGOS
exports.getCatalogos = async (req, res) => {
    try {
        const procesos = await db.query('SELECT * FROM cat_tipos_proceso WHERE activo = true');
        const direcciones = await db.query('SELECT * FROM cat_direcciones WHERE activo = true');
        
        res.json({
            tiposProceso: procesos.rows,
            direcciones: direcciones.rows
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al cargar catálogos TDR' });
    }
};

// 2. OBTENER LISTA (Solo los NO eliminados)
exports.getTDRs = async (req, res) => {
    try {
        const sql = `
            SELECT t.*, 
                   cat.nombre_proceso, 
                   dir.nombre_direccion,
                   est.nombre_estado, est.color_hex
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

// 3. CREAR NUEVO TDR
exports.createTDR = async (req, res) => {
    const d = req.body;
    try {
        const numero_tdr = d.numero_tdr || `TDR-${Date.now()}`;
        const anio_fiscal = d.anio_fiscal || new Date().getFullYear();
        // ... (resto de tus variables) ...
        const id_tipo_proceso = d.id_tipo_proceso;
        const id_direccion_solicitante = d.id_direccion_solicitante;
        const objeto_contratacion = d.objeto_contratacion || 'Sin Objeto';
        const presupuesto_referencial = d.presupuesto_referencial || 0;
        const partida_presupuestaria = d.partida_presupuestaria || '';
        const fecha_inicio = d.fecha_inicio_contrato || null;
        const fecha_fin = d.fecha_fin_contrato || null;
        const id_usuario_responsable = d.id_usuario || 1; 
        let id_estado = 1;

        const sql = `
            INSERT INTO tdr 
            (numero_tdr, anio_fiscal, id_tipo_proceso, id_direccion_solicitante, 
             id_usuario_responsable, usuario_registro_id, 
             id_estado, objeto_contratacion, 
             presupuesto_referencial, partida_presupuestaria, 
             fecha_inicio_contrato, fecha_fin_contrato)
            VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $8, $9, $10, $11) 
            RETURNING *
        `;

        const values = [numero_tdr, anio_fiscal, id_tipo_proceso, id_direccion_solicitante, id_usuario_responsable, id_estado, objeto_contratacion, presupuesto_referencial, partida_presupuestaria, fecha_inicio, fecha_fin];

        const result = await db.query(sql, values);
        
        // 🚨 AUDITORIA: CREAR
        const nuevoTdr = result.rows[0];
        await auditar(req, 'CREAR', 'TDR', nuevoTdr.id_tdr, {
            numero_tdr: nuevoTdr.numero_tdr,
            objeto: nuevoTdr.objeto_contratacion,
            presupuesto: nuevoTdr.presupuesto_referencial
        });

        res.json({ message: 'TDR creado', tdr: nuevoTdr });

    } catch (error) {
        console.error("Error createTDR:", error.message);
        res.status(500).json({ error: error.message });
    }
};

// 4. ACTUALIZAR TDR
exports.updateTDR = async (req, res) => {
    const { id } = req.params;
    const d = req.body;
    
    try {
        // Primero obtenemos el dato anterior para auditoría
        const oldData = await db.query('SELECT * FROM tdr WHERE id_tdr = $1', [id]);
        
        const sql = `
            UPDATE tdr SET
                objeto_contratacion = $1,
                presupuesto_referencial = $2,
                partida_presupuestaria = $3,
                fecha_inicio_contrato = $4,
                fecha_fin_contrato = $5,
                id_tipo_proceso = $6,
                id_direccion_solicitante = $7
            WHERE id_tdr = $8
            RETURNING *
        `;
        
        const values = [
            d.objeto_contratacion,
            d.presupuesto_referencial,
            d.partida_presupuestaria,
            d.fecha_inicio_contrato,
            d.fecha_fin_contrato,
            d.id_tipo_proceso,
            d.id_direccion_solicitante,
            id
        ];

        const result = await db.query(sql, values);
        
        if (result.rowCount === 0) return res.status(404).json({ error: 'TDR no encontrado' });

        // 🚨 AUDITORIA: ACTUALIZAR
        await auditar(req, 'ACTUALIZAR', 'TDR', id, 
            { objeto: d.objeto_contratacion, presupuesto: d.presupuesto_referencial }, // Datos Nuevos
            oldData.rows[0] ? { objeto: oldData.rows[0].objeto_contratacion, presupuesto: oldData.rows[0].presupuesto_referencial } : null // Datos Anteriores
        );

        res.json({ message: 'TDR actualizado correctamente', tdr: result.rows[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al actualizar TDR' });
    }
};

// 5. ELIMINAR TDR
exports.deleteTDR = async (req, res) => {
    const { id } = req.params;
    try {
        // Obtenemos datos antes de borrar
        const oldData = await db.query('SELECT * FROM tdr WHERE id_tdr = $1', [id]);

        const sql = 'DELETE FROM tdr WHERE id_tdr = $1 RETURNING id_tdr'; 
        const result = await db.query(sql, [id]);

        if (result.rowCount === 0) return res.status(404).json({ error: 'TDR no encontrado' });

        // 🚨 AUDITORIA: ELIMINAR
        if(oldData.rows.length > 0) {
            await auditar(req, 'ELIMINAR', 'TDR', id, null, {
                numero_tdr: oldData.rows[0].numero_tdr,
                objeto: oldData.rows[0].objeto_contratacion
            });
        }

        res.json({ message: 'TDR eliminado permanentemente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al eliminar: Es posible que este TDR tenga datos asociados.' });
    }
};

// 6. OBTENER TDR POR ID
exports.getTdrById = async (req, res) => {
    const { id } = req.params;
    try {
        const sql = 'SELECT * FROM tdr WHERE id_tdr = $1';
        const result = await db.query(sql, [id]);

        if (result.rows.length === 0) return res.status(404).json({ error: 'TDR no encontrado' });

        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al buscar TDR por ID' });
    }
};
exports.subirArchivo = async (req, res) => {
    try {
        // req.file viene gracias a Multer (middleware de subida)
        if (!req.file) {
            return res.status(400).json({ error: 'No se ha enviado ningún archivo' });
        }

        const { id_tdr, tipo_documento } = req.body;
        const rutaArchivo = req.file.path; // O req.file.filename según tu config de Multer

        // Definir en qué columna guardar según el tipo
        let columnaDb = '';
        if (tipo_documento === 'necesidad') {
            columnaDb = 'url_informe_necesidad'; // Asegúrate que así se llame en tu BD
        } else if (tipo_documento === 'tdr') {
            columnaDb = 'url_documento_tdr';     // Asegúrate que así se llame en tu BD
        } else {
            return res.status(400).json({ error: 'Tipo de documento no válido' });
        }

        // Actualizar la base de datos con la ruta del archivo
        const sql = `UPDATE tdr SET ${columnaDb} = $1 WHERE id_tdr = $2 RETURNING *`;
        const result = await db.query(sql, [rutaArchivo, id_tdr]);

        // 🚨 AUDITORIA: SUBIDA
        await auditar(req, 'SUBIR_ARCHIVO', 'TDR', id_tdr, {
            tipo: tipo_documento,
            archivo: req.file.originalname
        });

        res.json({ 
            message: 'Archivo guardado correctamente', 
            tdr: result.rows[0] 
        });

    } catch (error) {
        console.error("Error al subir archivo:", error);
        res.status(500).json({ error: 'Error interno al guardar el archivo' });
    }
};
