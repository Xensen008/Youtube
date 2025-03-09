const ytdl = require("@distube/ytdl-core");

/**
 * Get video information from YouTube
 */
exports.getVideoInfo = async (req, res) => {
    try {
        const { url } = req.query;
        
        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }
        
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
            description: info.videoDetails.description,
            thumbnails: info.videoDetails.thumbnails,
            author: info.videoDetails.author
        });
    } catch (error) {
        console.error('Error getting video info:', error.message);
        res.status(400).json({ error: error.message });
    }
};
