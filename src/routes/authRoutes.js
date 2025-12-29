const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Asegúrate de que apunte a .login
router.post('/login', authController.login); 

module.exports = router;