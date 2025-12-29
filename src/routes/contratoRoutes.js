const express = require('express');
const router = express.Router();
const contratoController = require('../controllers/contratoController');

// 1. Catálogos PRIMERO
router.get('/catalogos', contratoController.getCatalogos);

// 2. El resto DESPUÉS
router.get('/', contratoController.getContratos);
router.post('/', contratoController.createContrato);
router.get('/:id', contratoController.getContratoById);
router.put('/:id', contratoController.updateContrato);
router.delete('/:id', contratoController.deleteContrato);

module.exports = router;