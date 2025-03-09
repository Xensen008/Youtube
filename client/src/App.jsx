import axios from "axios";
import React, { useState } from "react";

const App = () => {
  const [urlValue, setUrlValue] = useState("");
  const [videoInfo, setVideoInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloadingFormat, setDownloadingFormat] = useState(null);

  const handleUrlChange = async (e) => {
    const url = e.target.value;
    setUrlValue(url);
    setVideoInfo(null);
    setLoading(false);
    
    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      setLoading(true);
      try {
        const response = await axios.get(
          `http://localhost:5000/api/info?url=${url}`
        );
        const uniqueFormats = filterUniqueFormats(response.data.formats);
        setVideoInfo({
          ...response.data,
          formats: uniqueFormats,
        });
      } catch (error) {
        console.error("Info error:", error);
      } finally {
        setLoading(false);
      }
    }
  };

  const filterUniqueFormats = (formats) => {
    const qualityMap = new Map();

    // First, find formats with both audio and video
    const combinedFormats = formats.filter(
      (format) => format.hasVideo && format.hasAudio
    );

    // Then handle separate video and audio formats
    const videoFormats = formats.filter(
      (format) => format.hasVideo && !format.hasAudio
    );
    const audioFormats = formats.filter(
      (format) => !format.hasVideo && format.hasAudio
    );

    return {
      combined: combinedFormats.sort((a, b) => b.height - a.height),
      video: videoFormats
        .filter((format) => {
          const key = `video-${format.qualityLabel}`;
          if (qualityMap.has(key)) return false;
          qualityMap.set(key, format);
          return true;
        })
        .sort((a, b) => b.height - a.height),
      audio: audioFormats.filter((format) => {
        const key = `audio-${format.audioQuality}`;
        if (qualityMap.has(key)) return false;
        qualityMap.set(key, format);
        return true;
      }),
    };
  };

  const getVideoEmbed = (videoId) => {
    return `https://www.youtube.com/embed/${videoId}`;
  };

  const handleDownload = async (format, label) => {
    try {
      setDownloadingFormat(label || "Video");
      window.location.href = `http://localhost:5000/api/download?url=${urlValue}&format=${format}`;
      setTimeout(() => setDownloadingFormat(null), 3000);
    } catch (error) {
      console.error("Download error:", error);
      alert("Error downloading video. Please try again.");
      setDownloadingFormat(null);
    }
  };

  const handleMergedDownload = async (videoFormat, audioFormat, quality) => {
    try {
      setDownloadingFormat(`${quality} HD`);
      window.location.href = `http://localhost:5000/api/download-merged?url=${urlValue}&videoFormat=${videoFormat}&audioFormat=${audioFormat}`;
      setTimeout(() => setDownloadingFormat(null), 5000);
    } catch (error) {
      console.error("Download error:", error);
      alert("Error downloading video. Please try again.");
      setDownloadingFormat(null);
    }
  };

  // Find best audio format
  const getBestAudioFormat = (formats) => {
    // Check if formats is the already processed object with 'audio' property
    if (formats.audio) {
      if (formats.audio.length === 0) return null;
      // Sort by bitrate (highest first) and return the best one
      return formats.audio.sort((a, b) => b.audioBitrate - a.audioBitrate)[0];
    }

    // Otherwise assume it's the raw formats array
    const audioFormats = formats.filter(
      (format) => format.hasAudio && !format.hasVideo
    );
    if (audioFormats.length === 0) return null;

    // Sort by bitrate (highest first) and return the best one
    return audioFormats.sort((a, b) => b.audioBitrate - a.audioBitrate)[0];
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
            <p className="text-gray-400">
              Download your favorite videos in any format
            </p>
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

          {/* Loading State */}
          {loading && (
            <div className="flex justify-center items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
            </div>
          )}

          {/* Download Progress */}
          {downloadingFormat && (
            <div className="bg-blue-900/50 p-4 rounded-lg text-white text-center">
              <div className="flex items-center justify-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Preparing {downloadingFormat} download...</span>
              </div>
            </div>
          )}

          {/* Video Info */}
          {videoInfo && (
            <div className="bg-gray-800/50 rounded-xl p-6 backdrop-blur-sm">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Video Preview */}
                <div className="space-y-4">
                  <h2 className="text-xl font-bold text-white">
                    {videoInfo.title}
                  </h2>
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
                  {/* All Video Formats (With Audio) */}
                  <div className="space-y-3">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      Video with Audio
                      <span className="text-xs bg-green-700/50 px-2 py-0.5 rounded-full">All formats include audio</span>
                    </h3>
                    
                    {/* First show standard formats that already have audio */}
                    {videoInfo.formats.combined.length > 0 && (
                      <div className="space-y-1">
                        <h4 className="text-sm font-medium text-gray-300">Standard Quality</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {videoInfo.formats.combined.map((format, index) => (
                            <button
                              key={index}
                              onClick={() => handleDownload(format.itag, `${format.qualityLabel} Standard`)}
                              className="bg-green-700 hover:bg-green-600 p-3 rounded-lg text-white text-sm font-medium transition-colors flex flex-col items-center justify-center"
                            >
                              <span>{format.qualityLabel}</span>
                              <span className="text-gray-200 text-xs">
                                {format.container}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Then show high quality formats with merged audio */}
                    {videoInfo.formats.video.length > 0 && (
                      <div className="space-y-1 mt-3">
                        <h4 className="text-sm font-medium text-gray-300">High Definition</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {videoInfo.formats.video.map((format, index) => {
                            const bestAudio = getBestAudioFormat(
                              videoInfo.formats.audio.length > 0
                                ? { audio: videoInfo.formats.audio }
                                : videoInfo.formats
                            );
                            
                            return (
                              <button
                                key={index}
                                onClick={() =>
                                  handleMergedDownload(
                                    format.itag,
                                    bestAudio.itag,
                                    format.qualityLabel
                                  )
                                }
                                className="bg-green-700 hover:bg-green-600 p-3 rounded-lg text-white text-sm font-medium transition-colors flex flex-col items-center"
                              >
                                <span className="font-medium">{format.qualityLabel}</span>
                                <div className="flex items-center gap-1 text-xs text-gray-200">
                                  <span>{format.container}</span>
                                  {format.height >= 1080 && (
                                    <span className="bg-yellow-600 px-1.5 rounded-sm">HD</span>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-xs text-gray-400 italic">
                          HD videos include high-quality audio automatically
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Audio Formats */}
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-gray-300">
                      Audio Only
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {videoInfo.formats.audio.map((format, index) => (
                        <button
                          key={index}
                          onClick={() => handleDownload(format.itag, `Audio ${format.audioQuality.replace("AUDIO_QUALITY_", "")}`)}
                          className="bg-purple-800 hover:bg-purple-700 p-3 rounded-lg text-white text-sm font-medium transition-colors"
                        >
                          {format.audioQuality.replace("AUDIO_QUALITY_", "")}
                          {format.audioBitrate && <span className="block text-xs">{format.audioBitrate} kbps</span>}
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
