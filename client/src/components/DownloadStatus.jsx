import React, { useState, useEffect } from "react";

// Status badge component with animation
const StatusBadge = ({ status }) => {
  const statusConfig = {
    initializing: {
      color: "bg-blue-500",
      pulse: true,
      text: "INITIALIZING"
    },
    downloading: {
      color: "bg-blue-600",
      pulse: true,
      text: "DOWNLOADING"
    },
    processing: {
      color: "bg-yellow-600",
      pulse: true,
      text: "PROCESSING"
    },
    completed: {
      color: "bg-green-600",
      pulse: false,
      text: "COMPLETED"
    },
    error: {
      color: "bg-red-600",
      pulse: false,
      text: "FAILED"
    },
    finished: {
      color: "bg-green-700",
      pulse: false,
      text: "FINISHED"
    }
  };
  
  const config = statusConfig[status] || { color: "bg-gray-600", pulse: false, text: status.toUpperCase() };
  
  return (
    <span className={`
      px-2 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1
      ${config.color} ${config.pulse ? 'animate-pulse' : ''}
    `}>
      {config.pulse && (
        <span className="h-1.5 w-1.5 rounded-full bg-white inline-block"></span>
      )}
      {config.text}
    </span>
  );
};

// Visual progress indicator with cool animations
const ProgressIndicator = ({ status, progress, videoProgress, audioProgress }) => {
  // Track the previous progress value to animate properly
  const [displayProgress, setDisplayProgress] = useState(progress);
  
  // Update the displayed progress smoothly
  useEffect(() => {
    // If progress jumped by more than 10%, animate in steps
    if (progress > displayProgress + 10) {
      const timer = setInterval(() => {
        setDisplayProgress(prev => {
          if (prev + 2 >= progress) {
            clearInterval(timer);
            return progress;
          }
          return prev + 2;
        });
      }, 50);
      return () => clearInterval(timer);
    } else {
      setDisplayProgress(progress);
    }
  }, [progress]);

  // Progress color based on status
  const getProgressColor = () => {
    switch (status) {
      case 'downloading': return 'from-blue-600 to-blue-400';
      case 'processing': return 'from-yellow-500 to-yellow-300';
      case 'completed': 
      case 'finished': return 'from-green-600 to-green-400';
      case 'error': return 'from-red-600 to-red-400';
      default: return 'from-blue-500 to-blue-300';
    }
  };

  return (
    <div className="space-y-2">
      {/* Main progress bar with gradient and animation */}
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-gray-700 rounded-full h-2.5 overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-300 ease-out bg-gradient-to-r ${getProgressColor()}`}
            style={{ width: `${displayProgress}%` }}
          ></div>
        </div>
        <span className="text-xs font-mono font-bold text-white bg-gray-700 px-2 py-1 rounded-md">
          {displayProgress}%
        </span>
      </div>
      
      {/* Detailed progress bars for video and audio */}
      {status === 'downloading' && videoProgress !== undefined && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-gray-400">
              <span>Video</span>
              <span>{videoProgress}%</span>
            </div>
            <div className="bg-gray-700 rounded-full h-1.5">
              <div 
                className="bg-gradient-to-r from-blue-600 to-blue-400 h-full rounded-full transition-all duration-300"
                style={{ width: `${videoProgress}%` }}
              ></div>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-gray-400">
              <span>Audio</span>
              <span>{audioProgress}%</span>
            </div>
            <div className="bg-gray-700 rounded-full h-1.5">
              <div 
                className="bg-gradient-to-r from-purple-600 to-purple-400 h-full rounded-full transition-all duration-300"
                style={{ width: `${audioProgress}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}

      {/* Processing animation for merging */}
      {status === 'processing' && (
        <div className="flex items-center gap-2 text-xs text-yellow-400">
          <div className="flex gap-0.5">
            <div className="h-1 w-1 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="h-1 w-1 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="h-1 w-1 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
          <span>Merging video and audio...</span>
        </div>
      )}
    </div>
  );
};

const DownloadStatus = ({ downloadStatus }) => {
  if (Object.values(downloadStatus).length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-white/90 flex items-center gap-2">
          Downloads
          <span className="text-xs bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
            Live Status
          </span>
        </h3>
      </div>
      
      <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
        {Object.values(downloadStatus).map((download) => (
          <div 
            key={download.id} 
            className={`
              backdrop-blur-xl bg-white/5 rounded-xl border border-white/10 p-5
              hover:bg-white/10 transition-all duration-300
              ${download.status === 'error' ? 'border-red-500/50' : ''}
              ${download.status === 'completed' ? 'border-green-500/50' : ''}
              ${download.status === 'processing' ? 'border-yellow-500/50' : ''}
              ${download.status === 'downloading' ? 'border-purple-500/50' : ''}
              ${download.status === 'finished' ? 'border-green-500/50' : ''}
              ${download.status === 'initializing' ? 'border-blue-500/50' : ''}
            `}
          >
            {/* Header section with thumbnail and title */}
            <div className="flex items-start gap-4">
              {download.thumbnail ? (
                <img 
                  src={download.thumbnail} 
                  alt="Video thumbnail" 
                  className="w-16 h-16 rounded-md object-cover shadow-md"
                />
              ) : (
                <div className="w-16 h-16 rounded-md bg-gray-700 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
              
              <div className="flex-1 min-w-0">
                <div className="flex justify-between">
                  <h4 className="text-white font-medium text-base truncate max-w-[70%]">
                    {download.title || "Video Download"}
                  </h4>
                  <StatusBadge status={download.status} />
                </div>
                
                <div className="mt-1 flex flex-wrap gap-2">
                  <span className="text-gray-400 text-xs bg-gray-700 py-0.5 px-2 rounded-full">
                    {download.quality}
                  </span>
                  {download.status === 'downloading' && (
                    <span className="text-blue-300 text-xs bg-blue-900/50 py-0.5 px-2 rounded-full flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                      Downloading
                    </span>
                  )}
                  {download.status === 'processing' && (
                    <span className="text-yellow-300 text-xs bg-yellow-900/50 py-0.5 px-2 rounded-full flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 animate-spin" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                      </svg>
                      Processing
                    </span>
                  )}
                  {download.status === 'completed' && (
                    <span className="text-green-300 text-xs bg-green-900/50 py-0.5 px-2 rounded-full flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Ready
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            {/* Progress section */}
            <div className="mt-4">
              <ProgressIndicator 
                status={download.status}
                progress={download.progress}
                videoProgress={download.videoProgress}
                audioProgress={download.audioProgress}
              />
            </div>
            
            {/* Status message with icon */}
            <div className="mt-3 text-xs text-gray-300 flex items-center gap-2">
              {download.status === 'downloading' && (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                </svg>
              )}
              {download.status === 'processing' && (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              )}
              {(download.status === 'completed' || download.status === 'finished') && (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {download.status === 'error' && (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <span>{download.message}</span>
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 4px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.15);
        }
      `}</style>
    </div>
  );
};

export default DownloadStatus;
