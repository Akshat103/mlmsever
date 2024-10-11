const multer = require('multer');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

// Define the upload directory
const uploadDir = path.join(__dirname, '../uploads');

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueFilename = Date.now() + '-' + file.originalname;
        cb(null, uniqueFilename);
        
        // Log the successful upload
        logger.info(`Uploaded file: ${uniqueFilename}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 1024 * 1024 * 2 }, // Limit file size to 2MB
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        
        if (mimetype && extname) {
            return cb(null, true);
        }
        
        logger.error(`File upload error: ${file.originalname} - Unsupported file type`); // Log error
        cb(new Error('Error: File type not supported!'));
    }
});

// Middleware for multiple files upload
const multipleUpload = (req, res, next) => {
    const serverIp = process.env.SERVER || 'localhost';
    
    if (req.files) {
        // Construct file URLs for each uploaded file
        req.fileUrls = req.files.map(file => {
            const encodedFilename = encodeURIComponent(file.filename);
            const fileUrl = `${serverIp}/uploads/${encodedFilename}`;
            logger.info(`File available at: ${fileUrl}`);
            return fileUrl;
        });
    }
    
    next();
};


// Export the upload middleware and multipleUpload function
module.exports = { upload, multipleUpload };