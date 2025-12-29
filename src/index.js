require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// 1. IMPORTAR RUTAS
const authRoutes = require('./routes/authRoutes');
const tdrRoutes = require('./routes/tdrRoutes');
const mantenimientoRoutes = require('./routes/mantenimientoRoutes');
const contratoRoutes = require('./routes/contratoRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const auditoriaRoutes = require('./routes/auditoriaRoutes');
const usuarioRoutes = require('./routes/usuarioRoutes');
const archivoRoutes = require('./routes/archivoRoutes');

const app = express();

// 2. MIDDLEWARES
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// --- EL CHISMOSO (Logger Global) ---
// Esto nos dirá EXACTAMENTE qué está llegando al servidor
app.use((req, res, next) => {
    console.log(`📡 PETICIÓN RECIBIDA: ${req.method} ${req.url}`);
    next();
});

// 3. USAR LAS RUTAS REALES
app.use('/api/auth', authRoutes);
app.use('/api/tdrs', tdrRoutes);
app.use('/api/mantenimientos', mantenimientoRoutes);
app.use('/api/contratos', contratoRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/auditoria', auditoriaRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/archivos', archivoRoutes);

// 4. INICIAR SERVIDOR
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 SERVIDOR REAL CORRIENDO EN PUERTO ${PORT}`);
    console.log(`📋 Rutas de usuarios activas en: /api/usuarios`);
});