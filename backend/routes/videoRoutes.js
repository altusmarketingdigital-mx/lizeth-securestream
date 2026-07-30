const express = require('express');
const router = express.Router();
const videoController = require('../controllers/videoController');
const { requireAuth } = require('../middlewares/authMiddleware');

router.get('/catalog', videoController.getCatalog);
router.get('/:id/images', videoController.getImages);
router.get('/my-videos', requireAuth, videoController.getMyVideos);
router.get('/stream/:slug', requireAuth, videoController.streamVideo);

module.exports = router;
