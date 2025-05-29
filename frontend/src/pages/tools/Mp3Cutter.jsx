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
  Gauge,
} from "lucide-react";
import SpeedControl from "../../components/SpeedControl";
import PitchControl from "../../components/PitchControl";
import React, {
  useRef,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import "../../components/SpeedControl.css";
import "../../components/PitchControl.css";
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

  // Undo/Redo functionality for region selection
  const [undoHistory, setUndoHistory] = useState([]);
  const [redoHistory, setRedoHistory] = useState([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [previousRegion, setPreviousRegion] = useState(null);
  const maxHistorySize = 20; // Giới hạn 10 thao tác undo

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

        case "z": // Ctrl+Z - Undo
        case "Z":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleUndo();
          }
          break;

        case "y": // Ctrl+Y - Redo
        case "Y":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleRedo();
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
    return () => {
      console.log('[CLEANUP] 🧹 Component unmounting...');
      
      // Cancel any pending retries
      if (window.pitchRetryOnNextToggle) {
        window.pitchRetryOnNextToggle = null;
      }
      
      console.log('[CLEANUP] ✅ Cleanup completed');
    };
  }, []);

  // Undo/Redo functions for region selection
  const saveRegionToHistory = useCallback((start, end, source = 'manual') => {
    console.log(`[UNDO_HISTORY] 📝 Attempting to save: ${start.toFixed(4)}s - ${end.toFixed(4)}s (${source})`);
    
    const newRegion = { 
      start: parseFloat(start.toFixed(4)), 
      end: parseFloat(end.toFixed(4)),
      timestamp: Date.now(),
      source
    };
  
    setUndoHistory(prev => {
      // ✅ IMPROVED: Kiểm tra duplicate với tolerance và log chi tiết
      const lastRegion = prev[prev.length - 1];
      
      if (lastRegion) {
        const startDiff = Math.abs(lastRegion.start - newRegion.start);
        const endDiff = Math.abs(lastRegion.end - newRegion.end);
        const isDuplicate = startDiff < 0.001 && endDiff < 0.001;
        
        console.log(`[UNDO_HISTORY] 🔍 Duplicate check:`, {
          lastRegion: `${lastRegion.start.toFixed(4)}s - ${lastRegion.end.toFixed(4)}s`,
          newRegion: `${newRegion.start.toFixed(4)}s - ${newRegion.end.toFixed(4)}s`,
          startDiff: startDiff.toFixed(6),
          endDiff: endDiff.toFixed(6),
          isDuplicate
        });
        
        if (isDuplicate) {
          console.log('[UNDO_HISTORY] ⏭️ Skipping duplicate region');
          return prev;
        }
      }
      
      console.log(`[UNDO_HISTORY] ✅ Adding new region to history`);
      const newHistory = [...prev, newRegion];
      
      // ✅ DEBUG: Log toàn bộ history với index rõ ràng
      console.log(`[UNDO_HISTORY] 📚 Complete history after save:`, newHistory.map((h, i) => 
        `[${i}]: ${h.start.toFixed(4)}s - ${h.end.toFixed(4)}s (${h.source})`
      ));
      
      if (newHistory.length > maxHistorySize) {
        newHistory.shift();
        console.log('[UNDO_HISTORY] ⚠️ History size limited, removed oldest entry');
      }
      
      return newHistory;
    });
  
    // Clear redo history khi có thao tác mới
    if (redoHistory.length > 0) {
      setRedoHistory([]);
      console.log('[UNDO_HISTORY] 🗑️ Cleared redo history due to new action');
    }
  }, [redoHistory.length, maxHistorySize]);

  
  const handleRegionChange = (start, end, shouldSaveHistory = false, source = 'unknown') => {
    console.log(`[HANDLE_REGION_CHANGE] start: ${start.toFixed(4)}, end: ${end.toFixed(4)}, shouldSave: ${shouldSaveHistory}, source: ${source}`);
    
    // ✅ FIXED: Lưu previous region TRƯỚC KHI update refs
    const hasValidRefs = startRef.current !== undefined && 
                        endRef.current !== undefined && 
                        isFinite(startRef.current) && 
                        isFinite(endRef.current);
    
    // CHỈ lưu history khi shouldSaveHistory = true VÀ có refs hợp lệ
    if (shouldSaveHistory && hasValidRefs) {
      // ✅ CRITICAL: Lưu PREVIOUS region (từ refs) vào history
      console.log(`[HANDLE_REGION_CHANGE] ✅ Saving PREVIOUS region to history: ${startRef.current.toFixed(4)} - ${endRef.current.toFixed(4)}`);
      saveRegionToHistory(startRef.current, endRef.current, source);
    } else if (shouldSaveHistory && !hasValidRefs) {
      console.log(`[HANDLE_REGION_CHANGE] ⚠️ Cannot save history - refs not properly initialized`);
    } else if (!shouldSaveHistory) {
      console.log(`[HANDLE_REGION_CHANGE] ⏭️ Skipping history save (shouldSave = false)`);
    }
  
    // ✅ FIXED: Update refs AFTER saving previous state to history
    startRef.current = start;
    endRef.current = end;
    setDisplayStart(start.toFixed(2));  
    setDisplayEnd(end.toFixed(2));
    
    console.log(`[HANDLE_REGION_CHANGE] ✅ Region updated to: ${start.toFixed(4)}s - ${end.toFixed(4)}s`);
  };

  const handleUndo = useCallback(() => {
    console.log('[UNDO] 🔄 Starting undo operation...');
    console.log('[UNDO] 📚 Current undo history length:', undoHistory.length);
    console.log('[UNDO] 📚 Current redo history length:', redoHistory.length);
    
    if (undoHistory.length === 0) {
      console.log('[UNDO] ❌ No history to undo');
      return;
    }
  
    // ✅ CRITICAL: Lấy region hiện tại TRƯỚC KHI thay đổi
    const currentRegion = waveformRef.current?.getRegionBounds();
    if (!currentRegion) {
      console.error('[UNDO] ❌ Cannot get current region bounds');
      return;
    }
  
    console.log(`[UNDO] 📍 Current region: ${currentRegion.start.toFixed(4)}s - ${currentRegion.end.toFixed(4)}s`);
  
    // ✅ FIXED: Lấy previous state TRƯỚC KHI modify undo history
    const previousState = undoHistory[undoHistory.length - 1];
    console.log(`[UNDO] 📍 Previous state to restore: ${previousState.start.toFixed(4)}s - ${previousState.end.toFixed(4)}s (${previousState.source})`);
  
    // ✅ IMPROVED: Giảm threshold xuống 0.0001 để sensitive hơn
    const startDiff = Math.abs(currentRegion.start - previousState.start);
    const endDiff = Math.abs(currentRegion.end - previousState.end);
    const hasSignificantChange = startDiff > 0.0001 || endDiff > 0.0001;
    
    console.log(`[UNDO] 🔍 Change analysis:`, {
      startDiff: startDiff.toFixed(6),
      endDiff: endDiff.toFixed(6),
      hasSignificantChange,
      threshold: '0.0001'
    });
  
    if (!hasSignificantChange) {
      console.log('[UNDO] ⚠️ No significant change detected - threshold too small, forcing undo anyway for debug');
      // ✅ DEBUG: Force undo anyway to debug the issue
      console.log('[UNDO] 🔧 Forcing undo for debugging...');
    }
  
    // Lưu trạng thái hiện tại vào redo stack
    const currentState = {
      start: parseFloat(currentRegion.start.toFixed(4)),
      end: parseFloat(currentRegion.end.toFixed(4)),
      timestamp: Date.now(),
      source: 'undo_save'
    };
  
    console.log(`[UNDO] 💾 Saving current state to redo: ${currentState.start.toFixed(4)}s - ${currentState.end.toFixed(4)}s`);
  
    // ✅ ATOMIC: Update cả undo và redo history cùng lúc
    setUndoHistory(prev => {
      const newUndoHistory = prev.slice(0, -1);
      console.log(`[UNDO] 📚 New undo history length: ${newUndoHistory.length}`);
      return newUndoHistory;
    });
    
    setRedoHistory(prev => {
      const newRedoHistory = [...prev, currentState];
      console.log(`[UNDO] 📚 New redo history length: ${newRedoHistory.length}`);
      return newRedoHistory;
    });
  
    // ✅ APPLY: Áp dụng previous state
    console.log(`[UNDO] 🎯 Applying previous state: ${previousState.start.toFixed(4)}s - ${previousState.end.toFixed(4)}s`);
    
    if (waveformRef.current) {
      try {
        const success = waveformRef.current.setRegionBounds(previousState.start, previousState.end);
        
        if (success) {
          // Update refs and display
          startRef.current = previousState.start;
          endRef.current = previousState.end;
          setDisplayStart(previousState.start.toFixed(2));
          setDisplayEnd(previousState.end.toFixed(2));
          
          // ✅ CRITICAL: Gọi handleRegionChange với shouldSave = false
          handleRegionChange(previousState.start, previousState.end, false, 'undo_restore');
          
          console.log('[UNDO] ✅ Undo completed successfully');
        } else {
          console.error('[UNDO] ❌ Failed to set region bounds');
          // Rollback changes nếu failed
          setUndoHistory(prev => [...prev, previousState]);
          setRedoHistory(prev => prev.slice(0, -1));
        }
        
      } catch (error) {
        console.error('[UNDO] ❌ Error applying undo:', error);
        // Rollback changes nếu failed
        setUndoHistory(prev => [...prev, previousState]);
        setRedoHistory(prev => prev.slice(0, -1));
      }
    }
  }, [undoHistory, redoHistory, handleRegionChange]);

  const handleRedo = useCallback(() => {
    console.log('[REDO] 🔄 Starting redo operation...');
    console.log('[REDO] 📚 Current undo history length:', undoHistory.length);
    console.log('[REDO] 📚 Current redo history length:', redoHistory.length);
    
    if (redoHistory.length === 0) {
      console.log('[REDO] ❌ No redo history available');
      return;
    }
  
    // ✅ CRITICAL: Lấy region hiện tại TRƯỚC KHI thay đổi
    const currentRegion = waveformRef.current?.getRegionBounds();
    if (!currentRegion) {
      console.error('[REDO] ❌ Cannot get current region bounds');
      return;
    }
  
    console.log(`[REDO] 📍 Current region: ${currentRegion.start.toFixed(4)}s - ${currentRegion.end.toFixed(4)}s`);
  
    // ✅ FIXED: Lấy redo state TRƯỚC KHI modify redo history
    const redoState = redoHistory[redoHistory.length - 1];
    console.log(`[REDO] 📍 Redo state to apply: ${redoState.start.toFixed(4)}s - ${redoState.end.toFixed(4)}s (${redoState.source})`);
  
    // ✅ CRITICAL: Kiểm tra xem có thực sự khác biệt không
    const startDiff = Math.abs(currentRegion.start - redoState.start);
    const endDiff = Math.abs(currentRegion.end - redoState.end);
    const hasSignificantChange = startDiff > 0.001 || endDiff > 0.001;
    
    console.log(`[REDO] 🔍 Change analysis:`, {
      startDiff: startDiff.toFixed(6),
      endDiff: endDiff.toFixed(6),
      hasSignificantChange
    });
  
    if (!hasSignificantChange) {
      console.log('[REDO] ⚠️ No significant change detected, skipping redo');
      return;
    }
  
    // Lưu trạng thái hiện tại vào undo stack
    const currentState = {
      start: parseFloat(currentRegion.start.toFixed(4)),
      end: parseFloat(currentRegion.end.toFixed(4)),
      timestamp: Date.now(),
      source: 'redo_save'
    };
  
    console.log(`[REDO] 💾 Saving current state to undo: ${currentState.start.toFixed(4)}s - ${currentState.end.toFixed(4)}s`);
  
    // ✅ ATOMIC: Update cả undo và redo history cùng lúc
    setRedoHistory(prev => {
      const newRedoHistory = prev.slice(0, -1);
      console.log(`[REDO] 📚 New redo history length: ${newRedoHistory.length}`);
      return newRedoHistory;
    });
    
    setUndoHistory(prev => {
      const newUndoHistory = [...prev, currentState];
      console.log(`[REDO] 📚 New undo history length: ${newUndoHistory.length}`);
      return newUndoHistory;
    });
  
    // ✅ APPLY: Áp dụng redo state
    console.log(`[REDO] 🎯 Applying redo state: ${redoState.start.toFixed(4)}s - ${redoState.end.toFixed(4)}s`);
    
    if (waveformRef.current) {
      try {
        const success = waveformRef.current.setRegionBounds(redoState.start, redoState.end);
        
        if (success) {
          // Update refs and display
          startRef.current = redoState.start;
          endRef.current = redoState.end;
          setDisplayStart(redoState.start.toFixed(2));
          setDisplayEnd(redoState.end.toFixed(2));
          
          // ✅ CRITICAL: Gọi handleRegionChange với shouldSave = false
          handleRegionChange(redoState.start, redoState.end, false, 'redo_restore');
          
          console.log('[REDO] ✅ Redo completed successfully');
        } else {
          console.error('[REDO] ❌ Failed to set region bounds');
          // Rollback changes nếu failed
          setRedoHistory(prev => [...prev, redoState]);
          setUndoHistory(prev => prev.slice(0, -1));
        }
        
      } catch (error) {
        console.error('[REDO] ❌ Error applying redo:', error);
        // Rollback changes nếu failed  
        setRedoHistory(prev => [...prev, redoState]);
        setUndoHistory(prev => prev.slice(0, -1));
      }
    }
  }, [undoHistory, redoHistory, handleRegionChange]);

  // Update can undo/redo states
  useEffect(() => {
    setCanUndo(undoHistory.length > 0);
    setCanRedo(redoHistory.length > 0);
  }, [undoHistory.length, redoHistory.length]);

  useEffect(() => {
    console.log(`[HISTORY_MONITOR] 📊 History update:`, {
      undoLength: undoHistory.length,
      redoLength: redoHistory.length,
      canUndo,
      canRedo
    });
    
    if (undoHistory.length > 0) {
      console.log(`[HISTORY_MONITOR] 📚 Latest undo entries:`, 
        undoHistory.slice(-3).map((h, i) => 
          `${undoHistory.length - 3 + i}: ${h.start.toFixed(4)}s - ${h.end.toFixed(4)}s (${h.source})`
        )
      );
    }
    
    if (redoHistory.length > 0) {
      console.log(`[HISTORY_MONITOR] 📚 Latest redo entries:`, 
        redoHistory.slice(-3).map((h, i) => 
          `${redoHistory.length - 3 + i}: ${h.start.toFixed(4)}s - ${h.end.toFixed(4)}s (${h.source})`
        )
      );
    }
  }, [undoHistory.length, redoHistory.length, canUndo, canRedo]);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!file) {
      setError('❌ Chưa chọn file');
      return;
    }
  
    setIsLoading(true);
    setError('');
    setProcessingProgress(0);
  
    try {
      const regionBounds = waveformRef.current?.getRegionBounds();
  
      // Get audio duration from waveform instance
      const audioDuration = waveformRef.current?.getWavesurferInstance()?.getDuration() || 0;
  
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
      }
  
      if (validEnd <= 0) {
        console.error('[handleSubmit] End time is still 0 or negative:', validEnd);
        setError('❌ Thời gian kết thúc không hợp lệ. Hãy kiểm tra file audio.');
        setIsLoading(false);
        return;
      }
  
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
        outputFormat: outputFormat, // ← CRITICAL: THÊM DÒNG NÀY
      };
  
      console.log('[handleSubmit] Sending parameters:', parameters); // ← Debug log
  
      // Prepare and send request
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
  
      // Debug: Log formData contents
      console.log('[handleSubmit] FormData contents:');
      for (let [key, value] of formData.entries()) {
        console.log(`[handleSubmit] - ${key}:`, value);
      }
  
      const response = await fetch(`${API_BASE_URL}/api/cut-mp3`, {
        method: 'POST',
        body: formData,
      });
  
      if (!response.ok) {
        const errorData = await response.json();
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
            break;
          }
  
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;
  
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
  
          for (const line of lines) {
            if (line.trim()) {
              try {
                const data = JSON.parse(line);
  
                if (data.progress !== undefined) {
                  setProcessingProgress(data.progress);
  
                  if (data.progress >= 100) {
                    hasReached100 = true;
                  }
                }
  
                if (data.status) {
                  setProcessingStatus(data.status);
                }
  
                if (data.status === "completed" && data.filename && hasReached100) {
                  finalResult = data;
                } else if (data.status === "completed" && data.filename && !hasReached100) {
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
        setTimeout(async () => {
          const downloadUrl = `${API_BASE_URL}/output/${finalResult.filename}`;
          setDownloadUrl(downloadUrl);
  
          await generateQRCode(downloadUrl);
        }, 500);
      } else {
        console.error("[handleSubmit] Missing requirements - finalResult:", !!finalResult, "hasReached100:", hasReached100);
        throw new Error("Processing completed but final result not properly received");
      }
  
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


  const forceUpdateWaveform = () => {
    if (!waveformRef.current) {
      console.warn('[forceUpdateWaveform] waveformRef not available');
      return;
    }
  
    try {
      const currentPosition = waveformRef.current.wavesurferRef?.current?.getCurrentTime() || 0;
      
      // CRITICAL: Validate currentPosition
      if (!isFinite(currentPosition) || isNaN(currentPosition)) {
        console.error('[forceUpdateWaveform] Invalid currentPosition:', currentPosition);
        return;
      }
  
      // Validate startRef and endRef before using
      if (!isFinite(startRef.current) || !isFinite(endRef.current)) {
        console.error('[forceUpdateWaveform] Invalid refs:', { start: startRef.current, end: endRef.current });
        return;
      }
  
      // Try to update region directly if possible
      if (waveformRef.current.wavesurferRef?.current && waveformRef.current.regionRef?.current) {
        try {
          const region = waveformRef.current.regionRef.current;
          region.start = startRef.current;
          region.end = endRef.current;
  
          // Fire event if available
          if (waveformRef.current.wavesurferRef.current.fireEvent) {
            waveformRef.current.wavesurferRef.current.fireEvent("region-updated", region);
          }
        } catch (err) {
          console.warn('[forceUpdateWaveform] Could not update region directly:', err);
        }
      }
  
      // Update volume and overlay with validation
      if (typeof waveformRef.current.updateVolume === "function") {
        waveformRef.current.updateVolume(currentPosition, true);
      }
      
      if (typeof waveformRef.current.drawVolumeOverlay === "function") {
        waveformRef.current.drawVolumeOverlay();
      }
      
      console.log('[forceUpdateWaveform] ✅ Force update completed successfully');
    } catch (err) {
      console.error('[forceUpdateWaveform] Error updating waveform:', err);
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
                . Các tùy chọn Volume Profile đã bị vô hiệu hóa.
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

  // Fast speed reset - Only WaveSurfer speed control
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
        console.log("[RESET] - Pitch will be reset by Tone.js separately");
        
      } catch (error) {
        console.error("[RESET] ❌ Error resetting audio parameters:", error);
      }
    } else {
      console.warn("[RESET] ⚠️ WaveSurfer instance not available for reset");
    }
  }

  console.log("[RESET] 🎵 Resetting pitch-speed to normal...");
if (waveformRef.current) {
  const wavesurferInstance = waveformRef.current.getWavesurferInstance?.();
  if (wavesurferInstance) {
    try {
      wavesurferInstance.setPlaybackRate(1.0);
      console.log("[RESET] ✅ Pitch-speed reset to 1.0x completed");
    } catch (error) {
      console.error("[RESET] ❌ Error resetting pitch-speed:", error);
    }
  }
}

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
  console.log("[RESET] ✅ Complete reset finished - Ready for SoundTouch pitch system");
};

const setRegionStart = () => {
  console.log("[SET_REGION_START] Function called");

  if (!waveformRef.current) {
    console.error("[SET_REGION_START] waveformRef is null");
    return;
  }

  const wavesurferInstance = waveformRef.current.getWavesurferInstance
    ? waveformRef.current.getWavesurferInstance()
    : null;

  if (!wavesurferInstance) {
    console.error("[SET_REGION_START] WaveSurfer instance is not available");
    return;
  }

  try {
    const currentTime = wavesurferInstance.getCurrentTime();
    console.log(`[SET_REGION_START] Current time: ${currentTime.toFixed(4)}s`);

    // Lưu trạng thái hiện tại vào history TRƯỚC khi thay đổi
    if (startRef.current !== undefined && endRef.current !== undefined) {
      console.log("[SET_REGION_START] Saving current region to history");
      saveRegionToHistory(startRef.current, endRef.current, 'set_start_manual');
    }

    if (currentTime !== undefined && typeof waveformRef.current.setRegionStart === "function") {
      waveformRef.current.setRegionStart(currentTime);
      startRef.current = currentTime;
      setDisplayStart(currentTime.toFixed(2));
      console.log(`[SET_REGION_START] ✅ Region start updated to: ${currentTime.toFixed(4)}s`);
    } else {
      // Fallback method
      if (waveformRef.current.getRegion) {
        const region = waveformRef.current.getRegion();
        if (region) {
          const currentEnd = region.end;
          if (currentTime < currentEnd) {
            if (region.setOptions) {
              region.setOptions({ start: currentTime });
            } else if (region.update) {
              region.update({ start: currentTime });
            } else {
              region.start = currentTime;
            }
            startRef.current = currentTime;
            setDisplayStart(currentTime.toFixed(2));
            console.log(`[SET_REGION_START] ✅ Region start updated directly to: ${currentTime.toFixed(4)}s`);
          }
        }
      }
    }
  } catch (err) {
    console.error("[SET_REGION_START] Error:", err);
  }
};

const setRegionEnd = () => {
  console.log("[SET_REGION_END] Function called");

  if (!waveformRef.current) {
    console.error("[SET_REGION_END] waveformRef is null");
    return;
  }

  const wavesurferInstance = waveformRef.current.getWavesurferInstance
    ? waveformRef.current.getWavesurferInstance()
    : null;

  if (!wavesurferInstance) {
    console.error("[SET_REGION_END] WaveSurfer instance is not available");
    return;
  }

  try {
    const currentTime = wavesurferInstance.getCurrentTime();
    console.log(`[SET_REGION_END] Current time: ${currentTime.toFixed(4)}s`);

    // Lưu trạng thái hiện tại vào history TRƯỚC khi thay đổi
    if (startRef.current !== undefined && endRef.current !== undefined) {
      console.log("[SET_REGION_END] Saving current region to history");
      saveRegionToHistory(startRef.current, endRef.current, 'set_end_manual');
    }

    if (currentTime !== undefined && typeof waveformRef.current.setRegionEnd === "function") {
      waveformRef.current.setRegionEnd(currentTime);
      endRef.current = currentTime;
      setDisplayEnd(currentTime.toFixed(2));
      console.log(`[SET_REGION_END] ✅ Region end updated to: ${currentTime.toFixed(4)}s`);
    } else {
      // Fallback method
      if (waveformRef.current.getRegion) {
        const region = waveformRef.current.getRegion();
        if (region) {
          const currentStart = region.start;
          if (currentTime > currentStart) {
            if (region.setOptions) {
              region.setOptions({ end: currentTime });
            } else if (region.update) {
              region.update({ end: currentTime });
            } else {
              region.end = currentTime;
            }
            endRef.current = currentTime;
            setDisplayEnd(currentTime.toFixed(2));
            console.log(`[SET_REGION_END] ✅ Region end updated directly to: ${currentTime.toFixed(4)}s`);
          }
        }
      }
    }
  } catch (err) {
    console.error("[SET_REGION_END] Error:", err);
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
  console.log("[MP3CUTTER] Speed change requested:", speed);
  console.log("[MP3CUTTER] This should NOT trigger any backend calls");

  // Update state immediately for UI responsiveness
  setPlaybackSpeed(speed);

  if (waveformRef.current) {
    const wavesurferInstance = waveformRef.current.getWavesurferInstance?.();
    if (wavesurferInstance) {
      try {
        // CRITICAL: Preserve current position and playing state
        const currentPosition = wavesurferInstance.getCurrentTime();
        const wasPlaying = wavesurferInstance.isPlaying ? wavesurferInstance.isPlaying() : false;
        
        console.log(`[MP3CUTTER] SPEED CHANGE: Current position: ${currentPosition.toFixed(4)}s, Playing: ${wasPlaying}`);

        // Use requestAnimationFrame to avoid blocking UI
        requestAnimationFrame(() => {
          // Additional check in case component unmounted
          if (waveformRef.current) {
            const currentInstance = waveformRef.current.getWavesurferInstance?.();
            if (currentInstance) {
              // ENHANCED: Set speed without pausing if possible
              try {
                // Set new playback rate directly without pausing
                currentInstance.setPlaybackRate(speed);
                console.log("[MP3CUTTER] ✅ WaveSurfer playback rate set to:", speed);
                
                // Verify position is still correct after speed change
                const newPosition = currentInstance.getCurrentTime();
                const positionDrift = Math.abs(newPosition - currentPosition);
                
                if (positionDrift > 0.1) {
                  console.log(`[MP3CUTTER] Position drift detected (${positionDrift.toFixed(4)}s), correcting...`);
                  const totalDuration = currentInstance.getDuration();
                  if (totalDuration > 0) {
                    const seekRatio = currentPosition / totalDuration;
                    currentInstance.seekTo(seekRatio);
                    console.log(`[MP3CUTTER] ✅ Position corrected to: ${currentPosition.toFixed(4)}s`);
                  }
                }
                
                // CRITICAL: Ensure playback continues if it was playing
                if (wasPlaying) {
                  const regionBounds = waveformRef.current.getRegionBounds?.();
                  if (regionBounds) {
                    const regionEnd = regionBounds.end;
                    const actualPosition = currentInstance.getCurrentTime();
                    
                    // Only restart playback if WaveSurfer stopped
                    const isStillPlaying = currentInstance.isPlaying ? currentInstance.isPlaying() : false;
                    
                    if (!isStillPlaying) {
                      console.log(`[MP3CUTTER] ✅ Restarting playback from ${actualPosition.toFixed(4)}s to ${regionEnd.toFixed(4)}s at ${speed}x speed`);
                      
                      setTimeout(() => {
                        if (currentInstance && waveformRef.current) {
                          currentInstance.play(actualPosition, regionEnd);
                          
                          // CRITICAL: Ensure UI state stays in sync
                          setTimeout(() => {
                            if (waveformRef.current) {
                              const stillPlaying = currentInstance.isPlaying ? currentInstance.isPlaying() : false;
                              if (stillPlaying && !isPlaying) {
                                console.log("[MP3CUTTER] ✅ Syncing UI state to playing");
                                setIsPlaying(true);
                              } else if (!stillPlaying && isPlaying) {
                                console.log("[MP3CUTTER] ✅ Syncing UI state to stopped");
                                setIsPlaying(false);
                              }
                            }
                          }, 100);
                        }
                      }, 50);
                    } else {
                      console.log(`[MP3CUTTER] ✅ Playback continuing at ${speed}x speed`);
                    }
                  }
                }
                
              } catch (speedError) {
                console.error("[MP3CUTTER] Error setting speed directly, trying with pause method:", speedError);
                
                // Fallback: pause and resume method
                if (wasPlaying) {
                  currentInstance.pause();
                }
                
                currentInstance.setPlaybackRate(speed);
                
                if (wasPlaying) {
                  const totalDuration = currentInstance.getDuration();
                  const seekRatio = currentPosition / totalDuration;
                  currentInstance.seekTo(seekRatio);
                  
                  const regionBounds = waveformRef.current.getRegionBounds?.();
                  if (regionBounds) {
                    setTimeout(() => {
                      currentInstance.play(currentPosition, regionBounds.end);
                      setIsPlaying(true); // Explicitly restore playing state
                    }, 100);
                  }
                }
              }
            }
          }
        });
      } catch (error) {
        console.error("[MP3CUTTER] ❌ Error setting playback rate:", error);
      }
    } else {
      console.warn("[MP3CUTTER] WaveSurfer instance not available");
    }
  }
  
  console.log("[MP3CUTTER] ✅ Speed change completed - NO BACKEND INTERACTION");
};


const handlePitchChange = (semitones) => {
  console.log('[PITCH_CHANGE] 🎵 New pitch-speed control:', semitones, 'semitones');
  
  // Update UI immediately
  setPitchShift(semitones);
  
  if (waveformRef.current) {
    const wavesurferInstance = waveformRef.current.getWavesurferInstance?.();
    if (wavesurferInstance) {
      try {
        // Convert semitones to playback rate
        // Each semitone = 2^(1/12) ratio
        const pitchRatio = Math.pow(2, semitones / 12);
        console.log('[PITCH_CHANGE] Calculated playback rate:', pitchRatio.toFixed(4));
        
        // Preserve current position and playing state
        const currentPosition = wavesurferInstance.getCurrentTime();
        const wasPlaying = wavesurferInstance.isPlaying ? wavesurferInstance.isPlaying() : false;
        
        console.log('[PITCH_CHANGE] Current state - Position:', currentPosition.toFixed(4), 'Playing:', wasPlaying);
        
        // Apply new playback rate
        wavesurferInstance.setPlaybackRate(pitchRatio);
        console.log('[PITCH_CHANGE] ✅ Playback rate applied successfully');
        
        // If was playing, ensure it continues with new rate
        if (wasPlaying) {
          const regionBounds = waveformRef.current.getRegionBounds?.();
          if (regionBounds) {
            // Small delay to ensure rate change is applied
            setTimeout(() => {
              if (wavesurferInstance && waveformRef.current) {
                const currentPos = wavesurferInstance.getCurrentTime();
                console.log('[PITCH_CHANGE] Continuing playback from:', currentPos.toFixed(4));
                wavesurferInstance.play(currentPos, regionBounds.end);
              }
            }, 50);
          }
        }
        
        console.log('[PITCH_CHANGE] ✅ Pitch-speed change completed');
        
      } catch (error) {
        console.error('[PITCH_CHANGE] ❌ Error applying pitch change:', error);
      }
    } else {
      console.warn('[PITCH_CHANGE] WaveSurfer instance not available');
    }
  }
};











const toggleIcon = (icon) => {
  console.log('[TOGGLE_ICON] =================');
  console.log('[TOGGLE_ICON] Icon clicked:', icon);
  console.log('[TOGGLE_ICON] Current states before toggle:');
  console.log('[TOGGLE_ICON] - activeIcons:', activeIcons);
  console.log('[TOGGLE_ICON] - fadeIn:', fadeIn, 'fadeOut:', fadeOut);
  console.log('[TOGGLE_ICON] - volumeProfile:', volumeProfile);
  console.log('[TOGGLE_ICON] - showSpeedControl:', showSpeedControl);
  console.log('[TOGGLE_ICON] - showPitchControl:', showPitchControl);
  
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
      console.log('[TOGGLE_ICON] Speed control will be:', newState.speed ? 'SHOWN' : 'HIDDEN');
      setShowSpeedControl(newState.speed);
      
      // Đảm bảo chỉ một control panel được hiển thị tại một thời điểm
      if (newState.speed && showPitchControl) {
        console.log('[TOGGLE_ICON] Speed enabled - hiding pitch control');
        setShowPitchControl(false);
        newState.pitch = false;
      }
      
    } else if (icon === "pitch") {
      console.log('[TOGGLE_ICON] === PROCESSING PITCH TOGGLE ===');
      console.log('[TOGGLE_ICON] Pitch control will be:', newState.pitch ? 'SHOWN' : 'HIDDEN');
      setShowPitchControl(newState.pitch);
      
      // Đảm bảo chỉ một control panel được hiển thị tại một thời điểm
      if (newState.pitch && showSpeedControl) {
        console.log('[TOGGLE_ICON] Pitch enabled - hiding speed control');
        setShowSpeedControl(false);
        newState.speed = false;
      }
    }

    console.log('[TOGGLE_ICON] Final activeIcons state:', newState);
    console.log('[TOGGLE_ICON] Final showSpeedControl:', newState.speed ? 'TRUE' : 'FALSE');
    console.log('[TOGGLE_ICON] Final showPitchControl:', newState.pitch ? 'TRUE' : 'FALSE');
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
                  onClose={() => {
                    console.log('[MP3CUTTER] Speed Control close button clicked');
                    setShowSpeedControl(false);
                    setActiveIcons(prev => ({ ...prev, speed: false }));
                  }}
                />
              </div>
            )}       
{/* Pitch Control Panel - COMPACT VERSION */}
{showPitchControl && (
  <div className="mb-3">
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-800 flex items-center">
          <Music className="w-4 h-4 mr-1.5 text-orange-600" />
          Pitch Control
        </h3>
        <button
          type="button"
          onClick={() => {
            console.log('[PITCH_PANEL] Close button clicked');
            setShowPitchControl(false);
            setActiveIcons(prev => ({ ...prev, pitch: false }));
          }}
          className="text-gray-400 hover:text-gray-600 transition-colors p-0.5 hover:bg-gray-100 rounded"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <PitchControl
        value={pitchShift}
        onChange={handlePitchChange}
        onSpeedChange={handleSpeedChange}
        currentSpeed={playbackSpeed}
        disabled={isLoading}
        panel={true}
      />
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
                onRegionChange={(start, end, shouldSave, source) => handleRegionChange(start, end, shouldSave, source)}
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
                
                {/* Undo/Redo Controls */}
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={!canUndo}
                  className={`flex items-center py-2 px-3 rounded-lg transition-all group relative ${
                    canUndo
                      ? "bg-orange-600 hover:bg-orange-700 text-white"
                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
                  title={canUndo ? "Hoàn tác vùng cắt (Ctrl+Z)" : "Không có thao tác để hoàn tác"}
                >
                  <svg
                    className={`w-4 h-4 mr-1 transition-transform ${
                      canUndo ? "group-hover:scale-110" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                    />
                  </svg>
                  <span className="font-mono text-sm">Undo</span>
                  {canUndo && undoHistory.length > 0 && (
                    <span className="ml-1 text-xs bg-orange-300 text-orange-900 px-1 rounded-full">
                      {undoHistory.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleRedo}
                  disabled={!canRedo}
                  className={`flex items-center py-2 px-3 rounded-lg transition-all group relative ${
                    canRedo
                      ? "bg-teal-600 hover:bg-teal-700 text-white"
                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
                  title={canRedo ? "Làm lại vùng cắt (Ctrl+Y)" : "Không có thao tác để làm lại"}
                >
                  <svg
                    className={`w-4 h-4 mr-1 transition-transform ${
                      canRedo ? "group-hover:scale-110" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6"
                    />
                  </svg>
                  <span className="font-mono text-sm">Redo</span>
                  {canRedo && redoHistory.length > 0 && (
                    <span className="ml-1 text-xs bg-teal-300 text-teal-900 px-1 rounded-full">
                      {redoHistory.length}
                    </span>
                  )}
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
