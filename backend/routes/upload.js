const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const { upload } = require('../controllers/uploadController');

const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};
const multerUpload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/', authenticate, multerUpload.single('file'), upload);

module.exports = router;
