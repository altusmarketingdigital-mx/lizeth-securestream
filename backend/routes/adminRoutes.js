const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const requireAdmin = require('../middlewares/requireAdmin');
const { requireAuth } = require('../middlewares/authMiddleware');

// Rutas protegidas (Auth + Admin)
router.use(requireAuth, requireAdmin);

router.get('/stats', adminController.getStats);
router.get('/users', adminController.getUsers);
router.get('/sales', adminController.getSales);
router.post('/sales', adminController.createManualSale);
router.delete('/sales/:id', adminController.deleteSale);
router.get('/sales/analytics', adminController.getSalesAnalytics);

router.get('/videos', adminController.getVideos);
router.put('/videos/reorder', adminController.reorderVideos);
router.post('/videos', adminController.addVideo);
router.put('/videos/:id', adminController.updateVideo);
router.delete('/videos/:id', adminController.deleteVideo);
router.get('/get-upload-url', adminController.getUploadUrl);
router.get('/dropbox-token', adminController.getDropboxToken);
router.post('/users', adminController.createUser);
router.post('/fix-cors', adminController.fixCors);
router.put('/users/:id', adminController.updateUser);
router.get('/users/:id/purchases', adminController.getUserPurchases);
router.delete('/users/:id', adminController.deleteUser);
router.put('/users/:id/toggle-block', adminController.toggleUserBlock);
router.put('/users/:id/reset-password', adminController.regenerateUserPassword);
router.put('/users/:id/name', adminController.updateUserName);
router.post('/import-users', adminController.importUsers);

module.exports = router;
