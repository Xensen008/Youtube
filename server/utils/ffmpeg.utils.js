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

module.exports = {
    ffmpeg,
    tempDir
};
