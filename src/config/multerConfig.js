const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Configuración de almacenamiento
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Guardamos todo en la carpeta 'uploads' que está en la raíz
        cb(null, path.join(__dirname, '../../uploads')); 
    },
    filename: (req, file, cb) => {
        // Generamos un nombre único: "uuid-nombreOriginal.pdf"
        const uniqueName = `${uuidv4()}-${file.originalname}`;
        cb(null, uniqueName);
    }
});

// Filtro para aceptar solo PDFs (según requerimiento)
const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
        cb(null, true);
    } else {
        cb(new Error('❌ Solo se permiten archivos PDF'), false);
    }
};

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // Límite de 10MB
    fileFilter: fileFilter
});

module.exports = upload;