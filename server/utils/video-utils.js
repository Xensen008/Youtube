const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');

// Configure ffmpeg to use static binary
ffmpeg.setFfmpegPath(ffmpegStatic);

// Create temp directory if it doesn't exist
const tempDir = path.join(__dirname, '../temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

/**
 * Clean up old temp files that are over an hour old
 */
function cleanupOldTempFiles() {
    try {
        const files = fs.readdirSync(tempDir);
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        
        files.forEach(file => {
            const filePath = path.join(tempDir, file);
            try {
                const stats = fs.statSync(filePath);
                // Delete files older than 1 hour
                if (stats.isFile() && stats.mtimeMs < oneHourAgo) {
                    fs.unlinkSync(filePath);
                    console.log(`Deleted old temp file: ${file}`);
                }
            } catch (err) {
                console.error(`Error checking temp file ${file}:`, err);
            }
        });
    } catch (err) {
        console.error('Error during temp directory cleanup:', err);
    }
}

// Run cleanup every hour
setInterval(cleanupOldTempFiles, 60 * 60 * 1000);
// Run cleanup on startup as well
cleanupOldTempFiles();

console.log(`Temp directory configured at: ${tempDir}`);

/**
 * Get best audio format with fallback options
 */
exports.getBestAudioFormat = (formats) => {
    // First try dedicated audio formats
    const audioFormats = formats.filter(format => 
        format.hasAudio && !format.hasVideo
    );
    
    // Common audio itags in order of preference
    const preferredAudioItags = [251, 140, 250, 249, 171, 139];
    
    // Try to find a preferred format first
    for (const preferredItag of preferredAudioItags) {
        const format = audioFormats.find(f => parseInt(f.itag) === preferredItag);
        if (format) {
            console.log(`Found preferred audio format: ${format.itag}`);
            return format;
        }
    }
    
    // If no preferred format found, sort by bitrate
    if (audioFormats.length > 0) {
        const bestFormat = audioFormats.sort((a, b) => 
            (b.audioBitrate || 0) - (a.audioBitrate || 0)
        )[0];
        console.log(`Using best available audio format: ${bestFormat.itag}`);
        return bestFormat;
    }
    
    // Last resort: any format with audio
    const anyAudioFormat = formats.find(format => format.audioBitrate > 0);
    if (anyAudioFormat) {
        console.log(`Using fallback audio format: ${anyAudioFormat.itag}`);
        return anyAudioFormat;
    }
    
    console.warn('No suitable audio format found');
    return null;
};

module.exports = {
    ffmpeg,
    tempDir,
    getBestAudioFormat
};