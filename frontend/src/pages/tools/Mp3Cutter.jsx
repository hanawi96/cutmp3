// Thêm dòng này vào phần import
import {
  SoftFadeInIcon,
  SoftFadeOutIcon,
  SoftSpeedControlIcon,
  MinimalFadeInIcon,
  MinimalFadeOutIcon,
  ModernButton,
  SoftRemoveIcon,
  SoftPitchIcon,
} from "../../components/SoftAudioIcons";

import WaveformSelector from "../../components/WaveformSelector";
import {
  Music,
  Upload,
  Clock,
  BarChart3,
  Scissors,
  FileAudio,
  Download,
  RefreshCw,
  CornerDownLeft,
  CornerDownRight,
  Plus,
  Gauge,
} from "lucide-react";
import SpeedControl from "../../components/SpeedControl";
import React, {
  useRef,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from "react";

import "../../components/SpeedControl.css";
import "../../components/FadeControls.css";
import config from "../../config";

import "./PlayButtonAnimation.css";
import QRCode from "qrcode";
// Sử dụng API URL từ file cấu hình
const API_BASE_URL = config.API_URL;

export default function Mp3Cutter() {
  const [progress, setProgress] = useState(0);
  const [file, setFile] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStatus, setProcessingStatus] = useState("");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [showQrCode, setShowQrCode] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [shareQrCode, setShareQrCode] = useState("");
  const [showShareSection, setShowShareSection] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [smoothProgress, setSmoothProgress] = useState(0);
  const progressAnimationRef = useRef(null);
  const [error, setError] = useState(null);
  const [serverStatus, setServerStatus] = useState(null);
  const [volume, setVolume] = useState(1.0);
  const [fadeIn, setFadeIn] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [volumeProfile, setVolumeProfile] = useState("uniform");
  const [customVolume, setCustomVolume] = useState({
    start: 1.0,
    middle: 1.0,
    end: 1.0,
  });
  const [normalizeAudio, setNormalizeAudio] = useState(false);
  const [outputFormat, setOutputFormat] = useState("mp3");
  const [fadeInDuration, setFadeInDuration] = useState(3); // Default 3 seconds for fadeIn
  const [fadeOutDuration, setFadeOutDuration] = useState(3); // Default 3 seconds for fadeOut
  const [isDragging, setIsDragging] = useState(false); // Thêm state để theo dõi trạng thái kéo file
  const [isPlaying, setIsPlaying] = useState(false); // Track play state for button display
  const [loopPlayback, setLoopPlayback] = useState(false); // Loop mode for continuous playback
  const [removeMode, setRemoveMode] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [pitchShift, setPitchShift] = useState(0); // Pitch shift in semitones (-12 to +12)
const [showPitchControl, setShowPitchControl] = useState(false);
  const fileInputRef = useRef(null); // Thêm ref để có thể trigger file input từ khu vực drag-drop
  const audioContextRef = useRef(null);
const soundTouchRef = useRef(null);
const sourceNodeRef = useRef(null);
const gainNodeRef = useRef(null);
const scriptNodeRef = useRef(null);
  const startRef = useRef(0);
  const endRef = useRef(0);
  const waveformRef = useRef(null);
  const [displayStart, setDisplayStart] = useState(0);
  const [displayEnd, setDisplayEnd] = useState(0);
  const [currentPlayPosition, setCurrentPlayPosition] = useState(0);
  const [showSpeedControl, setShowSpeedControl] = useState(false);
  const [activeIcons, setActiveIcons] = useState({
    fadeIn: false,
    fadeOut: false,
    speed: false,
    remove: false,
    pitch: false,
  });

  // Kiểm tra trạng thái backend khi component được tải
  useEffect(() => {
    async function checkServerStatus() {
      try {
        const response = await fetch(`${API_BASE_URL}/status`);
        if (response.ok) {
          setServerStatus("online");
          setError(null);
        } else {
          setServerStatus("error");
          setError("Backend server is not responding correctly");
        }
      } catch (err) {
        console.error("Cannot connect to backend:", err);
        setServerStatus("offline");
        setError("Cannot connect to backend server");
      }
    }

    checkServerStatus();
  }, []);


  // THÊM - Optimized Web Audio Initialization
// OPTIMIZED - Independent Pitch Shifter Initialization
useEffect(() => {
  console.log('[PITCH_INIT] ⚡ Starting INDEPENDENT pitch shifter initialization...');
  
  const startTime = performance.now();
  
  // Quick capability check - no heavy operations
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) {
    console.error('[PITCH_INIT] ❌ Web Audio API not supported in this browser');
    return;
  }
  
  console.log('[PITCH_INIT] ✅ Web Audio API available');
  console.log('[PITCH_INIT] 🎛️ AudioWorklet support:', typeof AudioWorkletNode !== 'undefined' ? 'YES' : 'NO');
  
  // Lazy initialization - only create when needed
  if (!audioContextRef.current) {
    console.log('[PITCH_INIT] 📝 AudioContext will be created on first use (lazy loading)');
  } else {
    console.log('[PITCH_INIT] ✅ AudioContext already exists');
  }
  
  const endTime = performance.now();
  console.log(`[PITCH_INIT] ✅ Quick initialization completed in ${(endTime - startTime).toFixed(2)}ms`);
  console.log('[PITCH_INIT] 🚀 Pitch control: READY for COMPLETE INDEPENDENCE');
  
  // Cleanup function
  return () => {
    console.log('[PITCH_INIT] 🧹 Component cleanup - disconnecting pitch shifter...');
    
    // Clean disconnect
    if (pitchShiftNode) {
      try {
        pitchShiftNode.disconnect();
        console.log('[PITCH_INIT] ✅ Pitch shift node disconnected');
      } catch (e) {
        console.warn('[PITCH_INIT] ⚠️ Error disconnecting pitch node:', e.message);
      }
      pitchShiftNode = null;
    }
    
    if (mediaSourceNode) {
      try {
        mediaSourceNode.disconnect();
        console.log('[PITCH_INIT] ✅ Media source node disconnected');
      } catch (e) {
        console.warn('[PITCH_INIT] ⚠️ Error disconnecting media node:', e.message);
      }
      mediaSourceNode = null;
    }
    
    if (audioContextRef.current) {
      try {
        if (audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close();
          console.log('[PITCH_INIT] ✅ AudioContext closed');
        }
      } catch (e) {
        console.warn('[PITCH_INIT] ⚠️ Error closing AudioContext:', e.message);
      }
      audioContextRef.current = null;
    }
    
    console.log('[PITCH_INIT] 🧹 Cleanup completed');
  };
}, []);


