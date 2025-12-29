const express = require('express');
const router = express.Router();
const auditoriaController = require('../controllers/auditoriaController');
const authMiddleware = require('../middleware/authMiddleware'); // Comentado por ahora si quieres probar sin token

// GET http://localhost:3000/api/auditoria
router.get('/', auditoriaController.obtenerAuditoria);

module.exports = router;