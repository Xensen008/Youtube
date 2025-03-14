import axios from "axios";
import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import DownloadStatus from "./components/DownloadStatus";

const App = () => {
  const [urlValue, setUrlValue] = useState("");
  const [videoInfo, setVideoInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloadingFormat, setDownloadingFormat] = useState(null);
  const [socketId, setSocketId] = useState(null);
  const [downloadStatus, setDownloadStatus] = useState({});
  const [showPlatforms, setShowPlatforms] = useState(false);
  const socketRef = useRef(null);
  
  // Connect to WebSocket when component mounts
  useEffect(() => {
    const socket = io("http://localhost:5000");
    socketRef.current = socket;
    
    socket.on("connect", () => {
      setSocketId(socket.id);
    });
    
    socket.on("download:status", (status) => {
      setDownloadStatus(prevState => ({
        ...prevState,
        [status.id]: status
      }));
      
      // Auto-remove finished downloads after 30 seconds
      if (status.status === 'finished') {
        setTimeout(() => {
          setDownloadStatus(prevState => {
            const newState = { ...prevState };
            delete newState[status.id];
            return newState;
          });
        }, 30000);
      }
    });
    
    return () => {
      socket.disconnect();
    };
  }, []);

  // Download handlers
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
      
      // Check if this is an audio format
      const isAudioFormat = label?.toLowerCase().includes('audio');
      
      // Add error handling and timeout
      const downloadTimeout = setTimeout(() => {
        setDownloadingFormat(null);
        alert("Download failed to start. Please try again.");
      }, 10000);
      
      // Create the download URL
      const downloadUrl = `http://localhost:5000/api/download?url=${encodeURIComponent(urlValue)}&format=${format}`;
      console.log(`Starting ${isAudioFormat ? 'audio' : 'video'} download:`, format);
      
      // Trigger download
      window.location.href = downloadUrl;
      
      // Clear the timeout if download starts
      setTimeout(() => {
        clearTimeout(downloadTimeout);
        setDownloadingFormat(null);
      }, 3000);
    } catch (error) {
      console.error("Download error:", error);
      alert("Error downloading. Please try again.");
      setDownloadingFormat(null);
    }
  };

  const handleMergedDownload = async (videoFormat, audioFormat, quality) => {
    try {
      setDownloadingFormat(`${quality} HD`);
      window.location.href = `http://localhost:5000/api/download/merged?url=${urlValue}&videoFormat=${videoFormat}&audioFormat=${audioFormat}&socketId=${socketId}`;
      setTimeout(() => setDownloadingFormat(null), 1000);
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

  // Status badge component
  const StatusBadge = ({ status }) => {
    const statusColors = {
      initializing: "bg-blue-500",
      downloading: "bg-blue-600",
      processing: "bg-yellow-600",
      completed: "bg-green-600",
      error: "bg-red-600",
      finished: "bg-green-700"
    };
    
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[status] || "bg-gray-600"}`}>
        {status}
      </span>
    );
  };

  const PlatformsDialog = () => (
    <div className={`fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 transition-opacity duration-300 ${showPlatforms ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <div className="bg-gray-800 rounded-2xl border border-white/10 p-6 max-w-md w-full mx-4 shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-white">Supported Platforms</h3>
          <button
            onClick={() => setShowPlatforms(false)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
            <div className="w-10 h-10 flex items-center justify-center bg-red-500/10 rounded-lg">
              <svg className="w-6 h-6 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
              </svg>
            </div>
            <div>
              <h4 className="text-white font-medium">YouTube</h4>
              <p className="text-gray-400 text-sm">Download videos and audio</p>
            </div>
          </div>
          
          <p className="text-xs text-gray-400 mt-4">
            More platforms coming soon...
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0A0A0A] relative overflow-hidden">
      {/* Gradient spotlight effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[40vh] -left-[20vw] w-[80vw] h-[80vh] bg-purple-500/20 rounded-full blur-[120px]" />
        <div className="absolute -bottom-[40vh] -right-[20vw] w-[80vw] h-[80vh] bg-blue-500/20 rounded-full blur-[120px]" />
      </div>

      <div className="container mx-auto px-4 py-20 relative z-10">
        <div className="max-w-4xl mx-auto space-y-12">
          {/* Header with new button */}
          <div className="text-center space-y-4 mb-16">
            <h1 className="text-7xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 bg-clip-text text-transparent">
                MediaFlow
              </span>
            </h1>
            <div className="space-y-4">
              <p className="text-gray-400 text-lg">
                Stream your content, your way
              </p>
              <button
                onClick={() => setShowPlatforms(true)}
                className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-2 mx-auto"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                View supported platforms
              </button>
            </div>
          </div>

          {/* Platforms Dialog */}
          <PlatformsDialog />

          {/* Search Input in Modal-like container */}
          <div className="relative backdrop-blur-xl bg-white/5 rounded-2xl border border-white/10 p-8 shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-2xl" />
            <input
              type="text"
              placeholder="Paste video URL here..."
              value={urlValue}
              onChange={handleUrlChange}
              className="w-full px-4 py-3 bg-black/40 rounded-xl border border-white/10 text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-sm backdrop-blur-sm"
            />
          </div>

          {/* Download Status */}
          <DownloadStatus downloadStatus={downloadStatus} />

          {/* Loading State */}
          {loading && (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500 border-t-transparent"></div>
            </div>
          )}

          {/* Download Progress */}
          {downloadingFormat && (
            <div className="backdrop-blur-xl bg-white/5 rounded-xl border border-white/10 p-4 text-white text-center">
              <div className="flex items-center justify-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-purple-500 border-t-transparent"></div>
                <span className="text-sm">Preparing {downloadingFormat} download...</span>
              </div>
            </div>
          )}

          {/* Video Info */}
          {videoInfo && (
            <div className="backdrop-blur-xl bg-white/5 rounded-2xl border border-white/10 p-6 shadow-2xl">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Keep existing video preview section but update classes */}
                <div className="space-y-4">
                  <h2 className="text-xl font-medium text-white/90">
                    {videoInfo.title}
                  </h2>
                  <div className="aspect-video w-full rounded-xl overflow-hidden border border-white/10">
                    <iframe
                      src={getVideoEmbed(videoInfo.videoId)}
                      className="w-full h-full"
                      allowFullScreen
                      title={videoInfo.title}
                    />
                  </div>
                </div>

                {/* Update download options styling */}
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
          
          {/* Footer */}
          <div className="text-center text-gray-500 text-sm mt-12">
            <p>Download and convert media for personal use only.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