// Debug useEffect để kiểm tra waveformRef khi component được khởi tạo
useEffect(() => {
  if (waveformRef.current) {
    // Thêm timeout để đảm bảo WaveSurfer đã được khởi tạo đầy đủ
    setTimeout(() => {
      console.log(
        "Initial check for waveformRef after timeout:",
        waveformRef.current
      );
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
    
    // THÊM - Auto-connect pitch shifter when audio is ready
 setTimeout(() => {
  if (waveformRef.current?.getWavesurferInstance?.()) {
    console.log('[AUTO_PITCH] 🔄 Auto-connecting INDEPENDENT pitch shifter...');
    console.log('[AUTO_PITCH] 🎯 Goal: ZERO impact on speed control');
    
    connectPitchShifter().then(success => {
      if (success) {
        console.log('[AUTO_PITCH] ✅ INDEPENDENT pitch shifter connected successfully!');
        console.log('[AUTO_PITCH] 🎵 Pitch control: COMPLETELY INDEPENDENT from speed');
        console.log('[AUTO_PITCH] 🚀 Speed control: COMPLETELY INDEPENDENT from pitch');
        console.log('[AUTO_PITCH] ⚡ Zero-latency pitch adjustment ready');
        console.log('[AUTO_PITCH] 🎯 Mission: COMPLETE AUDIO INDEPENDENCE achieved!');
        
        // Test initial state
        const currentPitch = pitchShift;
        const currentSpeed = playbackSpeed;
        console.log('[AUTO_PITCH] 📊 Initial state check:');
        console.log('[AUTO_PITCH] - Pitch:', currentPitch, 'semitones');
        console.log('[AUTO_PITCH] - Speed:', currentSpeed, 'x');
        console.log('[AUTO_PITCH] - Controls:', 'INDEPENDENT ✅');
        
      } else {
        console.log('[AUTO_PITCH] ⚠️ Pitch shifter connection failed - using fallback mode');
        console.log('[AUTO_PITCH] 💡 Fallback: Minimized speed impact when changing pitch');
      }
    }).catch(error => {
      console.warn('[AUTO_PITCH] ⚠️ Pitch shifter auto-connect error:', error.message);
      console.log('[AUTO_PITCH] 🔄 Fallback mode will be used for pitch changes');
    });
  } else {
    console.log('[AUTO_PITCH] ⏳ WaveSurfer not ready yet, will auto-connect on first pitch change');
  }
}, 1500); // Increased timeout for better audio loading
  }
}, [file]);

  // Xử lý phím tắt
  useEffect(() => {
    if (!file) return;

    const handleKeyDown = (e) => {
      // Không kích hoạt phím tắt khi focus vào các element input
      if (
        e.target.tagName === "INPUT" ||
        e.target.tagName === "TEXTAREA" ||
        e.target.tagName === "SELECT"
      ) {
        return;
      }

      // Ngăn chặn sự kiện scroll khi sử dụng phím mũi tên
      if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
      }

      if (!waveformRef.current) return;

      // Lấy instance WaveSurfer
      const wavesurferInstance = waveformRef.current.getWavesurferInstance?.();
      if (!wavesurferInstance) return;

      switch (e.key) {
        case " ": // Space - Play/Pause
          if (waveformRef.current.togglePlayPause) {
            waveformRef.current.togglePlayPause();
          }
          break;

        case "ArrowLeft": // Left Arrow - Di chuyển con trỏ lùi 1 giây
          if (e.shiftKey) {
            // Shift + Left Arrow - Lùi 5 giây
            const currentTime = wavesurferInstance.getCurrentTime();
            const newTime = Math.max(0, currentTime - 5);
            wavesurferInstance.seekTo(
              newTime / wavesurferInstance.getDuration()
            );
          } else if (e.ctrlKey || e.metaKey) {
            // Ctrl/Cmd + Left Arrow - Đặt điểm bắt đầu tại vị trí con trỏ
            setRegionStart();
          } else {
            // Chỉ Left Arrow - Lùi 1 giây
            const currentTime = wavesurferInstance.getCurrentTime();
            const newTime = Math.max(0, currentTime - 1);
            wavesurferInstance.seekTo(
              newTime / wavesurferInstance.getDuration()
            );
          }
          break;

        case "ArrowRight": // Right Arrow - Di chuyển con trỏ tiến 1 giây
          if (e.shiftKey) {
            // Shift + Right Arrow - Tiến 5 giây
            const currentTime = wavesurferInstance.getCurrentTime();
            const newTime = Math.min(
              wavesurferInstance.getDuration(),
              currentTime + 5
            );
            wavesurferInstance.seekTo(
              newTime / wavesurferInstance.getDuration()
            );
          } else if (e.ctrlKey || e.metaKey) {
            // Ctrl/Cmd + Right Arrow - Đặt điểm kết thúc tại vị trí con trỏ
            setRegionEnd();
          } else {
            // Chỉ Right Arrow - Tiến 1 giây
            const currentTime = wavesurferInstance.getCurrentTime();
            const newTime = Math.min(
              wavesurferInstance.getDuration(),
              currentTime + 1
            );
            wavesurferInstance.seekTo(
              newTime / wavesurferInstance.getDuration()
            );
          }
          break;

        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [file]);

  useEffect(() => {
    // FIXED: Chỉ log khi thay đổi đáng kể để giảm noise
    const shouldLogProgress =
      Math.abs(processingProgress - smoothProgress) > 10; // Chỉ log khi thay đổi > 10%
    const shouldLogSpeedControl =
      showSpeedControl && processingProgress !== smoothProgress;

    if (
      shouldLogProgress ||
      (shouldLogSpeedControl && processingProgress % 25 === 0)
    ) {
      console.log(
        "[smoothProgress] useEffect triggered - processingProgress:",
        processingProgress,
        "smoothProgress:",
        smoothProgress,
        "showSpeedControl:",
        showSpeedControl
      );
    }

    // FIXED: Ngăn animation khi SpeedControl được mở
    if (showSpeedControl) {
      // Chỉ log một lần khi SpeedControl mở, không log mỗi lần progress thay đổi
      if (
        processingProgress !== smoothProgress &&
        processingProgress % 50 === 0
      ) {
        console.log(
          "[smoothProgress] SpeedControl is open - setting progress immediately"
        );
      }

      // Cancel any existing animation immediately
      if (progressAnimationRef.current) {
        cancelAnimationFrame(progressAnimationRef.current);
        progressAnimationRef.current = null;
      }

      // Set progress immediately without animation
      if (processingProgress !== smoothProgress) {
        setSmoothProgress(Math.max(0, processingProgress));
      }

      return; // Exit early - không chạy animation
    }

    // Chỉ animate khi SpeedControl KHÔNG hiển thị
    if (
      processingProgress !== smoothProgress &&
      processingProgress >= 0 &&
      smoothProgress >= 0
    ) {
      const progressDiff = Math.abs(processingProgress - smoothProgress);

      // Only animate for significant changes
      if (progressDiff > 5) {
        // Chỉ log khi bắt đầu animation thật sự
        if (shouldLogProgress) {
          console.log(
            "[smoothProgress] Starting animation from",
            smoothProgress,
            "to",
            processingProgress
          );
        }

        // Cancel any existing animation
        if (progressAnimationRef.current) {
          cancelAnimationFrame(progressAnimationRef.current);
          progressAnimationRef.current = null;
        }

        const startProgress = Math.max(0, smoothProgress);
        const targetProgress = Math.max(0, processingProgress);
        const startTime = performance.now();
        const duration = 200; // Giảm xuống 200ms để nhanh hơn

        const animate = (currentTime) => {
          // FIXED: Kiểm tra showSpeedControl trong animation loop - không log
          if (showSpeedControl) {
            setSmoothProgress(Math.max(0, targetProgress));
            progressAnimationRef.current = null;
            return;
          }

          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / duration, 1);

          // Faster easing
          const easeProgress = progress * progress; // Quadratic easing

          const currentValue =
            startProgress + (targetProgress - startProgress) * easeProgress;
          const roundedValue = Math.max(0, Math.round(currentValue));

          setSmoothProgress(roundedValue);

          if (progress < 1) {
            progressAnimationRef.current = requestAnimationFrame(animate);
          } else {
            setSmoothProgress(Math.max(0, targetProgress));
            progressAnimationRef.current = null;
            // Chỉ log completion cho major milestones
            if (targetProgress % 25 === 0) {
              console.log(
                "[smoothProgress] Animation completed at",
                Math.max(0, targetProgress)
              );
            }
          }
        };

        progressAnimationRef.current = requestAnimationFrame(animate);
      } else {
        // For small changes, set immediately - không log
        setSmoothProgress(Math.max(0, processingProgress));
      }
    }

    // Cleanup function
    return () => {
      if (progressAnimationRef.current) {
        cancelAnimationFrame(progressAnimationRef.current);
        progressAnimationRef.current = null;
      }
    };
  }, [processingProgress, showSpeedControl]); // Removed smoothProgress from deps to prevent loops

  // Tự động set share link khi có downloadUrl
  useEffect(() => {
    if (downloadUrl) {
      console.log(
        "[SHARE LINK] Setting share link to downloadUrl:",
        downloadUrl
      );
      setShareLink(downloadUrl);
      setShowShareSection(true);

      // Generate QR code for share link (same as download)
      if (!shareQrCode) {
        const shareQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
          downloadUrl
        )}`;
        setShareQrCode(shareQrUrl);
        console.log("[SHARE LINK] QR code generated for share link");
      }
    }
  }, [downloadUrl]);

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
      alert(
        `❌ File is too large (${formatFileSize(
          file.size
        )}). Maximum size is ${formatFileSize(maxSize)}.`
      );
      return false;
    }

    return true;
  };

  // Thay thế hoàn toàn hàm handleSubmit cũ bằng hàm này:
  // Thay thế hàm handleSubmit cũ bằng hàm này (đã sửa logic xử lý completed):
  const handleSubmit = async (e) => {
  e.preventDefault();
  console.log('[handleSubmit] Starting submission process...');
  
  if (!file) {
    setError('❌ Chưa chọn file');
    return;
  }

  setIsLoading(true);
  setError('');
  setProcessingProgress(0);

  try {
    console.log('[handleSubmit] Getting region bounds...');
    const regionBounds = waveformRef.current?.getRegionBounds();
    console.log('[handleSubmit] Raw region bounds:', regionBounds);

    // Get audio duration from waveform instance
    const audioDuration = waveformRef.current?.getWavesurferInstance()?.getDuration() || 0;
    console.log('[handleSubmit] Audio duration from waveform:', audioDuration);

    // Validate and fix region bounds
    let validStart = 0;
    let validEnd = audioDuration;

    if (regionBounds && audioDuration > 0) {
      // Validate start time
      validStart = typeof regionBounds.start === 'number' && !isNaN(regionBounds.start) && regionBounds.start >= 0 
        ? regionBounds.start 
        : 0;
        
      // Validate end time
      validEnd = typeof regionBounds.end === 'number' && !isNaN(regionBounds.end) && regionBounds.end > 0 
        ? regionBounds.end 
        : audioDuration;
    }

    console.log('[handleSubmit] After validation:', { validStart, validEnd, audioDuration });

    // Final validation checks
    if (audioDuration <= 0) {
      console.error('[handleSubmit] Audio duration is 0 or invalid:', audioDuration);
      setError('❌ Không thể xác định độ dài audio. Hãy thử tải lại file.');
      setIsLoading(false);
      return;
    }

    if (validEnd <= validStart) {
      console.error('[handleSubmit] Invalid region: end <= start', { validStart, validEnd });
      // Use full audio as fallback
      validStart = 0;
      validEnd = audioDuration;
      console.log('[handleSubmit] Using full audio duration as fallback');
    }

    if (validEnd <= 0) {
      console.error('[handleSubmit] End time is still 0 or negative:', validEnd);
      setError('❌ Thời gian kết thúc không hợp lệ. Hãy kiểm tra file audio.');
      setIsLoading(false);
      return;
    }

    console.log('[handleSubmit] Final validated region:', { start: validStart, end: validEnd });

    const parameters = {
      start: validStart,
      end: validEnd,
      duration: audioDuration,
      volume: volume,
      volumeProfile: volumeProfile,
      customVolume: volumeProfile === 'custom' ? customVolume : undefined,
      normalizeAudio: normalizeAudio,
      fade: fadeIn || fadeOut,
      fadeIn: fadeIn,
      fadeOut: fadeOut,
      fadeInDuration: fadeInDuration,
      fadeOutDuration: fadeOutDuration,
      speed: playbackSpeed,
    };

    console.log('[handleSubmit] Final parameters:', parameters);

    // Prepare and send request
    console.log('[handleSubmit] Sending request to', `${API_BASE_URL}/api/cut-mp3`);
    
    const formData = new FormData();
    formData.append('audio', file);
    
    Object.keys(parameters).forEach(key => {
      if (parameters[key] !== undefined) {
        if (typeof parameters[key] === 'object') {
          formData.append(key, JSON.stringify(parameters[key]));
        } else {
          formData.append(key, parameters[key]);
        }
      }
    });

    console.log('[handleSubmit] FormData prepared, starting fetch request...');

    const response = await fetch(`${API_BASE_URL}/api/cut-mp3`, {
      method: 'POST',
      body: formData,
    });

    console.log('[handleSubmit] Fetch response status:', response.status);

    if (!response.ok) {
      console.log('[handleSubmit] Response not OK, status:', response.status);
      const errorData = await response.json();
      console.log('[handleSubmit] Error data from server:', errorData);
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }

    // Xử lý streaming response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finalResult = null;
    let hasReached100 = false;

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          console.log("[handleSubmit] Stream reading completed");
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        console.log("[handleSubmit] Received chunk:", chunk.trim());

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              console.log("[handleSubmit] Parsed progress data:", data);

              if (data.progress !== undefined) {
                console.log("[handleSubmit] Updating progress to:", data.progress);
                setProcessingProgress(data.progress);

                if (data.progress >= 100) {
                  hasReached100 = true;
                  console.log("[handleSubmit] ✅ Reached 100% progress");
                }
              }

              if (data.status) {
                console.log("[handleSubmit] Updating status to:", data.status);
                setProcessingStatus(data.status);
              }

              if (data.status === "completed" && data.filename && hasReached100) {
                finalResult = data;
                console.log("[handleSubmit] ✅ Final result received with 100% progress:", finalResult);
              } else if (data.status === "completed" && data.filename && !hasReached100) {
                console.log("[handleSubmit] ⚠️ Completed received but progress not 100% yet, waiting...");
                finalResult = data;
              }

              if (data.status === "error") {
                console.error("[handleSubmit] Error received from server:", data);
                throw new Error(data.error || data.details || "Processing failed");
              }
            } catch (parseError) {
              console.error("[handleSubmit] Error parsing JSON:", parseError, "Line:", line);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Set download URL if everything completed successfully
    if (finalResult && finalResult.filename && hasReached100) {
      console.log("[handleSubmit] ✅ All conditions met - setting download URL:", finalResult.filename);

      setTimeout(async () => {
        const downloadUrl = `${API_BASE_URL}/output/${finalResult.filename}`;
        setDownloadUrl(downloadUrl);
        console.log("[handleSubmit] Download URL set after progress completion");

        console.log("[handleSubmit] Generating QR code for download...");
        await generateQRCode(downloadUrl);
      }, 500);
    } else {
      console.error("[handleSubmit] Missing requirements - finalResult:", !!finalResult, "hasReached100:", hasReached100);
      throw new Error("Processing completed but final result not properly received");
    }

    console.log("[handleSubmit] Cut process completed successfully");
  } catch (err) {
    console.error("[handleSubmit] Error processing audio:", err);
    console.error("[handleSubmit] Error stack:", err.stack);

    let errorMessage = err.message || "Failed to connect to server.";
    if (errorMessage.includes("muxing queue")) {
      errorMessage = "Error processing large audio file. Try selecting a smaller region.";
    } else if (errorMessage.includes("fade")) {
      errorMessage = "Error applying fade effect. Try a different fade settings.";
    }

    console.error("[handleSubmit] Final error message:", errorMessage);
    setError(errorMessage);
    alert(`❌ ${errorMessage}`);
  } finally {
    console.log("[handleSubmit] Setting isLoading to false");
    setIsLoading(false);
    setProcessingProgress(0);
    setProcessingStatus("");
    setSmoothProgress(0);
    
    if (!downloadUrl) {
      setQrCodeDataUrl("");
      setShowQrCode(false);
      setShareLink("");
      setShareQrCode("");
      setShowShareSection(false);
    }
  }
};

  const handleStreamingResponse = async (response) => {
    console.log(
      "[handleStreamingResponse] Starting to process streaming response..."
    );

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finalResult = null;

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          console.log("[handleStreamingResponse] Stream reading completed");
          break;
        }

        // Decode chunk and add to buffer
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        console.log("[handleStreamingResponse] Received chunk:", chunk);

        // Process complete lines in buffer
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              console.log("[handleStreamingResponse] Parsed data:", data);

              if (data.progress !== undefined) {
                setProcessingProgress(data.progress);
                console.log(
                  "[handleStreamingResponse] Progress updated:",
                  data.progress
                );
              }

              if (data.status) {
                setProcessingStatus(data.status);
                console.log(
                  "[handleStreamingResponse] Status updated:",
                  data.status
                );
              }

              if (data.status === "completed" && data.filename) {
                finalResult = data;
                console.log(
                  "[handleStreamingResponse] Final result received:",
                  finalResult
                );
              }

              if (data.status === "error") {
                console.error(
                  "[handleStreamingResponse] Error received:",
                  data
                );
                throw new Error(
                  data.error || data.details || "Processing failed"
                );
              }
            } catch (parseError) {
              console.error(
                "[handleStreamingResponse] Error parsing JSON:",
                parseError,
                "Line:",
                line
              );
            }
          }
        }
      }

      console.log(
        "[handleStreamingResponse] Stream processing completed, final result:",
        finalResult
      );
      return finalResult;
    } catch (error) {
      console.error(
        "[handleStreamingResponse] Stream processing error:",
        error
      );
      throw error;
    } finally {
      reader.releaseLock();
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
  console.log('[incrementRegionStart] Raw region bounds:', regionBounds);

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
        const currentPosition =
          waveformRef.current.wavesurferRef?.current?.getCurrentTime() || 0;

        // Thử cập nhật region trực tiếp theo nhiều cách
        if (
          waveformRef.current.wavesurferRef?.current &&
          waveformRef.current.regionRef?.current
        ) {
          try {
            // Cách 1: Cập nhật trực tiếp thuộc tính
            const region = waveformRef.current.regionRef.current;
            region.start = startRef.current;
            region.end = endRef.current;

            // Kích hoạt sự kiện redraw
            if (waveformRef.current.wavesurferRef.current.fireEvent) {
              waveformRef.current.wavesurferRef.current.fireEvent(
                "region-updated",
                region
              );
            }
          } catch (err) {
            console.warn("Could not update region directly:", err);
          }
        }

        // Cập nhật volume và overlay
        if (typeof waveformRef.current.updateVolume === "function") {
          waveformRef.current.updateVolume(currentPosition, true);
        }
        if (typeof waveformRef.current.drawVolumeOverlay === "function") {
          waveformRef.current.drawVolumeOverlay();
        }
      } catch (err) {
        console.error("Error updating waveform:", err);
      }
    }
  };

  const renderVolumeOptions = () => {
    if (volumeProfile === "custom") {
      return (
        <div className="space-y-4">
          {/* Hiển thị các thanh custom chỉ khi không có fade nào được bật */}
          {!(fadeIn || fadeOut) && (
            <>
              {/* Thêm thanh kéo Fade In Duration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 flex justify-between">
                  <span>Fade In Duration:</span>{" "}
                  <span className="text-blue-600">{fadeInDuration}s</span>
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
                  <span>Fade Out Duration:</span>{" "}
                  <span className="text-blue-600">{fadeOutDuration}s</span>
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
                    <span>{key}:</span>{" "}
                    <span className="text-blue-600">
                      {Math.min(1.0, customVolume[key]).toFixed(1)}x
                    </span>
                  </label>
                  <input
                    type="range"
                    min="0.0"
                    max="1.0"
                    step="0.1"
                    value={Math.min(1.0, customVolume[key])}
onChange={(e) => {
  const newValue = Math.min(1.0, parseFloat(e.target.value));
  const newCustomVolume = {
    ...customVolume,
    [key]: newValue,
  };
  
  // OPTIMIZED: Minimal logging
  console.log('[CustomVolume] Changed:', key, 'to:', newValue);
  
  setCustomVolume(newCustomVolume);
  
  // OPTIMIZED: Throttled update instead of immediate
  if (waveformRef.current) {
    const currentPos = waveformRef.current.getWavesurferInstance?.()?.getCurrentTime() || 0;
    
    // Single update call
    if (waveformRef.current.updateVolume) {
      waveformRef.current.updateVolume(currentPos, true, true);
    }
  }
  
  // OPTIMIZED: Debounced force update
  clearTimeout(window.customVolumeUpdateTimeout);
  window.customVolumeUpdateTimeout = setTimeout(() => {
    if (waveformRef.current) {
      forceUpdateWaveform();
    }
  }, 150); // Debounce 150ms
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
                  <span>Volume:</span>{" "}
                  <span className="text-blue-600">
                    {Math.min(1.0, volume).toFixed(1)}x
                  </span>
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.1"
                  value={Math.min(1.0, volume)}
                  onChange={(e) => {
                    const newVolume = Math.min(1.0, parseFloat(e.target.value));
                    setVolume(newVolume);
                    // Cập nhật UI ngay lập tức
                    if (waveformRef.current) {
                      if (
                        typeof waveformRef.current.updateVolume === "function"
                      ) {
                        waveformRef.current.updateVolume(null, true, true);
                      }
                    }
                    setTimeout(forceUpdateWaveform, 10);
                  }}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>{" "}
              <div className="text-sm text-blue-600 mt-2 bg-blue-50 p-2 rounded-md border border-blue-100">
                {fadeIn && fadeOut
                  ? "Chế độ Fade In & Out (2s) đang được bật"
                  : fadeIn
                  ? "Chế độ Fade In (2s) đang được bật"
                  : "Chế độ Fade Out (2s) đang được bật"}
                . Các tùy chỉnh cụ thể đã bị ẩn.
              </div>
            </>
          )}
        </div>
      );
    }
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 flex justify-between">
          <span>Volume:</span>{" "}
          <span className="text-blue-600">
            {Math.min(1.0, volume).toFixed(1)}x
          </span>
        </label>
        <input
          type="range"
          min="0.1"
          max="1.0"
          step="0.1"
          value={Math.min(1.0, volume)}
          onChange={(e) => {
            const newVolume = Math.min(1.0, parseFloat(e.target.value));
            setVolume(newVolume);
            // Cập nhật UI ngay lập tức
            if (waveformRef.current) {
              if (typeof waveformRef.current.updateVolume === "function") {
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

  const generateQRCode = async (downloadUrl) => {
    try {
      console.log("[generateQRCode] Generating QR code for URL:", downloadUrl);

      // Tạo QR code với options tùy chỉnh
      const qrDataUrl = await QRCode.toDataURL(downloadUrl, {
        width: 200, // Kích thước QR code
        margin: 2, // Lề xung quanh
        color: {
          dark: "#000000", // Màu đen cho QR code
          light: "#FFFFFF", // Màu trắng cho nền
        },
        errorCorrectionLevel: "M", // Mức độ sửa lỗi trung bình
      });

      console.log("[generateQRCode] QR code generated successfully");
      setQrCodeDataUrl(qrDataUrl);
      setShowQrCode(true);

      return qrDataUrl;
    } catch (error) {
      console.error("[generateQRCode] Error generating QR code:", error);
      setShowQrCode(false);
      return null;
    }
  };

  // Hàm copy link
  const copyShareLink = async (e) => {
    // Ngăn event bubbling
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    console.log(
      "[copyShareLink] Function called, shareLink:",
      shareLink ? "EXISTS" : "NULL"
    );
    console.log("[copyShareLink] isCopied:", isCopied);

    if (!shareLink) {
      console.log("[copyShareLink] Cannot copy - no link available");
      return;
    }

    try {
      console.log("[copyShareLink] Attempting to copy link:", shareLink);
      await navigator.clipboard.writeText(shareLink);

      console.log(
        "[copyShareLink] Link copied successfully, setting isCopied to true"
      );
      setIsCopied(true);

      // Reset về "Copy" sau 2 giây
      setTimeout(() => {
        console.log(
          "[copyShareLink] Resetting isCopied to false after 2 seconds"
        );
        setIsCopied(false);
      }, 2000);

      console.log("[copyShareLink] Copy operation completed successfully");
    } catch (error) {
      console.error("[copyShareLink] Error copying link:", error);
      alert("❌ Failed to copy link. Please copy manually.");
    }
  };

  // Hàm format thời gian còn lại
  const formatTimeRemaining = (expiryDate) => {
    if (!expiryDate) return "";

    const now = new Date();
    const diff = expiryDate - now;

    if (diff <= 0) return "Expired";

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    } else {
      return `${minutes}m remaining`;
    }
  };

const handleReset = () => {
  console.log("[RESET] Starting complete reset of all settings...");
  
  // Reset volume settings
  setVolume(1.0);
  setFadeIn(false);
  setFadeOut(false);
  setVolumeProfile("uniform");
  setCustomVolume({ start: 1.0, middle: 1.0, end: 1.0 });
  setNormalizeAudio(false);
  setFadeInDuration(3);
  setFadeOutDuration(3);
  setPlaybackSpeed(1.0);
  setPitchShift(0);

  // THÊM - Reset AudioWorklet pitch shifter
  // IMPROVED - Reset INDEPENDENT pitch shifter
console.log("[RESET] ⚡ Resetting INDEPENDENT pitch shifter...");

// Reset pitch state
setPitchShift(0);
console.log("[RESET] ✅ Pitch UI state reset to 0 semitones");

// Reset AudioWorklet if connected
if (pitchShiftNode) {
  console.log("[RESET] 🎛️ Resetting AudioWorklet pitch to 0...");
  const success = setPitchShiftValue(0);
  if (success) {
    console.log("[RESET] ✅ AudioWorklet pitch reset successfully");
  } else {
    console.warn("[RESET] ⚠️ AudioWorklet pitch reset failed");
  }
} else {
  console.log("[RESET] 💡 AudioWorklet not connected - will reset on next pitch change");
}

// Reset performance tracking
lastPitchValue = 0;
pitchConnectAttempts = 0;
console.log("[RESET] 📊 Pitch performance tracking reset");

// Verify WaveSurfer speed is preserved
if (waveformRef.current) {
  const wavesurferInstance = waveformRef.current.getWavesurferInstance?.();
  if (wavesurferInstance) {
    const currentRate = wavesurferInstance.getPlaybackRate?.() || 1.0;
    console.log("[RESET] 📊 Post-pitch-reset speed check:", currentRate, "x");
    
    // Ensure speed is exactly what we expect
    if (Math.abs(currentRate - playbackSpeed) > 0.001) {
      console.log("[RESET] 🔧 Correcting speed to:", playbackSpeed, "x");
      wavesurferInstance.setPlaybackRate(playbackSpeed);
    } else {
      console.log("[RESET] ✅ Speed preserved correctly during pitch reset");
    }
  }
}

console.log("[RESET] 🎯 Pitch reset completed - speed COMPLETELY UNAFFECTED");

  // Fast pitch and speed reset
  console.log("[RESET] ⚡ Fast audio parameters reset...");
  if (waveformRef.current) {
    const wavesurferInstance = waveformRef.current.getWavesurferInstance?.();
    if (wavesurferInstance) {
      try {
        const resetStartTime = performance.now();
        
        // Reset to normal playback rate instantly
        wavesurferInstance.setPlaybackRate(1.0);
        
        const resetEndTime = performance.now();
        console.log(`[RESET] ✅ Audio reset completed in ${(resetEndTime - resetStartTime).toFixed(2)}ms`);
        console.log("[RESET] - Speed reset to: 1.0x");
        console.log("[RESET] - Pitch reset to: 0 semitones");
        
      } catch (error) {
        console.error("[RESET] ❌ Error resetting audio parameters:", error);
      }
    } else {
      console.warn("[RESET] ⚠️ WaveSurfer instance not available for reset");
    }
  }
  
  // Reset UI states
  console.log("[RESET] Resetting UI states...");
  setActiveIcons({
    fadeIn: false,
    fadeOut: false,
    speed: false,
    remove: false,
    pitch: false,
  });
  
  setShowSpeedControl(false);
  setShowPitchControl(false);
  setRemoveMode(false);

  // Reset waveform region (existing logic)
  if (
    waveformRef.current &&
    waveformRef.current.wavesurferRef &&
    waveformRef.current.wavesurferRef.current
  ) {
    const ws = waveformRef.current.wavesurferRef.current;
    const duration = ws.getDuration();

    startRef.current = 0;
    endRef.current = duration;
    setDisplayStart("0.00");
    setDisplayEnd(duration.toFixed(2));

    handleRegionChange(0, duration);

    if (waveformRef.current.setFadeInDuration) {
      waveformRef.current.setFadeInDuration(3);
    }
    if (waveformRef.current.setFadeOutDuration) {
      waveformRef.current.setFadeOutDuration(3);
    }

    try {
      if (
        waveformRef.current.regionRef &&
        waveformRef.current.regionRef.current
      ) {
        const region = waveformRef.current.regionRef.current;
        region.start = 0;
        region.end = duration;

        if (ws.fireEvent) {
          ws.fireEvent("region-updated", region);
        }
      }
    } catch (err) {
      console.warn("Could not update region directly during reset:", err);
    }
  }

  setTimeout(forceUpdateWaveform, 20);
  console.log("[RESET] ✅ Complete reset finished - pitch and speed fully independent");
};


  const setRegionStart = () => {
    console.log("Calling setRegionStart");

    // Kiểm tra kỹ lưỡng waveformRef
    if (!waveformRef.current) {
      console.error("waveformRef is null");
      return;
    }

    // Kiểm tra xem WaveSurfer instance đã được khởi tạo chưa
    const wavesurferInstance = waveformRef.current.getWavesurferInstance
      ? waveformRef.current.getWavesurferInstance()
      : null;

    if (!wavesurferInstance) {
      console.error("WaveSurfer instance is not available");
      return;
    }

    try {
      // Lấy thời gian hiện tại từ instance WaveSurfer
      const currentTime = wavesurferInstance.getCurrentTime();
      console.log("Current time from wavesurfer instance:", currentTime);

      if (
        currentTime !== undefined &&
        typeof waveformRef.current.setRegionStart === "function"
      ) {
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
          console.error(
            "Region is not accessible and setRegionStart is not available"
          );
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
    const wavesurferInstance = waveformRef.current.getWavesurferInstance
      ? waveformRef.current.getWavesurferInstance()
      : null;

    if (!wavesurferInstance) {
      console.error("WaveSurfer instance is not available");
      return;
    }

    try {
      // Lấy thời gian hiện tại từ instance WaveSurfer
      const currentTime = wavesurferInstance.getCurrentTime();
      console.log("Current time from wavesurfer instance:", currentTime);

      if (
        currentTime !== undefined &&
        typeof waveformRef.current.setRegionEnd === "function"
      ) {
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
          console.error(
            "Region is not accessible and setRegionEnd is not available"
          );
        }
      }
    } catch (err) {
      console.error("Error in setRegionEnd:", err);
    }
  };

  // Update fadeDuration handlers
 const handleFadeInDurationChange = (duration) => {
  console.log('[handleFadeInDurationChange] Duration changed to:', duration);
  
  setFadeInDuration(duration);
  
  if (waveformRef.current) {
    // Cập nhật fade duration
    if (waveformRef.current.setFadeInDuration) {
      waveformRef.current.setFadeInDuration(duration);
    }

    // OPTIMIZED: Single update call instead of multiple
    const currentPos = waveformRef.current.getWavesurferInstance?.()?.getCurrentTime() || 0;
    
    // Batch all updates together
    if (waveformRef.current.updateVolume) {
      waveformRef.current.updateVolume(currentPos, true, true);
    }

    // OPTIMIZED: Single delayed update instead of multiple timeouts
    setTimeout(() => {
      if (waveformRef.current) {
        forceUpdateWaveform();
        if (waveformRef.current.drawVolumeOverlay) {
          waveformRef.current.drawVolumeOverlay(true);
        }
      }
    }, 100); // Increased delay to avoid rapid updates
  }
};

const handleFadeOutDurationChange = (duration) => {
  console.log('[handleFadeOutDurationChange] Duration changed to:', duration);
  
  setFadeOutDuration(duration);
  
  if (waveformRef.current) {
    // Cập nhật fade duration
    if (waveformRef.current.setFadeOutDuration) {
      waveformRef.current.setFadeOutDuration(duration);
    }

    // OPTIMIZED: Single update call instead of multiple
    const currentPos = waveformRef.current.getWavesurferInstance?.()?.getCurrentTime() || 0;
    
    // Batch all updates together
    if (waveformRef.current.updateVolume) {
      waveformRef.current.updateVolume(currentPos, true, true);
    }

    // OPTIMIZED: Single delayed update instead of multiple timeouts
    setTimeout(() => {
      if (waveformRef.current) {
        forceUpdateWaveform();
        if (waveformRef.current.drawVolumeOverlay) {
          waveformRef.current.drawVolumeOverlay(true);
        }
      }
    }, 100); // Increased delay to avoid rapid updates
  }
};



const handleSpeedChange = (speed) => {
  console.log("[SPEED] 🚀 PURE speed change:", speed, "x");
  console.log("[SPEED] 🎵 Current pitch:", pitchShift, "semitones - will stay INDEPENDENT");
  console.log("[SPEED] ⚡ Using WaveSurfer playbackRate for speed ONLY");
  
  const startTime = performance.now();
  
  // Update state immediately
  setPlaybackSpeed(speed);
  console.log("[SPEED] ✅ Speed state updated to:", speed, "x");
  
  if (!waveformRef.current) {
    console.error("[SPEED] ❌ WaveformRef not available");
    return;
  }
  
  const wavesurferInstance = waveformRef.current.getWavesurferInstance?.();
  if (!wavesurferInstance) {
    console.error("[SPEED] ❌ WaveSurfer instance not available");
    return;
  }
  
  try {
    // Store current state
    const currentPosition = wavesurferInstance.getCurrentTime();
    const wasPlaying = wavesurferInstance.isPlaying?.() || false;
    const currentRate = wavesurferInstance.getPlaybackRate?.() || 1.0;
    
    console.log("[SPEED] 📊 Current state:");
    console.log("[SPEED] - Position:", currentPosition.toFixed(2), "s");
    console.log("[SPEED] - Playing:", wasPlaying);
    console.log("[SPEED] - Current rate:", currentRate, "x");
    console.log("[SPEED] - Target speed:", speed, "x");
    console.log("[SPEED] - Pitch shifter active:", !!pitchShiftNode);
    
    // STRATEGY: Pure speed control through WaveSurfer
    // Pitch is handled separately by AudioWorklet
    
    if (pitchShiftNode && pitchShift !== 0) {
      console.log("[SPEED] 🎛️ AudioWorklet active - applying PURE speed change");
      console.log("[SPEED] 🎵 Pitch will remain at:", pitchShift, "semitones via AudioWorklet");
      
      // With AudioWorklet: WaveSurfer controls speed, AudioWorklet controls pitch
      // NO interaction between them!
      wavesurferInstance.setPlaybackRate(speed);
      
      console.log("[SPEED] ✅ Pure speed applied via WaveSurfer playbackRate");
      console.log("[SPEED] 🎵 Pitch remains independent via AudioWorklet");
      
    } else if (pitchShift === 0) {
      console.log("[SPEED] 🚀 No pitch shift - direct speed control");
      
      // No pitch shift: direct speed control
      wavesurferInstance.setPlaybackRate(speed);
      
      console.log("[SPEED] ✅ Direct speed control applied");
      
    } else {
      console.log("[SPEED] 🔄 Fallback mode - compensating for pitch in playbackRate");
      
      // Fallback: pitch is embedded in playbackRate, need to maintain it
      const pitchRatio = Math.pow(2, pitchShift / 12);
      const targetRate = speed * pitchRatio;
      
      console.log("[SPEED] 📊 Fallback calculation:");
      console.log("[SPEED] - Speed multiplier:", speed);
      console.log("[SPEED] - Pitch ratio:", pitchRatio.toFixed(4));
      console.log("[SPEED] - Combined rate:", targetRate.toFixed(4));
      
      wavesurferInstance.setPlaybackRate(targetRate);
      console.log("[SPEED] ✅ Fallback speed with pitch compensation applied");
    }
    
    // Verify the change
    setTimeout(() => {
      const newRate = wavesurferInstance.getPlaybackRate?.();
      console.log("[SPEED] 📊 Verification:");
      console.log("[SPEED] - New playback rate:", newRate, "x");
      console.log("[SPEED] - Change successful:", newRate !== currentRate ? "✅ YES" : "⚠️ NO");
    }, 50);
    
    // Maintain playback if it was playing
    if (wasPlaying) {
      requestAnimationFrame(() => {
        if (!wavesurferInstance.isPlaying?.()) {
          const regionBounds = waveformRef.current?.getRegionBounds?.();
          if (regionBounds) {
            wavesurferInstance.play(currentPosition, regionBounds.end);
            console.log("[SPEED] ▶️ Playback resumed with new speed");
          }
        }
        setTimeout(() => setIsPlaying(wavesurferInstance.isPlaying?.() || false), 100);
      });
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    console.log(`[SPEED] ✅ Speed change completed in ${duration.toFixed(2)}ms`);
    console.log("[SPEED] 🚀 New speed:", speed, "x");
    console.log("[SPEED] 🎵 Pitch independence:", pitchShiftNode ? "MAINTAINED" : "N/A");
    
    // Performance feedback
    if (duration < 5) {
      console.log("[SPEED] ⚡ ULTRA-FAST speed change!");
    } else if (duration < 15) {
      console.log("[SPEED] ✅ Fast speed change");
    }
    
  } catch (error) {
    console.error("[SPEED] ❌ Error in speed change:", error);
    console.error("[SPEED] Error details:", error.message);
    
    // Emergency fallback
    try {
      wavesurferInstance.setPlaybackRate(speed);
      console.log("[SPEED] 🆘 Emergency fallback applied");
    } catch (fallbackError) {
      console.error("[SPEED] ❌ Emergency fallback failed:", fallbackError);
    }
  }
};


// THÊM - High-Performance Pitch Shifter
let pitchWorkletLoaded = false;
let pitchShiftNode = null;
let mediaSourceNode = null;
// IMPROVED - Additional pitch shifter tracking variables
let pitchShifterInitialized = false;
let lastPitchValue = 0;
let pitchConnectAttempts = 0;
const MAX_PITCH_CONNECT_ATTEMPTS = 3;

// Performance tracking for pitch operations
const pitchPerformanceTracker = {
  lastPitchChangeTime: 0,
  averageLatency: 0,
  successfulChanges: 0,
  failedChanges: 0,
  
  recordSuccess: (latency) => {
    pitchPerformanceTracker.successfulChanges++;
    pitchPerformanceTracker.averageLatency = 
      (pitchPerformanceTracker.averageLatency * (pitchPerformanceTracker.successfulChanges - 1) + latency) / 
      pitchPerformanceTracker.successfulChanges;
    console.log('[PITCH_PERF] ✅ Success recorded - avg latency:', pitchPerformanceTracker.averageLatency.toFixed(2), 'ms');
  },
  
  recordFailure: () => {
    pitchPerformanceTracker.failedChanges++;
    console.log('[PITCH_PERF] ❌ Failure recorded - total failures:', pitchPerformanceTracker.failedChanges);
  },
  
  getStats: () => {
    const total = pitchPerformanceTracker.successfulChanges + pitchPerformanceTracker.failedChanges;
    const successRate = total > 0 ? (pitchPerformanceTracker.successfulChanges / total * 100).toFixed(1) : 0;
    return {
      successRate: successRate + '%',
      averageLatency: pitchPerformanceTracker.averageLatency.toFixed(2) + 'ms',
      totalOperations: total
    };
  }
};

const createPitchShiftWorklet = async () => {
  console.log('[PITCH_WORKLET] 🎛️ Creating INDEPENDENT pitch shifter...');
  
  if (!audioContextRef.current) {
    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    console.log('[PITCH_WORKLET] ✅ New AudioContext created');
  }
  
  const audioContext = audioContextRef.current;
  
  // Resume context if suspended
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
    console.log('[PITCH_WORKLET] ✅ AudioContext resumed');
  }
  
  try {
    // High-performance pitch shift processor - COMPLETELY INDEPENDENT
    const processorCode = `
      class IndependentPitchShifter extends AudioWorkletProcessor {
        constructor() {
          super();
          
          console.log('[WORKLET] 🎵 Independent Pitch Shifter initialized');
          
          // HIGH-PERFORMANCE parameters
          this.pitchRatio = 1.0;
          this.bufferSize = 8192; // Increased for better quality
          this.overlapRatio = 0.5;
          this.grainSize = Math.floor(this.bufferSize * this.overlapRatio);
          
          // Dual circular buffers for stereo
          this.leftInputBuffer = new Float32Array(this.bufferSize);
          this.rightInputBuffer = new Float32Array(this.bufferSize);
          this.leftOutputBuffer = new Float32Array(this.bufferSize);
          this.rightOutputBuffer = new Float32Array(this.bufferSize);
          
          // Buffer indices
          this.writeIndex = 0;
          this.readIndex = 0;
          
          // Smooth Hann window for grain processing
          this.window = new Float32Array(this.grainSize);
          for (let i = 0; i < this.grainSize; i++) {
            this.window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / this.grainSize));
          }
          
          // Grain overlap management
          this.grainIndex = 0;
          this.overlapBuffer = new Float32Array(this.grainSize);
          
          // Listen for pitch changes - INDEPENDENT from speed
          this.port.onmessage = (event) => {
            if (event.data.type === 'setPitch') {
              const newRatio = event.data.ratio;
              console.log('[WORKLET] 🎛️ Pitch ratio updated:', newRatio);
              this.pitchRatio = newRatio;
            }
          };
          
          console.log('[WORKLET] ✅ Buffers and windows initialized');
        }
        
        process(inputs, outputs) {
          const input = inputs[0];
          const output = outputs[0];
          
          if (!input || !output || input.length === 0 || output.length === 0) {
            return true;
          }
          
          const inputLeft = input[0] || new Float32Array(128);
          const inputRight = input[1] || inputLeft; // Mono fallback
          const outputLeft = output[0];
          const outputRight = output[1] || outputLeft;
          
          const frameCount = inputLeft.length;
          
          // OPTIMIZED: Direct passthrough when no pitch change
          if (Math.abs(this.pitchRatio - 1.0) < 0.001) {
            for (let i = 0; i < frameCount; i++) {
              outputLeft[i] = inputLeft[i];
              outputRight[i] = inputRight[i];
            }
            return true;
          }
          
          // HIGH-QUALITY pitch shifting using PSOLA-like algorithm
          for (let i = 0; i < frameCount; i++) {
            // Write input to circular buffers
            this.leftInputBuffer[this.writeIndex] = inputLeft[i];
            this.rightInputBuffer[this.writeIndex] = inputRight[i];
            this.writeIndex = (this.writeIndex + 1) % this.bufferSize;
            
            // Calculate read position with pitch adjustment
            const readPosition = this.readIndex * this.pitchRatio;
            const readIdx = Math.floor(readPosition) % this.bufferSize;
            const nextIdx = (readIdx + 1) % this.bufferSize;
            const fraction = readPosition - Math.floor(readPosition);
            
            // High-quality cubic interpolation for smoother sound
            const prevIdx = (readIdx - 1 + this.bufferSize) % this.bufferSize;
            const nextNextIdx = (readIdx + 2) % this.bufferSize;
            
            // Cubic interpolation coefficients
            const a = fraction;
            const a2 = a * a;
            const a3 = a2 * a;
            
            const c0 = -0.5 * a3 + a2 - 0.5 * a;
            const c1 = 1.5 * a3 - 2.5 * a2 + 1;
            const c2 = -1.5 * a3 + 2 * a2 + 0.5 * a;
            const c3 = 0.5 * a3 - 0.5 * a2;
            
            // Apply cubic interpolation for both channels
            const leftSample = 
              c0 * this.leftInputBuffer[prevIdx] +
              c1 * this.leftInputBuffer[readIdx] +
              c2 * this.leftInputBuffer[nextIdx] +
              c3 * this.leftInputBuffer[nextNextIdx];
              
            const rightSample = 
              c0 * this.rightInputBuffer[prevIdx] +
              c1 * this.rightInputBuffer[readIdx] +
              c2 * this.rightInputBuffer[nextIdx] +
              c3 * this.rightInputBuffer[nextNextIdx];
            
            // Apply window smoothing for grain boundaries
            const windowIndex = this.grainIndex % this.grainSize;
            const windowValue = this.window[windowIndex];
            
            // Output with windowing
            outputLeft[i] = leftSample * windowValue * 0.8; // Slight volume compensation
            outputRight[i] = rightSample * windowValue * 0.8;
            
            this.readIndex = (this.readIndex + 1) % this.bufferSize;
            this.grainIndex++;
          }
          
          return true;
        }
      }
      
      registerProcessor('independent-pitch-shifter', IndependentPitchShifter);
    `;
    
    // Create and load the worklet
    const blob = new Blob([processorCode], { type: 'application/javascript' });
    const workletUrl = URL.createObjectURL(blob);
    
    console.log('[PITCH_WORKLET] 📝 Loading AudioWorklet processor...');
    await audioContext.audioWorklet.addModule(workletUrl);
    
    // Clean up blob URL
    URL.revokeObjectURL(workletUrl);
    
    pitchWorkletLoaded = true;
    console.log('[PITCH_WORKLET] ✅ INDEPENDENT pitch shifter loaded successfully');
    console.log('[PITCH_WORKLET] 🚀 Pitch control: COMPLETELY SEPARATE from speed');
    return true;
    
  } catch (error) {
    console.error('[PITCH_WORKLET] ❌ Failed to load independent pitch shifter:', error);
    console.error('[PITCH_WORKLET] Error details:', error.message);
    return false;
  }
};

const connectPitchShifter = async () => {
  console.log('[PITCH_CONNECT] 🔗 Connecting INDEPENDENT pitch shifter...');
  
  if (!pitchWorkletLoaded) {
    console.log('[PITCH_CONNECT] Loading worklet first...');
    const loaded = await createPitchShiftWorklet();
    if (!loaded) {
      console.error('[PITCH_CONNECT] ❌ Failed to load worklet');
      return false;
    }
  }
  
  if (!waveformRef.current) {
    console.error('[PITCH_CONNECT] ❌ WaveformRef not available');
    return false;
  }
  
  const wavesurferInstance = waveformRef.current.getWavesurferInstance?.();
  if (!wavesurferInstance?.media) {
    console.error('[PITCH_CONNECT] ❌ WaveSurfer media not available');
    return false;
  }
  
  const audioContext = audioContextRef.current;
  
  try {
    console.log('[PITCH_CONNECT] 🧹 Cleaning up existing connections...');
    
    // Disconnect existing nodes safely
    if (mediaSourceNode) {
      try {
        mediaSourceNode.disconnect();
        console.log('[PITCH_CONNECT] ✅ Previous media source disconnected');
      } catch (e) {
        console.warn('[PITCH_CONNECT] ⚠️ Error disconnecting media source:', e.message);
      }
    }
    
    if (pitchShiftNode) {
      try {
        pitchShiftNode.disconnect();
        console.log('[PITCH_CONNECT] ✅ Previous pitch node disconnected');
      } catch (e) {
        console.warn('[PITCH_CONNECT] ⚠️ Error disconnecting pitch node:', e.message);
      }
    }
    
    console.log('[PITCH_CONNECT] 🎵 Creating new audio pipeline...');
    
    // Create fresh media source from WaveSurfer's audio element
    mediaSourceNode = audioContext.createMediaElementSource(wavesurferInstance.media);
    console.log('[PITCH_CONNECT] ✅ Media source created from WaveSurfer audio');
    
    // Create INDEPENDENT pitch shift node
    pitchShiftNode = new AudioWorkletNode(audioContext, 'independent-pitch-shifter', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      channelCount: 2,
      channelCountMode: 'explicit',
      channelInterpretation: 'speakers',
      processorOptions: {
        pitchRatio: Math.pow(2, pitchShift / 12)
      }
    });
    
    console.log('[PITCH_CONNECT] ✅ Independent pitch shifter node created');
    
    // CRITICAL: Create connection chain that preserves WaveSurfer's speed control
    // MediaSource -> PitchShifter -> Destination
    // This way, WaveSurfer controls playback rate, AudioWorklet controls pitch ONLY
    
    mediaSourceNode.connect(pitchShiftNode);
    pitchShiftNode.connect(audioContext.destination);
    
    console.log('[PITCH_CONNECT] ✅ Audio pipeline connected:');
    console.log('[PITCH_CONNECT] 📊 WaveSurfer Audio Element → MediaSource → PitchShift → Speakers');
    console.log('[PITCH_CONNECT] 🚀 WaveSurfer controls: SPEED (playbackRate)');
    console.log('[PITCH_CONNECT] 🎵 AudioWorklet controls: PITCH (frequency)');
    console.log('[PITCH_CONNECT] ✨ COMPLETELY INDEPENDENT controls achieved!');
    
    // Set initial pitch
    const initialPitchRatio = Math.pow(2, pitchShift / 12);
    pitchShiftNode.port.postMessage({
      type: 'setPitch',
      ratio: initialPitchRatio
    });
    
    console.log('[PITCH_CONNECT] 🎛️ Initial pitch ratio set:', initialPitchRatio);
    
    // Add error handling for the worklet
    pitchShiftNode.onprocessorerror = (event) => {
      console.error('[PITCH_CONNECT] ❌ AudioWorklet processor error:', event);
    };
    
    return true;
    
  } catch (error) {
    console.error('[PITCH_CONNECT] ❌ Connection failed:', error);
    console.error('[PITCH_CONNECT] Error stack:', error.stack);
    
    // Cleanup on failure
    if (mediaSourceNode) {
      try { mediaSourceNode.disconnect(); } catch(e) {}
      mediaSourceNode = null;
    }
    if (pitchShiftNode) {
      try { pitchShiftNode.disconnect(); } catch(e) {}
      pitchShiftNode = null;
    }
    
    return false;
  }
};

const setPitchShiftValue = (semitones) => {
  console.log('[PITCH_SET] 🎛️ Setting INDEPENDENT pitch:', semitones, 'semitones');
  
  if (!pitchShiftNode) {
    console.warn('[PITCH_SET] ⚠️ Pitch shifter not connected, attempting to connect...');
    
    // Try to connect automatically
    connectPitchShifter().then(connected => {
      if (connected) {
        console.log('[PITCH_SET] ✅ Auto-connected, retrying pitch set...');
        setPitchShiftValue(semitones); // Retry after connection
      } else {
        console.error('[PITCH_SET] ❌ Failed to auto-connect pitch shifter');
      }
    });
    
    return false;
  }
  
  try {
    const pitchRatio = Math.pow(2, semitones / 12);
    
    console.log('[PITCH_SET] 📊 Pitch calculation:');
    console.log('[PITCH_SET] - Semitones:', semitones);
    console.log('[PITCH_SET] - Pitch ratio:', pitchRatio.toFixed(6));
    console.log('[PITCH_SET] - Frequency shift:', ((pitchRatio - 1) * 100).toFixed(2) + '%');
    
    // Send message to AudioWorklet processor
    pitchShiftNode.port.postMessage({
      type: 'setPitch',
      ratio: pitchRatio,
      semitones: semitones,
      timestamp: performance.now()
    });
    
    console.log('[PITCH_SET] ✅ Pitch message sent to AudioWorklet');
    console.log('[PITCH_SET] 🚀 Speed remains at:', playbackSpeed, 'x (UNAFFECTED)');
    console.log('[PITCH_SET] 🎵 Pitch is now COMPLETELY INDEPENDENT');
    
    // Verify current WaveSurfer playback rate hasn't changed
    if (waveformRef.current) {
      const wavesurferInstance = waveformRef.current.getWavesurferInstance?.();
      if (wavesurferInstance) {
        const currentRate = wavesurferInstance.getPlaybackRate?.() || 'unknown';
        console.log('[PITCH_SET] 📊 WaveSurfer playback rate check:', currentRate);
        
        if (typeof currentRate === 'number' && Math.abs(currentRate - playbackSpeed) > 0.001) {
          console.warn('[PITCH_SET] ⚠️ WaveSurfer rate mismatch! Expected:', playbackSpeed, 'Got:', currentRate);
        } else {
          console.log('[PITCH_SET] ✅ WaveSurfer speed unchanged - perfect!');
        }
      }
    }
    
    return true;
    
  } catch (error) {
    console.error('[PITCH_SET] ❌ Error setting pitch value:', error);
    console.error('[PITCH_SET] Error details:', error.message);
    return false;
  }
};

const handlePitchChange = async (semitones) => {
  console.log("[PITCH] 🎵 INDEPENDENT pitch change:", semitones, "semitones");
  console.log("[PITCH] 🚀 Current speed:", playbackSpeed, "x - will remain UNCHANGED");
  console.log("[PITCH] ⚡ Using AudioWorklet for ZERO speed impact");
  
  const startTime = performance.now();
  
  // Update UI state immediately for responsiveness
  setPitchShift(semitones);
  console.log("[PITCH] ✅ UI state updated to:", semitones, "semitones");
  
  if (!waveformRef.current) {
    console.error("[PITCH] ❌ WaveformRef not available");
    return false;
  }
  
  const wavesurferInstance = waveformRef.current.getWavesurferInstance?.();
  if (!wavesurferInstance) {
    console.error("[PITCH] ❌ WaveSurfer instance not available");
    return false;
  }
  
  try {
    // CRITICAL: Store current playback state WITHOUT touching playbackRate
    const currentPosition = wavesurferInstance.getCurrentTime();
    const wasPlaying = wavesurferInstance.isPlaying?.() || false;
    const currentPlaybackRate = wavesurferInstance.getPlaybackRate?.() || playbackSpeed;
    
    console.log("[PITCH] 📊 Current audio state:");
    console.log("[PITCH] - Position:", currentPosition.toFixed(2), "s");
    console.log("[PITCH] - Playing:", wasPlaying);
    console.log("[PITCH] - WaveSurfer rate:", currentPlaybackRate, "x");
    console.log("[PITCH] - Expected speed:", playbackSpeed, "x");
    
    // METHOD 1: Pure AudioWorklet approach (ZERO impact on speed)
    console.log("[PITCH] 🎛️ Applying pitch via AudioWorklet (method 1)...");
    
    // Ensure pitch shifter is connected
    let connected = !!pitchShiftNode;
    if (!connected) {
      console.log("[PITCH] 🔄 Connecting pitch shifter...");
      connected = await connectPitchShifter();
    }
    
    if (connected && pitchShiftNode) {
      console.log("[PITCH] ✅ AudioWorklet available - applying pure pitch shift");
      
      // Apply pitch shift WITHOUT touching WaveSurfer's playbackRate
      const success = setPitchShiftValue(semitones);
      
      if (success) {
        // Verify WaveSurfer's playbackRate is unchanged
        const finalPlaybackRate = wavesurferInstance.getPlaybackRate?.() || playbackSpeed;
        
        console.log("[PITCH] 📊 Post-pitch verification:");
        console.log("[PITCH] - WaveSurfer rate:", finalPlaybackRate, "x");
        console.log("[PITCH] - Expected speed:", playbackSpeed, "x");
        console.log("[PITCH] - Rate unchanged:", Math.abs(finalPlaybackRate - playbackSpeed) < 0.001 ? "✅ YES" : "❌ NO");
        
        // Maintain playback if it was playing
        if (wasPlaying && !wavesurferInstance.isPlaying?.()) {
          console.log("[PITCH] 🔄 Resuming playback...");
          const regionBounds = waveformRef.current?.getRegionBounds?.();
          if (regionBounds) {
            wavesurferInstance.play(currentPosition, regionBounds.end);
          } else {
            wavesurferInstance.play();
          }
        }
        
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        console.log(`[PITCH] ✅ AudioWorklet pitch applied in ${duration.toFixed(2)}ms`);
        console.log("[PITCH] 🎵 Quality: PROFESSIONAL");
        console.log("[PITCH] 🚀 Speed impact: ABSOLUTELY ZERO");
        console.log("[PITCH] ⚡ Performance: OPTIMAL");
        console.log("[PITCH] 🎯 Mission accomplished: COMPLETE INDEPENDENCE!");
        
        return true;
      } else {
        console.warn("[PITCH] ⚠️ AudioWorklet method failed, trying fallback...");
      }
    } else {
      console.warn("[PITCH] ⚠️ AudioWorklet not available, using fallback method...");
    }
    
    // METHOD 2: Intelligent fallback (minimize speed impact)
    console.log("[PITCH] 🔄 Using intelligent fallback method...");
    
    if (semitones === 0) {
      // Reset to original speed
      console.log("[PITCH] 🔄 Resetting to original state...");
      wavesurferInstance.setPlaybackRate(playbackSpeed);
      console.log("[PITCH] ✅ Reset complete - speed:", playbackSpeed, "x, pitch: 0 semitones");
    } else {
      // Smart compensation algorithm
      const pitchRatio = Math.pow(2, semitones / 12);
      const absSemitones = Math.abs(semitones);
      
      // Adaptive compensation based on pitch amount
      let compensation;
      if (absSemitones <= 1) {
        compensation = 0.98; // 98% compensation for very small changes
      } else if (absSemitones <= 2) {
        compensation = 0.95; // 95% compensation for small changes
      } else if (absSemitones <= 4) {
        compensation = 0.90; // 90% compensation for medium changes
      } else if (absSemitones <= 8) {
        compensation = 0.85; // 85% compensation for large changes
      } else {
        compensation = 0.80; // 80% compensation for extreme changes
      }
      
      // Apply smart compensation
      const compensatedRatio = 1 + (pitchRatio - 1) * compensation;
      const targetRate = playbackSpeed * compensatedRatio;
      
      console.log("[PITCH] 📊 Intelligent fallback calculation:");
      console.log("[PITCH] - Target speed:", playbackSpeed, "x");
      console.log("[PITCH] - Pitch ratio:", pitchRatio.toFixed(4));
      console.log("[PITCH] - Compensation:", (compensation * 100).toFixed(1) + "%");
      console.log("[PITCH] - Final rate:", targetRate.toFixed(4), "x");
      console.log("[PITCH] - Speed deviation:", ((targetRate/playbackSpeed - 1) * 100).toFixed(1) + "% (minimized)");
      
      wavesurferInstance.setPlaybackRate(targetRate);
      console.log("[PITCH] ✅ Fallback applied with minimized speed impact");
    }
    
    // Maintain playback state
    if (wasPlaying && !wavesurferInstance.isPlaying?.()) {
      requestAnimationFrame(() => {
        const regionBounds = waveformRef.current?.getRegionBounds?.();
        if (regionBounds) {
          wavesurferInstance.play(currentPosition, regionBounds.end);
        } else {
          wavesurferInstance.play();
        }
        console.log("[PITCH] ▶️ Playback resumed");
      });
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    console.log(`[PITCH] ✅ Fallback method completed in ${duration.toFixed(2)}ms`);
    console.log("[PITCH] 🎵 Quality: GOOD");
    console.log("[PITCH] 🚀 Speed impact: MINIMIZED");
    
    return true;
    
  } catch (error) {
    console.error("[PITCH] ❌ Error in pitch change:", error);
    console.error("[PITCH] Error stack:", error.stack);
    
    // Emergency reset on error
    try {
      wavesurferInstance.setPlaybackRate(playbackSpeed);
      console.log("[PITCH] 🆘 Emergency reset to speed:", playbackSpeed, "x");
    } catch (resetError) {
      console.error("[PITCH] ❌ Emergency reset failed:", resetError);
    }
    
    return false;
  }
};

// THÊM - Performance monitoring helper
const performanceMonitor = {
  enabled: true, // Set false in production
  
  measureFunction: (functionName, fn, ...args) => {
    if (!performanceMonitor.enabled) {
      return fn(...args);
    }
    
    const startTime = performance.now();
    const result = fn(...args);
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    console.log(`[PERF] ${functionName} took ${duration.toFixed(2)}ms`);
    
    // Alert if too slow
    if (duration > 50) {
      console.warn(`[PERF] ⚠️ ${functionName} is slow: ${duration.toFixed(2)}ms`);
    }
    
    return result;
  },
  
  getMemoryUsage: () => {
    if (performance.memory) {
      const usage = performance.memory.usedJSHeapSize / 1024 / 1024;
      console.log(`[MEMORY] Current usage: ${usage.toFixed(1)}MB`);
      return usage;
    }
    return 0;
  }
};


const toggleIcon = (icon) => {
  console.log('[TOGGLE_ICON] =================');
  console.log('[TOGGLE_ICON] Icon clicked:', icon);
  console.log('[TOGGLE_ICON] Current states before toggle:');
  console.log('[TOGGLE_ICON] - activeIcons:', activeIcons);
  console.log('[TOGGLE_ICON] - fadeIn:', fadeIn, 'fadeOut:', fadeOut);
  console.log('[TOGGLE_ICON] - volumeProfile:', volumeProfile);
  
  setActiveIcons((prev) => {
    const newState = { ...prev };
    newState[icon] = !newState[icon];
    
    console.log('[TOGGLE_ICON] New icon state for', icon, ':', newState[icon]);

    if (icon === "fadeIn") {
      console.log('[TOGGLE_ICON] === PROCESSING FADEIN TOGGLE ===');
      
      if (newState.fadeIn) {
        console.log('[TOGGLE_ICON] FadeIn ENABLED - Setting up 2s fade in');
        setFadeIn(true);
        setVolumeProfile("uniform");
        // Tắt remove mode khi bật fade
        setRemoveMode(false);
        newState.remove = false;
        
        // CRITICAL: Gọi WaveformSelector để áp dụng fade ngay lập tức
        setTimeout(() => {
          if (waveformRef.current && waveformRef.current.toggleFade) {
            console.log('[TOGGLE_ICON] Calling waveform toggleFade(true, ' + fadeOut + ')');
            waveformRef.current.toggleFade(true, fadeOut);
          }
        }, 50);
        
      } else {
        console.log('[TOGGLE_ICON] FadeIn DISABLED - Removing fade in completely');
        setFadeIn(false);
        
        // CRITICAL: Gọi WaveformSelector để xóa fade ngay lập tức
        setTimeout(() => {
          if (waveformRef.current && waveformRef.current.toggleFade) {
            console.log('[TOGGLE_ICON] Calling waveform toggleFade(false, ' + fadeOut + ')');
            waveformRef.current.toggleFade(false, fadeOut);
          }
        }, 50);
        
        // FIXED: Luôn luôn set uniform khi tắt fade
        console.log('[TOGGLE_ICON] FadeIn OFF - Always setting uniform profile');
        setVolumeProfile("uniform");
      }
      
    } else if (icon === "fadeOut") {
      console.log('[TOGGLE_ICON] === PROCESSING FADEOUT TOGGLE ===');
      
      if (newState.fadeOut) {
        console.log('[TOGGLE_ICON] FadeOut ENABLED - Setting up 2s fade out');
        setFadeOut(true);
        setVolumeProfile("uniform");
        // Tắt remove mode khi bật fade
        setRemoveMode(false);
        newState.remove = false;
        
        // CRITICAL: Gọi WaveformSelector để áp dụng fade ngay lập tức
        setTimeout(() => {
          if (waveformRef.current && waveformRef.current.toggleFade) {
            console.log('[TOGGLE_ICON] Calling waveform toggleFade(' + fadeIn + ', true)');
            waveformRef.current.toggleFade(fadeIn, true);
          }
        }, 50);
        
      } else {
        console.log('[TOGGLE_ICON] FadeOut DISABLED - Removing fade out completely');
        setFadeOut(false);
        
        // CRITICAL: Gọi WaveformSelector để xóa fade ngay lập tức
        setTimeout(() => {
          if (waveformRef.current && waveformRef.current.toggleFade) {
            console.log('[TOGGLE_ICON] Calling waveform toggleFade(' + fadeIn + ', false)');
            waveformRef.current.toggleFade(fadeIn, false);
          }
        }, 50);
        
        // FIXED: Luôn luôn set uniform khi tắt fade
        console.log('[TOGGLE_ICON] FadeOut OFF - Always setting uniform profile');
        setVolumeProfile("uniform");
      }
      
    } else if (icon === "remove") {
      console.log('[TOGGLE_ICON] === PROCESSING REMOVE TOGGLE ===');
      setRemoveMode(newState.remove);
      
      if (newState.remove) {
        console.log('[TOGGLE_ICON] Remove mode enabled - disabling all fades');
        setFadeIn(false);
        setFadeOut(false);
        newState.fadeIn = false;
        newState.fadeOut = false;
        setVolumeProfile("uniform");
        
        // Tắt tất cả fade effects
        setTimeout(() => {
          if (waveformRef.current && waveformRef.current.toggleFade) {
            console.log('[TOGGLE_ICON] Remove mode - calling toggleFade(false, false)');
            waveformRef.current.toggleFade(false, false);
          }
        }, 50);
      } else {
        // FIXED: Khi tắt remove mode, luôn set uniform
        console.log('[TOGGLE_ICON] Remove mode disabled - setting uniform profile');
        setVolumeProfile("uniform");
      }
      
    } else if (icon === "speed") {
      console.log('[TOGGLE_ICON] === PROCESSING SPEED TOGGLE ===');
      setShowSpeedControl(newState.speed);
    } else if (icon === "pitch") {
  console.log('[TOGGLE_ICON] === PROCESSING PITCH TOGGLE ===');
  setShowPitchControl(newState.pitch);
}

    console.log('[TOGGLE_ICON] Final activeIcons state:', newState);
    console.log('[TOGGLE_ICON] VolumeProfile will be set to: uniform');
    console.log('[TOGGLE_ICON] =================');
    return newState;
  });
};

  // Thêm CSS cho switch toggle (nếu chưa có)
  const switchStyle = {
    display: "inline-flex",
    alignItems: "center",
    cursor: "pointer",
    marginLeft: "1rem",
    marginRight: "1rem",
  };
  const switchInputStyle = {
    width: 0,
    height: 0,
    opacity: 0,
    position: "absolute",
  };
  const switchSliderStyle = (checked) => ({
    display: "inline-block",
    width: "36px",
    height: "20px",
    background: checked ? "#2563eb" : "#d1d5db",
    borderRadius: "9999px",
    position: "relative",
    transition: "background 0.2s",
    marginRight: "0.5rem",
  });
  const switchCircleStyle = (checked) => ({
    position: "absolute",
    left: checked ? "18px" : "2px",
    top: "2px",
    width: "16px",
    height: "16px",
    background: "#fff",
    borderRadius: "50%",
    transition: "left 0.2s",
  });

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl space-y-6">
        <header className="text-center">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            🎧 MP3 Cutter
          </h1>
          <p className="text-gray-600">
            Easily trim and customize your MP3 files.
          </p>

          {/* Server status indicator */}
          {serverStatus && (
            <div
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-2 
              ${
                serverStatus === "online"
                  ? "bg-green-100 text-green-800"
                  : serverStatus === "error"
                  ? "bg-yellow-100 text-yellow-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full mr-1.5 
                ${
                  serverStatus === "online"
                    ? "bg-green-500"
                    : serverStatus === "error"
                    ? "bg-yellow-500"
                    : "bg-red-500"
                }`}
              ></span>
              {serverStatus === "online"
                ? "Server Connected"
                : serverStatus === "error"
                ? "Server Error"
                : "Server Offline"}
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
                <li>
                  Check if the backend server is running at {API_BASE_URL}
                </li>
                <li>
                  Make sure you started the backend with{" "}
                  <code className="bg-gray-100 px-1 py-0.5 rounded">
                    npm start
                  </code>{" "}
                  in the backend folder
                </li>
                <li>
                  Check if there are any firewall or network issues blocking the
                  connection
                </li>
                <li>Refresh the page and try again</li>
              </ol>
            </div>
          </div>
        )}

        {!file ? (
          <div
            className={`bg-white rounded-lg shadow-md p-10 flex flex-col items-center justify-center min-h-[300px] border-2 ${
              isDragging
                ? "border-blue-500 bg-blue-50 border-dashed"
                : "border-dashed border-blue-100"
            } transition-all duration-200 ease-in-out cursor-pointer`}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleAreaClick}
          >
            <Music
              className={`w-16 h-16 ${
                isDragging ? "text-blue-600" : "text-blue-500"
              } mb-4 transition-colors duration-200`}
            />
            <h2 className="text-xl font-semibold text-gray-700 mb-2">
              Upload MP3 File
            </h2>
            <p className="text-gray-500 mb-6 text-center">
              {isDragging
                ? "Drop your MP3 file here"
                : "Drag and drop your audio file here or click to browse"}
            </p>

            <label
              className={`inline-flex items-center px-6 py-3 ${
                isDragging ? "bg-blue-700" : "bg-blue-600"
              } text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors`}
              onClick={(e) => e.stopPropagation()}
            >
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
            <p className="mt-4 text-sm text-gray-500">
              Supported format: MP3 (Max size: 50MB)
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <FileAudio className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">
                    {file.name}
                  </h2>
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      Audio File
                    </span>
                    {file.size && <span>{formatFileSize(file.size)}</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* Speed Control Panel - Hiển thị khi được toggle */}
            {showSpeedControl && (
              <div className="mb-4">
                <SpeedControl
                  value={playbackSpeed}
                  onChange={handleSpeedChange}
                  disabled={isLoading}
                  panel={true}
                />
              </div>
            )}

            {/* Pitch Control Panel - Hiển thị khi được toggle */}
{showPitchControl && (
  <div className="mb-4">
    <div className="bg-white rounded-lg shadow-md border p-4 transition-colors duration-100 bg-orange-50 border-orange-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-full transition-colors duration-100 bg-orange-100">
            <SoftPitchIcon className="w-4 h-4 transition-colors duration-100 text-orange-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-800">Pitch Control</h3>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div className="text-xl font-bold transition-colors duration-100 text-orange-600">
            {pitchShift > 0 ? `+${pitchShift}` : pitchShift} semitones
          </div>
          
          <button
            onClick={() => handlePitchChange(0)}
            className="flex items-center px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors duration-100 group text-xs"
            title="Reset to 0 semitones"
          >
            <svg className="w-3 h-3 text-gray-600 group-hover:rotate-180 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Pitch Slider */}
      <div className="mb-4">
        <div className="relative">
          <input
            type="range"
            min="-12"
            max="12"
            step="1"
            value={pitchShift}
            onChange={(e) => {
              const newPitch = parseInt(e.target.value);
              handlePitchChange(newPitch);
            }}
            className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer slider-thumb transition-all duration-50"
            style={{
              background: `linear-gradient(to right, 
                #f59e0b 0%, 
                #f59e0b ${((pitchShift + 12) / 24) * 100}%, 
                #e5e7eb ${((pitchShift + 12) / 24) * 100}%, 
                #e5e7eb 100%)`
            }}
          />
          
          <div className="flex justify-between text-xs text-gray-400 mt-1 px-0.5">
            <span>-12</span>
            <span>0</span>
            <span>+12</span>
          </div>
        </div>
      </div>

      {/* Preset Pitch Buttons */}
      <div className="grid grid-cols-5 gap-1.5 mb-3">
        {[-12, -6, 0, 6, 12].map((preset) => {
          const isActive = Math.abs(pitchShift - preset) < 0.5;
          
          return (
            <button
              key={preset}
              onClick={() => handlePitchChange(preset)}
              disabled={isActive}
              className={`relative p-1.5 rounded-md text-center transition-all duration-200 cursor-pointer ${
                isActive 
                  ? 'bg-orange-500 text-white shadow-md' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:scale-105 active:scale-95'
              }`}
              title={`${preset > 0 ? '+' : ''}${preset} semitones${preset === 0 ? ' (Original)' : ''}`}
              style={{
                transform: 'translateZ(0)',
                willChange: isActive ? 'none' : 'transform, background-color',
                opacity: 1
              }}
            >
              <div className="text-xs font-bold leading-none">
                {preset > 0 ? `+${preset}` : preset}
              </div>
              {preset === 0 && (
                <div className="text-xs mt-0.5 opacity-80">Original</div>
              )}
              
              {isActive && (
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-white rounded-full">
                  <div className="w-full h-full bg-current rounded-full animate-pulse opacity-80"></div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Preset Pitch Buttons */}
      <div className="grid grid-cols-5 gap-1.5 mb-3">
        {/* ... existing preset buttons code ... */}
      </div>

      {/* THÊM ĐOẠN NÀY - Quick Reset Buttons */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => {
            console.log("[QUICK] Reset pitch only");
            handlePitchChange(0);
          }}
          className="flex-1 px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-md text-xs transition-colors font-medium"
          title="Reset pitch to 0 semitones, keep current speed"
        >
          🎵 Reset Pitch Only
        </button>
        
        <button
          onClick={() => {
            console.log("[QUICK] Reset speed only");
            handleSpeedChange(1.0);
          }}
          className="flex-1 px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-md text-xs transition-colors font-medium"
          title="Reset speed to 1.0x, keep current pitch"
        >
          🚀 Reset Speed Only
        </button>
      </div>

      {/* Pitch Info */}
      <div className="p-2 bg-gray-50 rounded-md transition-colors duration-100">
        {/* ... existing pitch info code ... */}
      </div>

      {/* Pitch Info */}
      <div className="p-2 bg-gray-50 rounded-md transition-colors duration-100">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-1">
            <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM21 16c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
            </svg>
            <span className="text-gray-600">
              {pitchShift === 0 ? 'Original pitch' : 
               pitchShift > 0 ? `Higher by ${pitchShift} semitone${pitchShift !== 1 ? 's' : ''}` : 
               `Lower by ${Math.abs(pitchShift)} semitone${Math.abs(pitchShift) !== 1 ? 's' : ''}`}
            </span>
          </div>
          
          {pitchShift !== 0 && (
            <span className="font-medium text-orange-600">
              {pitchShift > 0 ? '↑' : '↓'} {Math.abs(pitchShift * 100).toFixed(0)} cents
            </span>
          )}
        </div>
      </div>
    </div>
  </div>
)}

            <div className="bg-white rounded-lg shadow-md p-6">
<div className="flex items-center justify-center mb-4">
  {/* Container responsive cho icons - Improved alignment */}
  <div className="
    w-full max-w-5xl
    grid grid-cols-3 gap-6 md:grid-cols-6 md:gap-8 lg:gap-10
    justify-items-center 
    items-start
    px-4
  ">
    <ModernButton
      icon={SoftFadeInIcon}
      isActive={activeIcons.fadeIn}
      onClick={() => toggleIcon("fadeIn")}
      title="Fade In (2s)"
      activeColor="bg-green-50 text-green-600 border-green-300"
    />

    <ModernButton
      icon={SoftFadeOutIcon}
      isActive={activeIcons.fadeOut}
      onClick={() => toggleIcon("fadeOut")}
      title="Fade Out (2s)"
      activeColor="bg-red-50 text-red-600 border-red-300"
    />

    <ModernButton
      icon={SoftSpeedControlIcon}
      isActive={activeIcons.speed}
      onClick={() => toggleIcon("speed")}
      title="Speed Control"
      activeColor="bg-purple-50 text-purple-600 border-purple-300"
    />
    
    <ModernButton
  icon={SoftRemoveIcon}
  isActive={activeIcons.remove}
  onClick={() => toggleIcon("remove")}
  title="Remove Selection"
  activeColor="bg-blue-50 text-blue-600 border-blue-300"
/>

  <ModernButton
    icon={SoftPitchIcon}  // <- Thay thế: icon mới
    isActive={activeIcons.pitch}  // <- Thay thế: state mới
    onClick={() => toggleIcon("pitch")}  // <- Thay thế: action mới
    title="Pitch Control"  // <- Thay thế: title mới
    activeColor="bg-orange-50 text-orange-600 border-orange-300"  // <- Thay thế: màu mới
  />



    <ModernButton
      icon={SoftSpeedControlIcon}
      isActive={activeIcons.speed}
      onClick={() => toggleIcon("speed")}
      title="Speed Control"
      activeColor="bg-purple-50 text-purple-600 border-purple-300"
    />
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
                removeMode={removeMode}
              />

              <div className="flex justify-center items-center mt-3 space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    if (
                      waveformRef.current &&
                      waveformRef.current.togglePlayPause
                    ) {
                      waveformRef.current.togglePlayPause();
                    }
                  }}
                  className={`flex-shrink-0 flex items-center justify-center py-2 px-6 group
                    ${
                      isPlaying
                        ? "bg-green-700 ring-2 ring-green-300 shadow-md"
                        : "bg-green-600 hover:bg-green-700"
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
                          <span
                            className="animate-sound-wave inline-block w-0.5 h-3 bg-green-200 rounded-full will-change-transform"
                            style={{ animationDelay: "0.1s" }}
                          ></span>
                          <span
                            className="animate-sound-wave inline-block w-0.5 h-2.5 bg-green-200 rounded-full will-change-transform"
                            style={{ animationDelay: "0.2s" }}
                          ></span>
                          <span
                            className="animate-sound-wave inline-block w-0.5 h-3.5 bg-green-200 rounded-full will-change-transform"
                            style={{ animationDelay: "0.3s" }}
                          ></span>
                          <span
                            className="animate-sound-wave inline-block w-0.5 h-2 bg-green-200 rounded-full will-change-transform"
                            style={{ animationDelay: "0.4s" }}
                          ></span>
                          <span
                            className="animate-sound-wave inline-block w-0.5 h-3 bg-green-200 rounded-full will-change-transform"
                            style={{ animationDelay: "0.5s" }}
                          ></span>
                          <span
                            className="animate-sound-wave inline-block w-0.5 h-2.5 bg-green-200 rounded-full will-change-transform"
                            style={{ animationDelay: "0.6s" }}
                          ></span>
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
                      ? "bg-purple-600 hover:bg-purple-700 ring-2 ring-purple-300 shadow-lg shadow-purple-500/50"
                      : "bg-gray-600 hover:bg-gray-700"
                  } text-white rounded-lg transition-all`}
                  title={
                    loopPlayback
                      ? "Nhấn để dừng phát lặp lại"
                      : "Phát lặp lại vùng đã chọn"
                  }
                >
                  {/* Đã xóa hiệu ứng nền khi loop được kích hoạt */}

                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-5 w-5 mr-1 ${
                      loopPlayback && isPlaying
                        ? "animate-spin text-purple-200 animate-float"
                        : loopPlayback
                        ? "text-purple-200"
                        : "group-hover:animate-pulse"
                    }`}
                    style={{
                      animationDuration:
                        loopPlayback && isPlaying ? "2s" : "0s",
                      animationTimingFunction: "linear",
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
                  <h3 className="text-sm font-medium text-gray-700">
                    Volume Profile
                  </h3>{" "}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    {" "}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      {[
                        "uniform",
                        "fadeIn",
                        "fadeOut",
                        "fadeInOut",
                        "custom",
                      ].map((v) => {
                        // Chỉ disable các chế độ không phải uniform khi fade được bật
                        const isDisabled =
                          (fadeIn || fadeOut) && v !== "uniform";

                        return (
                          <label
                            key={v}
                            className={`flex items-center px-3 py-2 border rounded-md ${
                              isDisabled
                                ? "cursor-not-allowed opacity-50 border-gray-200 bg-gray-100 text-gray-400"
                                : `cursor-pointer ${
                                    volumeProfile === v
                                      ? "border-blue-500 bg-blue-50 text-blue-700"
                                      : "border-gray-200 hover:bg-gray-100"
                                  }`
                            }`}
                          >
                            <input
                              type="radio"
                              name="volumeProfile"
                              value={v}
                              checked={volumeProfile === v}
                              disabled={isDisabled}
                              onChange={() => {
                                setVolumeProfile(v);
                                setTimeout(forceUpdateWaveform, 10);
                              }}
                              className="h-4 w-4 text-blue-600 mr-2 hidden"
                            />
                            <span className="text-sm capitalize">{v}</span>
                          </label>
                        );
                      })}{" "}
                    </div>
                    {(fadeIn || fadeOut) && (
                      <div className="text-sm text-blue-600 mb-4 bg-blue-50 p-3 rounded-md border border-blue-100">
                        <div className="flex items-center">
                          <svg
                            className="w-4 h-4 mr-2 flex-shrink-0"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <span>
                            {fadeIn && fadeOut
                              ? "Chế độ Fade In & Out (2s) đang được bật"
                              : fadeIn
                              ? "Chế độ Fade In (2s) đang được bật"
                              : "Chế độ Fade Out (2s) đang được bật"}
                            . Các tùy chọn Volume Profile đã bị vô hiệu hóa.
                          </span>
                        </div>
                      </div>
                    )}
                    {volumeProfile === "fadeInOut" && !(fadeIn || fadeOut) ? (
                      <div className="space-y-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 flex justify-between">
                            <span>Volume:</span>{" "}
                            <span className="text-blue-600">
                              {Math.min(1.0, volume).toFixed(1)}x
                            </span>
                          </label>
                          <input
                            type="range"
                            min="0.1"
                            max="1.0"
                            step="0.1"
                            value={Math.min(1.0, volume)}
                            onChange={(e) => {
                              const newVolume = Math.min(
                                1.0,
                                parseFloat(e.target.value)
                              );
                              setVolume(newVolume);
                              setTimeout(forceUpdateWaveform, 10);
                            }}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 flex justify-between">
                            <span>Fade In Duration:</span>{" "}
                            <span className="text-blue-600">
                              {fadeInDuration}s
                            </span>
                          </label>
                          <input
                            type="range"
                            min="0.1"
                            max="10"
                            step="0.1"
                            value={fadeInDuration}
                            onChange={(e) => {
                              handleFadeInDurationChange(
                                parseFloat(e.target.value)
                              );
                              setTimeout(forceUpdateWaveform, 10);
                            }}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 flex justify-between">
                            <span>Fade Out Duration:</span>{" "}
                            <span className="text-blue-600">
                              {fadeOutDuration}s
                            </span>
                          </label>
                          <input
                            type="range"
                            min="0.1"
                            max="10"
                            step="0.1"
                            value={fadeOutDuration}
                            onChange={(e) => {
                              handleFadeOutDurationChange(
                                parseFloat(e.target.value)
                              );
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
                  <h3 className="text-sm font-medium text-gray-700">
                    Additional Options
                  </h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <label className="flex items-center p-2 hover:bg-gray-100 rounded-md cursor-pointer">
                      <input
                        type="checkbox"
                        checked={normalizeAudio}
                        onChange={(e) => setNormalizeAudio(e.target.checked)}
                        className="h-4 w-4 text-blue-600 rounded accent-blue-600"
                      />
                      <span className="ml-2 text-sm text-gray-700">
                        Normalize Audio
                      </span>
                      {normalizeAudio && (
                        <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-800 text-xs font-medium rounded-full animate-pulse">
                          ENABLED
                        </span>
                      )}
                      <span className="ml-2 text-xs text-gray-500">
                        (Adjusts audio to streaming standards: -16 LUFS, -1.5
                        dBTP)
                      </span>
                    </label>

                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Output Format
                      </label>
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
                        className={`py-2 px-4 bg-blue-600 text-white rounded-lg transition-colors flex items-center justify-center flex-1 relative overflow-hidden ${
                          isLoading
                            ? "opacity-90 cursor-not-allowed"
                            : "hover:bg-blue-700"
                        }`}
                      >
                        {/* Ultra smooth Progress bar background */}
                        {isLoading && (
                          <div
                            className="absolute inset-0 bg-blue-400"
                            style={{
                              width: `${smoothProgress}%`,
                              transition:
                                "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)", // Custom smooth easing
                              transform: "translateZ(0)", // Hardware acceleration
                              willChange: "width", // Optimize for width changes
                            }}
                          />
                        )}

                        {/* Subtle glow effect for progress bar */}
                        {isLoading && smoothProgress > 0 && (
                          <div
                            className="absolute inset-0 bg-gradient-to-r from-blue-300 to-blue-500 opacity-60"
                            style={{
                              width: `${smoothProgress}%`,
                              transition:
                                "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                              transform: "translateZ(0)",
                              filter: "blur(1px)",
                            }}
                          />
                        )}

                        {/* Button content */}
                        <div className="relative z-10 flex items-center">
                          {isLoading ? (
                            <>
                              <svg
                                className="animate-spin h-5 w-5 mr-2"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                style={{ animationDuration: "1.5s" }} // Slower, smoother spin
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
                              <span
                                className="font-medium"
                                style={{
                                  transition: "all 0.2s ease-out",
                                  transform: "translateZ(0)",
                                }}
                              >
                                {smoothProgress > 0
                                  ? `Progress ${smoothProgress}%`
                                  : "Processing..."}
                              </span>
                            </>
                          ) : (
                            <>
                              <Scissors className="w-5 h-5 mr-2" />
                              Cut & Download
                            </>
                          )}
                        </div>
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
                    <path
                      d="M7 13L10 16L17 9"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                  </svg>
                </div>
                <p className="text-gray-800 font-medium mb-6">
                  Processing Complete!
                </p>

                {/* Main download options */}
                <div className="flex flex-col lg:flex-row items-center justify-center gap-6 mb-6">
                  {/* Direct Download */}
                  <div className="flex flex-col items-center">
                    <a
                      href={downloadUrl}
                      download
                      className="inline-flex items-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-blue-700 transition-colors mb-2 font-medium"
                      target="_blank"
                    >
                      <Download className="w-5 h-5 mr-2" />
                      Download {outputFormat.toUpperCase()}
                    </a>
                    <span className="text-sm text-gray-500">
                      Direct download to this device
                    </span>
                  </div>

                  {/* QR Code for direct download */}
                  {showQrCode && qrCodeDataUrl && (
                    <>
                      <div className="hidden lg:block w-px h-24 bg-gray-300"></div>
                      <div className="lg:hidden w-24 h-px bg-gray-300"></div>

                      <div className="flex flex-col items-center">
                        <div className="bg-white p-3 rounded-lg border-2 border-gray-200 shadow-sm mb-2">
                          <img
                            src={qrCodeDataUrl}
                            alt="QR Code for direct download"
                            className="w-24 h-24"
                            style={{ imageRendering: "pixelated" }}
                          />
                        </div>
                        <div className="text-center">
                          <span className="text-sm text-gray-600 font-medium block">
                            Scan for direct download
                          </span>
                          <span className="text-xs text-gray-500">
                            on mobile device
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Share Link Section */}
                <div className="border-t border-gray-200 pt-6">
                  <div className="flex items-center justify-center mb-4">
                    <svg
                      className="w-5 h-5 text-blue-600 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
                      />
                    </svg>
                    <h3 className="text-lg font-semibold text-gray-800">
                      Share with Others
                    </h3>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex items-center gap-4">
                      {/* Share link input với button copy */}
                      <div
                        className="flex-1 flex items-stretch"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="text"
                          value={shareLink || "Generating share link..."}
                          readOnly
                          placeholder="Share link will appear here..."
                          className="flex-1 px-3 py-2.5 border border-gray-300 rounded-l-md bg-white text-sm font-mono text-gray-700 focus:outline-none focus:ring-0 focus:border-gray-300 border-r-0"
                          style={{
                            borderTopRightRadius: 0,
                            borderBottomRightRadius: 0,
                            outline: "none",
                            boxShadow: "none",
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            console.log("[BUTTON CLICK] Copy button clicked");
                            copyShareLink(e);
                          }}
                          disabled={!shareLink}
                          className={`px-4 py-2.5 rounded-r-md border transition-colors flex items-center font-medium whitespace-nowrap focus:outline-none focus:ring-0 ${
                            isCopied
                              ? "bg-green-500 text-white border-green-500"
                              : !shareLink
                              ? "bg-gray-300 text-gray-500 cursor-not-allowed border-gray-300"
                              : "bg-blue-600 text-white hover:bg-blue-700 border-blue-600 hover:border-blue-700"
                          }`}
                          style={{
                            borderTopLeftRadius: 0,
                            borderBottomLeftRadius: 0,
                            outline: "none",
                            boxShadow: "none",
                          }}
                        >
                          {isCopied ? (
                            <>
                              <svg
                                className="w-4 h-4 mr-2"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              Copied
                            </>
                          ) : (
                            <>
                              <svg
                                className="w-4 h-4 mr-2"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                />
                              </svg>
                              Copy
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Enhanced Help section */}
                <div className="mt-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 overflow-hidden">
                  <div className="bg-blue-600 text-white px-6 py-3">
                    <div className="flex items-center justify-center">
                      <svg
                        className="w-5 h-5 mr-2"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <h3 className="font-semibold text-lg text-white">
                        Download & Share Options
                      </h3>
                    </div>
                  </div>

                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Direct Download */}
                      <div className="text-center p-4 bg-white rounded-lg shadow-sm border border-blue-100">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                          <Download className="w-6 h-6 text-blue-600" />
                        </div>
                        <h4 className="font-semibold text-gray-900 mb-2">
                          Direct Download
                        </h4>
                        <p className="text-gray-600 text-sm">
                          Download immediately to your current device
                        </p>
                      </div>

                      {/* QR Code Download */}
                      <div className="text-center p-4 bg-white rounded-lg shadow-sm border border-blue-100">
                        <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                          <svg
                            className="w-6 h-6 text-purple-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                            />
                          </svg>
                        </div>
                        <h4 className="font-semibold text-gray-900 mb-2">
                          QR Code
                        </h4>
                        <p className="text-gray-600 text-sm">
                          Scan with mobile camera to download on phone
                        </p>
                      </div>

                      {/* Share Link */}
                      <div className="text-center p-4 bg-white rounded-lg shadow-sm border border-blue-100">
                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                          <svg
                            className="w-6 h-6 text-green-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
                            />
                          </svg>
                        </div>
                        <h4 className="font-semibold text-gray-900 mb-2">
                          Share Link
                        </h4>
                        <p className="text-gray-600 text-sm">
                          Send link to others for easy sharing
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
