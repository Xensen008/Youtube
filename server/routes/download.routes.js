const express = require('express');
const router = express.Router();
const downloadController = require('../controllers/download.controller');

/**
 * @route   GET /api/download
 * @desc    Download a YouTube video in the specified format
 * @query   {string} url - The YouTube video URL
 * @query   {string} format - The format (itag) to download
 */
router.get('/', downloadController.downloadVideo);

/**
 * @route   GET /api/download/merged
 * @desc    Download and merge video and audio streams
 * @query   {string} url - The YouTube video URL
 * @query   {string} videoFormat - The video format (itag) to download
 * @query   {string} audioFormat - The audio format (itag) to download
 */
router.get('/merged', downloadController.downloadMerged);

module.exports = router;
