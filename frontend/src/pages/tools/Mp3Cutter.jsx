import React, { useRef, useState, useEffect } from "react";
import WaveformSelector from "../../components/WaveformSelector";
import { Music, Upload, Clock, BarChart3, Scissors, FileAudio, Download, RefreshCw, CornerDownLeft, CornerDownRight, Plus } from "lucide-react";
import config from "../../config";
import "./PlayButtonAnimation.css";

// Sử dụng API URL từ file cấu hình
const API_BASE_URL = config.API_URL;

export default function Mp3Cutter() {
  const [file, setFile] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [serverStatus, setServerStatus] = useState(null);  const [volume, setVolume] = useState(1.0);
  const [fadeIn, setFadeIn] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [volumeProfile, setVolumeProfile] = useState("uniform");
  const [customVolume, setCustomVolume] = useState({ start: 1.0, middle: 1.0, end: 1.0 });
  const [normalizeAudio, setNormalizeAudio] = useState(false);
  const [outputFormat, setOutputFormat] = useState("mp3");
  const [fadeInDuration, setFadeInDuration] = useState(3); // Default 3 seconds for fadeIn
  const [fadeOutDuration, setFadeOutDuration] = useState(3); // Default 3 seconds for fadeOut
  const [isDragging, setIsDragging] = useState(false); // Thêm state để theo dõi trạng thái kéo file
  const [isPlaying, setIsPlaying] = useState(false); // Track play state for button display
  const [loopPlayback, setLoopPlayback] = useState(false); // Loop mode for continuous playback
  
  const fileInputRef = useRef(null); // Thêm ref để có thể trigger file input từ khu vực drag-drop
  const startRef = useRef(0);
  const endRef = useRef(0);
  const waveformRef = useRef(null);
  const [displayStart, setDisplayStart] = useState(0);
  const [displayEnd, setDisplayEnd] = useState(0);
  const [currentPlayPosition, setCurrentPlayPosition] = useState(0);

  // Kiểm tra trạng thái backend khi component được tải
  useEffect(() => {
    async function checkServerStatus() {
      try {
        const response = await fetch(`${API_BASE_URL}/status`);
        if (response.ok) {
          setServerStatus('online');
          setError(null);
        } else {
          setServerStatus('error');
          setError('Backend server is not responding correctly');
        }
      } catch (err) {
        console.error("Cannot connect to backend:", err);
        setServerStatus('offline');
        setError('Cannot connect to backend server');
      }
    }
    
    checkServerStatus();
  }, []);

  // Debug useEffect để kiểm tra waveformRef khi component được khởi tạo
  useEffect(() => {
    if (waveformRef.current) {
      // Thêm timeout để đảm bảo WaveSurfer đã được khởi tạo đầy đủ
      setTimeout(() => {
        console.log("Initial check for waveformRef after timeout:", waveformRef.current);
        const methods = Object.keys(waveformRef.current || {});
        console.log("Available methods after timeout:", methods);
        
        // Kiểm tra WaveSurfer instance
        if (waveformRef.current.getWavesurferInstance) {
          const ws = waveformRef.current.getWavesurferInstance();
          console.log("WaveSurfer instance after timeout:", ws);
        }
        
        // Kiểm tra Region
        if (waveformRef.current.getRegion) {
          const region = waveformRef.current.getRegion();
          console.log("Current region after timeout:", region);
        }
      }, 500); // 500ms timeout
    }
  }, [file]);

  // Xử lý phím tắt
  useEffect(() => {
    if (!file) return;

    const handleKeyDown = (e) => {
      // Không kích hoạt phím tắt khi focus vào các element input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
        return;
      }

      // Ngăn chặn sự kiện scroll khi sử dụng phím mũi tên
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
      }

      if (!waveformRef.current) return;

      // Lấy instance WaveSurfer
      const wavesurferInstance = waveformRef.current.getWavesurferInstance?.();
      if (!wavesurferInstance) return;

      switch (e.key) {
        case ' ': // Space - Play/Pause
          if (waveformRef.current.togglePlayPause) {
            waveformRef.current.togglePlayPause();
          }
          break;
        
        case 'ArrowLeft': // Left Arrow - Di chuyển con trỏ lùi 1 giây
          if (e.shiftKey) {
            // Shift + Left Arrow - Lùi 5 giây
            const currentTime = wavesurferInstance.getCurrentTime();
            const newTime = Math.max(0, currentTime - 5);
            wavesurferInstance.seekTo(newTime / wavesurferInstance.getDuration());
          } else if (e.ctrlKey || e.metaKey) {
            // Ctrl/Cmd + Left Arrow - Đặt điểm bắt đầu tại vị trí con trỏ
            setRegionStart();
          } else {
            // Chỉ Left Arrow - Lùi 1 giây
            const currentTime = wavesurferInstance.getCurrentTime();
            const newTime = Math.max(0, currentTime - 1);
            wavesurferInstance.seekTo(newTime / wavesurferInstance.getDuration());
          }
          break;
        
        case 'ArrowRight': // Right Arrow - Di chuyển con trỏ tiến 1 giây
          if (e.shiftKey) {
            // Shift + Right Arrow - Tiến 5 giây
            const currentTime = wavesurferInstance.getCurrentTime();
            const newTime = Math.min(wavesurferInstance.getDuration(), currentTime + 5);
            wavesurferInstance.seekTo(newTime / wavesurferInstance.getDuration());
          } else if (e.ctrlKey || e.metaKey) {
            // Ctrl/Cmd + Right Arrow - Đặt điểm kết thúc tại vị trí con trỏ
            setRegionEnd();
          } else {
            // Chỉ Right Arrow - Tiến 1 giây
            const currentTime = wavesurferInstance.getCurrentTime();
            const newTime = Math.min(wavesurferInstance.getDuration(), currentTime + 1);
            wavesurferInstance.seekTo(newTime / wavesurferInstance.getDuration());
          }
          break;
          
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [file]);

  // Xử lý sự kiện kéo file vào khu vực
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (validateFile(droppedFile)) {
        setFile(droppedFile);
        setDownloadUrl("");
      }
    }
  };

  // Xử lý click vào khu vực kéo-thả để mở file dialog
  const handleAreaClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const validateFile = (file) => {
    const maxSize = 50 * 1024 * 1024;
    
    if (!file) return false;
    
    const isValidType = ["audio/mpeg", "audio/mp3"].includes(file.type);
    const isValidSize = file.size <= maxSize;
    
    if (!isValidType) {
      alert("❌ Invalid file type. Please upload an MP3 file.");
      return false;
    }
    
    if (!isValidSize) {
      alert(`❌ File is too large (${formatFileSize(file.size)}). Maximum size is ${formatFileSize(maxSize)}.`);
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Nếu đang phát nhạc thì tạm dừng trước khi cắt
    let wasPlaying = false;
    if (isPlaying && waveformRef.current && waveformRef.current.togglePlayPause) {
      console.log('[CUT] Audio is playing, pausing before cut...');
      waveformRef.current.togglePlayPause();
      setIsPlaying(false);
      wasPlaying = true;
    } else {
      console.log('[CUT] Audio is not playing, proceed to cut.');
    }
    setIsLoading(true);
    setDownloadUrl("");
    setError(null); // Reset lỗi

    if (!file || file.type !== "audio/mpeg") {
      alert("❌ Invalid MP3 file.");
      setIsLoading(false);
      return;
    }    // Kiểm tra thời lượng tối thiểu để áp dụng fade
    const duration = endRef.current - startRef.current;
    if ((fadeIn || fadeOut) && duration < 1) {
      alert("❌ Selected region is too short to apply fade effect (minimum 1 second required).");
      setIsLoading(false);
      return;
    }

    // Kiểm tra giá trị fade duration cho fadeInOut profile
    if (volumeProfile === "fadeInOut" && !(fadeIn || fadeOut)) {
      if (fadeInDuration + fadeOutDuration > duration) {
        // Hiển thị cảnh báo nhưng vẫn tiếp tục (backend sẽ điều chỉnh giá trị)
        console.warn(`Total fade duration (${fadeInDuration + fadeOutDuration}s) exceeds clip duration (${duration}s). Values will be adjusted.`);
      }
    }

    try {
      console.log(`Sending request to ${API_BASE_URL}/api/cut-mp3`);      console.log("Parameters:", {
        start: startRef.current,
        end: endRef.current,
        duration,
        volume,
        volumeProfile,
        fadeIn,
        fadeOut,
        fadeInDuration,
        fadeOutDuration,
        normalizeAudio,
        outputFormat
      });

      const formData = new FormData();
      formData.append("audio", file);
      formData.append("start", startRef.current);
      formData.append("end", endRef.current);
      formData.append("volume", volume);      formData.append("volumeProfile", volumeProfile);
      formData.append("customVolume", JSON.stringify(customVolume));
      formData.append("fadeIn", fadeIn.toString());
      formData.append("fadeOut", fadeOut.toString());
      formData.append("normalizeAudio", normalizeAudio.toString());
      formData.append("outputFormat", outputFormat);
      formData.append("fadeInDuration", fadeInDuration.toString());
      formData.append("fadeOutDuration", fadeOutDuration.toString());
      
      const res = await fetch(`${API_BASE_URL}/api/cut-mp3`, {
        method: "POST",
        body: formData,
      });
      
      if (!res.ok) {
        let errorData;
        try {
          errorData = await res.json();
        } catch (e) {
          errorData = { error: `Server error (${res.status})` };
        }
        throw new Error(errorData.error || `Server responded with status: ${res.status}`);
      }
      
      const data = await res.json();
      setDownloadUrl(`${API_BASE_URL}/output/${data.filename}`);
      // KHÔNG tự động phát lại sau khi cut, chỉ dừng ở vị trí hiện tại
      if (wasPlaying) {
        console.log('[CUT] Audio was playing, now paused after cut. User must press play to resume.');
      }
    } catch (err) {
      console.error("Error processing audio:", err);
      
      // Detailed error message based on error type
      let errorMessage = err.message || "Failed to connect to server.";
      if (errorMessage.includes("muxing queue")) {
        errorMessage = "Error processing large audio file. Try selecting a smaller region.";
      } else if (errorMessage.includes("fade")) {
        errorMessage = "Error applying fade effect. Try a different fade settings.";
      }
      
      setError(errorMessage);
      alert(`❌ ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegionChange = (start, end) => {
    startRef.current = start;
    endRef.current = end;
    setDisplayStart(start.toFixed(2));
    setDisplayEnd(end.toFixed(2));
  };

  const incrementRegionStart = () => {
    console.log("Calling incrementRegionStart");
    if (!waveformRef.current) {
      console.error("waveformRef is null");
      return;
    }

    const regionBounds = waveformRef.current.getRegionBounds();
    if (!regionBounds) {
      console.error("Region bounds not available");
      return;
    }

    const { start, end } = regionBounds;
    const newStart = start + 1;

    if (newStart >= end) {
      console.warn("Cannot increment start time: new start would exceed end time");
      return;
    }

    try {
      waveformRef.current.setRegionStart(newStart);
      startRef.current = newStart;
      setDisplayStart(newStart.toFixed(2));
      console.log("Region start incremented to:", newStart);
    } catch (err) {
      console.error("Error incrementing region start:", err);
    }
  };

  const forceUpdateWaveform = () => {
    if (waveformRef.current) {
      try {
        const currentPosition = waveformRef.current.wavesurferRef?.current?.getCurrentTime() || 0;
        
        // Thử cập nhật region trực tiếp theo nhiều cách
        if (waveformRef.current.wavesurferRef?.current && waveformRef.current.regionRef?.current) {
          try {
            // Cách 1: Cập nhật trực tiếp thuộc tính
            const region = waveformRef.current.regionRef.current;
            region.start = startRef.current;
            region.end = endRef.current;
            
            // Kích hoạt sự kiện redraw
            if (waveformRef.current.wavesurferRef.current.fireEvent) {
              waveformRef.current.wavesurferRef.current.fireEvent('region-updated', region);
            }
          } catch (err) {
            console.warn("Could not update region directly:", err);
          }
        }
        
        // Cập nhật volume và overlay
        if (typeof waveformRef.current.updateVolume === 'function') {
          waveformRef.current.updateVolume(currentPosition, true);
        }
        if (typeof waveformRef.current.drawVolumeOverlay === 'function') {
          waveformRef.current.drawVolumeOverlay();
        }
      } catch (err) {
        console.error("Error updating waveform:", err);
      }
    }
  };

  const renderVolumeOptions = () => {
    if (volumeProfile === "custom") {
      return (        <div className="space-y-4">
          {/* Hiển thị các thanh custom chỉ khi không có fade nào được bật */}
          {!(fadeIn || fadeOut) && (
            <>
              {/* Thêm thanh kéo Fade In Duration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 flex justify-between">
                  <span>Fade In Duration:</span> <span className="text-blue-600">{fadeInDuration}s</span>
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="10"
                  step="0.1"
                  value={fadeInDuration}
                  onChange={(e) => {
                    // Sử dụng handleFadeInDurationChange để đảm bảo tính nhất quán
                    handleFadeInDurationChange(parseFloat(e.target.value));
                  }}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>

              {/* Thêm thanh kéo Fade Out Duration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 flex justify-between">
                  <span>Fade Out Duration:</span> <span className="text-blue-600">{fadeOutDuration}s</span>
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="10"
                  step="0.1"
                  value={fadeOutDuration}
                  onChange={(e) => {
                    // Sử dụng handleFadeOutDurationChange để đảm bảo tính nhất quán
                    handleFadeOutDurationChange(parseFloat(e.target.value));
                  }}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>

              {["start", "middle", "end"].map((key) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 capitalize flex justify-between">
                    <span>{key}:</span> <span className="text-blue-600">{customVolume[key].toFixed(1)}x</span>
                  </label>
                  <input
                    type="range"
                    min="0.0"
                    max="3.0"
                    step="0.1"
                    value={customVolume[key]}
                    onChange={(e) => {
                      const newCustomVolume = { ...customVolume, [key]: parseFloat(e.target.value) };
                      setCustomVolume(newCustomVolume);
                      // Cập nhật UI ngay lập tức
                      if (waveformRef.current) {
                        if (typeof waveformRef.current.updateVolume === 'function') {
                          waveformRef.current.updateVolume(null, true, true);
                        }
                      }
                      setTimeout(forceUpdateWaveform, 10);
                    }}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
              ))}
            </>
          )}          
          {/* Hiển thị thanh điều chỉnh volume và thông báo khi có fade được bật */}
          {(fadeIn || fadeOut) && (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 flex justify-between">
                  <span>Volume:</span> <span className="text-blue-600">{volume.toFixed(1)}x</span>
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="3.0"
                  step="0.1"
                  value={volume}
                  onChange={(e) => {
                    const newVolume = parseFloat(e.target.value);
                    setVolume(newVolume);
                    // Cập nhật UI ngay lập tức
                    if (waveformRef.current) {
                      if (typeof waveformRef.current.updateVolume === 'function') {
                        waveformRef.current.updateVolume(null, true, true);
                      }
                    }
                    setTimeout(forceUpdateWaveform, 10);
                  }}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>              <div className="text-sm text-blue-600 mt-2 bg-blue-50 p-2 rounded-md border border-blue-100">
                {fadeIn && fadeOut ? "Chế độ Fade In & Out (2s) đang được bật" :
                 fadeIn ? "Chế độ Fade In (2s) đang được bật" :
                 "Chế độ Fade Out (2s) đang được bật"}. Các tùy chỉnh cụ thể đã bị ẩn.
              </div>
            </>
          )}
        </div>
      );
    }
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 flex justify-between">
          <span>Volume:</span> <span className="text-blue-600">{volume.toFixed(1)}x</span>
        </label>
        <input
          type="range"
          min="0.1"
          max="3.0"
          step="0.1"
          value={volume}
          onChange={(e) => {
            const newVolume = parseFloat(e.target.value);
            setVolume(newVolume);
            // Cập nhật UI ngay lập tức
            if (waveformRef.current) {
              if (typeof waveformRef.current.updateVolume === 'function') {
                waveformRef.current.updateVolume(null, true, true);
              }
            }
            setTimeout(forceUpdateWaveform, 10);
          }}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
      </div>
    );
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };
  const handleReset = () => {
    setVolume(1.0);
    setFadeIn(false);
    setFadeOut(false);
    setVolumeProfile("uniform");
    setCustomVolume({ start: 1.0, middle: 1.0, end: 1.0 });
    setNormalizeAudio(false);
    setFadeInDuration(3); // Reset fadeIn to default
    setFadeOutDuration(3); // Reset fadeOut to default
    
    if (waveformRef.current && 
        waveformRef.current.wavesurferRef && 
        waveformRef.current.wavesurferRef.current) {
      
      const ws = waveformRef.current.wavesurferRef.current;
      const duration = ws.getDuration();
      
      // Cập nhật trực tiếp refs và state
      startRef.current = 0;
      endRef.current = duration;
      setDisplayStart("0.00");
      setDisplayEnd(duration.toFixed(2));
      
      // Cập nhật UI
      handleRegionChange(0, duration);
      
      // Update fade durations through exposed API if available
      if (waveformRef.current.setFadeInDuration) {
        waveformRef.current.setFadeInDuration(3);
      }
      if (waveformRef.current.setFadeOutDuration) {
        waveformRef.current.setFadeOutDuration(3);
      }
      
      // Thử cập nhật trực tiếp thuộc tính region nếu có thể
      try {
        if (waveformRef.current.regionRef && waveformRef.current.regionRef.current) {
          const region = waveformRef.current.regionRef.current;
          region.start = 0;
          region.end = duration;
          
          // Kích hoạt sự kiện redraw
          if (ws.fireEvent) {
            ws.fireEvent('region-updated', region);
          }
        }
      } catch (err) {
        console.warn("Could not update region directly during reset:", err);
      }
    }
    
    setTimeout(forceUpdateWaveform, 20);
  };

  const setRegionStart = () => {
    console.log("Calling setRegionStart");
    
    // Kiểm tra kỹ lưỡng waveformRef
    if (!waveformRef.current) {
      console.error("waveformRef is null");
      return;
    }
    
    // Kiểm tra xem WaveSurfer instance đã được khởi tạo chưa
    const wavesurferInstance = waveformRef.current.getWavesurferInstance ? 
      waveformRef.current.getWavesurferInstance() : null;
    
    if (!wavesurferInstance) {
      console.error("WaveSurfer instance is not available");
      return;
    }
    
    try {
      // Lấy thời gian hiện tại từ instance WaveSurfer
      const currentTime = wavesurferInstance.getCurrentTime();
      console.log("Current time from wavesurfer instance:", currentTime);
      
      if (currentTime !== undefined && typeof waveformRef.current.setRegionStart === 'function') {
        // Gọi phương thức API đã được hiển thị
        waveformRef.current.setRegionStart(currentTime);
        
        // Cập nhật state và refs cho component cha
        startRef.current = currentTime;
        setDisplayStart(currentTime.toFixed(2));
        
        console.log("Region start updated to:", currentTime);
      } else {
        // Truy cập trực tiếp vào region nếu setRegionStart không khả dụng
        if (waveformRef.current.getRegion) {
          const region = waveformRef.current.getRegion();
          if (region) {
            const currentEnd = region.end;
            if (currentTime < currentEnd) {
              // Cập nhật trực tiếp
              if (region.setOptions) {
                region.setOptions({ start: currentTime });
              } else if (region.update) {
                region.update({ start: currentTime });
              } else {
                region.start = currentTime;
              }
              startRef.current = currentTime;
              setDisplayStart(currentTime.toFixed(2));
              console.log("Region start updated directly to:", currentTime);
            }
          }
        } else {
          console.error("Region is not accessible and setRegionStart is not available");
        }
      }
    } catch (err) {
      console.error("Error in setRegionStart:", err);
    }
  };

  const setRegionEnd = () => {
    console.log("Calling setRegionEnd");
    
    // Kiểm tra kỹ lưỡng waveformRef
    if (!waveformRef.current) {
      console.error("waveformRef is null");
      return;
    }
    
    // Kiểm tra xem WaveSurfer instance đã được khởi tạo chưa
    const wavesurferInstance = waveformRef.current.getWavesurferInstance ? 
      waveformRef.current.getWavesurferInstance() : null;
    
    if (!wavesurferInstance) {
      console.error("WaveSurfer instance is not available");
      return;
    }
    
    try {
      // Lấy thời gian hiện tại từ instance WaveSurfer
      const currentTime = wavesurferInstance.getCurrentTime();
      console.log("Current time from wavesurfer instance:", currentTime);
      
      if (currentTime !== undefined && typeof waveformRef.current.setRegionEnd === 'function') {
        // Gọi phương thức API đã được hiển thị
        waveformRef.current.setRegionEnd(currentTime);
        
        // Cập nhật state và refs cho component cha
        endRef.current = currentTime;
        setDisplayEnd(currentTime.toFixed(2));
        
        console.log("Region end updated to:", currentTime);
      } else {
        // Truy cập trực tiếp vào region nếu setRegionEnd không khả dụng
        if (waveformRef.current.getRegion) {
          const region = waveformRef.current.getRegion();
          if (region) {
            const currentStart = region.start;
            if (currentTime > currentStart) {
              // Cập nhật trực tiếp
              if (region.setOptions) {
                region.setOptions({ end: currentTime });
              } else if (region.update) {
                region.update({ end: currentTime });
              } else {
                region.end = currentTime;
              }
              endRef.current = currentTime;
              setDisplayEnd(currentTime.toFixed(2));
              console.log("Region end updated directly to:", currentTime);
            }
          }
        } else {
          console.error("Region is not accessible and setRegionEnd is not available");
        }
      }
    } catch (err) {
      console.error("Error in setRegionEnd:", err);
    }
  };

  // Update fadeDuration handlers
  const handleFadeInDurationChange = (duration) => {
    setFadeInDuration(duration);
    if (waveformRef.current) {
      // Cập nhật fade duration
      if (waveformRef.current.setFadeInDuration) {
        waveformRef.current.setFadeInDuration(duration);
      }
      
      // Đảm bảo cập nhật overlay volume
      if (waveformRef.current.drawVolumeOverlay) {
        waveformRef.current.drawVolumeOverlay();
      }
      
      // Kích hoạt update để thấy thay đổi ngay lập tức
      if (waveformRef.current.updateVolume) {
        waveformRef.current.updateVolume(null, true, true);
      }
      
      // Đảm bảo UI được cập nhật hoàn toàn
      setTimeout(forceUpdateWaveform, 10);
    }
  };

  const handleFadeOutDurationChange = (duration) => {
    setFadeOutDuration(duration);
    if (waveformRef.current) {
      // Cập nhật fade duration
      if (waveformRef.current.setFadeOutDuration) {
        waveformRef.current.setFadeOutDuration(duration);
      }
      
      // Đảm bảo cập nhật overlay volume
      if (waveformRef.current.drawVolumeOverlay) {
        waveformRef.current.drawVolumeOverlay();
      }
      
      // Kích hoạt update để thấy thay đổi ngay lập tức
      if (waveformRef.current.updateVolume) {
        waveformRef.current.updateVolume(null, true, true);
      }
      
      // Đảm bảo UI được cập nhật hoàn toàn
      setTimeout(forceUpdateWaveform, 10);
    }
  };

  // Thêm CSS cho switch toggle (nếu chưa có)
  const switchStyle = {
    display: 'inline-flex', alignItems: 'center', cursor: 'pointer', marginLeft: '1rem', marginRight: '1rem'
  };
  const switchInputStyle = {
    width: 0, height: 0, opacity: 0, position: 'absolute'
  };
  const switchSliderStyle = (checked) => ({
    display: 'inline-block', width: '36px', height: '20px', background: checked ? '#2563eb' : '#d1d5db', borderRadius: '9999px', position: 'relative', transition: 'background 0.2s', marginRight: '0.5rem'
  });
  const switchCircleStyle = (checked) => ({
    position: 'absolute', left: checked ? '18px' : '2px', top: '2px', width: '16px', height: '16px', background: '#fff', borderRadius: '50%', transition: 'left 0.2s'
  });

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl space-y-6">
        <header className="text-center">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">🎧 MP3 Cutter</h1>
          <p className="text-gray-600">Easily trim and customize your MP3 files.</p>
          
          {/* Server status indicator */}
          {serverStatus && (
            <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-2 
              ${serverStatus === 'online' ? 'bg-green-100 text-green-800' : 
                serverStatus === 'error' ? 'bg-yellow-100 text-yellow-800' : 
                'bg-red-100 text-red-800'}`}>
              <span className={`w-2 h-2 rounded-full mr-1.5 
                ${serverStatus === 'online' ? 'bg-green-500' : 
                  serverStatus === 'error' ? 'bg-yellow-500' : 
                  'bg-red-500'}`}></span>
              {serverStatus === 'online' ? 'Server Connected' : 
                serverStatus === 'error' ? 'Server Error' : 
                'Server Offline'}
            </div>
          )}
        </header>

        {/* Error message section with troubleshooting help */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            <p className="font-medium">Error: {error}</p>
            <div className="text-sm mt-2">
              <p className="font-semibold">Troubleshooting:</p>
              <ol className="list-decimal pl-5 mt-1 space-y-1">
                <li>Check if the backend server is running at {API_BASE_URL}</li>
                <li>Make sure you started the backend with <code className="bg-gray-100 px-1 py-0.5 rounded">npm start</code> in the backend folder</li>
                <li>Check if there are any firewall or network issues blocking the connection</li>
                <li>Refresh the page and try again</li>
              </ol>
            </div>
          </div>
        )}

        {!file ? (
          <div 
            className={`bg-white rounded-lg shadow-md p-10 flex flex-col items-center justify-center min-h-[300px] border-2 ${
              isDragging 
                ? 'border-blue-500 bg-blue-50 border-dashed' 
                : 'border-dashed border-blue-100'
            } transition-all duration-200 ease-in-out cursor-pointer`}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleAreaClick}
          >
            <Music className={`w-16 h-16 ${isDragging ? 'text-blue-600' : 'text-blue-500'} mb-4 transition-colors duration-200`} />
            <h2 className="text-xl font-semibold text-gray-700 mb-2">Upload MP3 File</h2>
            <p className="text-gray-500 mb-6 text-center">
              {isDragging ? 'Drop your MP3 file here' : 'Drag and drop your audio file here or click to browse'}
            </p>
            
            <label className={`inline-flex items-center px-6 py-3 ${
              isDragging ? 'bg-blue-700' : 'bg-blue-600'
            } text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors`}
            onClick={(e) => e.stopPropagation()}>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/mpeg"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f && validateFile(f)) {
                    setFile(f);
                    setDownloadUrl("");
                  }
                }}
              />
              <Upload className="w-5 h-5 mr-2" />
              Browse Files
            </label>
            <p className="mt-4 text-sm text-gray-500">Supported format: MP3 (Max size: 50MB)</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <FileAudio className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">{file.name}</h2>
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />Audio File</span>
                    {file.size && <span>{formatFileSize(file.size)}</span>}
                  </div>
                </div>
              </div>
            </div>
          
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-800">
                  <BarChart3 className="w-5 h-5 inline mr-2 text-blue-600" />
                  Waveform
                </h2>
                <div className="text-sm text-blue-600 font-medium flex items-center">
                  <span>Vùng chọn: {displayStart}s → {displayEnd}s</span>
                  {/* Switch FadeIn */}
                  <label style={switchStyle}>
                    <input
                      type="checkbox"
                      checked={fadeIn}
                      onChange={e => {
                        setFadeIn(e.target.checked);
                        setTimeout(() => {
                          if (waveformRef.current && typeof waveformRef.current.toggleFade === 'function') {
                            waveformRef.current.toggleFade(e.target.checked, fadeOut);
                          }
                          forceUpdateWaveform();
                        }, 50);
                        console.log('[UI] Fade In toggled:', e.target.checked);
                      }}
                      style={switchInputStyle}
                    />
                    <span style={switchSliderStyle(fadeIn)}>
                      <span style={switchCircleStyle(fadeIn)}></span>
                    </span>
                    <span className="ml-1">Fade In 2s</span>
                  </label>
                  {/* Switch FadeOut */}
                  <label style={switchStyle}>
                    <input
                      type="checkbox"
                      checked={fadeOut}
                      onChange={e => {
                        setFadeOut(e.target.checked);
                        setTimeout(() => {
                          if (waveformRef.current && typeof waveformRef.current.toggleFade === 'function') {
                            waveformRef.current.toggleFade(fadeIn, e.target.checked);
                          }
                          forceUpdateWaveform();
                        }, 50);
                        console.log('[UI] Fade Out toggled:', e.target.checked);
                      }}
                      style={switchInputStyle}
                    />
                    <span style={switchSliderStyle(fadeOut)}>
                      <span style={switchCircleStyle(fadeOut)}></span>
                    </span>
                    <span className="ml-1">Fade Out 2s</span>
                  </label>
                </div>
              </div>
                <WaveformSelector
                ref={waveformRef}
                audioFile={file}
                onRegionChange={handleRegionChange}
                fade={fadeIn || fadeOut}
                fadeIn={fadeIn}
                fadeOut={fadeOut}
                volumeProfile={volumeProfile}
                volume={volume}
                customVolume={customVolume}
                normalizeAudio={normalizeAudio}
                onTimeUpdate={setCurrentPlayPosition}
                theme="light"
                fadeInDuration={fadeInDuration}
                fadeOutDuration={fadeOutDuration}
                onPlayStateChange={setIsPlaying}
                loop={loopPlayback}
              />
              
              <div className="flex justify-center items-center mt-3 space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    if (waveformRef.current && waveformRef.current.togglePlayPause) {
                      waveformRef.current.togglePlayPause();
                    }
                  }}
                  className={`flex-shrink-0 flex items-center justify-center py-2 px-6 group
                    ${isPlaying 
                      ? 'bg-green-700 ring-2 ring-green-300 shadow-md' 
                      : 'bg-green-600 hover:bg-green-700'
                    } text-white rounded-lg transition-colors focus:outline-none relative overflow-hidden`}
                  title={isPlaying ? "Dừng phát" : "Phát vùng đã chọn"}
                >
                  {/* Đã xóa hiệu ứng pulse nền */}
                  
                  {isPlaying ? (
                    <>
                      <span className="font-medium flex items-center">
                        Đang phát
                        {/* Thanh sóng âm hoạt họa */}
                        <span className="ml-3 flex space-x-0.5 items-center">
                          <span className="animate-sound-wave inline-block w-0.5 h-2 bg-green-200 rounded-full will-change-transform"></span>
                          <span className="animate-sound-wave inline-block w-0.5 h-3 bg-green-200 rounded-full will-change-transform" style={{animationDelay: '0.1s'}}></span>
                          <span className="animate-sound-wave inline-block w-0.5 h-2.5 bg-green-200 rounded-full will-change-transform" style={{animationDelay: '0.2s'}}></span>
                          <span className="animate-sound-wave inline-block w-0.5 h-3.5 bg-green-200 rounded-full will-change-transform" style={{animationDelay: '0.3s'}}></span>
                          <span className="animate-sound-wave inline-block w-0.5 h-2 bg-green-200 rounded-full will-change-transform" style={{animationDelay: '0.4s'}}></span>
                          <span className="animate-sound-wave inline-block w-0.5 h-3 bg-green-200 rounded-full will-change-transform" style={{animationDelay: '0.5s'}}></span>
                          <span className="animate-sound-wave inline-block w-0.5 h-2.5 bg-green-200 rounded-full will-change-transform" style={{animationDelay: '0.6s'}}></span>
                        </span>
                      </span>
                    </>
                  ) : (
                    <>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 mr-2 group-hover:animate-pulse"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span className="font-medium">Phát</span>

                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setLoopPlayback(!loopPlayback)}
                  className={`flex items-center py-2 px-3 group relative overflow-hidden ${
                    loopPlayback 
                      ? 'bg-purple-600 hover:bg-purple-700 ring-2 ring-purple-300 shadow-lg shadow-purple-500/50' 
                      : 'bg-gray-600 hover:bg-gray-700'
                  } text-white rounded-lg transition-all`}
                  title={loopPlayback ? "Nhấn để dừng phát lặp lại" : "Phát lặp lại vùng đã chọn"}
                >
                  {/* Đã xóa hiệu ứng nền khi loop được kích hoạt */}
                  
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-5 w-5 mr-1 ${
                      loopPlayback && isPlaying ? 'animate-spin text-purple-200 animate-float' : 
                      loopPlayback ? 'text-purple-200' : 
                      'group-hover:animate-pulse'
                    }`}
                    style={{ 
                      animationDuration: loopPlayback && isPlaying ? '2s' : '0s',
                      animationTimingFunction: 'linear'
                    }}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  <span className="font-mono text-sm">
                    {loopPlayback ? "Dừng lặp" : "Lặp"}
                  </span>
                  {loopPlayback && (
                    <span className="ml-1 text-xs bg-purple-300 text-purple-900 px-1 rounded-full">
                      ON
                    </span>
                  )}
                  

                </button>
                <button
                  type="button"
                  onClick={incrementRegionStart}
                  className="flex items-center py-2 px-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors group relative"
                >
                  <Plus className="w-4 h-4 mr-1 group-hover:scale-110 transition-transform" />
                  <span className="font-mono text-sm">1s</span>

                </button>
                <button
                  type="button"
                  onClick={setRegionStart}
                  className="flex items-center py-2 px-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors group relative"
                >
                  <CornerDownLeft className="w-4 h-4 mr-1 group-hover:scale-110 transition-transform" />
                  <span className="font-mono text-sm">Set Start</span>

                </button>
                <button
                  type="button"
                  onClick={setRegionEnd}
                  className="flex items-center py-2 px-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors group relative"
                >
                  <span className="font-mono text-sm">Set End</span>
                  <CornerDownRight className="w-4 h-4 ml-1 group-hover:scale-110 transition-transform" />

                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">
                <Scissors className="w-5 h-5 inline mr-2 text-blue-600" />
                Audio Controls
              </h2>
              
              <div className="flex flex-col gap-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-gray-700">Volume Profile</h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      {["uniform", "fadeIn", "fadeOut", "fadeInOut", "custom"].map((v) => (
                        <label 
                          key={v} 
                          className={`flex items-center px-3 py-2 border rounded-md cursor-pointer ${
                            volumeProfile === v 
                              ? 'border-blue-500 bg-blue-50 text-blue-700' 
                              : 'border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          <input
                            type="radio"
                            name="volumeProfile"
                            value={v}
                            checked={volumeProfile === v}
                            onChange={() => {
                              setVolumeProfile(v);
                              setTimeout(forceUpdateWaveform, 10);
                            }}
                            className="h-4 w-4 text-blue-600 mr-2 hidden"
                          />
                          <span className="text-sm capitalize">{v}</span>
                        </label>
                      ))}
                    </div>
                    
                    {volumeProfile === "fadeInOut" && !(fadeIn || fadeOut) ? (
                      <div className="space-y-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 flex justify-between">
                            <span>Volume:</span> <span className="text-blue-600">{volume.toFixed(1)}x</span>
                          </label>
                          <input
                            type="range"
                            min="0.1"
                            max="3.0"
                            step="0.1"
                            value={volume}
                            onChange={(e) => {
                              setVolume(parseFloat(e.target.value));
                              setTimeout(forceUpdateWaveform, 10);
                            }}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 flex justify-between">
                            <span>Fade In Duration:</span> <span className="text-blue-600">{fadeInDuration}s</span>
                          </label>
                          <input
                            type="range"
                            min="0.1"
                            max="10"
                            step="0.1"
                            value={fadeInDuration}
                            onChange={(e) => {
                              handleFadeInDurationChange(parseFloat(e.target.value));
                              setTimeout(forceUpdateWaveform, 10);
                            }}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 flex justify-between">
                            <span>Fade Out Duration:</span> <span className="text-blue-600">{fadeOutDuration}s</span>
                          </label>
                          <input
                            type="range"
                            min="0.1"
                            max="10"
                            step="0.1"
                            value={fadeOutDuration}
                            onChange={(e) => {
                              handleFadeOutDurationChange(parseFloat(e.target.value));
                              setTimeout(forceUpdateWaveform, 10);
                            }}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                          />
                        </div>
                      </div>
                    ) : (
                      renderVolumeOptions()
                    )}
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-gray-700">Additional Options</h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <label className="flex items-center p-2 hover:bg-gray-100 rounded-md cursor-pointer">
                      <input
                        type="checkbox"
                        checked={normalizeAudio}
                        onChange={(e) => setNormalizeAudio(e.target.checked)}
                        className="h-4 w-4 text-blue-600 rounded accent-blue-600"
                      />
                      <span className="ml-2 text-sm text-gray-700">Normalize Audio</span>
                      {normalizeAudio && (
                        <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-800 text-xs font-medium rounded-full animate-pulse">
                          ENABLED
                        </span>
                      )}
                      <span className="ml-2 text-xs text-gray-500">
                        (Adjusts audio to streaming standards: -16 LUFS, -1.5 dBTP)
                      </span>
                    </label>
                    
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Output Format</label>
                      <select
                        value={outputFormat}
                        onChange={(e) => setOutputFormat(e.target.value)}
                        className="w-full py-2 px-3 bg-white border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="mp3">MP3</option>
                        <option value="m4r">M4R</option>
                        <option value="m4a">M4A</option>
                        <option value="wav">WAV</option>
                        <option value="aac">AAC</option>
                        <option value="ogg">OGG</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-3 mt-6">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleReset}
                        className="py-2 px-4 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors flex items-center justify-center"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Reset Settings
                      </button>
                      <button
                        type="submit"
                        disabled={isLoading}
                        className={`py-2 px-4 bg-blue-600 text-white rounded-lg transition-colors flex items-center justify-center flex-1 ${
                          isLoading ? "opacity-50 cursor-not-allowed" : "hover:bg-blue-700"
                        }`}
                      >
                        {isLoading ? (
                          <>
                            <svg
                              className="animate-spin h-5 w-5 mr-2"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              />
                            </svg>
                            Processing...
                          </>
                        ) : (
                          <>
                            <Scissors className="w-5 h-5 mr-2" />
                            Cut & Download
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {downloadUrl && (
              <div className="bg-white rounded-lg shadow-md p-6 text-center">
                <div className="flex items-center justify-center mb-4 text-green-600">
                  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none">
                    <path d="M7 13L10 16L17 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                  </svg>
                </div>
                <p className="text-gray-800 font-medium mb-4">Processing Complete!</p>
                <a
                  href={downloadUrl}
                  download
                  className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Download className="w-5 h-5 mr-2" />
                  Download {outputFormat.toUpperCase()}
                </a>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}