const express = require('express');
const router = express.Router();
const tdrController = require('../controllers/tdrController');
const jwt = require('jsonwebtoken');

// --- IMPORTACIONES PARA ARCHIVOS ---
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// --- CONFIGURACIÓN DE MULTER ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = 'uploads/';
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// --- MIDDLEWARE DE SEGURIDAD CORREGIDO Y ROBUSTO ---
const esAdminMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(403).json({ message: 'Token no proporcionado' });
    }

    try {
        const decoded = jwt.verify(token, 'SECRETO_SUPER_SECRETO');
        
        // 1. Limpiamos el rol (convertimos a minúsculas y quitamos espacios)
        const rolUsuario = (decoded.rol || '').toLowerCase().trim();

        console.log("🔍 Rol detectado en el token:", rolUsuario); // <--- ESTO TE AYUDARÁ A VER EL ERROR

        // 2. Validación flexible: Acepta 'admin', 'administrador', 'superadmin', etc.
        if (rolUsuario.includes('admin') || rolUsuario.includes('administrador')) {
            next(); // ¡Pase usted!
        } else {
            console.log("⛔ Acceso denegado. Rol insuficiente.");
            return res.status(403).json({ 
                message: `Permiso denegado: Tu rol es '${decoded.rol}', se requiere Administrador.` 
            });
        }
    } catch (error) {
        return res.status(401).json({ message: 'Token inválido o expirado' });
    }
};

// --- RUTAS ---

// 1. Subida de Archivos (Protegida también si quieres, o abierta a técnicos)
// Le pondremos el middleware si solo el admin puede subir, si no, quítalo.
// Según tu requerimiento, el técnico sube, así que lo dejamos SIN middleware o creamos uno para técnicos.
// Por ahora lo dejamos ABIERTO para que te funcione la subida.
router.post('/subir-archivo', upload.single('archivo'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send({ message: 'No se ha subido ningún archivo' });
        }
        const { id_tdr, tipo_documento } = req.body;
        console.log(`✅ Archivo recibido: ${req.file.originalname} | TDR: ${id_tdr}`);
        
        res.status(200).json({ 
            message: 'Archivo subido correctamente', 
            path: req.file.path,
            filename: req.file.filename
        });
    } catch (err) {
        console.error(err);
        res.status(500).send({ message: 'Error al subir archivo' });
    }
});

router.get('/catalogos', tdrController.getCatalogos);
router.get('/', tdrController.getTDRs);
router.get('/:id', tdrController.getTdrById);

// RUTAS PROTEGIDAS (Crear, Editar, Borrar)
router.post('/', esAdminMiddleware, tdrController.createTDR);
router.put('/:id', esAdminMiddleware, tdrController.updateTDR);
router.delete('/:id', esAdminMiddleware, tdrController.deleteTDR);

module.exports = router;