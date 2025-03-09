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
    const io = req.app.get('io');
    const downloadId = Date.now().toString();
    
    try {
        const { url, videoFormat, audioFormat } = req.query;
        const { socketId } = req.query;
        
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
        
        // Send initial status to client
        const progressInfo = {
            id: downloadId,
            title: videoDetails.title,
            quality: `${videoFormatObj.qualityLabel || 'N/A'} + audio (${audioFormatObj.audioBitrate || 'N/A'}kbps)`,
            thumbnail: videoDetails.thumbnails?.length > 0 ? videoDetails.thumbnails[0].url : null,
            status: 'initializing',
            progress: 0,
            message: 'Starting download...',
            videoSize: videoFormatObj.contentLength ? parseInt(videoFormatObj.contentLength) : 'Unknown',
            audioSize: audioFormatObj.contentLength ? parseInt(audioFormatObj.contentLength) : 'Unknown',
        };
        
        if (socketId) {
            io.to(socketId).emit('download:status', progressInfo);
        } else {
            io.emit('download:status', progressInfo);
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
        
        // Create streams for video and audio download
        let videoProgress = 0;
        let audioProgress = 0;
        let videoSize = 0;
        let audioSize = 0;
        
        if (videoFormatObj.contentLength) videoSize = parseInt(videoFormatObj.contentLength);
        if (audioFormatObj.contentLength) audioSize = parseInt(audioFormatObj.contentLength);
        
        // Update function for progress
        const updateProgress = () => {
            // Calculate overall progress (video is 80% of the process, audio is 20%)
            const overallProgress = Math.floor((videoProgress * 0.8) + (audioProgress * 0.2));
            
            const update = {
                ...progressInfo,
                status: 'downloading',
                progress: overallProgress,
                videoProgress,
                audioProgress,
                message: `Downloading video (${videoProgress}%) and audio (${audioProgress}%)...`,
            };
            
            if (socketId) {
                io.to(socketId).emit('download:status', update);
            } else {
                io.emit('download:status', update);
            }
        };
        
        // Setup video download with progress tracking
        const videoStream = ytdl(url, { format: videoFormatObj })
            .on('progress', (_, downloaded, total) => {
                if (total) {
                    videoSize = total;
                    videoProgress = Math.floor((downloaded / total) * 100);
                    updateProgress();
                }
            })
            .pipe(fs.createWriteStream(videoPath));

        // Setup audio download with progress tracking
        const audioStream = ytdl(url, { format: audioFormatObj })
            .on('progress', (_, downloaded, total) => {
                if (total) {
                    audioSize = total;
                    audioProgress = Math.floor((downloaded / total) * 100);
                    updateProgress();
                }
            })
            .pipe(fs.createWriteStream(audioPath));

        console.log(`Downloading video (${videoFormatObj.qualityLabel}) and audio (${audioFormatObj.audioBitrate}kbps)...`);

        // Wait for both downloads to complete
        await Promise.all([
            new Promise(resolve => videoStream.on('finish', resolve)),
            new Promise(resolve => audioStream.on('finish', resolve))
        ]);

        // Update status to merging
        const mergingUpdate = {
            ...progressInfo,
            status: 'processing',
            progress: 80,
            message: 'Download complete, merging files...',
        };
        
        if (socketId) {
            io.to(socketId).emit('download:status', mergingUpdate);
        } else {
            io.emit('download:status', mergingUpdate);
        }
        
        console.log('Download complete, merging files...');

        // Merge video and audio using ffmpeg
        ffmpeg()
            .input(videoPath)
            .input(audioPath)
            .outputOptions(['-c:v copy', '-c:a aac', '-map 0:v:0', '-map 1:a:0'])
            .output(outputPath)
            .on('progress', (progress) => {
                if (progress.percent) {
                    // More granular progress updates for processing stage
                    // Map merging progress from 0-100% to 80-99% of overall process
                    const mergeProgress = Math.min(99, 80 + Math.floor(progress.percent / 5));
                    const update = {
                        ...progressInfo,
                        status: 'processing',
                        progress: mergeProgress,
                        message: `Merging: ${progress.percent.toFixed(1)}% complete...`,
                        timeRemaining: progress.timemark
                    };
                    
                    if (socketId) {
                        io.to(socketId).emit('download:status', update);
                    } else {
                        io.emit('download:status', update);
                    }
                }
            })
            .on('start', (commandLine) => {
                console.log('FFmpeg process started:', commandLine);
                // Send processing started notification
                const processingUpdate = {
                    ...progressInfo,
                    status: 'processing',
                    progress: 82,
                    message: 'Processing started: Merging video and audio...',
                };
                
                if (socketId) {
                    io.to(socketId).emit('download:status', processingUpdate);
                } else {
                    io.emit('download:status', processingUpdate);
                }
            })
            .on('end', () => {
                // Send completion status
                const completeUpdate = {
                    ...progressInfo,
                    status: 'completed',
                    progress: 100,
                    message: 'Download complete! Starting file transfer...',
                };
                
                if (socketId) {
                    io.to(socketId).emit('download:status', completeUpdate);
                } else {
                    io.emit('download:status', completeUpdate);
                }
                
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
                res.on('close', () => {
                    setTimeout(() => {
                        try {
                            // Check if file still exists before trying to delete
                            if (fs.existsSync(outputPath)) {
                                fs.unlinkSync(outputPath);
                                console.log(`File deleted successfully: ${outputPath}`);
                                
                                const cleanupUpdate = {
                                    ...progressInfo,
                                    status: 'finished',
                                    progress: 100,
                                    message: 'Download finished and temp files cleaned up.',
                                };
                                
                                if (socketId) {
                                    io.to(socketId).emit('download:status', cleanupUpdate);
                                } else {
                                    io.emit('download:status', cleanupUpdate);
                                }
                            }
                        } catch (err) {
                            console.error('Error deleting output file after streaming:', err);
                        }
                    }, 1000);
                });
            })
            .on('error', (err) => {
                console.error('Error merging streams:', err);
                
                // Send error status
                const errorUpdate = {
                    ...progressInfo,
                    status: 'error',
                    message: 'Error processing video: ' + err.message,
                };
                
                if (socketId) {
                    io.to(socketId).emit('download:status', errorUpdate);
                } else {
                    io.emit('download:status', errorUpdate);
                }
                
                res.status(500).send({ error: 'Error processing video' });
                
                // Clean up temp files on error
                cleanupTempFiles(tempFiles);
            })
            .run();
    } catch (error) {
        console.error('Download error:', error);
        
        // Send error status
        const errorUpdate = {
            id: downloadId,
            status: 'error',
            message: 'Download error: ' + error.message,
        };
        
        const io = req.app.get('io');
        if (req.query.socketId) {
            io.to(req.query.socketId).emit('download:status', errorUpdate);
        } else {
            io.emit('download:status', errorUpdate);
        }
        
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
