const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { getAll, getOne, update, remove } = require('../controllers/userController');

router.get('/',    authenticate, requireRole('admin', 'facility_manager'), getAll);
router.get('/:id', authenticate, getOne);
router.patch('/:id', authenticate, update);
router.delete('/:id', authenticate, requireRole('admin'), remove);

module.exports = router;
