const express = require('express');
const router = express.Router();
const usuarioController = require('../controllers/usuarioController');

// 1. RUTA ESPECÍFICA (La ponemos PRIMERO para que tenga prioridad)
// PUT /api/usuarios/4/password
router.put('/:id/password', usuarioController.updatePassword);

// 2. RUTAS GENERALES
router.get('/', usuarioController.getUsuarios);
router.post('/', usuarioController.createUsuario);
router.put('/:id', usuarioController.updateUsuario); // Esta va después para no "comerse" a la de password
router.delete('/:id', usuarioController.deleteUsuario);

module.exports = router;