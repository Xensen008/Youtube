const express = require('express');
const cors = require('cors');
const ytdl = require("@distube/ytdl-core");
// const ffmpeg = require('fluent-ffmpeg');
const path = require('path');

const app = express();

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
                hasVideo: !!format.qualityLabel
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

        res.header('Content-Disposition', `attachment; filename="${title}.mp4"`);
        ytdl(url, {
            format: format,
            quality: format
        }).pipe(res);
    } catch (error) {
        console.error('Download error:', error);
        return res.status(500).send({ error: error.message });
    }
});

// app.post('/api/create-short', async (req, res) => {
//     try {
//         const { url, startTime, endTime } = req.body;
//         const outputPath = path.join(__dirname, 'temp', `short-${Date.now()}.mp4`);
        
//         const video = ytdl(url, { quality: 'highest' });
        
//         ffmpeg(video)
//             .setStartTime(startTime)
//             .setDuration(endTime - startTime)
//             .output(outputPath)
//             .on('end', () => {
//                 res.download(outputPath, 'short.mp4', () => {
//                     // Clean up temp file after download
//                     fs.unlinkSync(outputPath);
//                 });
//             })
//             .on('error', (err) => {
//                 console.error(err);
//                 res.status(500).json({ error: 'Error creating short' });
//             })
//             .run();
//     } catch (error) {
//         res.status(400).json({ error: error.message });
//     }
// });

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});