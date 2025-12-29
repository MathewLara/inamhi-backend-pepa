const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
});

// Probar conexión al iniciar
pool.connect((err, client, release) => {
    if (err) {
        console.error('❌ Error conectando a la Base de Datos:', err.stack);
    } else {
        console.log('✅ ¡Conexión exitosa a PostgreSQL!');
        release();
    }
});

module.exports = pool;