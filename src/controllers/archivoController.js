const db = require('../config/db');
const path = require('path');
const fs = require('fs');

// 1. SUBIR ARCHIVO
exports.subirArchivo = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se ha subido ningún archivo o no es un PDF válido.' });
        }

        let { id_tdr, id_contrato, tipo_documento, id_usuario } = req.body;
        const archivo = req.file;

        // --- CORRECCIÓN AQUÍ: Convertir texto a número ---
        // La base de datos espera un ID (integer), no un string.
        if (tipo_documento === 'necesidad') {
            tipo_documento = 1; // Asumimos que 1 es Informe Necesidad
        } else if (tipo_documento === 'tdr') {
            tipo_documento = 2; // Asumimos que 2 es Documento TDR
        } 
        // Si ya viene como número, lo dejamos tal cual.
        // -----------------------------------------------

        // Validar vinculación
        if (!id_tdr && !id_contrato) {
            // Si falla, borramos el archivo físico para no dejar basura
            if (fs.existsSync(archivo.path)) fs.unlinkSync(archivo.path);
            return res.status(400).json({ error: 'Debes vincular el archivo a un TDR o Contrato.' });
        }

        const sql = `
            INSERT INTO repositorio_archivos 
            (nombre_original, ruta_almacenamiento, peso_kb, mime_type, id_usuario_subida, id_tdr_vinculado, id_contrato_vinculado, id_tipo_documento, estado_verificado)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
            RETURNING *
        `;

        const values = [
            archivo.originalname,
            archivo.filename,
            (archivo.size / 1024).toFixed(2),
            archivo.mimetype,
            id_usuario || 1,
            id_tdr || null,
            id_contrato || null,
            tipo_documento || null // Ahora sí enviamos un número
        ];

        const result = await db.query(sql, values);
        res.status(201).json({ message: 'Archivo subido correctamente', archivo: result.rows[0] });

    } catch (error) {
        console.error("🔥 Error al subir:", error); // Mira tu terminal para ver el error exacto
        res.status(500).json({ error: 'Error interno al subir archivo (Revisar logs consola).' });
    }
};

// 2. DESCARGAR ARCHIVO
exports.descargarArchivo = async (req, res) => {
    const { nombreArchivo } = req.params;
    const rutaCompleta = path.join(__dirname, '../../uploads', nombreArchivo);

    // Verificamos si existe antes de intentar bajarlo
    if (fs.existsSync(rutaCompleta)) {
        res.download(rutaCompleta);
    } else {
        res.status(404).json({ error: 'Archivo no encontrado en servidor.' });
    }
};

// 3. ELIMINAR ARCHIVO
exports.eliminarArchivo = async (req, res) => {
    const { id_archivo } = req.params;
    
    try {
        // A) Buscar nombre del archivo
        const sqlSelect = 'SELECT ruta_almacenamiento FROM repositorio_archivos WHERE id_archivo = $1';
        const result = await db.query(sqlSelect, [id_archivo]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Archivo no encontrado en BD.' });
        }

        const nombreArchivo = result.rows[0].ruta_almacenamiento;
        const rutaFisica = path.join(__dirname, '../../uploads', nombreArchivo);

        // B) Borrar físico
        if (fs.existsSync(rutaFisica)) {
            fs.unlinkSync(rutaFisica);
        }

        // C) Borrar de la BD
        await db.query('DELETE FROM repositorio_archivos WHERE id_archivo = $1', [id_archivo]);

        res.json({ message: '✅ Archivo eliminado correctamente.' });

    } catch (error) {
        console.error("Error eliminando:", error);
        res.status(500).json({ error: 'Error al eliminar archivo.' });
    }
};