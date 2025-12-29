const express = require('express');
const router = express.Router();
const archivoController = require('../controllers/archivoController');
const upload = require('../config/multerConfig');
const authMiddleware = require('../middleware/authMiddleware'); 

// --- ZONA DE SEGURIDAD (Debugging) ---
// Esto evitará que se caiga el servidor si algo falta
const verificarToken = authMiddleware.verificarToken || ((req,res,next) => next());
const eliminarArchivo = archivoController.eliminarArchivo || ((req,res) => res.status(500).send("Falta función eliminar"));

console.log("Estado de rutas Archivos:");
console.log("- Middleware Token:", typeof authMiddleware.verificarToken); // Debe decir 'function'
console.log("- Controller Eliminar:", typeof archivoController.eliminarArchivo); // Debe decir 'function'

// ==========================================
// RUTAS DEFINITIVAS
// ==========================================

// RUTA DELETE: (La que fallaba)
// Usamos .verificarToken para corregir el error
router.delete('/:id_archivo', authMiddleware.verificarToken, archivoController.eliminarArchivo);

// RUTA POST: Subir archivo
router.post('/upload', upload.single('miArchivo'), archivoController.subirArchivo);

// RUTA GET: Descargar archivo
router.get('/descargar/:nombreArchivo', archivoController.descargarArchivo);

module.exports = router;