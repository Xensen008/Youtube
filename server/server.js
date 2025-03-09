const express = require('express');
const cors = require('cors');
const ytdl = require("@distube/ytdl-core");
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const path = require('path');
const fs = require('fs');
const { PassThrough } = require('stream');

// Configure ffmpeg to use static binary
ffmpeg.setFfmpegPath(ffmpegStatic);

const app = express();

// Create temp directory if it doesn't exist
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'client/dist')));

// Routes
app.get('/api/info', async (req, res) => {
    try {
        const { url } = req.query;
        const info = await ytdl.getInfo(url);
        const videoId = ytdl.getVideoID(url);
        
        // Filter and process formats
        const formats = info.formats
            .filter(format => format.qualityLabel || format.audioQuality)
            .map(format => ({
                ...format,
                container: format.mimeType.split('/')[1].split(';')[0],
                hasVideo: !!format.qualityLabel,
                hasAudio: !!format.audioBitrate,
                isAudioVideo: !!format.qualityLabel && !!format.audioBitrate
            }));

        res.json({
            title: info.videoDetails.title,
            formats: formats,
            videoId: videoId,
            duration: info.videoDetails.lengthSeconds,
            description: info.videoDetails.description
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.get('/api/download', async (req, res) => {
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
});

// New endpoint for downloading merged video and audio
app.get('/api/download-merged', async (req, res) => {
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
                
                // Clean up temp files after streaming is complete
                fileStream.on('end', () => {
                    try {
                        fs.unlinkSync(videoPath);
                        fs.unlinkSync(audioPath);
                        fs.unlinkSync(outputPath);
                        console.log('Temp files cleaned up');
                    } catch (err) {
                        console.error('Error cleaning up temp files:', err);
                    }
                });
            })
            .on('error', (err) => {
                console.error('Error merging streams:', err);
                res.status(500).send({ error: 'Error processing video' });
                
                // Clean up temp files on error
                try {
                    fs.unlinkSync(videoPath);
                    fs.unlinkSync(audioPath);
                } catch (cleanupErr) {
                    console.error('Error cleaning up temp files:', cleanupErr);
                }
            })
            .run();
    } catch (error) {
        console.error('Download error:', error);
        return res.status(500).send({ error: error.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});