const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { getAll, getOne, create, update, remove, assignWorker, getComments, addComment } = require('../controllers/issueController');

router.get('/',     authenticate, getAll);
router.get('/:id',  authenticate, getOne);
router.post('/',    authenticate, requireRole('community_member', 'admin'), create);
router.patch('/:id', authenticate, update);
router.delete('/:id', authenticate, remove);

router.post('/:id/assign',   authenticate, requireRole('facility_manager', 'admin'), assignWorker);
router.get('/:id/comments',  authenticate, getComments);
router.post('/:id/comments', authenticate, addComment);

module.exports = router;
