import axios from "axios";
import React, { useState } from "react";

const App = () => {
  const [urlValue, setUrlValue] = useState("");
  const [data, setData] = useState(null);
  const [videoInfo, setVideoInfo] = useState(null);

  const handleUrlChange = async (e) => {
    const url = e.target.value;
    setUrlValue(url);
    setVideoInfo(null); // Reset video info when URL changes
    
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      try {
        const response = await axios.get(`http://localhost:5000/api/info?url=${url}`);
        const uniqueFormats = filterUniqueFormats(response.data.formats);
        setVideoInfo({
          ...response.data,
          formats: uniqueFormats
        });
      } catch (error) {
        console.error("Info error:", error);
      }
    }
  };

  const filterUniqueFormats = (formats) => {
    const qualityMap = new Map();
    
    return formats.filter(format => {
      if (!format.qualityLabel && !format.audioQuality) return false;
      
      const type = format.hasVideo ? 'video' : 'audio';
      const quality = format.qualityLabel || format.audioQuality;
      const key = `${type}-${quality}`;
      
      if (qualityMap.has(key)) return false;
      
      // Prefer mp4 over webm
      if (qualityMap.has(key) && format.mimeType.includes('mp4')) {
        qualityMap.set(key, format);
        return true;
      }
      
      qualityMap.set(key, format);
      return true;
    }).sort((a, b) => {
      // Sort video formats by resolution (high to low)
      if (a.height && b.height) {
        return b.height - a.height;
      }
      return 0;
    });
  };

  const getVideoEmbed = (videoId) => {
    return `https://www.youtube.com/embed/${videoId}`;
  };

  const handleDownload = async (format) => {
    try {
      window.location.href = `http://localhost:5000/api/download?url=${urlValue}&format=${format}`;
    } catch (error) {
      console.error("Download error:", error);
      alert("Error downloading video. Please try again.");
    }
  };

  return (
    <div className="bg-gradient-to-br from-gray-900 to-gray-800 min-h-screen">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-red-500 to-yellow-500">
              YouTube Downloader
            </h1>
            <p className="text-gray-400">Download your favorite videos in any format</p>
          </div>

          {/* Search Input */}
          <div className="bg-gray-800/50 p-6 rounded-xl backdrop-blur-sm">
            <input
              type="text"
              placeholder="Paste YouTube URL here..."
              value={urlValue}
              onChange={handleUrlChange}
              className="w-full p-4 bg-gray-700/50 rounded-lg border border-gray-600 text-white placeholder-gray-400 focus:ring-2 focus:ring-red-500 focus:border-transparent transition"
            />
          </div>

          {/* Video Info */}
          {videoInfo && (
            <div className="bg-gray-800/50 rounded-xl p-6 backdrop-blur-sm">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Video Preview */}
                <div className="space-y-4">
                  <h2 className="text-xl font-bold text-white">{videoInfo.title}</h2>
                  <div className="aspect-video w-full">
                    <iframe
                      src={getVideoEmbed(videoInfo.videoId)}
                      className="w-full h-full rounded-lg"
                      allowFullScreen
                      title={videoInfo.title}
                    />
                  </div>
                </div>

                {/* Download Options */}
                <div className="space-y-6">
                  {/* Video Formats */}
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-gray-300">Video Quality</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {videoInfo.formats
                        .filter(f => f.hasVideo)
                        .map((format, index) => (
                          <button
                            key={index}
                            onClick={() => handleDownload(format.itag)}
                            className="bg-gray-700 hover:bg-gray-600 p-3 rounded-lg text-white text-sm font-medium transition-colors flex items-center justify-center space-x-2"
                          >
                            <span>{format.qualityLabel}</span>
                            <span className="text-gray-400 text-xs">
                              {format.container}
                            </span>
                          </button>
                        ))}
                    </div>
                  </div>

                  {/* Audio Formats */}
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-gray-300">Audio Only</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {videoInfo.formats
                        .filter(f => !f.hasVideo)
                        .map((format, index) => (
                          <button
                            key={index}
                            onClick={() => handleDownload(format.itag)}
                            className="bg-gray-700 hover:bg-gray-600 p-3 rounded-lg text-white text-sm font-medium transition-colors"
                          >
                            {format.audioQuality.replace('AUDIO_QUALITY_', '')}
                          </button>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;