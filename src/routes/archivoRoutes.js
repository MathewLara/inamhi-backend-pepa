const express = require('express');
const router = express.Router();
const archivoController = require('../controllers/archivoController');
const upload = require('../config/multerConfig');

// RUTA POST: Subir archivo
// 'miArchivo' es el nombre del campo que usaremos en el Frontend
router.post('/upload', upload.single('miArchivo'), archivoController.subirArchivo);

// RUTA GET: Descargar archivo
router.get('/descargar/:nombreArchivo', archivoController.descargarArchivo);

module.exports = router;