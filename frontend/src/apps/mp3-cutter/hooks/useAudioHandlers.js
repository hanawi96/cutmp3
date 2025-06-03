import { useCallback } from 'react';
import { audioService } from '../services/audioService';

export const useAudioHandlers = (state, saveRegionToHistory, handleRegionChange) => {
  
  // Handle Submit - Xử lý gửi form và process audio
  const handleSubmit = useCallback(async (e) => {
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



      for (let [key, value] of formData.entries()) {
        if (key === "audio") {

        } else {

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
          // generateQRCode sẽ được gọi từ useEffect trong component chính
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
  }, [
    state.file,
    state.waveformRef,
    state.volume,
    state.volumeProfile,
    state.customVolume,
    state.normalizeAudio,
    state.fadeIn,
    state.fadeOut,
    state.fadeInDuration,
    state.fadeOutDuration,
    state.playbackSpeed,
    state.outputFormat,
    state.setError,
    state.setIsLoading,
    state.setProcessingProgress,
    state.setProcessingStatus,
    state.setSmoothProgress,
    state.setDownloadUrl,
    state.setQrCodeDataUrl,
    state.setShowQrCode,
    state.setShareLink,
    state.setShareQrCode,
    state.setShowShareSection
  ]);

  // Force Update Waveform
  const forceUpdateWaveform = useCallback(() => {
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

      // Update volume and overlay with validation
      if (typeof state.waveformRef.current.updateVolume === "function") {
        state.waveformRef.current.updateVolume(currentPosition, true);
      }

      if (typeof state.waveformRef.current.drawVolumeOverlay === "function") {
        state.waveformRef.current.drawVolumeOverlay();
      }


    } catch (err) {
      console.error("[forceUpdateWaveform] Error updating waveform:", err);
    }
  }, [state.waveformRef, state.startRef, state.endRef]);

  // Handle Reset
  const handleReset = useCallback(() => {


    // Reset volume settings
    state.setVolume(1.0);
    state.setFadeIn(false);
    state.setFadeOut(false);
    state.setVolumeProfile("uniform");
    state.setCustomVolume({ start: 1.0, middle: 1.0, end: 1.0 });
    state.setNormalizeAudio(false);
    state.setFadeInDuration(2);
    state.setFadeOutDuration(2);
    state.setPlaybackSpeed(1.0);
    state.setPitchShift(0);

    // Reset UI states

    state.setActiveIcons({
      fadeIn: false,
      fadeOut: false,
      speed: false,
      remove: false,
      pitch: false,
    });

    state.setShowSpeedControl(false);
    state.setShowPitchControl(false);
    state.setShowFadeInControl(false);
    state.setRemoveMode(false);

    // Fast speed reset - Only WaveSurfer speed control

    if (state.waveformRef.current) {
      const wavesurferInstance =
        state.waveformRef.current.getWavesurferInstance?.();
      if (wavesurferInstance) {
        try {
          const resetStartTime = performance.now();

          // Reset to normal playback rate instantly
          wavesurferInstance.setPlaybackRate(1.0);

          const resetEndTime = performance.now();



        } catch (error) {
          console.error(
            "[RESET] ❌ Error resetting audio parameters:",
            error
          );
        }
      } else {
        console.warn("[RESET] ⚠️ WaveSurfer instance not available for reset");
      }
    }


    if (state.waveformRef.current) {
      const wavesurferInstance =
        state.waveformRef.current.getWavesurferInstance?.();
      if (wavesurferInstance) {
        try {
          wavesurferInstance.setPlaybackRate(1.0);

        } catch (error) {
          console.error("[RESET] ❌ Error resetting pitch-speed:", error);
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

      // Call handleRegionChange if it exists
      if (handleRegionChange && typeof handleRegionChange === 'function') {
        handleRegionChange(0, duration);
      }

      if (state.waveformRef.current.setFadeInDuration) {
        state.waveformRef.current.setFadeInDuration(2);
      }
      if (state.waveformRef.current.setFadeOutDuration) {
        state.waveformRef.current.setFadeOutDuration(2);
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

  }, [
    state.setVolume,
    state.setFadeIn,
    state.setFadeOut,
    state.setVolumeProfile,
    state.setCustomVolume,
    state.setNormalizeAudio,
    state.setFadeInDuration,
    state.setFadeOutDuration,
    state.setPlaybackSpeed,
    state.setPitchShift,
    state.setActiveIcons,
    state.setShowSpeedControl,
    state.setShowPitchControl,
    state.setShowFadeInControl,
    state.setRemoveMode,
    state.waveformRef,
    state.startRef,
    state.endRef,
    state.setDisplayStart,
    state.setDisplayEnd,
    forceUpdateWaveform,
    handleRegionChange
  ]);

  // Set Region Start
  const setRegionStart = useCallback(() => {
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

      // ✅ FIXED: Lưu lịch sử TRƯỚC KHI thay đổi region
      const hasValidRefs =
        state.startRef.current !== undefined &&
        state.endRef.current !== undefined;
      
      if (hasValidRefs) {
        const willChangeStart = Math.abs(currentTime - state.startRef.current) > 0.001;
        
        // Validate currentTime vs state.endRef to ensure valid region
        if (currentTime >= state.endRef.current) {
          console.warn(`[SET_REGION_START] Cannot set start >= end`);
          return;
        }

        // ✅ Lưu vị trí hiện tại TRƯỚC KHI thay đổi
        if (willChangeStart) {

          
          saveRegionToHistory(
            state.startRef.current,
            state.endRef.current,
            "set_start_before_change"
          );
        }
      }

      if (
        currentTime !== undefined &&
        typeof state.waveformRef.current.setRegionStart === "function"
      ) {
        state.waveformRef.current.setRegionStart(currentTime);
        state.startRef.current = currentTime;
        state.setDisplayStart(currentTime.toFixed(2));
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
  }, [state.waveformRef, state.startRef, state.endRef, state.setDisplayStart, saveRegionToHistory]);

  // Set Region End
  const setRegionEnd = useCallback(() => {
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

      // ✅ FIXED: Lưu lịch sử TRƯỚC KHI thay đổi region
      const hasValidRefs =
        state.startRef.current !== undefined &&
        state.endRef.current !== undefined;
        
      if (hasValidRefs) {
        const willChangeEnd = Math.abs(currentTime - state.endRef.current) > 0.001;
        
        // Validate currentTime vs state.startRef to ensure valid region
        if (currentTime <= state.startRef.current) {
          console.warn(`[SET_REGION_END] Cannot set end <= start`);
          return;
        }

        // ✅ Lưu vị trí hiện tại TRƯỚC KHI thay đổi
        if (willChangeEnd) {
          saveRegionToHistory(
            state.startRef.current,
            state.endRef.current,
            "set_end_before_change"
          );
        }
      }

      if (
        currentTime !== undefined &&
        typeof state.waveformRef.current.setRegionEnd === "function"
      ) {
        state.waveformRef.current.setRegionEnd(currentTime);
        state.endRef.current = currentTime;
        state.setDisplayEnd(currentTime.toFixed(2));
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
      console.error("[SET_REGION_END] Error:", err);
    }
  }, [state.waveformRef, state.startRef, state.endRef, state.setDisplayEnd, saveRegionToHistory]);

  return {
    handleSubmit,
    forceUpdateWaveform,
    handleReset,
    setRegionStart,
    setRegionEnd
  };
};