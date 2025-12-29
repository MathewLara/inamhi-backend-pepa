const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');

// Ruta GET: http://localhost:3000/api/dashboard
router.get('/', dashboardController.getResumen);

module.exports = router;