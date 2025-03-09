const ytdl = require("@distube/ytdl-core");
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const { tempDir } = require('../utils/ffmpeg.utils');

/**
 * Download a video in the specified format
 */
exports.downloadVideo = async (req, res) => {
    try {
        const { url, format } = req.query;
        
        if (!format) {
            return res.status(400).send({ error: 'Format is required' });
        }

        const info = await ytdl.getInfo(url);
        const videoDetails = info.videoDetails;
        const title = videoDetails.title.replace(/[^\w\s]/gi, '');

        // Check if the format has both audio and video
        const selectedFormat = info.formats.find(f => f.itag.toString() === format);
        
        if (selectedFormat && selectedFormat.hasAudio && selectedFormat.hasVideo) {
            res.header('Content-Disposition', `attachment; filename="${title}.mp4"`);
            ytdl(url, { format: format }).pipe(res);
        } else {
            // For video-only formats, download with audio
            res.header('Content-Disposition', `attachment; filename="${title}.mp4"`);
            ytdl(url, { 
                quality: format,
                filter: 'audioandvideo' 
            }).pipe(res);
        }
    } catch (error) {
        console.error('Download error:', error);
        return res.status(500).send({ error: error.message });
    }
};

/**
 * Download and merge separate video and audio streams
 */
exports.downloadMerged = async (req, res) => {
    const tempFiles = [];
    
    try {
        const { url, videoFormat, audioFormat } = req.query;
        
        if (!videoFormat || !audioFormat) {
            return res.status(400).send({ error: 'Video and audio formats are required' });
        }

        const info = await ytdl.getInfo(url);
        const videoDetails = info.videoDetails;
        const title = videoDetails.title.replace(/[^\w\s]/gi, '');
        
        // Find the actual format objects from the available formats
        const videoFormatObj = info.formats.find(f => f.itag.toString() === videoFormat);
        const audioFormatObj = info.formats.find(f => f.itag.toString() === audioFormat);
        
        if (!videoFormatObj || !audioFormatObj) {
            return res.status(400).send({ error: 'Invalid video or audio format' });
        }
        
        // Random file names to avoid conflicts
        const timestamp = Date.now();
        const videoPath = path.join(tempDir, `video-${timestamp}.mp4`);
        const audioPath = path.join(tempDir, `audio-${timestamp}.mp3`);
        const outputPath = path.join(tempDir, `output-${timestamp}.mp4`);
        
        // Keep track of files to clean up
        tempFiles.push(videoPath, audioPath, outputPath);

        // Set download headers
        res.header('Content-Disposition', `attachment; filename="${title}.mp4"`);
        
        // Create streams for video and audio download using the format objects directly
        const videoStream = ytdl(url, { format: videoFormatObj })
            .pipe(fs.createWriteStream(videoPath));

        const audioStream = ytdl(url, { format: audioFormatObj })
            .pipe(fs.createWriteStream(audioPath));

        console.log(`Downloading video (${videoFormatObj.qualityLabel}) and audio (${audioFormatObj.audioBitrate}kbps)...`);

        // Wait for both downloads to complete
        await Promise.all([
            new Promise(resolve => videoStream.on('finish', resolve)),
            new Promise(resolve => audioStream.on('finish', resolve))
        ]);

        console.log('Download complete, merging files...');

        // Merge video and audio using ffmpeg
        ffmpeg()
            .input(videoPath)
            .input(audioPath)
            .outputOptions(['-c:v copy', '-c:a aac', '-map 0:v:0', '-map 1:a:0'])
            .output(outputPath)
            .on('end', () => {
                console.log('Merge complete, streaming to client...');
                
                // Stream the merged file to client
                const fileStream = fs.createReadStream(outputPath);
                fileStream.pipe(res);
                
                // Delete video and audio files, but not output yet
                try {
                    fs.unlinkSync(videoPath);
                    fs.unlinkSync(audioPath);
                    tempFiles.splice(tempFiles.indexOf(videoPath), 1);
                    tempFiles.splice(tempFiles.indexOf(audioPath), 1);
                } catch (err) {
                    console.error('Error cleaning up temporary source files:', err);
                }
                
                // Set up a connection closed event to delete the output file
                // This ensures the file is only deleted after streaming is complete
                res.on('close', () => {
                    setTimeout(() => {
                        try {
                            // Check if file still exists before trying to delete
                            if (fs.existsSync(outputPath)) {
                                fs.unlinkSync(outputPath);
                                console.log(`File deleted successfully: ${outputPath}`);
                            }
                        } catch (err) {
                            console.error('Error deleting output file after streaming:', err);
                        }
                    }, 1000); // Small delay to ensure file is no longer in use
                });
            })
            .on('error', (err) => {
                console.error('Error merging streams:', err);
                res.status(500).send({ error: 'Error processing video' });
                
                // Clean up temp files on error
                cleanupTempFiles(tempFiles);
            })
            .run();
    } catch (error) {
        console.error('Download error:', error);
        cleanupTempFiles(tempFiles);
        return res.status(500).send({ error: error.message });
    }
};

/**
 * Helper function to clean up temporary files
 */
function cleanupTempFiles(files) {
    if (!files || !files.length) return;
    
    files.forEach(file => {
        try {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
                console.log(`Cleaned up temp file: ${file}`);
            }
        } catch (err) {
            console.error(`Failed to clean up temp file ${file}:`, err);
        }
    });
}
