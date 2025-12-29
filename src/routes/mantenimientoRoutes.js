const express = require('express');
const router = express.Router();
const mantenimientoController = require('../controllers/mantenimientoController');

// Definir las rutas (GET, POST, PUT)
router.get('/', mantenimientoController.getMantenimientos);
router.post('/', mantenimientoController.createMantenimiento);
router.put('/:id/estado', mantenimientoController.updateEstado);

module.exports = router;