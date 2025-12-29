const db = require('../config/db');
const path = require('path');
const fs = require('fs');

// SUBIR ARCHIVO
exports.subirArchivo = async (req, res) => {
    try {
        // Validar si Multer procesó el archivo
        if (!req.file) {
            return res.status(400).json({ error: 'No se ha subido ningún archivo o no es un PDF válido.' });
        }

        const { id_tdr, id_contrato, tipo_documento, id_usuario } = req.body;
        const archivo = req.file;

        // Validar que venga al menos un ID de vinculación
        if (!id_tdr && !id_contrato) {
            // Si quieres, borramos el archivo físico porque no se pudo vincular
            fs.unlinkSync(archivo.path);
            return res.status(400).json({ error: 'Debes vincular el archivo a un TDR o a un Contrato.' });
        }

        // Insertar en Base de Datos (Tabla repositorio_archivos)
        const sql = `
            INSERT INTO repositorio_archivos 
            (nombre_original, ruta_almacenamiento, peso_kb, mime_type, id_usuario_subida, id_tdr_vinculado, id_contrato_vinculado, id_tipo_documento, estado_verificado)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
            RETURNING *
        `;

        // Nota: id_tipo_documento deberías enviarlo desde el front (ej: 1 para "Informe", 2 para "Acta")
        // Si no tienes tipos definidos, mándalo como null o define uno por defecto.
        const values = [
            archivo.originalname,
            archivo.filename, // Guardamos el nombre único
            (archivo.size / 1024).toFixed(2), // Peso en KB
            archivo.mimetype,
            id_usuario || 1, // Usuario que sube
            id_tdr || null,
            id_contrato || null,
            tipo_documento || null 
        ];

        const result = await db.query(sql, values);

        console.log("✅ Archivo guardado y registrado:", archivo.originalname);
        res.status(201).json({ message: 'Archivo subido correctamente', archivo: result.rows[0] });

    } catch (error) {
        console.error("🔥 Error al subir archivo:", error);
        res.status(500).json({ error: 'Error interno al procesar el archivo.' });
    }
};

// DESCARGAR ARCHIVO (Para cuando le den click a "Ver PDF")
exports.descargarArchivo = async (req, res) => {
    const { nombreArchivo } = req.params;
    const rutaCompleta = path.join(__dirname, '../../uploads', nombreArchivo);

    res.download(rutaCompleta, (err) => {
        if (err) {
            console.error("Error al descargar:", err);
            res.status(404).json({ error: 'El archivo no existe en el servidor.' });
        }
    });
};
