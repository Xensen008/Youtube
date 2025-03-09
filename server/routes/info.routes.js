const express = require('express');
const router = express.Router();
const infoController = require('../controllers/info.controller');

/**
 * @route   GET /api/info
 * @desc    Get information about a YouTube video
 * @query   {string} url - The YouTube video URL
 */
router.get('/', infoController.getVideoInfo);

module.exports = router;
