const db = require('../config/db');

exports.getResumen = async (req, res) => {
    try {
        // 1. Contamos Contratos Profesionales
        const sqlContratos = 'SELECT COUNT(*) FROM contratos_profesionales';
        const resContratos = await db.query(sqlContratos);
        
        // 2. Contamos TDRs (Tu tabla se llama 'tdr' en singular)
        const sqlTdrs = 'SELECT COUNT(*) FROM tdr';
        const resTdrs = await db.query(sqlTdrs);

        // 3. Contamos Mantenimientos (Tu tabla es 'soporte_mantenimientos')
        const sqlMantenimientos = 'SELECT COUNT(*) FROM soporte_mantenimientos';
        const resMantenimientos = await db.query(sqlMantenimientos);
        
        // Enviamos los datos con los nombres que espera tu dashboard.ts
        res.json({
            totalContratos: parseInt(resContratos.rows[0].count),
            totalTdrs: parseInt(resTdrs.rows[0].count),
            totalMantenimientos: parseInt(resMantenimientos.rows[0].count)
        });

    } catch (error) {
        console.error("Error en dashboardController:", error);
        res.status(500).json({ error: 'Error al obtener resumen del dashboard' });
    }
};