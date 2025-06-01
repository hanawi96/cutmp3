import { useRegionHistory } from './hooks/useRegionHistory';
import FileUpload, { formatFileSize } from "./components/FileUpload";
import AudioButtonsPanel from "./components/AudioButtonsPanel";
import VolumeProfilePanel from "./components/VolumeProfilePanel";
import AudioSettings from "./components/AudioSettings";
import { useAudioState } from "./hooks/useAudioState";
import ProcessingAndResults from "./components/ProcessingAndResults";
import PlaybackControls from "./components/PlaybackControls";
import { audioService } from './services/audioService';


import WaveformSelector from "./components/WaveformSelector";
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
import SpeedControl from "./components/SpeedControl";
import PitchControl from "./components/PitchControl";
import React, {
  useRef,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import "./styles/components/SpeedControl.css";
import "./styles/components/PitchControl.css";
import "./styles/components/FadeControls.css";
import "./styles/components/Mp3Cutter.css";

import "./styles/components/PlayButtonAnimation.css";
import QRCode from "qrcode";
// Sử dụng API URL từ state.file cấu hình


export default function Mp3Cutter() {
  const state = useAudioState();
  const { saveRegionToHistory, handleUndo, handleRedo } = useRegionHistory(state);

  // Kiểm tra trạng thái backend khi component được tải
useEffect(() => {
  const checkServerStatus = async () => {
    const { status, error } = await audioService.checkServerStatus();
    state.setServerStatus(status);
    if (error) {
      state.setError(error);
    } else {
      state.setError(null);
    }
  };

  checkServerStatus();
}, []);

  // Debug useEffect để kiểm tra state.waveformRef khi component được khởi tạo
  useEffect(() => {
    if (state.waveformRef.current) {
      // Thêm timeout để đảm bảo WaveSurfer đã được khởi tạo đầy đủ
      setTimeout(() => {
        console.log(
          "Initial check for state.waveformRef after timeout:",
          state.waveformRef.current
        );
        const methods = Object.keys(state.waveformRef.current || {});
        console.log("Available methods after timeout:", methods);

        // Kiểm tra WaveSurfer instance
        if (state.waveformRef.current.getWavesurferInstance) {
          const ws = state.waveformRef.current.getWavesurferInstance();
          console.log("WaveSurfer instance after timeout:", ws);
        }

        // Kiểm tra Region
        if (state.waveformRef.current.getRegion) {
          const region = state.waveformRef.current.getRegion();
          console.log("Current region after timeout:", region);
        }
      }, 500); // 500ms timeout
    }
  }, [state.file]);

  // Xử lý phím tắt
// Xử lý phím tắt
useEffect(() => {
  if (!state.file) return;

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

    if (!state.waveformRef.current) return;

    // Lấy instance WaveSurfer
    const wavesurferInstance =
      state.waveformRef.current.getWavesurferInstance?.();
    if (!wavesurferInstance) return;

    switch (e.key) {
      case " ": // Space - Play/Pause
        if (state.waveformRef.current.togglePlayPause) {
          state.waveformRef.current.togglePlayPause();
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
          console.log("[KEYBOARD] Ctrl+Z pressed, calling handleUndo");
          handleUndo();
        }
        break;

      case "y": // Ctrl+Y - Redo
      case "Y":
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          console.log("[KEYBOARD] Ctrl+Y pressed, calling handleRedo");
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
}, [state.file, handleUndo, handleRedo]); // ← ĐÂY LÀ SỰ THAY ĐỔI QUAN TRỌNG: thêm handleUndo, handleRedo vào dependencies

  useEffect(() => {
    return () => {
      console.log("[CLEANUP] 🧹 Component unmounting...");

      // Cancel any pending retries
      if (window.pitchRetryOnNextToggle) {
        window.pitchRetryOnNextToggle = null;
      }

      console.log("[CLEANUP] ✅ Cleanup completed");
    };
  }, []);



  const handleRegionChange = (
    start,
    end,
    shouldSaveHistory = false,
    source = "unknown"
  ) => {
    // Validate refs before checking for changes
    const hasValidRefs =
      state.startRef.current !== undefined &&
      state.endRef.current !== undefined &&
      isFinite(state.startRef.current) &&
      isFinite(state.endRef.current);

    // Only save history when shouldSaveHistory = true
    if (shouldSaveHistory) {
      if (hasValidRefs) {
        // Check if NEW region is significantly different
        const isSignificantChange =
          Math.abs(start - state.startRef.current) > 0.001 ||
          Math.abs(end - state.endRef.current) > 0.001;

        if (isSignificantChange) {
          console.log(
            `[REGION_CHANGE] Saving to history: ${start.toFixed(
              2
            )}s - ${end.toFixed(2)}s`
          );
          saveRegionToHistory(start, end, source);
        }
      } else {
        console.warn(
          "[REGION_CHANGE] Cannot save history - refs not initialized"
        );
      }
    }

    // Update refs AFTER checking for changes
    state.startRef.current = start;
    state.endRef.current = end;
    state.setDisplayStart(start.toFixed(2));
    state.setDisplayEnd(end.toFixed(2));
  };



 

  // Update can undo/redo states
  useEffect(() => {
    state.setCanUndo(state.undoHistory.length > 0);
    state.setCanRedo(state.redoHistory.length > 0);
  }, [state.undoHistory.length, state.redoHistory.length]);

  useEffect(() => {
    // Only log significant history changes for debugging
    if (state.undoHistory.length > 10 || state.redoHistory.length > 5) {
      console.log(
        `[HISTORY] Large history detected - Undo: ${state.undoHistory.length}, Redo: ${state.redoHistory.length}`
      );
    }
  }, [
    state.undoHistory.length,
    state.redoHistory.length,
    state.canUndo,
    state.canRedo,
  ]);

  useEffect(() => {
    // FIXED: Chỉ log khi thay đổi đáng kể để giảm noise
    const shouldLogProgress =
      Math.abs(state.processingProgress - state.smoothProgress) > 10; // Chỉ log khi thay đổi > 10%
    const shouldLogSpeedControl =
      state.showSpeedControl &&
      state.processingProgress !== state.smoothProgress;

    if (
      shouldLogProgress ||
      (shouldLogSpeedControl && state.processingProgress % 25 === 0)
    ) {
      console.log(
        "[state.smoothProgress] useEffect triggered - state.processingProgress:",
        state.processingProgress,
        "state.smoothProgress:",
        state.smoothProgress,
        "state.showSpeedControl:",
        state.showSpeedControl
      );
    }

    // FIXED: Ngăn animation khi SpeedControl được mở
    if (state.showSpeedControl) {
      // Chỉ log một lần khi SpeedControl mở, không log mỗi lần progress thay đổi
      if (
        state.processingProgress !== state.smoothProgress &&
        state.processingProgress % 50 === 0
      ) {
        console.log(
          "[state.smoothProgress] SpeedControl is open - setting progress immediately"
        );
      }

      // Cancel any existing animation immediately
      if (state.progressAnimationRef.current) {
        cancelAnimationFrame(state.progressAnimationRef.current);
        state.progressAnimationRef.current = null;
      }

      // Set progress immediately without animation
      if (state.processingProgress !== state.smoothProgress) {
        state.setSmoothProgress(Math.max(0, state.processingProgress));
      }

      return; // Exit early - không chạy animation
    }

    // Chỉ animate khi SpeedControl KHÔNG hiển thị
    if (
      state.processingProgress !== state.smoothProgress &&
      state.processingProgress >= 0 &&
      state.smoothProgress >= 0
    ) {
      const progressDiff = Math.abs(
        state.processingProgress - state.smoothProgress
      );

      // Only animate for significant changes
      if (progressDiff > 5) {
        // Chỉ log khi bắt đầu animation thật sự
        if (shouldLogProgress) {
          console.log(
            "[state.smoothProgress] Starting animation from",
            state.smoothProgress,
            "to",
            state.processingProgress
          );
        }

        // Cancel any existing animation
        if (state.progressAnimationRef.current) {
          cancelAnimationFrame(state.progressAnimationRef.current);
          state.progressAnimationRef.current = null;
        }

        const startProgress = Math.max(0, state.smoothProgress);
        const targetProgress = Math.max(0, state.processingProgress);
        const startTime = performance.now();
        const duration = 200; // Giảm xuống 200ms để nhanh hơn

        const animate = (currentTime) => {
          // FIXED: Kiểm tra state.showSpeedControl trong animation loop - không log
          if (state.showSpeedControl) {
            state.setSmoothProgress(Math.max(0, targetProgress));
            state.progressAnimationRef.current = null;
            return;
          }

          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / duration, 1);

          // Faster easing
          const easeProgress = state.progress * state.progress; // Quadratic easing

          const currentValue =
            startProgress + (targetProgress - startProgress) * easeProgress;
          const roundedValue = Math.max(0, Math.round(currentValue));

          state.setSmoothProgress(roundedValue);

          if (state.progress < 1) {
            state.progressAnimationRef.current = requestAnimationFrame(animate);
          } else {
            state.setSmoothProgress(Math.max(0, targetProgress));
            state.progressAnimationRef.current = null;
            // Chỉ log completion cho major milestones
            if (targetProgress % 25 === 0) {
              console.log(
                "[state.smoothProgress] Animation completed at",
                Math.max(0, targetProgress)
              );
            }
          }
        };

        state.progressAnimationRef.current = requestAnimationFrame(animate);
      } else {
        // For small changes, set immediately - không log
        state.setSmoothProgress(Math.max(0, state.processingProgress));
      }
    }

    // Cleanup function
    return () => {
      if (state.progressAnimationRef.current) {
        cancelAnimationFrame(state.progressAnimationRef.current);
        state.progressAnimationRef.current = null;
      }
    };
  }, [state.processingProgress, state.showSpeedControl]); // Removed state.smoothProgress from deps to prevent loops

  // Tự động set share link khi có state.downloadUrl
  useEffect(() => {
    if (state.downloadUrl) {
      console.log(
        "[SHARE LINK] Setting share link to state.downloadUrl:",
        state.downloadUrl
      );
      state.setShareLink(state.downloadUrl);
      state.setShowShareSection(true);

      // Generate QR code for share link (same as download)
      if (!state.shareQrCode) {
        const shareQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
          state.downloadUrl
        )}`;
        state.setShareQrCode(shareQrUrl);
        console.log("[SHARE LINK] QR code generated for share link");
      }
    }
  }, [state.downloadUrl]);

  const handleSubmit = async (e) => {
  e.preventDefault();

  if (!state.file) {
    state.setError("❌ Chưa chọn file");
    return;
  }

  state.setIsLoading(true);
  state.setError("");
  state.setProcessingProgress(0);

  try {
    const regionBounds = state.waveformRef.current?.getRegionBounds();

    // Get audio duration from waveform instance
    const audioDuration =
      state.waveformRef.current?.getWavesurferInstance()?.getDuration() || 0;

    // Validate and fix region bounds
    let validStart = 0;
    let validEnd = audioDuration;

    if (regionBounds && audioDuration > 0) {
      // Validate start time
      validStart =
        typeof regionBounds.start === "number" &&
        !isNaN(regionBounds.start) &&
        regionBounds.start >= 0
          ? regionBounds.start
          : 0;

      // Validate end time
      validEnd =
        typeof regionBounds.end === "number" &&
        !isNaN(regionBounds.end) &&
        regionBounds.end > 0
          ? regionBounds.end
          : audioDuration;
    }

    // Final validation checks
    if (audioDuration <= 0) {
      console.error(
        "[handleSubmit] Audio duration is 0 or invalid:",
        audioDuration
      );
      state.setError(
        "❌ Không thể xác định độ dài audio. Hãy thử tải lại file."
      );
      state.setIsLoading(false);
      return;
    }

    if (validEnd <= validStart) {
      console.error("[handleSubmit] Invalid region: end <= start", {
        validStart,
        validEnd,
      });
      // Use full audio as fallback
      validStart = 0;
      validEnd = audioDuration;
    }

    if (validEnd <= 0) {
      console.error(
        "[handleSubmit] End time is still 0 or negative:",
        validEnd
      );
      state.setError(
        "❌ Thời gian kết thúc không hợp lệ. Hãy kiểm tra file audio."
      );
      state.setIsLoading(false);
      return;
    }

    const parameters = {
      start: validStart,
      end: validEnd,
      duration: audioDuration,
      volume: state.volume,
      volumeProfile: state.volumeProfile,
      customVolume:
        state.volumeProfile === "custom" ? state.customVolume : undefined,
      normalizeAudio: state.normalizeAudio,
      fade: state.fadeIn || state.fadeOut,
      fadeIn: state.fadeIn,
      fadeOut: state.fadeOut,
      fadeInDuration: state.fadeInDuration,
      fadeOutDuration: state.fadeOutDuration,
      speed: state.playbackSpeed,
      outputFormat: state.outputFormat,
    };

    console.log("[handleSubmit] Sending parameters:", parameters);

    // Prepare form data
    const formData = new FormData();
    formData.append("audio", state.file);

    Object.keys(parameters).forEach((key) => {
      if (parameters[key] !== undefined) {
        if (typeof parameters[key] === "object") {
          formData.append(key, JSON.stringify(parameters[key]));
        } else {
          formData.append(key, parameters[key]);
        }
      }
    });

    // Debug FormData contents
    console.log("[handleSubmit] FormData contents:");
    console.log("[handleSubmit] - File info:", {
      name: state.file.name,
      type: state.file.type,
      size: state.file.size,
      lastModified: state.file.lastModified,
    });

    for (let [key, value] of formData.entries()) {
      if (key === "audio") {
        console.log(
          `[handleSubmit] - ${key}: [File object]`,
          value.name,
          value.type,
          value.size + " bytes"
        );
      } else {
        console.log(`[handleSubmit] - ${key}:`, value);
      }
    }

    // Process audio using audioService
    const result = await audioService.processAudio(
      formData,
      // Progress callback
      (progress) => {
        state.setProcessingProgress(progress);
      },
      // Status callback  
      (status) => {
        state.setProcessingStatus(status);
      }
    );

    // Handle successful result
    if (result.success) {
      setTimeout(async () => {
        state.setDownloadUrl(result.downloadUrl);
        await generateQRCode(result.downloadUrl);
      }, 500);
    }

  } catch (err) {
    console.error("[handleSubmit] Error processing audio:", err);
    console.error("[handleSubmit] Error stack:", err.stack);

    let errorMessage = err.message || "Failed to connect to server.";
    if (errorMessage.includes("muxing queue")) {
      errorMessage =
        "Error processing large audio file. Try selecting a smaller region.";
    } else if (errorMessage.includes("fade")) {
      errorMessage =
        "Error applying fade effect. Try a different fade settings.";
    }

    console.error("[handleSubmit] Final error message:", errorMessage);
    state.setError(errorMessage);
    alert(`❌ ${errorMessage}`);
  } finally {
    state.setIsLoading(false);
    state.setProcessingProgress(0);
    state.setProcessingStatus("");
    state.setSmoothProgress(0);

    if (!state.downloadUrl) {
      state.setQrCodeDataUrl("");
      state.setShowQrCode(false);
      state.setShareLink("");
      state.setShareQrCode("");
      state.setShowShareSection(false);
    }
  }
};



  const forceUpdateWaveform = () => {
    if (!state.waveformRef.current) {
      console.warn("[forceUpdateWaveform] state.waveformRef not available");
      return;
    }

    try {
      const currentPosition =
        state.waveformRef.current.wavesurferRef?.current?.getCurrentTime() || 0;

      // CRITICAL: Validate currentPosition
      if (!isFinite(currentPosition) || isNaN(currentPosition)) {
        console.error(
          "[forceUpdateWaveform] Invalid currentPosition:",
          currentPosition
        );
        return;
      }

      // Validate state.startRef and state.endRef before using
      if (
        !isFinite(state.startRef.current) ||
        !isFinite(state.endRef.current)
      ) {
        console.error("[forceUpdateWaveform] Invalid refs:", {
          start: state.startRef.current,
          end: state.endRef.current,
        });
        return;
      }

      // Try to update region directly if possible
      if (
        state.waveformRef.current.wavesurferRef?.current &&
        state.waveformRef.current.regionRef?.current
      ) {
        try {
          const region = state.waveformRef.current.regionRef.current;
          region.start = state.startRef.current;
          region.end = state.endRef.current;

          // Fire event if available
          if (state.waveformRef.current.wavesurferRef.current.fireEvent) {
            state.waveformRef.current.wavesurferRef.current.fireEvent(
              "region-updated",
              region
            );
          }
        } catch (err) {
          console.warn(
            "[forceUpdateWaveform] Could not update region directly:",
            err
          );
        }
      }

      // Update state.volume and overlay with validation
      if (typeof state.waveformRef.current.updateVolume === "function") {
        state.waveformRef.current.updateVolume(currentPosition, true);
      }

      if (typeof state.waveformRef.current.drawVolumeOverlay === "function") {
        state.waveformRef.current.drawVolumeOverlay();
      }

      console.log(
        "[forceUpdateWaveform] ✅ Force update completed successfully"
      );
    } catch (err) {
      console.error("[forceUpdateWaveform] Error updating waveform:", err);
    }
  };

  const renderVolumeOptions = () => {
    if (state.volumeProfile === "custom") {
      return (
        <div className="space-y-4">
          {/* Hiển thị các thanh custom chỉ khi không có fade nào được bật */}
          {!(state.fadeIn || state.fadeOut) && (
            <>
              {/* Thêm thanh kéo Fade In Duration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 flex justify-between">
                  <span>Fade In Duration:</span>{" "}
                  <span className="text-blue-600">{state.fadeInDuration}s</span>
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="10"
                  step="0.1"
                  value={state.fadeInDuration}
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
                  <span className="text-blue-600">
                    {state.fadeOutDuration}s
                  </span>
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="10"
                  step="0.1"
                  value={state.fadeOutDuration}
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
                      {Math.min(1.0, state.customVolume[key]).toFixed(1)}x
                    </span>
                  </label>
                  <input
                    type="range"
                    min="0.0"
                    max="1.0"
                    step="0.1"
                    value={Math.min(1.0, state.customVolume[key])}
                    onChange={(e) => {
                      const newValue = Math.min(
                        1.0,
                        parseFloat(e.target.value)
                      );
                      const newCustomVolume = {
                        ...state.customVolume,
                        [key]: newValue,
                      };

                      state.setCustomVolume(newCustomVolume);

                      // OPTIMIZED: Throttled update instead of immediate
                      if (state.waveformRef.current) {
                        const currentPos =
                          state.waveformRef.current
                            .getWavesurferInstance?.()
                            ?.getCurrentTime() || 0;

                        // Single update call
                        if (state.waveformRef.current.updateVolume) {
                          state.waveformRef.current.updateVolume(
                            currentPos,
                            true,
                            true
                          );
                        }
                      }

                      // OPTIMIZED: Debounced force update
                      clearTimeout(window.customVolumeUpdateTimeout);
                      window.customVolumeUpdateTimeout = setTimeout(() => {
                        if (state.waveformRef.current) {
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
          {/* Hiển thị thanh điều chỉnh state.volume và thông báo khi có fade được bật */}
          {(state.fadeIn || state.fadeOut) && (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 flex justify-between">
                  <span>state.Volume:</span>{" "}
                  <span className="text-blue-600">
                    {Math.min(1.0, state.volume).toFixed(1)}x
                  </span>
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.1"
                  value={Math.min(1.0, state.volume)}
                  onChange={(e) => {
                    const newVolume = Math.min(1.0, parseFloat(e.target.value));
                    state.setVolume(newVolume);
                    // Cập nhật UI ngay lập tức
                    if (state.waveformRef.current) {
                      if (
                        typeof state.waveformRef.current.updateVolume ===
                        "function"
                      ) {
                        state.waveformRef.current.updateVolume(
                          null,
                          true,
                          true
                        );
                      }
                    }
                    setTimeout(forceUpdateWaveform, 10);
                  }}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>{" "}
              <div className="text-sm text-blue-600 mt-2 bg-blue-50 p-2 rounded-md border border-blue-100">
                {state.fadeIn && state.fadeOut
                  ? "Chế độ Fade In & Out (2s) đang được bật"
                  : state.fadeIn
                  ? "Chế độ Fade In (2s) đang được bật"
                  : "Chế độ Fade Out (2s) đang được bật"}
                . Các tùy chọn state.Volume Profile đã bị vô hiệu hóa.
              </div>
            </>
          )}
        </div>
      );
    }
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 flex justify-between">
          <span>state.Volume:</span>{" "}
          <span className="text-blue-600">
            {Math.min(1.0, state.volume).toFixed(1)}x
          </span>
        </label>
        <input
          type="range"
          min="0.1"
          max="1.0"
          step="0.1"
          value={Math.min(1.0, state.volume)}
          onChange={(e) => {
            const newVolume = Math.min(1.0, parseFloat(e.target.value));
            state.setVolume(newVolume);
            // Cập nhật UI ngay lập tức
            if (state.waveformRef.current) {
              if (
                typeof state.waveformRef.current.updateVolume === "function"
              ) {
                state.waveformRef.current.updateVolume(null, true, true);
              }
            }
            setTimeout(forceUpdateWaveform, 10);
          }}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
      </div>
    );
  };

  const generateQRCode = async (downloadUrl) => {
    try {
      console.log(
        "[generateQRCode] Generating QR code for URL:",
        downloadUrl // <-- dùng biến truyền vào!
      );

      // Tạo QR code với options tùy chỉnh
      const qrDataUrl = await QRCode.toDataURL(downloadUrl, {
        width: 200,
        margin: 2,
        color: { dark: "#000000", light: "#FFFFFF" },
        errorCorrectionLevel: "M",
      });

      console.log("[generateQRCode] QR code generated successfully");
      state.setQrCodeDataUrl(qrDataUrl);
      state.setShowQrCode(true);

      return qrDataUrl;
    } catch (error) {
      console.error("[generateQRCode] Error generating QR code:", error);
      state.setShowQrCode(false);
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
      "[copyShareLink] Function called, state.shareLink:",
      state.shareLink ? "EXISTS" : "NULL"
    );
    console.log("[copyShareLink] state.isCopied:", state.isCopied);

    if (!state.shareLink) {
      console.log("[copyShareLink] Cannot copy - no link available");
      return;
    }

    try {
      console.log("[copyShareLink] Attempting to copy link:", state.shareLink);
      await navigator.clipboard.writeText(state.shareLink);

      console.log(
        "[copyShareLink] Link copied successfully, setting state.isCopied to true"
      );
      state.setIsCopied(true);

      // Reset về "Copy" sau 2 giây
      setTimeout(() => {
        console.log(
          "[copyShareLink] Resetting state.isCopied to false after 2 seconds"
        );
        state.setIsCopied(false);
      }, 2000);

      console.log("[copyShareLink] Copy operation completed successfully");
    } catch (error) {
      console.error("[copyShareLink] Error copying link:", state.error);
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

    // Reset state.volume settings
    state.setVolume(1.0);
    state.setFadeIn(false);
    state.setFadeOut(false);
    state.setVolumeProfile("uniform");
    state.setCustomVolume({ start: 1.0, middle: 1.0, end: 1.0 });
    state.setNormalizeAudio(false);
    state.setFadeInDuration(3);
    state.setFadeOutDuration(3);
    state.setPlaybackSpeed(1.0);
    state.setPitchShift(0);

    // Reset UI states
    console.log("[RESET] Resetting UI states...");
    state.setActiveIcons({
      fadeIn: false,
      fadeOut: false,
      speed: false,
      remove: false,
      pitch: false,
    });

    state.setShowSpeedControl(false);
    state.setShowPitchControl(false);
    state.setRemoveMode(false);

    // Fast speed reset - Only WaveSurfer speed control
    console.log("[RESET] ⚡ Fast audio parameters reset...");
    if (state.waveformRef.current) {
      const wavesurferInstance =
        state.waveformRef.current.getWavesurferInstance?.();
      if (wavesurferInstance) {
        try {
          const resetStartTime = performance.now();

          // Reset to normal playback rate instantly
          wavesurferInstance.setPlaybackRate(1.0);

          const resetEndTime = performance.now();
          console.log(
            `[RESET] ✅ Audio reset completed in ${(
              resetEndTime - resetStartTime
            ).toFixed(2)}ms`
          );
          console.log("[RESET] - Speed reset to: 1.0x");
          console.log("[RESET] - Pitch will be reset by Tone.js separately");
        } catch (error) {
          console.error(
            "[RESET] ❌ Error resetting audio parameters:",
            state.error
          );
        }
      } else {
        console.warn("[RESET] ⚠️ WaveSurfer instance not available for reset");
      }
    }

    console.log("[RESET] 🎵 Resetting pitch-speed to normal...");
    if (state.waveformRef.current) {
      const wavesurferInstance =
        state.waveformRef.current.getWavesurferInstance?.();
      if (wavesurferInstance) {
        try {
          wavesurferInstance.setPlaybackRate(1.0);
          console.log("[RESET] ✅ Pitch-speed reset to 1.0x completed");
        } catch (error) {
          console.error("[RESET] ❌ Error resetting pitch-speed:", state.error);
        }
      }
    }

    // Reset waveform region (existing logic)
    if (
      state.waveformRef.current &&
      state.waveformRef.current.wavesurferRef &&
      state.waveformRef.current.wavesurferRef.current
    ) {
      const ws = state.waveformRef.current.wavesurferRef.current;
      const duration = ws.getDuration();

      state.startRef.current = 0;
      state.endRef.current = duration;
      state.setDisplayStart("0.00");
      state.setDisplayEnd(duration.toFixed(2));

      handleRegionChange(0, duration);

      if (state.waveformRef.current.setFadeInDuration) {
        state.waveformRef.current.setFadeInDuration(3);
      }
      if (state.waveformRef.current.setFadeOutDuration) {
        state.waveformRef.current.setFadeOutDuration(3);
      }

      try {
        if (
          state.waveformRef.current.regionRef &&
          state.waveformRef.current.regionRef.current
        ) {
          const region = state.waveformRef.current.regionRef.current;
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
    console.log(
      "[RESET] ✅ Complete reset finished - Ready for SoundTouch pitch system"
    );
  };

  const setRegionStart = () => {
    if (!state.waveformRef.current) {
      console.error("[SET_REGION_START] state.waveformRef is null");
      return;
    }

    const wavesurferInstance =
      state.waveformRef.current.getWavesurferInstance?.();
    if (!wavesurferInstance) {
      console.error("[SET_REGION_START] WaveSurfer instance not available");
      return;
    }

    try {
      const currentTime = wavesurferInstance.getCurrentTime();

      // Check for significant change
      const hasValidRefs =
        state.startRef.current !== undefined &&
        state.endRef.current !== undefined;
      const willChangeStart =
        hasValidRefs && Math.abs(currentTime - state.startRef.current) > 0.001;

      // Only save history when there's a significant change
      if (hasValidRefs && willChangeStart) {
        console.log("[SET_REGION_START] Saving to history before change");
        saveRegionToHistory(
          state.startRef.current,
          state.endRef.current,
          "set_start_manual"
        );
      }

      // Validate currentTime vs state.endRef to ensure valid region
      if (hasValidRefs && currentTime >= state.endRef.current) {
        console.warn(`[SET_REGION_START] Cannot set start >= end`);
        return;
      }

      if (
        currentTime !== undefined &&
        typeof state.waveformRef.current.setRegionStart === "function"
      ) {
        state.waveformRef.current.setRegionStart(currentTime);
        state.startRef.current = currentTime;
        state.setDisplayStart(currentTime.toFixed(2));
        console.log(
          `[SET_REGION_START] Updated to: ${currentTime.toFixed(2)}s`
        );
      } else {
        // Fallback method
        if (state.waveformRef.current.getRegion) {
          const region = state.waveformRef.current.getRegion();
          if (region && currentTime < region.end) {
            if (region.setOptions) {
              region.setOptions({ start: currentTime });
            } else if (region.update) {
              region.update({ start: currentTime });
            } else {
              region.start = currentTime;
            }
            state.startRef.current = currentTime;
            state.setDisplayStart(currentTime.toFixed(2));
          }
        }
      }
    } catch (err) {
      console.error("[SET_REGION_START] Error:", err);
    }
  };

  const setRegionEnd = () => {
    if (!state.waveformRef.current) {
      console.error("[SET_REGION_END] state.waveformRef is null");
      return;
    }

    const wavesurferInstance =
      state.waveformRef.current.getWavesurferInstance?.();
    if (!wavesurferInstance) {
      console.error("[SET_REGION_END] WaveSurfer instance not available");
      return;
    }

    try {
      const currentTime = wavesurferInstance.getCurrentTime();

      // Check for significant change
      const hasValidRefs =
        state.startRef.current !== undefined &&
        state.endRef.current !== undefined;
      const willChangeEnd =
        hasValidRefs && Math.abs(currentTime - state.endRef.current) > 0.001;

      // Only save history when there's a significant change
      if (hasValidRefs && willChangeEnd) {
        console.log("[SET_REGION_END] Saving to history before change");
        saveRegionToHistory(
          state.startRef.current,
          state.endRef.current,
          "set_end_manual"
        );
      }

      // Validate currentTime vs state.startRef to ensure valid region
      if (hasValidRefs && currentTime <= state.startRef.current) {
        console.warn(`[SET_REGION_END] Cannot set end <= start`);
        return;
      }

      if (
        currentTime !== undefined &&
        typeof state.waveformRef.current.setRegionEnd === "function"
      ) {
        state.waveformRef.current.setRegionEnd(currentTime);
        state.endRef.current = currentTime;
        state.setDisplayEnd(currentTime.toFixed(2));
        console.log(`[SET_REGION_END] Updated to: ${currentTime.toFixed(2)}s`);
      } else {
        // Fallback method
        if (state.waveformRef.current.getRegion) {
          const region = state.waveformRef.current.getRegion();
          if (region && currentTime > region.start) {
            if (region.setOptions) {
              region.setOptions({ end: currentTime });
            } else if (region.update) {
              region.update({ end: currentTime });
            } else {
              region.end = currentTime;
            }
            state.endRef.current = currentTime;
            state.setDisplayEnd(currentTime.toFixed(2));
          }
        }
      }
    } catch (err) {
      console.error("[SET_REGION_END] state.Error:", err);
    }
  };

  // Update fadeDuration handlers
  const handleFadeInDurationChange = (duration) => {
    console.log("[handleFadeInDurationChange] Duration changed to:", duration);

    state.setFadeInDuration(duration);

    if (state.waveformRef.current) {
      // Cập nhật fade duration
      if (state.waveformRef.current.setFadeInDuration) {
        state.waveformRef.current.setFadeInDuration(duration);
      }

      // OPTIMIZED: Single update call instead of multiple
      const currentPos =
        state.waveformRef.current.getWavesurferInstance?.()?.getCurrentTime() ||
        0;

      // Batch all updates together
      if (state.waveformRef.current.updateVolume) {
        state.waveformRef.current.updateVolume(currentPos, true, true);
      }

      // OPTIMIZED: Single delayed update instead of multiple timeouts
      setTimeout(() => {
        if (state.waveformRef.current) {
          forceUpdateWaveform();
          if (state.waveformRef.current.drawVolumeOverlay) {
            state.waveformRef.current.drawVolumeOverlay(true);
          }
        }
      }, 100); // Increased delay to avoid rapid updates
    }
  };

  const handleFadeOutDurationChange = (duration) => {
    console.log("[handleFadeOutDurationChange] Duration changed to:", duration);

    state.setFadeOutDuration(duration);

    if (state.waveformRef.current) {
      // Cập nhật fade duration
      if (state.waveformRef.current.setFadeOutDuration) {
        state.waveformRef.current.setFadeOutDuration(duration);
      }

      // OPTIMIZED: Single update call instead of multiple
      const currentPos =
        state.waveformRef.current.getWavesurferInstance?.()?.getCurrentTime() ||
        0;

      // Batch all updates together
      if (state.waveformRef.current.updateVolume) {
        state.waveformRef.current.updateVolume(currentPos, true, true);
      }

      // OPTIMIZED: Single delayed update instead of multiple timeouts
      setTimeout(() => {
        if (state.waveformRef.current) {
          forceUpdateWaveform();
          if (state.waveformRef.current.drawVolumeOverlay) {
            state.waveformRef.current.drawVolumeOverlay(true);
          }
        }
      }, 100); // Increased delay to avoid rapid updates
    }
  };

  const handleSpeedChange = (speed) => {
    // Update state immediately for UI responsiveness
    state.setPlaybackSpeed(speed);

    if (state.waveformRef.current) {
      const wavesurferInstance =
        state.waveformRef.current.getWavesurferInstance?.();
      if (wavesurferInstance) {
        try {
          // CRITICAL: Preserve current position and playing state
          const currentPosition = wavesurferInstance.getCurrentTime();
          const wasPlaying = wavesurferInstance.state.isPlaying
            ? wavesurferInstance.state.isPlaying()
            : false;

          // Use requestAnimationFrame to avoid blocking UI
          requestAnimationFrame(() => {
            // Additional check in case component unmounted
            if (state.waveformRef.current) {
              const currentInstance =
                state.waveformRef.current.getWavesurferInstance?.();
              if (currentInstance) {
                // ENHANCED: Set speed without pausing if possible
                try {
                  // Set new playback rate directly without pausing
                  currentInstance.setPlaybackRate(speed);

                  // Verify position is still correct after speed change
                  const newPosition = currentInstance.getCurrentTime();
                  const positionDrift = Math.abs(newPosition - currentPosition);

                  if (positionDrift > 0.1) {
                    // Only log significant position corrections
                    console.log(
                      `[MP3CUTTER] Position drift detected (${positionDrift.toFixed(
                        4
                      )}s), correcting...`
                    );
                    const totalDuration = currentInstance.getDuration();
                    if (totalDuration > 0) {
                      const seekRatio = currentPosition / totalDuration;
                      currentInstance.seekTo(seekRatio);
                    }
                  }

                  // CRITICAL: Ensure playback continues if it was playing
                  if (wasPlaying) {
                    const regionBounds =
                      state.waveformRef.current.getRegionBounds?.();
                    if (regionBounds) {
                      const regionEnd = regionBounds.end;
                      const actualPosition = currentInstance.getCurrentTime();

                      // Only restart playback if WaveSurfer stopped
                      const isStillPlaying = currentInstance.state.isPlaying
                        ? currentInstance.state.isPlaying()
                        : false;

                      if (!isStillPlaying) {
                        setTimeout(() => {
                          if (currentInstance && state.waveformRef.current) {
                            currentInstance.play(actualPosition, regionEnd);

                            // CRITICAL: Ensure UI state stays in sync
                            setTimeout(() => {
                              if (state.waveformRef.current) {
                                const stillPlaying = currentInstance.state
                                  .isPlaying
                                  ? currentInstance.state.isPlaying()
                                  : false;
                                if (stillPlaying && !state.isPlaying) {
                                  state.setIsPlaying(true);
                                } else if (!stillPlaying && state.isPlaying) {
                                  state.setIsPlaying(false);
                                }
                              }
                            }, 100);
                          }
                        }, 50);
                      }
                    }
                  }
                } catch (speedError) {
                  console.error(
                    "[MP3CUTTER] state.Error setting speed directly, trying with pause method:",
                    speedError
                  );

                  // Fallback: pause and resume method
                  if (wasPlaying) {
                    currentInstance.pause();
                  }

                  currentInstance.setPlaybackRate(speed);

                  if (wasPlaying) {
                    const totalDuration = currentInstance.getDuration();
                    const seekRatio = currentPosition / totalDuration;
                    currentInstance.seekTo(seekRatio);

                    const regionBounds =
                      state.waveformRef.current.getRegionBounds?.();
                    if (regionBounds) {
                      setTimeout(() => {
                        currentInstance.play(currentPosition, regionBounds.end);
                        state.setIsPlaying(true); // Explicitly restore playing state
                      }, 100);
                    }
                  }
                }
              }
            }
          });
        } catch (error) {
          console.error(
            "[MP3CUTTER] ❌ state.Error setting playback rate:",
            state.error
          );
        }
      } else {
        console.warn("[MP3CUTTER] WaveSurfer instance not available");
      }
    }
  };

  const handlePitchChange = (semitones) => {
    // Update UI immediately
    state.setPitchShift(semitones);

    if (state.waveformRef.current) {
      const wavesurferInstance =
        state.waveformRef.current.getWavesurferInstance?.();
      if (wavesurferInstance) {
        try {
          // Convert semitones to playback rate
          // Each semitone = 2^(1/12) ratio
          const pitchRatio = Math.pow(2, semitones / 12);

          // Preserve current position and playing state
          const currentPosition = wavesurferInstance.getCurrentTime();
          const wasPlaying = wavesurferInstance.state.isPlaying
            ? wavesurferInstance.state.isPlaying()
            : false;

          // Apply new playback rate
          wavesurferInstance.setPlaybackRate(pitchRatio);

          // If was playing, ensure it continues with new rate
          if (wasPlaying) {
            const regionBounds = state.waveformRef.current.getRegionBounds?.();
            if (regionBounds) {
              // Small delay to ensure rate change is applied
              setTimeout(() => {
                if (wavesurferInstance && state.waveformRef.current) {
                  const currentPos = wavesurferInstance.getCurrentTime();
                  wavesurferInstance.play(currentPos, regionBounds.end);
                }
              }, 50);
            }
          }
        } catch (error) {
          console.error(
            "[MP3CUTTER] state.Error applying pitch change:",
            state.error
          );
        }
      } else {
        console.warn("[MP3CUTTER] WaveSurfer instance not available");
      }
    }
  };


  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      {!state.file ? (
        <FileUpload
          file={state.file}
          setFile={state.setFile}
          isDragging={state.isDragging}
          setIsDragging={state.setIsDragging}
          fileInputRef={state.fileInputRef}
          serverStatus={state.serverStatus}
          error={state.error}
        />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <FileAudio className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-800">
                  {state.file.name}
                </h2>
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    Audio state
                  </span>
                  {state.file.size && (
                    <span>{formatFileSize(state.file.size)}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            {/* Audio Buttons Panel - Các buttons chức năng + Speed/Pitch panels */}
            <AudioButtonsPanel
              fadeIn={state.fadeIn}
              setFadeIn={state.setFadeIn}
              fadeOut={state.fadeOut}
              setFadeOut={state.setFadeOut}
              showSpeedControl={state.showSpeedControl}
              setShowSpeedControl={state.setShowSpeedControl}
              showPitchControl={state.showPitchControl}
              setShowPitchControl={state.setShowPitchControl}
              removeMode={state.removeMode}
              setRemoveMode={state.setRemoveMode}
              setVolumeProfile={state.setVolumeProfile}
              setActiveIcons={state.setActiveIcons}
              playbackSpeed={state.playbackSpeed}
              setPlaybackSpeed={state.setPlaybackSpeed}
              pitchShift={state.pitchShift}
              setPitchShift={state.setPitchShift}
              isLoading={state.isLoading}
              handleSpeedChange={handleSpeedChange}
              handlePitchChange={handlePitchChange}
            />

            {/* ✅ 2. WAVEFORM SECTION - Moved up */}
            <div className="mb-6">
              <WaveformSelector
                ref={state.waveformRef}
                audioFile={state.file}
                onRegionChange={(start, end, shouldSave, source) =>
                  handleRegionChange(start, end, shouldSave, source)
                }
                fade={state.fadeIn || state.fadeOut}
                fadeIn={state.fadeIn}
                fadeOut={state.fadeOut}
                volumeProfile={state.volumeProfile}
                volume={state.volume}
                customVolume={state.customVolume}
                normalizeAudio={state.normalizeAudio}
                onTimeUpdate={state.setCurrentPlayPosition}
                theme="light"
                fadeInDuration={state.fadeInDuration}
                fadeOutDuration={state.fadeOutDuration}
                onPlayStateChange={state.setIsPlaying}
                loop={state.loopPlayback}
                removeMode={state.removeMode}
              />
            </div>

            {/* ✅ 3. PLAYBACK CONTROLS SECTION - Moved down */}
<PlaybackControls
  waveformRef={state.waveformRef}
  isPlaying={state.isPlaying}
  loopPlayback={state.loopPlayback}
  setLoopPlayback={state.setLoopPlayback}
  canUndo={state.canUndo}
  canRedo={state.canRedo}
  undoHistory={state.undoHistory}
  redoHistory={state.redoHistory}
  handleUndo={handleUndo}
  handleRedo={handleRedo}
  setRegionStart={setRegionStart}
  setRegionEnd={setRegionEnd}
/>
          </div>

          {/* Volume Profile Panel */}
          <VolumeProfilePanel
            volume={state.volume}
            setVolume={state.setVolume}
            fadeIn={state.fadeIn}
            fadeOut={state.fadeOut}
            volumeProfile={state.volumeProfile}
            setVolumeProfile={state.setVolumeProfile}
            customVolume={state.customVolume}
            setCustomVolume={state.setCustomVolume}
            fadeInDuration={state.fadeInDuration}
            setFadeInDuration={state.setFadeInDuration}
            fadeOutDuration={state.fadeOutDuration}
            setFadeOutDuration={state.setFadeOutDuration}
            handleFadeInDurationChange={handleFadeInDurationChange}
            handleFadeOutDurationChange={handleFadeOutDurationChange}
            forceUpdateWaveform={forceUpdateWaveform}
            waveformRef={state.waveformRef}
          />

          {/* Audio Settings Panel - có thể đặt ở vị trí khác */}
          <AudioSettings
            normalizeAudio={state.normalizeAudio}
            setNormalizeAudio={state.setNormalizeAudio}
            outputFormat={state.outputFormat}
            setOutputFormat={state.setOutputFormat}
          />

          
 {/* Processing and Results - All-in-one */}
          <ProcessingAndResults
            isLoading={state.isLoading}
            smoothProgress={state.smoothProgress}
            downloadUrl={state.downloadUrl}
            outputFormat={state.outputFormat}
            showQrCode={state.showQrCode}
            qrCodeDataUrl={state.qrCodeDataUrl}
            shareLink={state.shareLink}
            isCopied={state.isCopied}
            handleSubmit={handleSubmit}
            handleReset={handleReset}
            copyShareLink={copyShareLink}
          />

        </form>
        
      )}
    </div> // <-- thêm dấu này!
  );
}
