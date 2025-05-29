import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/plugins/regions";
import TimeStepper from "./TimeStepper";
import {
  trackLoop,
  resetLoopCounter,
  monitorWavesurferLoop,
} from "./debug-loop";
import { applyInfiniteLoopFixes } from "./infinite-loop-fix";
import { Clock } from "lucide-react";
import "./DeleteRegion.css";

// Throttle helper - giới hạn tần suất thực thi
const throttle = (func, limit) => {
  let inThrottle;
  return function () {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

// THÊM DEBOUNCE HELPER TẠI ĐÂY
const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), delay);
  };
};

const WaveformSelector = forwardRef(
  (
    {
      audioFile,
      onRegionChange,
      volumeProfile = "uniform",
      volume = 1.0,
      customVolume = { start: 1.0, middle: 1.0, end: 1.0 },
      normalizeAudio = false,
      fade = false,
      fadeIn = false,
      fadeOut = false,
      isPreviewMode = false,
      onPlayEnd = () => {},
      theme = "light",
      onTimeUpdate = () => {},
      fadeInDuration = 3,
      fadeOutDuration = 3,
      onPlayStateChange = () => {},
      loop = false,
      removeMode = false,
      onDeleteModeChange = () => {},
      onDeleteConfirm = () => {},
    },
    ref
  ) => {
    // Move state declarations to the top
    const [isDeleteMode, setIsDeleteMode] = useState(removeMode);
    const [deletePreview, setDeletePreview] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [currentVolumeDisplay, setCurrentVolumeDisplay] = useState(volume);
    const [loading, setLoading] = useState(true);
    const [fadeInDurationState, setFadeInDurationState] =
      useState(fadeInDuration);
    const [fadeOutDurationState, setFadeOutDurationState] =
      useState(fadeOutDuration);
    const [displayRegionStart, setDisplayRegionStart] = useState("0.00");
    const [displayRegionEnd, setDisplayRegionEnd] = useState("0.00");
    // ✅ NEW: Track current playback position for tooltip
    const [currentPosition, setCurrentPosition] = useState(0);
    // ✅ NEW: Track numeric region values for tooltip positioning
    const [regionStartTime, setRegionStartTime] = useState(0);
    const [regionEndTime, setRegionEndTime] = useState(0);

    const waveformRef = useRef(null);
    const overlayRef = useRef(null);
    const wavesurferRef = useRef(null);
    const regionRef = useRef(null);
    const regionsPluginRef = useRef(null);
    const animationFrameRef = useRef(null);
    const lastPositionRef = useRef(0);
    const currentVolumeRef = useRef(volume);
    const drawTimerRef = useRef(null);
    const currentProfileRef = useRef(volumeProfile);
    const fadeEnabledRef = useRef(fade);
    const fadeTimeRef = useRef(2);
    const intendedVolumeRef = useRef(volume);
    const isDrawingOverlayRef = useRef(false);
    const throttledDrawRef = useRef(null);
    const customVolumeRef = useRef(customVolume);
    const fadeInDurationRef = useRef(fadeInDuration);
    const fadeOutDurationRef = useRef(fadeOutDuration);
    const lastRegionStartRef = useRef(0);
    const lastRegionEndRef = useRef(0);
    const throttledFunctionsRef = useRef({});    // ADDED: New refs to track click source
    const clickSourceRef = useRef(null);
    const removeModeRef = useRef(removeMode); // Add ref to track current removeMode value
    const isClickUpdatingEndRef = useRef(false);
    const isDragUpdatingEndRef = useRef(false);
    const lastDragEndTimeRef = useRef(null);

    // REALTIME DRAG SEEKING REFS
    const isRealtimeDragSeekingRef = useRef(false);
    const lastRealtimeSeekTimeRef = useRef(null);
    const realtimeSeekThrottleRef = useRef(null);

    // === SYNC FIX: Add refs for position synchronization ===
    const lastDrawPositionRef = useRef(0);
    const syncPositionRef = useRef(0); // Master position for both waveform and overlay
    const lastSyncTimeRef = useRef(0); // Time when last sync occurred
    const isSyncingRef = useRef(false); // Prevent recursive syncing

    // Theme colors
    const colors = {
      light: {
        waveColor: "#e5e7eb",
        progressColor: "#3b82f6",
        cursorColor: "#f97316",
        volumeOverlayColor: "rgba(59, 130, 246, 0.5)",
        regionColor: "rgba(219, 234, 254, 0.3)",
        regionBorderColor: "#93c5fd",
      },
      dark: {
        waveColor: "#374151",
        progressColor: "#60a5fa",
        cursorColor: "#f97316",
        volumeOverlayColor: "rgba(96, 165, 250, 0.5)",
        regionColor: "rgba(30, 58, 138, 0.3)",
        regionBorderColor: "#3b82f6",
      },
    };

    // Thêm refs để theo dõi trạng thái fade in/out riêng biệt
    const fadeInRef = useRef(fadeIn);
    const fadeOutRef = useRef(fadeOut);

    // Thêm ref để theo dõi nguồn gốc của thay đổi region
    const regionChangeSourceRef = useRef(null);
    const justUpdatedEndByClickRef = useRef(false);
    const endUpdateTimeoutRef = useRef(null);
    const lastClickEndTimeRef = useRef(null);
    // ✅ NEW: Store region state before drag starts
    const dragStartRegionRef = useRef(null);

    // Thêm ref để theo dõi animation frame cho việc vẽ overlay
    const overlayAnimationFrameRef = useRef(null);
    const lastDrawTimeRef = useRef(0);
    const DRAW_INTERVAL = 1000 / 60; // 60 FPS

    // Thêm ref để theo dõi trạng thái region update
    const isRegionUpdatingRef = useRef(false);
    const regionUpdateTimeoutRef = useRef(null);

    // Thêm ref để theo dõi vị trí hiện tại chính xác hơn
    const currentPositionRef = useRef(0);
    const isDraggingRef = useRef(false);
    const isEndingPlaybackRef = useRef(false);
    const isDraggingRegionRef = useRef(false);
    const PREVIEW_TIME_BEFORE_END = 3; // 3 seconds preview before end


// ✅ THÊM: Helper function để cập nhật display values - thêm sau dòng ~580
const updateDisplayValues = useCallback((source = "unknown") => {
  if (!regionRef.current) {
    console.log(`[updateDisplayValues] No region available - source: ${source}`);
    return;
  }

  const start = regionRef.current.start;
  const end = regionRef.current.end;
  
  if (typeof start !== 'number' || typeof end !== 'number' || isNaN(start) || isNaN(end)) {
    console.error(`[updateDisplayValues] Invalid start/end values - source: ${source}`, { start, end });
    return;
  }

  console.log(`[updateDisplayValues] Updating from ${source}:`, {
    start: start.toFixed(4),
    end: end.toFixed(4)
  });

  try {
    // Update display strings
    setDisplayRegionStart(formatDisplayTime(start));
    setDisplayRegionEnd(formatDisplayTime(end));
    
    // Update numeric values for tooltips
    setRegionStartTime(start);
    setRegionEndTime(end);
    
    console.log(`[updateDisplayValues] Successfully updated display values from ${source}`);
  } catch (error) {
    console.error(`[updateDisplayValues] Error updating display values from ${source}:`, error);
  }
}, []);

    const syncPositions = (newPosition, source = "unknown") => {
      if (isSyncingRef.current) return; // Prevent recursive syncing
    
      const now = performance.now();
      const timeSinceLastSync = now - lastSyncTimeRef.current;
    
      // Only sync if enough time has passed or if this is a forced sync
      if (timeSinceLastSync < 16 && source !== "force") return; // ~60fps limit
    
      isSyncingRef.current = true;
      lastSyncTimeRef.current = now;
    
      try {
        // Update master position
        syncPositionRef.current = newPosition;
        currentPositionRef.current = newPosition;
        lastPositionRef.current = newPosition;
    
        // Update UI time display
        setCurrentTime(newPosition);
        onTimeUpdate(newPosition);
        // ✅ NEW: Update current position for tooltip
        setCurrentPosition(newPosition);
      } finally {
        isSyncingRef.current = false;
      }
    };

    // Helper function to calculate preview position (3 seconds before end)
    const calculatePreviewPosition = (endTime, currentTime) => {
      const previewTime = Math.max(0, endTime - PREVIEW_TIME_BEFORE_END);
      console.log(
        `[calculatePreviewPosition] End: ${endTime.toFixed(
          2
        )}s, Current: ${currentTime.toFixed(
          2
        )}s, Preview: ${previewTime.toFixed(
          2
        )}s (${PREVIEW_TIME_BEFORE_END}s before end)`
      );
      return previewTime;
    };

    // Helper function to ensure cursor resets to region start
    // Helper function to ensure cursor resets to region start INSTANTLY
    const resetToRegionStart = (source = "unknown") => {
      if (!wavesurferRef.current || !regionRef.current) {
        console.log(`[resetToRegionStart] Missing refs - source: ${source}`);
        return;
      }

      const regionStart = regionRef.current.start;
      const currentPos = wavesurferRef.current.getCurrentTime();
      const positionDiff = Math.abs(currentPos - regionStart);

      console.log(`[resetToRegionStart] INSTANT RESET from ${source}`);
      console.log(
        `[resetToRegionStart] Current: ${currentPos.toFixed(
          4
        )}s, Target: ${regionStart.toFixed(4)}s, Diff: ${positionDiff.toFixed(
          4
        )}s`
      );

      // ALWAYS reset, regardless of difference - for instant response
      console.log(`[resetToRegionStart] FORCING instant seek to region start`);

      const totalDuration = wavesurferRef.current.getDuration();
      const seekRatio = regionStart / totalDuration;

      // INSTANT operations - no setTimeout
      wavesurferRef.current.seekTo(seekRatio);

      // IMMEDIATE position sync - multiple calls to ensure it sticks
      syncPositions(regionStart, `resetToRegionStart_${source}`);
      syncPositionRef.current = regionStart;
      currentPositionRef.current = regionStart;
      lastPositionRef.current = regionStart;

      // IMMEDIATE volume and overlay update
      updateVolume(regionStart, true, true);
      drawVolumeOverlay(true);

      console.log(
        `[resetToRegionStart] INSTANT RESET COMPLETED - All refs set to ${regionStart.toFixed(
          4
        )}s`
      );
    };

    const updateRegionStyles = useCallback(() => {
      if (!regionRef.current || !regionRef.current.element) return;
    
      try {
        // Cache colors to avoid recalculation
        const currentColor = isDeleteMode
          ? "rgba(239, 68, 68, 0.2)"  // Red for delete mode
          : "rgba(59, 130, 246, 0.2)"; // Blue for normal mode
            
        const currentBorder = isDeleteMode 
          ? '2px solid rgba(239, 68, 68, 0.8)'
          : '1px solid rgba(59, 130, 246, 0.5)';
            
        const currentHandleStyle = {
          borderColor: isDeleteMode
            ? "rgba(239, 68, 68, 0.8)"
            : colors[theme].regionBorderColor,
          backgroundColor: isDeleteMode
            ? "rgba(239, 68, 68, 0.3)"
            : colors[theme].regionBorderColor,
        };
    
        // Update through WaveSurfer API first
        if (regionRef.current.setOptions) {
          regionRef.current.setOptions({
            color: currentColor,
            handleStyle: currentHandleStyle,
          });
        } else if (regionRef.current.update) {
          regionRef.current.update({
            color: currentColor,
            handleStyle: currentHandleStyle,
          });
        }
    
        // Then force update element style directly
        if (regionRef.current.element) {
          const element = regionRef.current.element;
          
          // Only update if style actually changed (performance optimization)
          if (element.style.backgroundColor !== currentColor) {
            element.style.backgroundColor = currentColor;
            element.style.border = currentBorder;
    
            // Update child elements more efficiently
            const regionElements = element.getElementsByClassName("wavesurfer-region");
            for (let i = 0; i < regionElements.length; i++) {
              const el = regionElements[i];
              el.style.backgroundColor = currentColor;
              el.style.border = currentBorder;
            }
          }
        }
      } catch (error) {
        console.error("[updateRegionStyles] Error:", error);
      }
    }, [isDeleteMode, theme, colors]);
    
    const getThrottledFunction = useCallback((funcName, originalFunc, delay) => {
      if (!throttledFunctionsRef.current[funcName]) {
        throttledFunctionsRef.current[funcName] = throttle(originalFunc, delay);
      }
      return throttledFunctionsRef.current[funcName];
    }, []);
    
    // Helper functions để get throttled versions
    const getThrottledUpdateRegionStyles = useCallback(() => {
      return getThrottledFunction('updateRegionStyles', updateRegionStyles, 16);
    }, [getThrottledFunction, updateRegionStyles]);
    
    const getThrottledDraw = useCallback(() => {
      return getThrottledFunction('drawVolumeOverlay', () => drawVolumeOverlay(), 16);
    }, [getThrottledFunction]);

    
    // Xử lý khi volumeProfile hoặc fade thay đổi
useEffect(() => {
  intendedVolumeRef.current = volume;
  customVolumeRef.current = customVolume;
  fadeEnabledRef.current = fade;
  currentProfileRef.current = volumeProfile;
  currentVolumeRef.current = volume;

  if (wavesurferRef.current && regionRef.current) {
    // CRITICAL FIX: Smarter position determination logic
    let targetPosition;
    const currentWsPosition = wavesurferRef.current.getCurrentTime();
    const syncedPos = syncPositionRef.current;
    const regionStart = regionRef.current.start;
    const regionEnd = regionRef.current.end;

    if (isPlaying) {
      // If playing, always use current wavesurfer position
      targetPosition = currentWsPosition;
    } else {
      // IMPROVED LOGIC: If not playing, prioritize recently synced position
      const wsInRegion = currentWsPosition >= regionStart && currentWsPosition <= regionEnd;
      const syncedInRegion = syncedPos >= regionStart && syncedPos <= regionEnd;
      const syncTimeDiff = performance.now() - lastSyncTimeRef.current;

      if (syncTimeDiff < 1000 && syncedInRegion) {
        // Recently synced position within region - use it
        targetPosition = syncedPos;
      } else if (wsInRegion) {
        // WS position is valid within region
        targetPosition = currentWsPosition;
      } else if (syncedInRegion) {
        // Synced position is valid within region
        targetPosition = syncedPos;
      } else {
        // Neither position is valid - default to region start
        targetPosition = regionStart;
      }
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Only sync if position actually changes
    const currentSyncedPos = syncPositionRef.current;
    const positionDiff = Math.abs(targetPosition - currentSyncedPos);

    if (positionDiff > 0.001) {
      syncPositions(targetPosition, "volumeProfileChange");
      updateVolume(targetPosition, true, true);
    } else {
      updateVolume(targetPosition, true, true);
    }

    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updateRealtimeVolume);
    }

    drawVolumeOverlay();
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [volumeProfile, volume, customVolume, fade, isPlaying]); // Functions are stable, don't need dependencies

    // Thêm useEffect mới để theo dõi thay đổi của customVolume
    useEffect(() => {
      if (
        volumeProfile === "custom" &&
        wavesurferRef.current &&
        regionRef.current
      ) {
        const updateVolumeAndOverlay = () => {
          const throttledUpdate = getThrottledFunction('volumeAndOverlayUpdate', () => {
            const currentPos = isPlaying
              ? wavesurferRef.current.getCurrentTime()
              : regionRef.current.start;
            syncPositions(currentPos, "customVolumeChange");
            updateVolume(currentPos, true, true);
            drawVolumeOverlay();
          }, 16);
          
          throttledUpdate();
        };

        updateVolumeAndOverlay();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
      customVolume.start,
      customVolume.middle,
      customVolume.end,
      volumeProfile,
    ]); // Functions are stable

    // Update refs when props change
    useEffect(() => {
      fadeInDurationRef.current = fadeInDuration;
      setFadeInDurationState(fadeInDuration);

      if (
        wavesurferRef.current &&
        (volumeProfile === "custom" || volumeProfile === "fadeInOut") &&
        !fadeEnabledRef.current
      ) {
        drawVolumeOverlay();

        if (isPlaying) {
          const currentPos = wavesurferRef.current.getCurrentTime();
          syncPositions(currentPos, "fadeInDurationChange");
          updateVolume(currentPos, true, true);
        } else if (regionRef.current) {
          syncPositions(regionRef.current.start, "fadeInDurationChange");
          updateVolume(regionRef.current.start, true, true);
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fadeInDuration]); // Functions are stable

    useEffect(() => {
      fadeOutDurationRef.current = fadeOutDuration;
      setFadeOutDurationState(fadeOutDuration);

      if (
        wavesurferRef.current &&
        (volumeProfile === "fadeInOut" || volumeProfile === "custom") &&
        !fadeEnabledRef.current
      ) {
        drawVolumeOverlay();

        if (isPlaying) {
          const currentPos = wavesurferRef.current.getCurrentTime();
          syncPositions(currentPos, "fadeOutDurationChange");
          updateVolume(currentPos, true, true);
        } else if (regionRef.current) {
          syncPositions(regionRef.current.start, "fadeOutDurationChange");
          updateVolume(regionRef.current.start, true, true);
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fadeOutDuration]); // Functions are stable

    useImperativeHandle(ref, () => ({
      play: () => {
        if (wavesurferRef.current && regionRef.current) {
          const resumePosition = lastPositionRef.current;
          const start = regionRef.current.start;
          const end = regionRef.current.end;
    
          const playFrom =
            resumePosition >= start && resumePosition < end
              ? resumePosition
              : start;
    
          currentProfileRef.current =
      fadeEnabledRef.current && volumeProfile === "uniform"
        ? "fadeInOut"
        : volumeProfile;
    
    // CRITICAL: Special handling for fadeIn profile
    const isFadeInProfile = currentProfileRef.current === "fadeIn";
    console.log(`[togglePlayPause] Starting playback with profile: ${currentProfileRef.current}, isFadeIn: ${isFadeInProfile}`);
    
    syncPositions(playFrom, "togglePlayPausePlay");
    updateVolume(playFrom, true, true);
    
    // ENHANCED: Force immediate volume update for fadeIn to prevent silence
    if (isFadeInProfile) {
      console.log(`[togglePlayPause] FADEIN: Forcing immediate volume update at position ${playFrom.toFixed(4)}s`);
      
      // Force multiple volume updates to ensure it takes effect
      setTimeout(() => {
        if (wavesurferRef.current && regionRef.current) {
          const currentPos = wavesurferRef.current.getCurrentTime();
          console.log(`[togglePlayPause] FADEIN: Second volume update at position ${currentPos.toFixed(4)}s`);
          updateVolume(currentPos, true, true);
          drawVolumeOverlay(true);
        }
      }, 50);
      
      setTimeout(() => {
        if (wavesurferRef.current && regionRef.current) {
          const currentPos = wavesurferRef.current.getCurrentTime();
          console.log(`[togglePlayPause] FADEIN: Third volume update at position ${currentPos.toFixed(4)}s`);
          updateVolume(currentPos, true, true);
        }
      }, 100);
    }
    
    console.log(
      `Starting playback from ${playFrom.toFixed(4)}s to ${end.toFixed(
        4
      )}s, loop: ${loop}, profile: ${currentProfileRef.current}`
    );
    
    wavesurferRef.current.play(playFrom, end);
          setIsPlaying(true);
        }
      },
      stop: () => {
        if (wavesurferRef.current) {
          const currentPos = wavesurferRef.current.getCurrentTime();
          syncPositions(currentPos, "stopCommand");
    
          wavesurferRef.current.pause();
    
          const totalDuration = wavesurferRef.current.getDuration();
          wavesurferRef.current.seekTo(currentPos / totalDuration);
    
          setIsPlaying(false);
        }
      },
      togglePlayPause: () => togglePlayPause(),
      seekTo: (position) => {
        if (wavesurferRef.current && regionRef.current) {
          const start = regionRef.current.start;
          const end = regionRef.current.end;
          const seekPos = start + position * (end - start);
          wavesurferRef.current.seekTo(
            seekPos / wavesurferRef.current.getDuration()
          );
          syncPositions(seekPos, "seekToCommand");
          updateVolume(seekPos, false, true);
        }
      },
      toggleFade: (fadeInState, fadeOutState) => {
        console.log('[TOGGLE_FADE] =================');
        console.log('[TOGGLE_FADE] Called with fadeIn:', fadeInState, 'fadeOut:', fadeOutState);
        console.log('[TOGGLE_FADE] Previous states:');
        console.log('[TOGGLE_FADE] - fadeInRef.current:', fadeInRef.current);
        console.log('[TOGGLE_FADE] - fadeOutRef.current:', fadeOutRef.current);
        console.log('[TOGGLE_FADE] - fadeEnabledRef.current:', fadeEnabledRef.current);
        
        // CRITICAL: Cập nhật refs ngay lập tức
        fadeInRef.current = fadeInState;
        fadeOutRef.current = fadeOutState;
        fadeEnabledRef.current = fadeInState || fadeOutState;
        
        console.log('[TOGGLE_FADE] Updated refs:');
        console.log('[TOGGLE_FADE] - fadeInRef.current:', fadeInRef.current);
        console.log('[TOGGLE_FADE] - fadeOutRef.current:', fadeOutRef.current);
        console.log('[TOGGLE_FADE] - fadeEnabledRef.current:', fadeEnabledRef.current);
        
        if (wavesurferRef.current && regionRef.current) {
          // Stop any current animation
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
          }
          
          // Determine best position for update
          const wsPosition = wavesurferRef.current.getCurrentTime();
          const syncedPosition = syncPositionRef.current;
          const regionStart = regionRef.current.start;
          const regionEnd = regionRef.current.end;
          
          let targetPosition;
          
          if (isPlaying) {
            targetPosition = wsPosition;
            console.log('[TOGGLE_FADE] Playing - using WS position:', targetPosition.toFixed(4), 's');
          } else {
            const wsInRegion = wsPosition >= regionStart && wsPosition <= regionEnd;
            const syncedInRegion = syncedPosition >= regionStart && syncedPosition <= regionEnd;
            
            if (wsInRegion) {
              targetPosition = wsPosition;
              console.log('[TOGGLE_FADE] Not playing - WS position in region:', targetPosition.toFixed(4), 's');
            } else if (syncedInRegion) {
              targetPosition = syncedPosition;
              console.log('[TOGGLE_FADE] Not playing - synced position in region:', targetPosition.toFixed(4), 's');
            } else {
              targetPosition = regionStart;
              console.log('[TOGGLE_FADE] Not playing - fallback to region start:', targetPosition.toFixed(4), 's');
            }
          }
          
          // CRITICAL: Force immediate position sync và volume update
          syncPositions(targetPosition, "toggleFade");
          
          // CRITICAL: Force volume recalculation với updated fade states
          console.log('[TOGGLE_FADE] Forcing volume update at position:', targetPosition.toFixed(4), 's');
          updateVolume(targetPosition, true, true);
          
          // CRITICAL: Force overlay redraw
          console.log('[TOGGLE_FADE] Forcing overlay redraw');
          drawVolumeOverlay(true);
          
          // Restart animation if playing
          if (isPlaying) {
            console.log('[TOGGLE_FADE] Restarting realtime volume animation');
            animationFrameRef.current = requestAnimationFrame(updateRealtimeVolume);
          }
          
          console.log('[TOGGLE_FADE] ✅ Toggle fade completed successfully');
        } else {
          console.log('[TOGGLE_FADE] ❌ Missing refs - wavesurfer:', !!wavesurferRef.current, 'region:', !!regionRef.current);
        }
        
        console.log('[TOGGLE_FADE] =================');
        return true;
      },
      setFadeInDuration: (duration) => {
        fadeInDurationRef.current = duration;
        setFadeInDurationState(duration);
        if (
          wavesurferRef.current &&
          (volumeProfile === "fadeInOut" || volumeProfile === "custom") &&
          !fadeEnabledRef.current
        ) {
          drawVolumeOverlay();
    
          if (isPlaying) {
            const currentPos = wavesurferRef.current.getCurrentTime();
            syncPositions(currentPos, "setFadeInDuration");
            updateVolume(currentPos, true, true);
          } else if (regionRef.current) {
            syncPositions(regionRef.current.start, "setFadeInDuration");
            updateVolume(regionRef.current.start, true, true);
          }
    
          setTimeout(() => {
            if (isDrawingOverlayRef.current) return;
            drawVolumeOverlay();
    
            if (isPlaying && wavesurferRef.current) {
              const currentPos = wavesurferRef.current.getCurrentTime();
              syncPositions(currentPos, "setFadeInDurationDelayed");
              updateVolume(currentPos, true, true);
            }
          }, 50);
        }
      },
      setFadeOutDuration: (duration) => {
        fadeOutDurationRef.current = duration;
        setFadeOutDurationState(duration);
        if (
          wavesurferRef.current &&
          (volumeProfile === "fadeInOut" || volumeProfile === "custom") &&
          !fadeEnabledRef.current
        ) {
          drawVolumeOverlay();
    
          if (isPlaying) {
            const currentPos = wavesurferRef.current.getCurrentTime();
            syncPositions(currentPos, "setFadeOutDuration");
            updateVolume(currentPos, true, true);
          } else if (regionRef.current) {
            syncPositions(regionRef.current.start, "setFadeOutDuration");
            updateVolume(regionRef.current.start, true, true);
          }
    
          setTimeout(() => {
            if (isDrawingOverlayRef.current) return;
            drawVolumeOverlay();
    
            if (isPlaying && wavesurferRef.current) {
              const currentPos = wavesurferRef.current.getCurrentTime();
              syncPositions(currentPos, "setFadeOutDurationDelayed");
              updateVolume(currentPos, true, true);
            }
          }, 50);
        }
      },
      getFadeInDuration: () => fadeInDurationState,
      getFadeOutDuration: () => fadeOutDurationState,
      isFadeEnabled: () => fadeEnabledRef.current,
      canEnableFade: () => volumeProfile === "uniform",
      isPlaying: () => isPlaying,
      setRegionStart: (startTime) => {
        if (wavesurferRef.current && regionRef.current) {
          const currentEnd = regionRef.current.end;
          if (startTime < currentEnd) {
            try {
              if (regionRef.current.setOptions) {
                regionRef.current.setOptions({ start: startTime });
              } else if (regionRef.current.update) {
                regionRef.current.update({ start: startTime });
              } else {
                regionRef.current.start = startTime;
                if (wavesurferRef.current.fireEvent) {
                  wavesurferRef.current.fireEvent(
                    "region-updated",
                    regionRef.current
                  );
                }
              }
    
              onRegionChange(startTime, currentEnd);
              syncPositions(startTime, "setRegionStart");
              updateVolume(startTime, true, true);
              drawVolumeOverlay();
    
              console.log("Successfully updated region start to:", startTime);
            } catch (err) {
              console.error("Error updating region start:", err);
            }
          } else {
            console.warn("Start time cannot be after end time");
          }
        } else {
          console.warn("wavesurferRef or regionRef is not available");
        }
      },
      setRegionEnd: (endTime) => {
        console.log("[setRegionEnd] Called with endTime:", endTime);
    
        try {
          if (!wavesurferRef.current || !regionRef.current) {
            console.log("[setRegionEnd] Missing refs");
            return;
          }
    
          const currentStart = regionRef.current.start;
          const currentTime = wavesurferRef.current.getCurrentTime();
    
          console.log(
            "[setRegionEnd] Current start:",
            currentStart,
            "Current time:",
            currentTime,
            "New end:",
            endTime
          );
    
          if (endTime <= currentStart) {
            console.warn(
              "[setRegionEnd] End time cannot be before or equal to start time"
            );
            return;
          }
    
          const wasClickUpdate = clickSourceRef.current === "click";
          console.log("[setRegionEnd] Is this from click?", wasClickUpdate);
    
          if (regionRef.current.setOptions) {
            regionRef.current.setOptions({ end: endTime });
          } else if (regionRef.current.update) {
            regionRef.current.update({ end: endTime });
          } else {
            regionRef.current.end = endTime;
            if (wavesurferRef.current.fireEvent) {
              wavesurferRef.current.fireEvent(
                "region-updated",
                regionRef.current
              );
            }
          }
          console.log(`[setRegionEnd] Region end updated to ${endTime}`);
    
          onRegionChange(currentStart, endTime);
          syncPositions(currentTime, "setRegionEnd");
          updateVolume(currentTime, true, true);
          drawVolumeOverlay();
    
          if (!wasClickUpdate && isPlaying) {
            console.log(
              `[setRegionEnd] Programmatic update - checking playback position`
            );
            if (currentTime >= endTime) {
              console.log(
                `[setRegionEnd] Current position (${currentTime}) >= new end (${endTime}), stopping playback`
              );
              wavesurferRef.current.pause();
              const totalDuration = wavesurferRef.current.getDuration();
              wavesurferRef.current.seekTo(currentStart / totalDuration);
              syncPositions(currentStart, "setRegionEndStop");
              setIsPlaying(false);
              onPlayStateChange(false);
            } else {
              console.log(
                `[setRegionEnd] Current position (${currentTime}) < new end (${endTime}), continuing playback`
              );
            }
          } else if (wasClickUpdate) {
            console.log(
              `[setRegionEnd] Click update - playback logic handled by click handler`
            );
          }
    
          console.log("[setRegionEnd] Finished execution successfully");
        } catch (err) {
          console.error("[setRegionEnd] Error:", err);
        }
      },
      getWavesurferInstance: () => wavesurferRef.current,
      getRegionsPlugin: () => regionsPluginRef.current,
      getRegion: () => regionRef.current,
      getRegionBounds: () => {
        console.log('[getRegionBounds] Called');
        
        if (!regionRef.current) {
          console.log('[getRegionBounds] No region available, returning null');
          return null;
        }
        
        const start = regionRef.current.start;
        const end = regionRef.current.end;
        const duration = wavesurferRef.current ? wavesurferRef.current.getDuration() : 0;
        
        console.log('[getRegionBounds] Raw values:', { start, end, duration });
        
        // Validate values
        if (typeof start !== 'number' || typeof end !== 'number' || isNaN(start) || isNaN(end)) {
          console.error('[getRegionBounds] Invalid start or end values:', { start, end });
          return {
            start: 0,
            end: duration || 0
          };
        }
        
        if (start < 0 || end <= 0 || start >= end) {
          console.error('[getRegionBounds] Invalid region bounds:', { start, end });
          return {
            start: 0,
            end: duration || 0
          };
        }
        
        if (duration > 0 && end > duration) {
          console.warn('[getRegionBounds] End time exceeds duration, clamping:', { end, duration });
          return {
            start: Math.max(0, start),
            end: duration
          };
        }
        
        const result = { start, end };
        console.log('[getRegionBounds] Valid result:', result);
        return result;
      },
      setRegionBounds: (start, end) => {
        console.log(`[setRegionBounds] Called with start: ${start}, end: ${end}`);
        
        if (!wavesurferRef.current || !regionRef.current) {
          console.error("[setRegionBounds] Missing refs");
          return false;
        }
        
        // Validate input
        if (!isFinite(start) || !isFinite(end) || start < 0 || end <= start) {
          console.error("[setRegionBounds] Invalid bounds:", { start, end });
          return false;
        }
        
        const duration = wavesurferRef.current.getDuration();
        if (end > duration) {
          console.error("[setRegionBounds] End time exceeds duration:", { end, duration });
          return false;
        }
        
        try {
          // Update region bounds
          if (regionRef.current.setOptions) {
            regionRef.current.setOptions({ start: start, end: end });
          } else if (regionRef.current.update) {
            regionRef.current.update({ start: start, end: end });
          } else {
            regionRef.current.start = start;
            regionRef.current.end = end;
            if (wavesurferRef.current.fireEvent) {
              wavesurferRef.current.fireEvent("region-updated", regionRef.current);
            }
          }
          
          console.log(`[setRegionBounds] Successfully set region to ${start.toFixed(4)}s - ${end.toFixed(4)}s`);
          
          // Update position and volume
          const currentPos = wavesurferRef.current.getCurrentTime();
          let targetPos = currentPos;
          
          // If current position is outside new bounds, move to start
          if (currentPos < start || currentPos > end) {
            targetPos = start;
            const totalDuration = wavesurferRef.current.getDuration();
            wavesurferRef.current.seekTo(targetPos / totalDuration);
            console.log(`[setRegionBounds] Moved playhead to region start: ${targetPos.toFixed(4)}s`);
          }
          
          syncPositions(targetPos, "setRegionBounds");
          updateVolume(targetPos, true, true);
          drawVolumeOverlay(true);
          
          return true;
          
        } catch (error) {
          console.error("[setRegionBounds] Error setting bounds:", error);
          return false;
        }
      },
      deleteRegion: () => {
        if (!regionRef.current) {
          console.warn("[deleteRegion] No region available to delete");
          return null;
        }
    
        const regionToDelete = {
          start: regionRef.current.start,
          end: regionRef.current.end,
        };
    
        console.log(
          `[deleteRegion] Deleting region: ${regionToDelete.start.toFixed(
            4
          )}s - ${regionToDelete.end.toFixed(4)}s`
        );
        return regionToDelete;
      },
      getCurrentRegion: () => {
        if (!regionRef.current) {
          console.warn("[getCurrentRegion] No region available");
          return null;
        }
    
        return {
          start: regionRef.current.start,
          end: regionRef.current.end,
          mode: isDeleteMode ? "delete" : "keep",
        };
      },
      isDeleteMode: () => isDeleteMode,
      getDeletePreview: () => {
        if (!regionRef.current || !wavesurferRef.current) {
          console.warn("[getDeletePreview] Missing refs for delete preview");
          return null;
        }
    
        const totalDuration = wavesurferRef.current.getDuration();
        const regionStart = regionRef.current.start;
        const regionEnd = regionRef.current.end;
    
        if (isDeleteMode) {
          // In delete mode, return the sections that will be kept
          const keepSections = [];
    
          // Section before deleted region
          if (regionStart > 0) {
            keepSections.push({
              start: 0,
              end: regionStart,
              type: "keep",
            });
          }
    
          // Section after deleted region
          if (regionEnd < totalDuration) {
            keepSections.push({
              start: regionEnd,
              end: totalDuration,
              type: "keep",
            });
          }
    
          return {
            mode: "delete",
            deleteSection: {
              start: regionStart,
              end: regionEnd,
              type: "delete",
            },
            keepSections,
            totalDuration,
          };
        } else {
          // In normal mode, return the selected section
          return {
            mode: "keep",
            keepSections: [
              { start: regionStart, end: regionEnd, type: "keep" },
            ],
            deleteSection: null,
            totalDuration,
          };
        }
      },
      // CRITICAL: NEW METHOD - Ensure playback stays within region bounds
      ensurePlaybackWithinBounds: () => {
        console.log('[ensurePlaybackWithinBounds] Called via imperative handle');
        ensurePlaybackWithinBounds();
      },
    }));


const togglePlayPause = () => {
  if (!wavesurferRef.current || !regionRef.current) return;

  if (isPlaying) {
    const currentPos = wavesurferRef.current.getCurrentTime();
    syncPositions(currentPos, "togglePlayPausePause");

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    wavesurferRef.current.pause();

    const totalDuration = wavesurferRef.current.getDuration();
    wavesurferRef.current.seekTo(currentPos / totalDuration);

    setIsPlaying(false);
    onPlayStateChange(false);
    drawVolumeOverlay();
  } else {
    const start = regionRef.current.start;
    const end = regionRef.current.end;

    // === FIX: Ưu tiên vị trí hiện tại thay vì resumePosition ===
    const currentWsPosition = wavesurferRef.current.getCurrentTime();
    const syncedPosition = syncPositionRef.current;

    let playFrom;

    // Logic mới: Ưu tiên vị trí hiện tại nếu nó trong region
    if (currentWsPosition >= start && currentWsPosition < end) {
      playFrom = currentWsPosition;
    } else if (syncedPosition >= start && syncedPosition < end) {
      playFrom = syncedPosition;
    } else {
      // Fallback về resumePosition hoặc region start
      const resumePosition = lastPositionRef.current;
      playFrom =
        resumePosition >= start && resumePosition < end
          ? resumePosition
          : start;
    }

    currentProfileRef.current =
      fadeEnabledRef.current && volumeProfile === "uniform"
        ? "fadeInOut"
        : volumeProfile;

    // CRITICAL: Special handling for fadeIn profile
    const isFadeInProfile = currentProfileRef.current === "fadeIn";

    syncPositions(playFrom, "togglePlayPausePlay");
    updateVolume(playFrom, true, true);

    // ENHANCED: Force immediate volume update for fadeIn to prevent silence
    if (isFadeInProfile) {
      // Force multiple volume updates to ensure it takes effect
      setTimeout(() => {
        if (wavesurferRef.current && regionRef.current) {
          const currentPos = wavesurferRef.current.getCurrentTime();
          updateVolume(currentPos, true, true);
          drawVolumeOverlay(true);
        }
      }, 50);
      
      setTimeout(() => {
        if (wavesurferRef.current && regionRef.current) {
          const currentPos = wavesurferRef.current.getCurrentTime();
          updateVolume(currentPos, true, true);
        }
      }, 100);
    }

    wavesurferRef.current.play(playFrom, end);

    setIsPlaying(true);
    onPlayStateChange(true);

    if (loop) {
      // Silent loop mode activation
    }
  }

  setTimeout(() => {
    verifyPlaybackState();
  }, 100);
};

const calculateVolumeForProfile = (relPos, profile) => {
  // CRITICAL: Validate input parameters first
  if (typeof relPos !== 'number' || isNaN(relPos) || !isFinite(relPos)) {
    console.warn('[calculateVolumeForProfile] Invalid relPos:', relPos, 'defaulting to 0');
    relPos = 0;
  }
  
  // Clamp relPos to valid range
  relPos = Math.max(0, Math.min(1, relPos));
  
  const intendedVolume = Math.min(1.0, intendedVolumeRef.current || 1.0);
  const currentCustomVolume = {
    start: Math.min(1.0, customVolumeRef.current?.start || 1.0),
    middle: Math.min(1.0, customVolumeRef.current?.middle || 1.0),
    end: Math.min(1.0, customVolumeRef.current?.end || 1.0),
  };
  
  // Validate intendedVolume
  if (!isFinite(intendedVolume) || isNaN(intendedVolume)) {
    console.error('[calculateVolumeForProfile] Invalid intendedVolume:', intendedVolume);
    return 1.0;
  }
  
  // Check fade states
  const isFadeEnabled = fadeEnabledRef.current;
  const isFadeIn = fadeInRef.current;
  const isFadeOut = fadeOutRef.current;
  
  // Calculate base volume from profile
  let baseVolume = intendedVolume;
  
  try {
    switch (profile) {
      case "uniform":
        baseVolume = intendedVolume;
        break;
        
      case "custom": {
        if (relPos <= 0.5) {
          const t = relPos * 2;
          baseVolume = intendedVolume * (currentCustomVolume.start + (currentCustomVolume.middle - currentCustomVolume.start) * t);
        } else {
          const t = (relPos - 0.5) * 2;
          baseVolume = intendedVolume * (currentCustomVolume.middle + (currentCustomVolume.end - currentCustomVolume.middle) * t);
        }
        
        // Apply fade in/out duration for custom profile
        const regionDuration = regionRef.current ? regionRef.current.end - regionRef.current.start : 0;
        const fadeInDur = fadeInDurationRef.current || 3;
        const fadeOutDur = fadeOutDurationRef.current || 3;
        
        if (regionDuration > 0 && isFinite(regionDuration)) {
          const posInRegion = relPos * regionDuration;
          const timeToEnd = regionDuration - posInRegion;
          
          let fadeMultiplier = 1.0;
          
          if (posInRegion < fadeInDur && isFinite(fadeInDur) && fadeInDur > 0) {
            const fadeInMultiplier = Math.max(0, Math.min(1, posInRegion / fadeInDur));
            fadeMultiplier *= fadeInMultiplier;
          }
          
          if (timeToEnd < fadeOutDur && isFinite(fadeOutDur) && fadeOutDur > 0) {
            const fadeOutMultiplier = Math.max(0, Math.min(1, timeToEnd / fadeOutDur));
            fadeMultiplier *= fadeOutMultiplier;
          }
          
          baseVolume *= fadeMultiplier;
        }
        break;
      }
      
      case "fadeIn": {
        const safeRelPos = Math.max(0, Math.min(1, relPos));
        const MIN_AUDIBLE_VOLUME = 0.02;
        const fadeRange = intendedVolume - MIN_AUDIBLE_VOLUME;
        baseVolume = MIN_AUDIBLE_VOLUME + (fadeRange * safeRelPos);
        baseVolume = Math.min(baseVolume, intendedVolume);
        break;
      }
      
      case "fadeOut": {
        baseVolume = intendedVolume * (1 - relPos);
        break;
      }
      
      case "fadeInOut": {
        const fadeInDur = fadeInDurationRef.current || 3;
        const fadeOutDur = fadeOutDurationRef.current || 3;
        const regionDuration = regionRef.current ? regionRef.current.end - regionRef.current.start : 0;
        
        if (regionDuration <= 0 || !isFinite(regionDuration)) {
          baseVolume = intendedVolume;
          break;
        }
        
        const posInRegion = relPos * regionDuration;
        const timeToEnd = regionDuration - posInRegion;
        
        let fadeMultiplier = 1.0;
        
        if (posInRegion < fadeInDur && isFinite(fadeInDur) && fadeInDur > 0) {
          fadeMultiplier *= Math.max(0, Math.min(1, posInRegion / fadeInDur));
        }
        
        if (timeToEnd < fadeOutDur && isFinite(fadeOutDur) && fadeOutDur > 0) {
          fadeMultiplier *= Math.max(0, Math.min(1, timeToEnd / fadeOutDur));
        }
        
        baseVolume = intendedVolume * fadeMultiplier;
        break;
      }
      
      // Other cases remain same...
      default: {
        baseVolume = intendedVolume;
        break;
      }
    }
  } catch (error) {
    console.error('[calculateVolumeForProfile] Error in profile calculation:', error);
    baseVolume = intendedVolume;
  }
  
  // Apply additional fade effects if enabled
  let finalVolume = baseVolume;
  
  if (isFadeEnabled && (isFadeIn || isFadeOut)) {
    const regionDuration = regionRef.current ? regionRef.current.end - regionRef.current.start : 0;
    
    if (regionDuration > 0 && isFinite(regionDuration)) {
      const posInRegion = relPos * regionDuration;
      const timeToEnd = regionDuration - posInRegion;
      const FIXED_FADE_DURATION = 2.0;
      
      if (isFadeIn && posInRegion < FIXED_FADE_DURATION) {
        const fadeInMultiplier = Math.max(0, Math.min(1, posInRegion / FIXED_FADE_DURATION));
        finalVolume *= fadeInMultiplier;
      }
      
      if (isFadeOut && timeToEnd < FIXED_FADE_DURATION) {
        const fadeOutMultiplier = Math.max(0, Math.min(1, timeToEnd / FIXED_FADE_DURATION));
        finalVolume *= fadeOutMultiplier;
      }
    }
  }
  
  // CRITICAL: Final validation before return
  const result = Math.max(0, Math.min(1, finalVolume));
  
  if (!isFinite(result) || isNaN(result)) {
    console.error('[calculateVolumeForProfile] CRITICAL: Invalid final result:', result, 'returning safe fallback');
    return 1.0;
  }
  
  return result;
};

const updateVolume = (absPosition = null, forceUpdate = false, forceRedraw = false) => {
  if (!wavesurferRef.current || !regionRef.current) {
    return;
  }

  const regionStart = regionRef.current.start;
  const regionEnd = regionRef.current.end;
  
  // CRITICAL: Validate region bounds
  if (!isFinite(regionStart) || !isFinite(regionEnd) || regionEnd <= regionStart) {
    console.error('[updateVolume] Invalid region bounds:', { regionStart, regionEnd });
    return;
  }

  const currentPos = absPosition ?? (isPlaying ? wavesurferRef.current.getCurrentTime() : syncPositionRef.current);
  
  // CRITICAL: Validate currentPos
  if (!isFinite(currentPos) || isNaN(currentPos)) {
    console.error('[updateVolume] Invalid currentPos:', currentPos);
    return;
  }

  if (absPosition !== null) {
    syncPositions(currentPos, "updateVolume");
  }

  const start = regionRef.current.start;
  const end = regionRef.current.end;
  const regionDuration = end - start;
  
  // CRITICAL: Validate regionDuration
  if (!isFinite(regionDuration) || regionDuration <= 0) {
    console.error('[updateVolume] Invalid regionDuration:', regionDuration);
    return;
  }
  
  // Early return if position hasn't changed significantly and not forced
  if (!forceUpdate && Math.abs(currentPos - lastPositionRef.current) < 0.01) {
    return;
  }
  
  const relPos = Math.max(0, Math.min(1, (currentPos - start) / regionDuration));
  
  // CRITICAL: Validate relPos
  if (!isFinite(relPos) || isNaN(relPos)) {
    console.error('[updateVolume] Invalid relPos:', relPos, 'currentPos:', currentPos, 'start:', start, 'regionDuration:', regionDuration);
    return;
  }

  // ✅ REMOVED: Enhanced debugging for fadeIn profile - only log errors
  const isFadeInProfile = currentProfileRef.current === "fadeIn";
  if (isFadeInProfile) {
    const vol = calculateVolumeForProfile(relPos, currentProfileRef.current);
    
    // Only log critical errors
    if (!isFinite(vol) || isNaN(vol)) {
      console.error(`[updateVolume] FADEIN CRITICAL: Invalid volume calculated: ${vol} for relPos=${relPos.toFixed(4)}`);
      return;
    }
    
    if (vol < 0.01 && relPos > 0.01) {
      console.error(`[updateVolume] FADEIN EMERGENCY: Volume too low (${vol.toFixed(4)}) for relPos=${relPos.toFixed(4)}`);
    }
  }

  const vol = calculateVolumeForProfile(relPos, currentProfileRef.current);
  
  // CRITICAL: Final volume validation
  if (!isFinite(vol) || isNaN(vol)) {
    console.error('[updateVolume] CRITICAL: calculateVolumeForProfile returned invalid volume:', vol);
    return;
  }
  
  const normalizedVol = Math.max(0, Math.min(1, vol));
  
  // CRITICAL: Double-check normalized volume
  if (!isFinite(normalizedVol) || isNaN(normalizedVol)) {
    console.error('[updateVolume] CRITICAL: normalizedVol is invalid:', normalizedVol);
    return;
  }
  
  // Only update if volume actually changed
  const volumeChanged = Math.abs(normalizedVol - currentVolumeRef.current) > 0.001;
  
  if (volumeChanged || forceUpdate) {
    try {
      wavesurferRef.current.setVolume(normalizedVol);
      setCurrentVolumeDisplay(vol);
      currentVolumeRef.current = vol;
      
      // Update last position only when we actually made changes
      lastPositionRef.current = currentPos;
      
      // ✅ REMOVED: Success log to reduce noise
    } catch (error) {
      console.error('[updateVolume] Error setting volume:', error);
      return;
    }
  }

  // Conditional redraw - only when necessary
  if (forceRedraw || (volumeChanged && !isDraggingRef.current)) {
    requestAnimationFrame(() => {
      if (typeof drawVolumeOverlay === 'function') {
        drawVolumeOverlay();
      }
    });
  }
};



const drawVolumeOverlay = (forceRedraw = false) => {
  if (!overlayRef.current || !regionRef.current || !wavesurferRef.current) return;

  const now = performance.now();
  if (!forceRedraw && !isDraggingRef.current && now - lastDrawTimeRef.current < DRAW_INTERVAL) {
    return;
  }
  lastDrawTimeRef.current = now;

  if (drawTimerRef.current) {
    clearTimeout(drawTimerRef.current);
    drawTimerRef.current = null;
  }

  if (isDrawingOverlayRef.current) return;
  isDrawingOverlayRef.current = true;

  try {
    const ctx = overlayRef.current.getContext("2d");
    const width = overlayRef.current.width;
    const height = overlayRef.current.height;
    ctx.clearRect(0, 0, width, height);

    if (regionRef.current) {
      const start = regionRef.current.start;
      const end = regionRef.current.end;
      const totalDuration = wavesurferRef.current.getDuration();

      const startX = Math.max(0, Math.floor((start / totalDuration) * width));
      const endX = Math.min(width, Math.ceil((end / totalDuration) * width));
      const regionWidth = endX - startX;

      const currentProfile = currentProfileRef.current;
      const currentVolume = currentVolumeRef.current;

      // Draw volume overlay background
      ctx.fillStyle = colors[theme].volumeOverlayColor;
      ctx.beginPath();
      ctx.moveTo(startX, height);

      // Calculate max volume
      let maxVol = currentVolume;
      if (currentProfile !== "uniform") {
        // Optimize sample points based on profile complexity
        const samplePoints = (() => {
          switch (currentProfile) {
            case "custom":
            case "fadeInOut":
            case "bell":
            case "valley":
              return Math.min(200, regionWidth);
            case "exponential_in":
            case "exponential_out":
              return Math.min(100, regionWidth / 2);
            default:
              return 20;
          }
        })();
        
        for (let i = 0; i <= samplePoints; i++) {
          const t = i / samplePoints;
          const vol = calculateVolumeForProfile(t, currentProfile);
          maxVol = Math.max(maxVol, vol);
        }
      }
      maxVol = Math.max(1.0, maxVol);

      // Draw the volume curve - OPTIMIZED: Reduce sample points
      const stepSize = (() => {
        switch (currentProfile) {
          case "custom":
            return Math.max(2, Math.floor(regionWidth / 200));
          case "fadeInOut":
          case "bell":
          case "valley":
            return Math.max(1, Math.floor(regionWidth / 300));
          default:
            return Math.max(1, Math.floor(regionWidth / 400));
        }
      })();

      for (let i = 0; i <= regionWidth; i += stepSize) {
        const x = startX + i;
        const t = i / regionWidth;
        const vol = calculateVolumeForProfile(t, currentProfile);
        const h = (vol / maxVol) * height;
        ctx.lineTo(x, height - h);
      }

      ctx.lineTo(endX, height);
      ctx.closePath();
      ctx.fill();

      // CRITICAL: Draw fade zones if fade is enabled
      if (fadeEnabledRef.current && regionRef.current) {
        const regionDuration = end - start;
        const FADE_DURATION = 2.0;
        
        ctx.save();
        
        // Draw fade in zone (first 2s)
        if (fadeInRef.current && regionDuration > FADE_DURATION) {
          const fadeInWidth = (FADE_DURATION / regionDuration) * regionWidth;
          
          // Fade in gradient overlay
          const fadeInGradient = ctx.createLinearGradient(startX, 0, startX + fadeInWidth, 0);
          fadeInGradient.addColorStop(0, 'rgba(34, 197, 94, 0.3)');
          fadeInGradient.addColorStop(1, 'rgba(34, 197, 94, 0.1)');
          
          ctx.fillStyle = fadeInGradient;
          ctx.fillRect(startX, 0, fadeInWidth, height);
          
          // Fade in border
          ctx.strokeStyle = 'rgba(34, 197, 94, 0.6)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(startX + fadeInWidth, 0);
          ctx.lineTo(startX + fadeInWidth, height);
          ctx.stroke();
        }
        
        // Draw fade out zone (last 2s)
        if (fadeOutRef.current && regionDuration > FADE_DURATION) {
          const fadeOutWidth = (FADE_DURATION / regionDuration) * regionWidth;
          const fadeOutStartX = endX - fadeOutWidth;
          
          // Fade out gradient overlay
          const fadeOutGradient = ctx.createLinearGradient(fadeOutStartX, 0, endX, 0);
          fadeOutGradient.addColorStop(0, 'rgba(239, 68, 68, 0.1)');
          fadeOutGradient.addColorStop(1, 'rgba(239, 68, 68, 0.3)');
          
          ctx.fillStyle = fadeOutGradient;
          ctx.fillRect(fadeOutStartX, 0, fadeOutWidth, height);
          
          // Fade out border
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(fadeOutStartX, 0);
          ctx.lineTo(fadeOutStartX, height);
          ctx.stroke();
        }
        
        ctx.restore();
      }

      // Draw waveform outline
      ctx.save();
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = colors[theme].progressColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= regionWidth; i++) {
        const x = startX + i;
        const t = i / regionWidth;
        const vol = calculateVolumeForProfile(t, currentProfile);
        const h = (vol / maxVol) * height;
        if (i === 0) {
          ctx.moveTo(x, height - h);
        } else {
          ctx.lineTo(x, height - h);
        }
      }
      ctx.stroke();
      ctx.restore();

      // Get current position for indicator
      let currentTime;
      if (isClickUpdatingEndRef.current && lastClickEndTimeRef.current) {
        currentTime = calculatePreviewPosition(lastClickEndTimeRef.current, wavesurferRef.current.getCurrentTime());
      } else {
        const wsPosition = wavesurferRef.current.getCurrentTime();
        const syncedPosition = syncPositionRef.current;
        
        if (isPlaying) {
          currentTime = wsPosition;
        } else {
          const wsInRegion = wsPosition >= start && wsPosition <= end;
          const syncedInRegion = syncedPosition >= start && syncedPosition <= end;
          const syncTimeDiff = performance.now() - lastSyncTimeRef.current;
          
          if (syncTimeDiff < 500 && syncedInRegion) {
            currentTime = syncedPosition;
          } else if (wsInRegion) {
            currentTime = wsPosition;
          } else {
            currentTime = start;
          }
        }
      }

      // Draw volume indicator
      if (currentTime >= start && currentTime <= end) {
        ctx.save();
        
        const currentX = Math.floor((currentTime / totalDuration) * width);
        const t = (currentTime - start) / (end - start);
        const vol = calculateVolumeForProfile(t, currentProfile);
        const h = (vol / maxVol) * height;

        // Draw the orange indicator line
        ctx.strokeStyle = "#f97316";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(currentX, height - h);
        ctx.lineTo(currentX, height);
        ctx.stroke();
        
        // Add a small circle at the top
        ctx.beginPath();
        ctx.arc(currentX, height - h, 3, 0, Math.PI * 2);
        ctx.fillStyle = "#f97316";
        ctx.fill();
        
        ctx.restore();
        lastDrawPositionRef.current = currentX;
      }
    }
  } finally {
    isDrawingOverlayRef.current = false;
  }
};


    const handleLoopPlayback = () => {
      if (!wavesurferRef.current || !regionRef.current) return;

      const loopCount = trackLoop();

      const start = regionRef.current.start;
      const end = regionRef.current.end;

      // === SYNC FIX: Update synchronized position for loop restart ===
      syncPositions(start, "handleLoopPlayback");

      console.log(
        `Loop playback #${loopCount}: restarting from ${start.toFixed(
          2
        )}s to ${end.toFixed(2)}s`
      );

      if (!isPlaying) {
        setIsPlaying(true);
        onPlayStateChange(true);
      }

      wavesurferRef.current.pause();

      const totalDuration = wavesurferRef.current.getDuration();
      wavesurferRef.current.seekTo(start / totalDuration);

      setTimeout(() => {
        if (!wavesurferRef.current || !regionRef.current || !loop) return;

        if (wavesurferRef.current.getCurrentTime() !== start) {
          wavesurferRef.current.seekTo(start / totalDuration);
        }

        updateVolume(start, true, true);

        console.log(
          `Loop #${loopCount}: Starting playback from ${start.toFixed(
            2
          )}s to ${end.toFixed(2)}s`
        );
        wavesurferRef.current.play(start, end);

        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        animationFrameRef.current = requestAnimationFrame(updateRealtimeVolume);
      }, 50);
    };

    const handlePlaybackEnd = () => {
      console.log("[handlePlaybackEnd] 🏁 PLAYBACK END HANDLER START");

      // Critical validation
      if (!wavesurferRef.current || !regionRef.current) {
        console.error(
          "[handlePlaybackEnd] Missing refs - wavesurfer:",
          !!wavesurferRef.current,
          "region:",
          !!regionRef.current
        );
        return;
      }

      // Prevent recursive calls
      if (isEndingPlaybackRef.current) {
        console.log("[handlePlaybackEnd] Already processing end, skipping");
        return;
      }

      console.log("[handlePlaybackEnd] Current state:");
      console.log(`  - isPlaying: ${isPlaying}`);
      console.log(
        `  - Current time: ${wavesurferRef.current
          .getCurrentTime()
          .toFixed(4)}s`
      );
      console.log(
        `  - Region: ${regionRef.current.start.toFixed(
          4
        )}s - ${regionRef.current.end.toFixed(4)}s`
      );

      // Lock the handler
      isEndingPlaybackRef.current = true;
      try {
        // Stop all animations immediately
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }

        if (overlayAnimationFrameRef.current) {
          cancelAnimationFrame(overlayAnimationFrameRef.current);
          overlayAnimationFrameRef.current = null;
        }

        // Pause WaveSurfer if playing
        if (
          wavesurferRef.current.isPlaying &&
          wavesurferRef.current.isPlaying()
        ) {
          wavesurferRef.current.pause();
        }

        // Update state immediately
        setIsPlaying(false);
        if (onPlayStateChange) onPlayStateChange(false);
        if (onPlayEnd) onPlayEnd();

        // Reset to region start using helper function
        console.log("[handlePlaybackEnd] Resetting to region start");
        resetToRegionStart("handlePlaybackEnd_force");
      } catch (error) {
        console.error("[handlePlaybackEnd] Exception:", error);
      } finally {
        // Unlock handler
        setTimeout(() => {
          isEndingPlaybackRef.current = false;
          console.log("[handlePlaybackEnd] Handler unlocked");
        }, 100);
      }

      console.log("[handlePlaybackEnd] 🏁 HANDLER COMPLETED");
    };

    const verifyPlaybackState = () => {
      if (!wavesurferRef.current || !regionRef.current) return;
    
      const wavesurferPlaying = wavesurferRef.current.isPlaying
        ? wavesurferRef.current.isPlaying()
        : false;
      const internalPlaying = isPlaying;
    
      if (wavesurferPlaying !== internalPlaying) {
        if (wavesurferPlaying && !internalPlaying) {
          setIsPlaying(true);
          if (onPlayStateChange) onPlayStateChange(true);
        } else if (!wavesurferPlaying && internalPlaying) {
          // Get current position BEFORE changing isPlaying state
          const currentPos = wavesurferRef.current.getCurrentTime();
          const regionStart = regionRef.current.start;
          const regionEnd = regionRef.current.end;
          const END_TOLERANCE = 0.05; // 50ms tolerance for natural playback end
    
          // Check if this is a natural playback end (position slightly past region end)
          const pastRegionEnd = currentPos > regionEnd;
          const endDistance = currentPos - regionEnd;
          const isNaturalEnd = pastRegionEnd && endDistance <= END_TOLERANCE;
    
          if (isNaturalEnd) {
            // Use resetToRegionStart helper for smooth reset
            resetToRegionStart("verifyPlaybackState_naturalEnd");
          } else if (currentPos >= regionStart && currentPos <= regionEnd) {
            syncPositions(currentPos, "verifyPlaybackStatePreserve");
          } else {
            resetToRegionStart("verifyPlaybackState_correction");
          }
    
          // Change the state - position has been handled appropriately
          setIsPlaying(false);
          if (onPlayStateChange) onPlayStateChange(false);
        }
      }
    };


    const updateRealtimeVolume = () => {
      // Basic validation checks
      if (!wavesurferRef.current || !regionRef.current || !isPlaying) return;
    
      const isWavesurferPlaying = wavesurferRef.current.isPlaying 
        ? wavesurferRef.current.isPlaying() 
        : isPlaying && !wavesurferRef.current.paused;
    
      if (!isWavesurferPlaying) {
        handlePlaybackEnd();
        return;
      }
    
      // Get current position and region bounds
      const currentPos = wavesurferRef.current.getCurrentTime();
      const regionStart = regionRef.current.start;
      const regionEnd = regionRef.current.end;
    
      // CRITICAL: Check if position is outside region bounds
      if (currentPos < regionStart) {
        // ✅ ONLY log significant corrections
        console.log(`[updateRealtimeVolume] Position correction: ${currentPos.toFixed(3)}s → ${regionStart.toFixed(3)}s`);
        
        const totalDuration = wavesurferRef.current.getDuration();
        wavesurferRef.current.seekTo(regionStart / totalDuration);
        wavesurferRef.current.play(regionStart, regionEnd);
        
        syncPositionRef.current = regionStart;
        currentPositionRef.current = regionStart;
        lastPositionRef.current = regionStart;
        
        setCurrentTime(regionStart);
        onTimeUpdate(regionStart);
        updateVolume(regionStart, true, true);
        
        animationFrameRef.current = requestAnimationFrame(updateRealtimeVolume);
        return;
      }
    
      // Validation for position accuracy
      if (currentPos > regionEnd + 0.1) {
        // ✅ ONLY log end detection
        console.log(`[updateRealtimeVolume] End detected: ${currentPos.toFixed(3)}s > ${regionEnd.toFixed(3)}s`);
        
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        
        handlePlaybackEnd();
        return;
      }
    
      // Update position references
      syncPositionRef.current = currentPos;
      currentPositionRef.current = currentPos;
      lastPositionRef.current = currentPos;
    
      setCurrentTime(currentPos);
      onTimeUpdate(currentPos);
    
      // Volume update with minimal logging
      const currentProfile = currentProfileRef.current;
      if (currentProfile === "fadeIn") {
        const relPos = (currentPos - regionStart) / (regionEnd - regionStart);
        updateVolume(currentPos, true, true);
        
        // Only log critical errors
        const currentVol = currentVolumeRef.current;
        if (currentVol < 0.01 && relPos > 0.02) {
          console.error(`[updateRealtimeVolume] FADEIN ERROR: Volume=${currentVol.toFixed(4)} at relPos=${relPos.toFixed(4)}`);
          
          setTimeout(() => {
            if (wavesurferRef.current) {
              updateVolume(wavesurferRef.current.getCurrentTime(), true, true);
            }
          }, 10);
        }
      } else {
        updateVolume(currentPos, false, false);
      }
    
      drawVolumeOverlay(true);
    
      // End detection
      const END_TOLERANCE = 0.02;
      const distanceToEnd = regionEnd - currentPos;
    
      if (distanceToEnd <= END_TOLERANCE) {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        
        handlePlaybackEnd();
        return;
      }
    
      animationFrameRef.current = requestAnimationFrame(updateRealtimeVolume);
    };



// CRITICAL: Function to ensure playback stays within region bounds
const ensurePlaybackWithinBounds = useCallback(() => {
  if (!wavesurferRef.current || !regionRef.current || !isPlaying) return;
  
  const currentPos = wavesurferRef.current.getCurrentTime();
  const regionStart = regionRef.current.start;
  const regionEnd = regionRef.current.end;
  
  console.log(`[ensurePlaybackWithinBounds] Checking position ${currentPos.toFixed(3)}s against region ${regionStart.toFixed(3)}s - ${regionEnd.toFixed(3)}s`);
  
  // If position is outside bounds, correct it
  if (currentPos < regionStart || currentPos >= regionEnd) {
    console.log(`[ensurePlaybackWithinBounds] Position outside bounds - correcting to region start`);
    
    // Stop current playback
    wavesurferRef.current.pause();
    
    // Seek to region start
    const totalDuration = wavesurferRef.current.getDuration();
    wavesurferRef.current.seekTo(regionStart / totalDuration);
    
    // Restart playback from region start to end
    setTimeout(() => {
      if (wavesurferRef.current && regionRef.current && isPlaying) {
        console.log(`[ensurePlaybackWithinBounds] Restarting playback from ${regionStart.toFixed(3)}s to ${regionEnd.toFixed(3)}s`);
        wavesurferRef.current.play(regionStart, regionEnd);
        
        // Update position references
        syncPositions(regionStart, "ensurePlaybackWithinBounds");
        updateVolume(regionStart, true, true);
      }
    }, 50);
  } else {
    console.log(`[ensurePlaybackWithinBounds] Position within bounds - no correction needed`);
  }
}, [isPlaying, syncPositions, updateVolume]);

    useEffect(() => {
      let stateVerificationInterval;

      if (isPlaying) {
        stateVerificationInterval = setInterval(() => {
          verifyPlaybackState();
        }, 2000);
      }
      return () => {
        if (stateVerificationInterval) {
          clearInterval(stateVerificationInterval);
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPlaying]); // verifyPlaybackState is stable

    useEffect(() => {
      const current = wavesurferRef.current;
      if (current) {
        current.on("error", (err) => {
          console.error("WaveSurfer error:", err);
        });
      }

      return () => {
        if (current) {
          // Cleanup if needed
        }
      };
    }, []);


    useEffect(() => {
      if (!audioFile) return;
      setLoading(true);

      // Capture the waveform ref early to avoid stale closure in cleanup
      const currentWaveformElement = waveformRef.current;

      throttledDrawRef.current = () => getThrottledDraw()();

      const ws = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: "#e5e7eb",
        progressColor: "#e5e7eb",
        height: 120,
        responsive: true,
        cursorColor: colors[theme].cursorColor,
        backend: "WebAudio",
        volume: Math.min(1, volume),
        barWidth: 1.8,
        barGap: 1,
        barRadius: 3,
        normalize: normalizeAudio,        barColor: (barIndex, barTime) => {
          console.log("[BARCOLOR] Called with:", {
            barIndex,
            barTime: barTime.toFixed(3),
            removeMode: removeModeRef.current, // Use ref instead of closure
            hasRegion: !!regionRef.current,
          });

          if (!regionRef.current) {
            console.log("[BARCOLOR] No region, returning default gray");
            return "#e5e7eb";
          }

          const start = regionRef.current.start;
          const end = regionRef.current.end;
          const isInRegion = barTime >= start && barTime <= end;

          console.log("[BARCOLOR] Region analysis:", {
            regionStart: start.toFixed(3),
            regionEnd: end.toFixed(3),
            isInRegion,
            currentMode: removeModeRef.current ? "DELETE" : "NORMAL", // Use ref
          });

          if (removeModeRef.current) { // Use ref instead of closure
            // Chế độ xóa: vùng chọn trong suốt, phần ngoài màu xanh
            if (isInRegion) {
              console.log("[BARCOLOR] Delete mode - region (transparent)");
              return "transparent"; // Vùng sẽ bị xóa - trong suốt
            } else {
              console.log("[BARCOLOR] Delete mode - keep area (blue)");
              return "#3b82f6"; // Phần giữ lại - màu xanh
            }
          } else {
            // Chế độ bình thường: vùng chọn xanh, phần ngoài xám
            if (isInRegion) {
              console.log("[BARCOLOR] Normal mode - selected region (blue)");
              return "#3b82f6"; // Vùng được chọn - màu xanh
            } else {
              console.log("[BARCOLOR] Normal mode - unselected (gray)");
              return "#e5e7eb"; // Phần không chọn - màu xám
            }
          }
        },
      });

      const handleWaveformClick = (e) => {
        try {
          if (!wavesurferRef.current || !regionRef.current) return;
      
          console.log("[handleWaveformClick] 🖱️ Click detected");
          
          const rect = waveformRef.current.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const clickTime = (clickX / rect.width) * wavesurferRef.current.getDuration();
      
          const currentStart = regionRef.current.start;
          const currentEnd = regionRef.current.end;
          const wasPlaying = isPlaying;
          const currentTime = wavesurferRef.current.getCurrentTime();
      
          console.log(`[handleWaveformClick] 📍 Click analysis: time=${clickTime.toFixed(4)}s, region=${currentStart.toFixed(4)}-${currentEnd.toFixed(4)}s`);
      
          // ✅ ALWAYS set click flags fresh (ignore previous state)
          console.log("[handleWaveformClick] 🔄 Setting fresh click flags");
          clickSourceRef.current = "click";
          regionChangeSourceRef.current = "click";
      
          if (clickTime < currentStart) {
            console.log("[handleWaveformClick] 📍 Click BEFORE region start");
      
            // ✅ FIXED: Không lưu history ngay, để handleRegionChange tự động save previous region
            console.log("[handleWaveformClick] 🔄 Expanding region start - will auto-save previous region");
      
            // Update region
            if (regionRef.current.setOptions) {
              regionRef.current.setOptions({ start: clickTime });
            } else if (regionRef.current.update) {
              regionRef.current.update({ start: clickTime });
            } else {
              regionRef.current.start = clickTime;
              if (wavesurferRef.current.fireEvent) {
                wavesurferRef.current.fireEvent("region-updated", regionRef.current);
              }
            }
      
            // ✅ FIXED: Chỉ gọi một lần với shouldSave = true để save previous region
            console.log("[handleWaveformClick] 🔄 Updating to new region with history save");
            console.log(`[handleWaveformClick] New region: ${clickTime.toFixed(4)} - ${currentEnd.toFixed(4)}`);
            onRegionChange(clickTime, currentEnd, true, 'click_expand_start');
      
            if (wasPlaying) {
              wavesurferRef.current.pause();
              setTimeout(() => {
                if (wavesurferRef.current) {
                  wavesurferRef.current.play(clickTime, currentEnd);
                  syncPositions(clickTime, "handleWaveformClickNewStart");
                }
              }, 50);
            } else {
              const totalDuration = wavesurferRef.current.getDuration();
              wavesurferRef.current.seekTo(clickTime / totalDuration);
              syncPositions(clickTime, "handleWaveformClickSeekStart");
              updateVolume(clickTime, true, true);
            }
      
            // ✅ THÊM: Update display values after expanding start
            setTimeout(() => {
              console.log("[handleWaveformClick] 🔄 Updating display values after start expansion");
              updateDisplayValues("click_expand_start");
            }, 100);
            
          } else if (clickTime > currentEnd + 0.1) {
            console.log("[handleWaveformClick] 📍 Click AFTER region end");
      
            // ✅ FIXED: Không lưu history ngay, để handleRegionChange tự động save previous region
            console.log("[handleWaveformClick] 🔄 Expanding region end - will auto-save previous region");
      
            // Sau đó mới set flags cho UI update
            isClickUpdatingEndRef.current = true;
            lastClickEndTimeRef.current = clickTime;
      
            if (endUpdateTimeoutRef.current) {
              clearTimeout(endUpdateTimeoutRef.current);
              endUpdateTimeoutRef.current = null;
            }
      
            const previewPosition = calculatePreviewPosition(clickTime, currentTime);
            console.log(`[handleWaveformClick] 🎯 Preview position: ${previewPosition.toFixed(4)}s`);
      
            // Update region
            if (regionRef.current.setOptions) {
              regionRef.current.setOptions({ end: clickTime });
            } else if (regionRef.current.update) {
              regionRef.current.update({ end: clickTime });
            } else {
              regionRef.current.end = clickTime;
              if (wavesurferRef.current.fireEvent) {
                wavesurferRef.current.fireEvent("region-updated", regionRef.current);
              }
            }
      
            // ✅ FIXED: Chỉ gọi một lần với shouldSave = true để save previous region
            console.log("[handleWaveformClick] 🔄 Updating to new region with history save");
            console.log(`[handleWaveformClick] New region: ${currentStart.toFixed(4)} - ${clickTime.toFixed(4)}`);
            onRegionChange(currentStart, clickTime, true, 'click_expand_end');
      
            // Force seek and sync
            const seekRatio = previewPosition / wavesurferRef.current.getDuration();
            wavesurferRef.current.seekTo(seekRatio);
      
            syncPositionRef.current = previewPosition;
            currentPositionRef.current = previewPosition;
            lastPositionRef.current = previewPosition;
      
            updateVolume(previewPosition, true, true);
            drawVolumeOverlay(true);
      
            // Handle playback
            if (wasPlaying) {
              console.log(`[handleWaveformClick] ▶️ Continuing playback to new end: ${clickTime.toFixed(4)}s`);
              requestAnimationFrame(() => {
                if (wavesurferRef.current && isPlaying) {
                  wavesurferRef.current.play(previewPosition, clickTime);
                }
              });
            }
      
            // ✅ THÊM: Update display values after expanding end
            setTimeout(() => {
              console.log("[handleWaveformClick] 🔄 Updating display values after end expansion");
              updateDisplayValues("click_expand_end");
            }, 100);
      
            // Clear flags with delay
            setTimeout(() => {
              console.log("[handleWaveformClick] 🧹 Clearing click flags after end expansion");
              isClickUpdatingEndRef.current = false;
              lastClickEndTimeRef.current = null;
              clickSourceRef.current = null;
              regionChangeSourceRef.current = null;
              console.log("[handleWaveformClick] ✅ Click end expansion completed");
            }, 150);
            
          } else {
            console.log("[handleWaveformClick] 📍 Click WITHIN region - seeking only");
            
            const totalDuration = wavesurferRef.current.getDuration();
            wavesurferRef.current.seekTo(clickTime / totalDuration);
            syncPositions(clickTime, "handleWaveformClickWithin");
            updateVolume(clickTime, true, true);
      
            // UI only update for within-region clicks (NO history save)
            onRegionChange(currentStart, currentEnd, false, 'click_within_ui');
      
            setTimeout(() => {
              drawVolumeOverlay(true);
            }, 50);
      
            // ✅ THÊM: Update display values after within-region click
            setTimeout(() => {
              console.log("[handleWaveformClick] 🔄 Updating display values after within-region click");
              updateDisplayValues("click_within_region");
            }, 50);
      
            if (wasPlaying) {
              setTimeout(() => {
                if (wavesurferRef.current && isPlaying) {
                  wavesurferRef.current.play(clickTime, regionRef.current.end);
                }
              }, 50);
            }
          }
      
          // Final cleanup with longer delay
          setTimeout(() => {
            if (clickSourceRef.current === "click") {
              clickSourceRef.current = null;
            }
            if (regionChangeSourceRef.current === "click" && !isClickUpdatingEndRef.current) {
              regionChangeSourceRef.current = null;
            }
            console.log("[handleWaveformClick] 🧹 Final cleanup completed");
          }, 300);
          
        } catch (error) {
          console.error("[handleWaveformClick] Error processing click:", error);
          // Clear all flags on error
          clickSourceRef.current = null;
          regionChangeSourceRef.current = null;
          isClickUpdatingEndRef.current = false;
          lastClickEndTimeRef.current = null;
        }
      };

      waveformRef.current.addEventListener("click", handleWaveformClick);

      applyInfiniteLoopFixes(ws);

      wavesurferRef.current = ws;

      monitorWavesurferLoop(ws);
      resetLoopCounter();

      ws.on("ready", () => {
        const dur = ws.getDuration();
        setDuration(dur);
        setLoading(false);

        const plugin = ws.registerPlugin(
          RegionsPlugin.create({
            dragSelection: true,
            color: isDeleteMode
              ? "rgba(239, 68, 68, 0.2)"
              : "rgba(59, 130, 246, 0.2)",
            handleStyle: {
              borderColor: isDeleteMode
                ? "rgba(239, 68, 68, 0.8)"
                : colors[theme].regionBorderColor,
              backgroundColor: isDeleteMode
                ? "rgba(239, 68, 68, 0.3)"
                : colors[theme].regionBorderColor,
            },
          })
        );

        regionsPluginRef.current = plugin;

        // Create region with initial styles
        regionRef.current = plugin.addRegion({
          start: 0,
          end: dur,
          color: isDeleteMode
            ? "rgba(239, 68, 68, 0.2)"
            : "rgba(59, 130, 246, 0.2)",
          handleStyle: {
            borderColor: isDeleteMode
              ? "rgba(239, 68, 68, 0.8)"
              : colors[theme].regionBorderColor,
            backgroundColor: isDeleteMode
              ? "rgba(239, 68, 68, 0.3)"
              : colors[theme].regionBorderColor,
          },
        });

        // ✅ THÊM: Update display values ngay sau khi tạo region
console.log('[WS Ready] Region created, updating display values...');
setTimeout(() => {
  if (regionRef.current) {
    updateDisplayValues("ws_ready_initial");
    
    // ✅ THÊM: Trigger onRegionChange để đảm bảo parent component được thông báo
    onRegionChange(0, dur, false, 'initial_setup');
  }
}, 100);

// ✅ THÊM: Backup update sau khi tất cả đã ready
setTimeout(() => {
  if (regionRef.current) {
    console.log('[WS Ready] Backup display update...');
    updateDisplayValues("ws_ready_backup");
  }
}, 500);

        // Add handlers for all region interactions
        if (regionRef.current && regionRef.current.on) {
          // Handle region updates (dragging, resizing) - với throttling
          regionRef.current.on("update", () => getThrottledUpdateRegionStyles()());
        
          // Handle region-updated event (after drag/resize completes)
          regionRef.current.on("update-end", updateRegionStyles);
        
          // Handle region-updated event (for any other updates)
          regionRef.current.on("region-updated", updateRegionStyles);
        
          // Optimized mouse interaction handlers
          if (regionRef.current.element) {
            const element = regionRef.current.element;
            
            // Debounced mouse interaction handler
            const getDebouncedStyleUpdate = () => {
              if (!throttledFunctionsRef.current.debouncedStyleUpdate) {
                throttledFunctionsRef.current.debouncedStyleUpdate = debounce(updateRegionStyles, 50);
              }
              return throttledFunctionsRef.current.debouncedStyleUpdate;
            };
            
            const handleMouseInteraction = () => {
              getDebouncedStyleUpdate()();
            };
        
            // Optimized realtime drag handler với early return
            const handleMouseMove = (e) => {
              // ✅ THÊM SAFETY CHECK CHO EVENT
              if (!e || typeof e.buttons === 'undefined') {
                console.warn('[handleMouseMove] Invalid event object:', e);
                return;
              }
              
              // Early return if not dragging
              if (e.buttons !== 1 || !regionRef.current?.element) return;
              
              const regionElement = regionRef.current.element;
              console.log(`[mousemove] 🎯 Realtime drag - applying ${isDeleteMode ? 'RED' : 'BLUE'} color`);
              
              // Use cached color values
              const bgColor = isDeleteMode ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)';
              const borderStyle = isDeleteMode ? '2px solid rgba(239, 68, 68, 0.8)' : '1px solid rgba(59, 130, 246, 0.5)';
              
              // Only update if color actually changed
              if (regionElement.style.backgroundColor !== bgColor) {
                regionElement.style.backgroundColor = bgColor;
                regionElement.style.border = borderStyle;
                
                // Efficiently update child elements
                const regionElements = regionElement.getElementsByClassName('wavesurfer-region');
                for (let i = 0; i < regionElements.length; i++) {
                  const el = regionElements[i];
                  el.style.backgroundColor = bgColor;
                  el.style.border = borderStyle;
                }
              }
            };
        
            // Throttled mouse move handler
            const getThrottledMouseMove = () => {
              return getThrottledFunction('handleMouseMove', handleMouseMove, 16);
            };
        
            // Add event listeners
            element.addEventListener('mouseup', handleMouseInteraction);
            element.addEventListener('mouseleave', handleMouseInteraction);
            element.addEventListener('mousemove', (event) => {
              const throttledFunc = getThrottledMouseMove();
              throttledFunc(event); // ✅ Pass event argument properly
            });
            element.addEventListener('mousedown', () => {
              console.log(`[mousedown] Drag started - current mode: ${isDeleteMode ? 'DELETE' : 'NORMAL'}`);
              requestAnimationFrame(updateRegionStyles); // Use RAF for smooth update
            });
          }
        }



        lastRegionStartRef.current = regionRef.current.start;
        lastRegionEndRef.current = regionRef.current.end;

        // === SYNC FIX: Initialize synchronized position ===
        syncPositions(0, "wavesurferReady");

        if (regionRef.current.on) {
          // Thay thế đoạn region 'out' event handler
          regionRef.current.on("out", () => {
            console.log("[Region OUT] Playback left region");

            if (!isPlaying) {
              console.log("[Region OUT] Not playing, ignoring out event");
              return;
            }

            if (loop) {
              console.log("[Region OUT] Loop mode enabled - handling loop");
              handleLoopPlayback();
            } else {
              console.log("[Region OUT] Normal mode - handling end");
              handlePlaybackEnd();
            }
          });
        }

        console.log("Region created:", regionRef.current);
        console.log(
          "Region methods:",
          Object.getOwnPropertyNames(Object.getPrototypeOf(regionRef.current))
        );
        console.log("Regions plugin:", regionsPluginRef.current);
        if (regionsPluginRef.current) {
          console.log(
            "RegionsPlugin methods:",
            Object.getOwnPropertyNames(
              Object.getPrototypeOf(regionsPluginRef.current)
            )
          );
        }

// ✅ FIXED: Trong region "update" event handler - thêm cập nhật display (dòng ~1400)
regionRef.current.on("update", () => {
  // ✅ CAPTURE: Save region state BEFORE any changes (first time only)
  if (!dragStartRegionRef.current && regionRef.current) {
    dragStartRegionRef.current = {
      start: regionRef.current.start,
      end: regionRef.current.end,
      timestamp: Date.now()
    };
    console.log(`[UPDATE-START] 📍 Captured initial region: ${dragStartRegionRef.current.start.toFixed(4)}s - ${dragStartRegionRef.current.end.toFixed(4)}s`);
  }
  
  // CRITICAL: Force region style update ngay lập tức
  if (regionRef.current && regionRef.current.element) {
    const regionElement = regionRef.current.element;
    
    requestAnimationFrame(() => {
      if (!regionRef.current?.element) return;
      
      const bgColor = isDeleteMode ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)';
      const borderStyle = isDeleteMode ? '2px solid rgba(239, 68, 68, 0.8)' : '1px solid rgba(59, 130, 246, 0.5)';
      
      regionElement.style.backgroundColor = bgColor;
      regionElement.style.border = borderStyle;
      
      const regionElements = regionElement.getElementsByClassName('wavesurfer-region');
      for (let i = 0; i < regionElements.length; i++) {
        const el = regionElements[i];
        el.style.backgroundColor = bgColor;
        el.style.border = borderStyle;
      }
    });
  }
  
  // CRITICAL: Set dragging state
  isDraggingRegionRef.current = true;

  // Clear dragging state after delay
  clearTimeout(window.dragTimeout);
  window.dragTimeout = setTimeout(() => {
    isDraggingRegionRef.current = false;
  }, 100);

  if (
    regionChangeSourceRef.current === "click" &&
    isClickUpdatingEndRef.current
  ) {
    return;
  }

  const currentProfile = currentProfileRef.current;
  const newStart = regionRef.current.start;
  const newEnd = regionRef.current.end;
  const wasPlaying = isPlaying;

  // ✅ THÊM: Update display values realtime during drag
  console.log(`[Region Update] Updating display values during drag: ${newStart.toFixed(4)}s - ${newEnd.toFixed(4)}s`);
  updateDisplayValues("region_update_drag");

  regionChangeSourceRef.current = "drag";

  const isDraggingStart = newStart !== lastRegionStartRef.current;
  const isDraggingEnd = newEnd !== lastRegionEndRef.current;

  lastRegionStartRef.current = newStart;
  lastRegionEndRef.current = newEnd;

  onRegionChange(newStart, newEnd, false, 'drag_realtime');
  
  // Rest of the existing logic continues...
  if (wavesurferRef.current) {
    if (isDraggingStart) {
      if (wasPlaying) {
        wavesurferRef.current.pause();
        setIsPlaying(false);
        onPlayStateChange(false);
      }

      wavesurferRef.current.seekTo(
        newStart / wavesurferRef.current.getDuration()
      );
      syncPositions(newStart, "regionUpdateStart");

      if (wasPlaying) {
        setTimeout(() => {
          if (wavesurferRef.current) {
            wavesurferRef.current.play(newStart, newEnd);
            setIsPlaying(true);
            onPlayStateChange(true);
          }
        }, 50);
      }

      updateVolume(newStart, true, true);
    } else if (isDraggingEnd) {
      if (wasPlaying) {
        const currentTimeNow = performance.now();
        const shouldPerformRealtimeSeek =
          !lastRealtimeSeekTimeRef.current ||
          currentTimeNow - lastRealtimeSeekTimeRef.current > 100;

        if (shouldPerformRealtimeSeek) {
          const previewPosition = Math.max(
            newStart,
            newEnd - PREVIEW_TIME_BEFORE_END
          );

          isRealtimeDragSeekingRef.current = true;
          lastRealtimeSeekTimeRef.current = currentTimeNow;

          wavesurferRef.current.seekTo(
            previewPosition / wavesurferRef.current.getDuration()
          );
          syncPositions(previewPosition, "realtimeDragSeek");

          clearTimeout(realtimeSeekThrottleRef.current);
          realtimeSeekThrottleRef.current = setTimeout(() => {
            isRealtimeDragSeekingRef.current = false;
          }, 200);
        }
      } else {
        const previewPosition = Math.max(
          newStart,
          newEnd - PREVIEW_TIME_BEFORE_END
        );
        wavesurferRef.current.seekTo(
          previewPosition / wavesurferRef.current.getDuration()
        );
        syncPositions(previewPosition, "dragEndSeek");
        updateVolume(previewPosition, true, true);
        drawVolumeOverlay(true);
      }
    }
  }

  currentProfileRef.current = currentProfile;

  // Force region style update during drag
  if (regionRef.current && regionRef.current.element) {
    const regionElement = regionRef.current.element;
    
    if (isDeleteMode) {
      regionElement.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
      regionElement.style.border = '2px solid rgba(239, 68, 68, 0.8)';
      
      const regionElements = regionElement.getElementsByClassName('wavesurfer-region');
      Array.from(regionElements).forEach(el => {
        el.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
        el.style.border = '2px solid rgba(239, 68, 68, 0.8)';
      });
    } else {
      regionElement.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
      regionElement.style.border = '1px solid rgba(59, 130, 246, 0.5)';
      
      const regionElements = regionElement.getElementsByClassName('wavesurfer-region');
      Array.from(regionElements).forEach(el => {
        el.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
        el.style.border = '1px solid rgba(59, 130, 246, 0.5)';
      });
    }
  }

  throttledDrawRef.current();
});

// ✅ FIXED: Trong region "update-end" event handler - thêm cập nhật display (dòng ~1550)
regionRef.current.on("update-end", () => {
  console.log("[UPDATE-END] 🏁 Event triggered");
  
  if (wavesurferRef.current && regionRef.current) {
    const currentTime = wavesurferRef.current.getCurrentTime();
    const start = regionRef.current.start;
    const end = regionRef.current.end;
    
    // ✅ THÊM: Update display values sau khi drag kết thúc
    console.log("[UPDATE-END] Updating display values after drag completion");
    updateDisplayValues("update_end_completion");
    
    // ✅ IMPROVED: Better drag vs click detection logic
    const isClickOperation = regionChangeSourceRef.current === "click" && isClickUpdatingEndRef.current;
    const isDragOperation = regionChangeSourceRef.current === "drag" || !isClickOperation;
    
    console.log(`[UPDATE-END] 🔍 Operation detection:`, {
      regionChangeSource: regionChangeSourceRef.current,
      isClickUpdatingEnd: isClickUpdatingEndRef.current,
      isClickOperation,
      isDragOperation
    });
    
    // ✅ ALWAYS save history for drag operations, even if uncertain
    if (isDragOperation) {
      // ✅ FIXED: Save PREVIOUS region (before drag started) to history
      if (dragStartRegionRef.current) {
        const prevRegion = dragStartRegionRef.current;
        console.log(`[UPDATE-END] 💾 Drag operation detected - saving PREVIOUS region to history: ${prevRegion.start.toFixed(4)}s - ${prevRegion.end.toFixed(4)}s`);
        onRegionChange(prevRegion.start, prevRegion.end, true, 'drag_complete_save_previous');
        
        // Clear the captured region after using it
        dragStartRegionRef.current = null;
      } else {
        console.log(`[UPDATE-END] ⚠️ No previous region captured - fallback to current region`);
        onRegionChange(start, end, true, 'drag_complete_fallback');
      }
    } else {
      console.log(`[UPDATE-END] ⏭️ Click operation detected - history already saved in click handler`);
      // Clear drag start region for click operations too
      dragStartRegionRef.current = null;
    }
    
    const previewPosition = Math.max(start, end - PREVIEW_TIME_BEFORE_END);

    if (currentTime < start || currentTime >= end) {
      wavesurferRef.current.pause();

      setTimeout(() => {
        wavesurferRef.current.seekTo(previewPosition / wavesurferRef.current.getDuration());
        syncPositions(previewPosition, "updateEndSeek");
        updateVolume(previewPosition, true, true);
        if (isPlaying) {
          setTimeout(() => {
            wavesurferRef.current.play(previewPosition, end);
            setIsPlaying(true);
          }, 30);
        }
      }, 30);
    }
  }

  console.log(`\n🏁 [UPDATE-END EVENT] Processing completed`);
  console.log(`📊 Flags before cleanup:`);
  console.log(`  - regionChangeSourceRef: ${regionChangeSourceRef.current}`);
  console.log(`  - isDragUpdatingEndRef: ${isDragUpdatingEndRef.current}`);
  console.log(`  - isClickUpdatingEndRef: ${isClickUpdatingEndRef.current}`);

  // ✅ CRITICAL: Clear ALL flags immediately after update-end
  console.log("[UPDATE-END] 🧹 Clearing all flags to prepare for next operation");
  
  // Clear region change source immediately
  regionChangeSourceRef.current = null;
  
  // Clear click updating flags immediately  
  isClickUpdatingEndRef.current = false;
  lastClickEndTimeRef.current = null;
  
  // Clear click source ref
  clickSourceRef.current = null;
  
  // ✅ NEW: Clear drag start region capture
  if (!dragStartRegionRef.current) {
    // Only clear if not already cleared in drag operation above
    dragStartRegionRef.current = null;
  }
  
  // Handle drag flags with proper timing
  if (isDragUpdatingEndRef.current) {
    console.log(`[UPDATE-END] 🤔 Clearing drag flags...`);
    isDragUpdatingEndRef.current = false;
    lastDragEndTimeRef.current = null;
  }

  console.log(`📊 Flags after cleanup:`);
  console.log(`  - regionChangeSourceRef: ${regionChangeSourceRef.current}`);
  console.log(`  - isDragUpdatingEndRef: ${isDragUpdatingEndRef.current}`);
  console.log(`  - isClickUpdatingEndRef: ${isClickUpdatingEndRef.current}`);
  console.log(`  - clickSourceRef: ${clickSourceRef.current}`);

  // Rest of existing logic continues...
  if (regionChangeSourceRef.current === "click" && isClickUpdatingEndRef.current) {
    console.log(`[update-end] 🖱️ This check should never trigger now - flags cleared above`);
    return;
  }

  const newStart = regionRef.current.start;
  const newEnd = regionRef.current.end;
  const wasPlaying = isPlaying;

  console.log(`[update-end] 📍 Final region bounds: ${newStart.toFixed(4)}s - ${newEnd.toFixed(4)}s`);

  if (wavesurferRef.current) {
    const currentTime = wavesurferRef.current.getCurrentTime();

    if (wasPlaying && currentTime >= newStart && currentTime < newEnd) {
      console.log(`[update-end] ✅ Position valid - continuing playback to new end: ${newEnd.toFixed(4)}s`);
      wavesurferRef.current.play(currentTime, newEnd);
    } else if (wasPlaying) {
      console.log(`[update-end] ⚠️ Position outside valid range`);
    }
  }

  // Style updates
  if (regionRef.current && regionRef.current.element) {
    updateRegionStyles();
    
    setTimeout(() => {
      if (regionRef.current && regionRef.current.element) {
        updateRegionStyles();
        console.log(`[update-end] 🎨 Style refresh completed`);
      }
    }, 100);
  }

  // Clear any remaining timeouts
  if (endUpdateTimeoutRef.current) {
    clearTimeout(endUpdateTimeoutRef.current);
    endUpdateTimeoutRef.current = null;
  }

  console.log("[UPDATE-END] ✅ Event processing completed - ready for next operation");
});
        regionRef.current.on("region-updated", () => {
          if (regionChangeSourceRef.current === "click") {
            return;
          }

          if (isPlaying && wavesurferRef.current) {
            const currentTime = wavesurferRef.current.getCurrentTime();
            const start = regionRef.current.start;
            const end = regionRef.current.end;

            if (currentTime >= start && currentTime < end) {
              wavesurferRef.current.play(currentTime, end);
            }
          }
        });

        drawVolumeOverlay();
      });

      // === SYNC FIX: Enhanced audioprocess event with synchronized position updates ===
      // === ENHANCED EVENT HANDLERS ===
      // Thay thế đoạn 'finish' event handler
      ws.on("finish", () => {
        console.log("[WS finish] WaveSurfer finish event");

        if (loop && regionRef.current) {
          console.log("[WS finish] Loop mode - handling loop playback");
          handleLoopPlayback();
        } else {
          console.log("[WS finish] Normal finish - handling end");
          handlePlaybackEnd();
        }
      });

      ws.on("audioprocess", () => {
        const currentTime = ws.getCurrentTime();

        // Update synchronized position
        syncPositions(currentTime, "audioprocess");
        onTimeUpdate(currentTime);

        // Only redraw overlay if playing and not dragging
        if (isPlaying && !isDraggingRef.current) {
          drawVolumeOverlay(true);
        }
      });

      ws.on("seeking", () => {
        const currentTime = ws.getCurrentTime();
        
        // Update synchronized position
        syncPositions(currentTime, "seeking");
        onTimeUpdate(currentTime);
        updateVolume(currentTime, false, true);
        drawVolumeOverlay(true);
      });
      ws.on("seek", () => {
        const currentTime = ws.getCurrentTime();
        console.log(
          `[WS seek] 🎯 Seek completed to ${currentTime.toFixed(4)}s`
        );

        // Force immediate overlay redraw
        setTimeout(() => {
          drawVolumeOverlay(true);
          console.log(
            `[WS seek] Overlay synchronized to: ${currentTime.toFixed(4)}s`
          );
        }, 10);
      });
      ws.loadBlob(audioFile);

      return () => {
        // === CLEANUP TIMERS VÀ ANIMATIONS (giữ nguyên) ===
        if (drawTimerRef.current) {
          clearTimeout(drawTimerRef.current);
        }
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        if (endUpdateTimeoutRef.current) {
          clearTimeout(endUpdateTimeoutRef.current);
        }
        if (regionUpdateTimeoutRef.current) {
          clearTimeout(regionUpdateTimeoutRef.current);
        }
      
        // === MỚI: CLEANUP THROTTLED FUNCTIONS ===
        console.log('[CLEANUP] Clearing throttled functions cache');
        
        // Cancel any pending throttled/debounced calls
        Object.values(throttledFunctionsRef.current).forEach(func => {
          if (func && typeof func.cancel === 'function') {
            console.log('[CLEANUP] Cancelling throttled function');
            func.cancel(); // For lodash throttle/debounce
          }
          if (func && typeof func.flush === 'function') {
            console.log('[CLEANUP] Flushing throttled function');
            func.flush(); // Execute any pending calls immediately
          }
        });
        
        // Clear the cache completely
        throttledFunctionsRef.current = {};
        console.log('[CLEANUP] Throttled functions cache cleared');
      
        // === CLEANUP FLAGS VÀ STATES (giữ nguyên) ===
        isEndingPlaybackRef.current = false;
        
        // === CLEANUP EVENT LISTENERS (giữ nguyên) ===
        if (currentWaveformElement) {
          currentWaveformElement.removeEventListener(
            "click",
            handleWaveformClick
          );
        }
        
        // === DESTROY WAVESURFER (giữ nguyên) ===
        if (ws) {
          console.log('[CLEANUP] Destroying WaveSurfer instance');
          ws.destroy();
        }
        
        console.log('[CLEANUP] Component cleanup completed');
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [audioFile, theme, onTimeUpdate]); // Many functions are stable and don't need dependencies

    useEffect(() => {
      console.log(
        `[fadeEffect] TRIGGERED - fadeIn: ${fadeIn}, fadeOut: ${fadeOut}, isPlaying: ${isPlaying}`
      );

      fadeInRef.current = fadeIn;
      fadeOutRef.current = fadeOut;
      fadeEnabledRef.current = fadeIn || fadeOut;

      if (wavesurferRef.current && regionRef.current) {
        // ENHANCED: Better position determination for fade effect changes
        const wsPosition = wavesurferRef.current.getCurrentTime();
        const syncedPosition = syncPositionRef.current;
        const regionStart = regionRef.current.start;
        const regionEnd = regionRef.current.end;

        let targetPosition;

        console.log(`[fadeEffect] Position analysis:`);
        console.log(`  - WS position: ${wsPosition.toFixed(4)}s`);
        console.log(`  - Synced position: ${syncedPosition.toFixed(4)}s`);
        console.log(
          `  - Region: ${regionStart.toFixed(4)}s - ${regionEnd.toFixed(4)}s`
        );

        if (isPlaying) {
          // When playing, always use wavesurfer position
          targetPosition = wsPosition;
          console.log(
            `[fadeEffect] Playing - using WS position: ${targetPosition.toFixed(
              4
            )}s`
          );
        } else {
          // When not playing, determine best position
          const wsInRegion =
            wsPosition >= regionStart && wsPosition <= regionEnd;
          const syncedInRegion =
            syncedPosition >= regionStart && syncedPosition <= regionEnd;
          const syncTimeDiff = performance.now() - lastSyncTimeRef.current;

          if (syncTimeDiff < 1000 && syncedInRegion) {
            // Recent sync position within region
            targetPosition = syncedPosition;
            console.log(
              `[fadeEffect] Using recent synced position: ${targetPosition.toFixed(
                4
              )}s`
            );
          } else if (wsInRegion) {
            // WS position is valid
            targetPosition = wsPosition;
            console.log(
              `[fadeEffect] Using WS position in region: ${targetPosition.toFixed(
                4
              )}s`
            );
          } else {
            // Fallback to region start
            targetPosition = regionStart;
            console.log(
              `[fadeEffect] Fallback to region start: ${targetPosition.toFixed(
                4
              )}s`
            );
          }
        }

        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }

        // Force immediate position sync
        syncPositions(targetPosition, "fadeEffect");
        updateVolume(targetPosition, true, true);

        if (isPlaying) {
          animationFrameRef.current =
            requestAnimationFrame(updateRealtimeVolume);
        }

        // Force immediate overlay redraw
        drawVolumeOverlay(true);

        console.log(
          `[fadeEffect] ✅ COMPLETED - position: ${targetPosition.toFixed(
            4
          )}s, fadeEnabled: ${fadeEnabledRef.current}`
        );
      } else {
        console.log(
          `[fadeEffect] ❌ Missing refs - wavesurfer: ${!!wavesurferRef.current}, region: ${!!regionRef.current}`
        );
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fadeIn, fadeOut, isPlaying]); // Functions are stable



// CRITICAL: Effect để handle fadeIn profile đặc biệt
useEffect(() => {
  console.log(`[fadeInProfileEffect] TRIGGERED - volumeProfile: ${volumeProfile}`);
  
  if (volumeProfile !== "fadeIn") return;
  
  if (!wavesurferRef.current || !regionRef.current) {
    console.log(`[fadeInProfileEffect] Missing refs for fadeIn profile`);
    return;
  }
  
  console.log(`[fadeInProfileEffect] FADEIN PROFILE ACTIVATED - Setting up special handling`);
  
  // Force immediate position and volume sync for fadeIn
  const wsPosition = wavesurferRef.current.getCurrentTime();
  const regionStart = regionRef.current.start;
  const regionEnd = regionRef.current.end;
  
  let targetPosition = wsPosition;
  
  // Ensure position is within region
  if (wsPosition < regionStart || wsPosition > regionEnd) {
    targetPosition = regionStart;
    console.log(`[fadeInProfileEffect] FADEIN: Correcting position to region start: ${targetPosition.toFixed(4)}s`);
    
    const totalDuration = wavesurferRef.current.getDuration();
    wavesurferRef.current.seekTo(targetPosition / totalDuration);
  }
  
  // Force multiple volume updates to ensure fadeIn works
  const forceVolumeUpdate = (attempt) => {
    if (wavesurferRef.current && regionRef.current && volumeProfile === "fadeIn") {
      const currentPos = wavesurferRef.current.getCurrentTime();
      console.log(`[fadeInProfileEffect] FADEIN: Force update attempt ${attempt} at ${currentPos.toFixed(4)}s`);
      
      syncPositions(currentPos, `fadeInProfileEffect_${attempt}`);
      updateVolume(currentPos, true, true);
      drawVolumeOverlay(true);
      
      // Verify volume was set correctly
      const relPos = Math.max(0, (currentPos - regionRef.current.start) / (regionRef.current.end - regionRef.current.start));
      const expectedMinVolume = 0.02 + ((volume - 0.02) * relPos);
      
      console.log(`[fadeInProfileEffect] FADEIN: Expected min volume: ${expectedMinVolume.toFixed(4)}, actual: ${currentVolumeRef.current.toFixed(4)}`);
    }
  };
  
  // Multiple attempts to ensure fadeIn volume is set correctly
  forceVolumeUpdate(1);
  setTimeout(() => forceVolumeUpdate(2), 50);
  setTimeout(() => forceVolumeUpdate(3), 100);
  setTimeout(() => forceVolumeUpdate(4), 200);
  
  console.log(`[fadeInProfileEffect] ✅ FadeIn profile special handling completed`);
  
}, [volumeProfile]); // Only depend on volumeProfile changes


    useEffect(() => {
      if (regionRef.current) {
        const handleRegionUpdated = () => {
          isDraggingRef.current = true;
          isRegionUpdatingRef.current = true;

          if (regionUpdateTimeoutRef.current) {
            clearTimeout(regionUpdateTimeoutRef.current);
          }

          drawVolumeOverlay(true);

          regionUpdateTimeoutRef.current = setTimeout(() => {
            isDraggingRef.current = false;
            isRegionUpdatingRef.current = false;

            if (isPlaying && wavesurferRef.current) {
              const currentTime = wavesurferRef.current.getCurrentTime();
              const start = regionRef.current.start;
              const end = regionRef.current.end;

              if (currentTime < start || currentTime >= end) {
                console.log(
                  "[handleRegionUpdated] Position outside region while playing, handling end"
                );
                handlePlaybackEnd();
              }
            } else {
              console.log(
                "[handleRegionUpdated] Not playing, skipping position check"
              );
            }

            drawVolumeOverlay(true);
          }, 150);

          if (
            justUpdatedEndByClickRef.current &&
            isPlaying &&
            lastClickEndTimeRef.current
          ) {
            const currentTime = wavesurferRef.current.getCurrentTime();
            if (currentTime < lastClickEndTimeRef.current) {
              wavesurferRef.current.play(
                currentTime,
                lastClickEndTimeRef.current
              );
            }
          }
        };

        regionRef.current.on("region-updated", handleRegionUpdated);
        return () => {
          if (regionRef.current) {
            regionRef.current.un("region-updated", handleRegionUpdated);
          }
          if (regionUpdateTimeoutRef.current) {
            clearTimeout(regionUpdateTimeoutRef.current);
          }
        };
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPlaying]); // Functions are stable

    const formatTime = (seconds) => {
      const min = Math.floor(seconds / 60);
      const sec = Math.floor(seconds % 60);
      return `${min}:${sec.toString().padStart(2, "0")}`;
    };

 // ✅ FIXED: useEffect để cập nhật display times - dòng ~1740-1752
useEffect(() => {
  console.log('[DisplayUpdate] useEffect triggered, regionRef.current:', !!regionRef.current);
  
  if (regionRef.current && regionRef.current.start !== undefined && regionRef.current.end !== undefined) {
    const newStart = regionRef.current.start;
    const newEnd = regionRef.current.end;
    
    console.log('[DisplayUpdate] Updating display times:', {
      newStart: newStart.toFixed(4),
      newEnd: newEnd.toFixed(4)
    });

    // Update display states
    setDisplayRegionStart(formatDisplayTime(newStart));
    setDisplayRegionEnd(formatDisplayTime(newEnd));
    // Update numeric values for tooltips
    setRegionStartTime(newStart);
    setRegionEndTime(newEnd);
    
    console.log('[DisplayUpdate] Display times updated successfully');
  } else {
    console.log('[DisplayUpdate] Region not ready or missing start/end values');
  }
}, [regionRef.current, duration]); // ✅ FIXED: Better dependencies
    

// ✅ THÊM: useEffect để cập nhật khi duration thay đổi (thêm sau useEffect hiện tại ~1752)
useEffect(() => {
  console.log('[Duration Change] Duration updated:', duration);
  
  if (duration > 0 && regionRef.current) {
    console.log('[Duration Change] Updating display values after duration change');
    
    // Ensure region end is not greater than duration
    if (regionRef.current.end > duration) {
      console.log('[Duration Change] Region end exceeds duration, adjusting...');
      if (regionRef.current.setOptions) {
        regionRef.current.setOptions({ end: duration });
      } else if (regionRef.current.update) {
        regionRef.current.update({ end: duration });
      } else {
        regionRef.current.end = duration;
      }
    }
    
    // Force update display values
    setTimeout(() => {
      updateDisplayValues("duration_change");
    }, 100);
  }
}, [duration, updateDisplayValues]);

    useEffect(() => {
      console.log(`[removeModeEffect] SIMPLIFIED - removeMode: ${isDeleteMode}`);
      
      // Since barColor now uses removeModeRef.current, we only need to update region styles
      updateRegionStyles();
    }, [isDeleteMode, updateRegionStyles]);// Update delete mode state when prop changes


    useEffect(() => {
      setIsDeleteMode(removeMode);
      removeModeRef.current = removeMode; // Keep ref in sync
    }, [removeMode]);



    // Handle delete mode toggle
    const handleDeleteModeToggle = (newMode) => {
      setIsDeleteMode(newMode);
      onDeleteModeChange?.(newMode);

      if (wavesurferRef.current && regionRef.current) {
        // Force redraw with new mode
        drawVolumeOverlay(true);

        // Update preview
        const preview = ref.current?.getDeletePreview();
        setDeletePreview(preview);

        // If turning off delete mode, reset to normal view
        if (!newMode) {
          const currentTime = wavesurferRef.current.getCurrentTime();
          syncPositions(currentTime, "deleteModeOff");
          updateVolume(currentTime, true, true);
        }
      }
    };

    // Handle delete confirmation
    const handleDeleteConfirm = () => {
      if (!wavesurferRef.current || !regionRef.current) return;

      const regionToDelete = ref.current?.deleteRegion();
      if (regionToDelete) {
        onDeleteConfirm?.(regionToDelete);

        // Reset to normal mode after delete
        handleDeleteModeToggle(false);

        // Reset region to full duration
        const totalDuration = wavesurferRef.current.getDuration();
        if (regionRef.current.setOptions) {
          regionRef.current.setOptions({ start: 0, end: totalDuration });
        } else if (regionRef.current.update) {
          regionRef.current.update({ start: 0, end: totalDuration });
        } else {
          regionRef.current.start = 0;
          regionRef.current.end = totalDuration;
        }

        // Update UI
        onRegionChange(0, totalDuration);
        syncPositions(0, "deleteConfirm");
        updateVolume(0, true, true);
        drawVolumeOverlay(true);
      }
    };

    // ✅ NEW: Time formatting functions for tooltips
// ✅ FIXED: formatDisplayTime function - dòng ~1780-1790
const formatDisplayTime = (seconds) => {
  console.log(`[formatDisplayTime] Input: ${seconds}`);
  
  if (typeof seconds !== 'number' || !isFinite(seconds) || isNaN(seconds) || seconds < 0) {
    console.warn(`[formatDisplayTime] Invalid input: ${seconds}, returning default`);
    return "00:00.0";
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  const wholeSeconds = Math.floor(remainingSeconds);
  const tenths = Math.floor((remainingSeconds - wholeSeconds) * 10);
  
  const result = `${minutes.toString().padStart(2, '0')}:${wholeSeconds.toString().padStart(2, '0')}.${tenths}`;
  console.log(`[formatDisplayTime] Output: ${result}`);
  
  return result;
};

    const formatDurationTime = (seconds) => {
      if (!isFinite(seconds) || seconds < 0) return "00:00";
      
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = Math.floor(seconds % 60);
      
      return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    };

    // ✅ THÊM: Initialize region values when duration is set
    useEffect(() => {
      if (duration > 0 && (regionStartTime === 0 && regionEndTime === 0)) {
        console.log('[Duration Init] Setting initial region values:', { duration });
        setRegionStartTime(0);
        setRegionEndTime(duration);
        setDisplayRegionStart(formatDisplayTime(0));
        setDisplayRegionEnd(formatDisplayTime(duration));
      }
    }, [duration, regionStartTime, regionEndTime]);

    // ✅ THÊM: Update regionEndTime when duration changes (for dynamic audio loading)
    useEffect(() => {
      if (duration > 0 && regionEndTime !== duration) {
        console.log('[Duration Change] Updating regionEndTime from', regionEndTime, 'to', duration);
        setRegionEndTime(duration);
        setDisplayRegionEnd(formatDisplayTime(duration));
      }
    }, [duration]);

    // ✅ THÊM: Monitor region values for debugging
    useEffect(() => {
      console.log('[Region Values Monitor]', {
        regionStartTime,
        regionEndTime,
        displayRegionStart,
        displayRegionEnd,
        duration,
        loading
      });
    }, [regionStartTime, regionEndTime, displayRegionStart, displayRegionEnd, duration, loading]);

    return (
      <div className="relative space-y-3 max-w-7xl mx-auto">
        {loading && (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center z-50 rounded-lg">
            <div className="flex items-center space-x-2 bg-white shadow-md rounded-full px-4 py-2">
              <svg
                className="animate-spin h-4 w-4 text-blue-600"
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
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <span className="text-slate-700 font-medium text-sm">Loading audio...</span>
            </div>
          </div>
        )}

        {/* Delete Mode Indicator - Compact */}
        {isDeleteMode && (
          <div className="bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-lg p-2">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <p className="text-red-700 font-medium text-xs">
                Delete Mode: Red regions will be deleted, blue regions kept
              </p>
            </div>
          </div>
        )}

        {/* 1. WAVEFORM CONTAINER - Compact Height */}
        <div className="bg-gradient-to-br from-slate-50 to-blue-50/30 rounded-xl border border-slate-200/60 shadow-lg overflow-hidden">
          <div className="bg-white/60 backdrop-blur-sm border-b border-slate-200/40 px-4 py-2">
            <h3 className="text-slate-700 font-semibold text-xs tracking-wide uppercase">
              Audio Waveform
            </h3>
          </div>
          
          <div 
            className="relative bg-gradient-to-b from-slate-900 to-slate-800 p-3"
            style={{ minHeight: '140px' }}
          >
            {/* Compact Time Display Tooltips */}
            {audioFile && (
              <div className="absolute inset-0 pointer-events-none z-20">
                {/* Region Start Time Tooltip */}
                {regionStartTime !== undefined && (
                  <div 
                    className="absolute top-2 bg-blue-600 text-white text-xs font-mono px-2 py-1 rounded shadow-lg"
                    style={{
                      left: `${(regionStartTime / (wavesurferRef.current?.getDuration() || 1)) * 100}%`,
                      transform: 'translateX(-50%)',
                      zIndex: 30
                    }}
                  >
                    <div className="text-center">
                      <div className="font-semibold text-xs">{displayRegionStart}</div>
                      <div className="text-xs opacity-75">Start</div>
                    </div>
                    <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-blue-600 rotate-45"></div>
                  </div>
                )}

                {/* Region End Time Tooltip */}
                {regionEndTime !== undefined && (
                  <div 
                    className="absolute top-2 bg-blue-600 text-white text-xs font-mono px-2 py-1 rounded shadow-lg"
                    style={{
                      left: `${(regionEndTime / (wavesurferRef.current?.getDuration() || 1)) * 100}%`,
                      transform: 'translateX(-50%)',
                      zIndex: 30
                    }}
                  >
                    <div className="text-center">
                      <div className="font-semibold text-xs">{displayRegionEnd}</div>
                      <div className="text-xs opacity-75">End</div>
                    </div>
                    <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-blue-600 rotate-45"></div>
                  </div>
                )}

                {/* Region Duration Display */}
                {regionStartTime !== undefined && regionEndTime !== undefined && (
                  <div 
                    className="absolute bottom-2 bg-emerald-600 text-white text-xs font-mono px-2 py-1 rounded shadow-lg"
                    style={{
                      left: `${((regionStartTime + regionEndTime) / 2) / (wavesurferRef.current?.getDuration() || 1) * 100}%`,
                      transform: 'translateX(-50%)',
                      zIndex: 30
                    }}
                  >
                    <div className="text-center">
                      <div className="font-semibold text-xs">{formatDurationTime(regionEndTime - regionStartTime)}</div>
                      <div className="text-xs opacity-75">Duration</div>
                    </div>
                    <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-emerald-600 rotate-45"></div>
                  </div>
                )}

                {/* Current Playback Time Tooltip */}
                {isPlaying && currentPosition !== undefined && (
                  <div 
                    className="absolute top-8 bg-orange-500 text-white text-xs font-mono px-2 py-1 rounded shadow-lg animate-pulse"
                    style={{
                      left: `${(currentPosition / (wavesurferRef.current?.getDuration() || 1)) * 100}%`,
                      transform: 'translateX(-50%)',
                      zIndex: 35
                    }}
                  >
                    <div className="text-center">
                      <div className="font-semibold text-xs">{formatDisplayTime(currentPosition)}</div>
                      <div className="text-xs opacity-75">Playing</div>
                    </div>
                    <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-orange-500 rotate-45"></div>
                  </div>
                )}
              </div>
            )}

            {/* Waveform element */}
            <div ref={waveformRef} className="w-full h-full rounded-lg overflow-hidden" />
          </div>
        </div>

        {/* 2. VOLUME OVERLAY - Compact */}
        <div className="bg-white rounded-xl border border-slate-200/60 shadow-md">
          <div className="bg-gradient-to-r from-slate-50 to-blue-50/30 border-b border-slate-200/40 px-4 py-1.5">
            <h3 className="text-slate-700 font-semibold text-xs tracking-wide uppercase">
              Volume Profile
            </h3>
          </div>
          
          <div className="p-3">
            <canvas
              ref={overlayRef}
              width={1000}
              height={60}
              className={`w-full border border-slate-200/60 rounded-lg bg-gradient-to-r from-slate-50 to-blue-50/20 shadow-inner ${
                isDeleteMode ? "waveform-delete-canvas" : ""
              }`}
              style={{ zIndex: 1, pointerEvents: "none" }}
            />
          </div>
        </div>

        {/* 3. CONTROLS PANEL - Ultra Compact */}
        <div className="bg-white rounded-xl border border-slate-200/60 shadow-md">
          <div className="bg-gradient-to-r from-slate-50 to-blue-50/30 border-b border-slate-200/40 px-4 py-1.5">
            <h3 className="text-slate-700 font-semibold text-xs tracking-wide uppercase">
              Playback Controls
            </h3>
          </div>
          
          <div className="p-3">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
              {/* Time Steppers - Compact Center */}
              <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 bg-gradient-to-r from-slate-50 to-blue-50/30 rounded-lg px-4 py-2 border border-slate-200/40 flex-1 max-w-xl">
                <TimeStepper
                  value={isPlaying ? currentTime : (regionStartTime || 0)}
                  onChange={(val) => {
                    console.log("[TimeStepper-Start] Direct edit onChange:", val);
                    const currentEnd = regionEndTime || duration || 0;
                    console.log(
                      "[TimeStepper-Start] Current end value:",
                      currentEnd
                    );

                    if (val >= 0 && val < currentEnd && val <= duration) {
                      console.log(
                        "[TimeStepper-Start] Valid start time, updating region:",
                        val
                      );
                      if (ref?.current?.setRegionStart) {
                        ref.current.setRegionStart(val);
                      }
                      setDisplayRegionStart(formatDisplayTime(val));
                      setRegionStartTime(val);

                      if (wavesurferRef.current && regionRef.current) {
                        const totalDuration = wavesurferRef.current.getDuration();
                        wavesurferRef.current.seekTo(val / totalDuration);
                        syncPositions(val, "timeStepperStartEdit");
                        updateVolume(val, true, true);
                        drawVolumeOverlay(true);
                      }
                    } else {
                      console.warn("[TimeStepper-Start] Invalid start time:", {
                        val,
                        currentEnd,
                        duration,
                      });
                      alert(
                        `❌ Invalid start time. Must be between 0 and ${formatTime(
                          currentEnd - 0.01
                        )}`
                      );
                    }
                  }}
                  label={isPlaying ? "Now" : "Start"}
                  maxValue={Math.max(0, (regionEndTime || duration || 30) - 0.01)}
                  minValue={0}
                  compact={true}
                  disabled={loading || !audioFile}
                  isRealTime={isPlaying}
                  showEditButton={!isPlaying}
                />
                
                <div className="flex items-center">
                  <div className="hidden sm:block w-px h-6 bg-slate-300 mx-2"></div>
                  <div className="sm:hidden w-6 h-px bg-slate-300 my-1"></div>
                </div>
                
                <TimeStepper
                  value={regionEndTime || duration || 30}
                  onChange={(val) => {
                    console.log("[TimeStepper-End] Direct edit onChange:", val);
                    const currentStart = isPlaying
                      ? currentTime
                      : regionStartTime || 0;
                    console.log(
                      "[TimeStepper-End] Current start value:",
                      currentStart
                    );

                    if (val > currentStart && val <= duration) {
                      console.log(
                        "[TimeStepper-End] Valid end time, updating region:",
                        val
                      );
                      if (ref?.current?.setRegionEnd) {
                        ref.current.setRegionEnd(val);
                      }
                      setDisplayRegionEnd(formatDisplayTime(val));
                      setRegionEndTime(val);

                      const previewPosition = Math.max(currentStart, val - 3);
                      console.log(
                        "[TimeStepper-End] Seeking to preview position:",
                        previewPosition
                      );

                      if (wavesurferRef.current && regionRef.current) {
                        const totalDuration = wavesurferRef.current.getDuration();
                        wavesurferRef.current.seekTo(
                          previewPosition / totalDuration
                        );
                        syncPositions(previewPosition, "timeStepperEndEdit");
                        updateVolume(previewPosition, true, true);
                        drawVolumeOverlay(true);
                      }
                    } else {
                      console.warn("[TimeStepper-End] Invalid end time:", {
                        val,
                        currentStart,
                        duration,
                      });
                      alert(
                        `❌ Invalid end time. Must be between ${formatTime(
                          currentStart + 0.01
                        )} and ${formatTime(duration)}`
                      );
                    }
                  }}
                  label="End"
                  minValue={Math.max(
                    0.01,
                    (isPlaying ? currentTime : regionStartTime || 0) + 0.01
                  )}
                  maxValue={duration || 30}
                  compact={true}
                  disabled={loading || !audioFile}
                  isRealTime={false}
                  showEditButton={true}
                />
              </div>

              {/* Side Info Panels - Compact */}
              <div className="flex flex-row lg:flex-col gap-3 lg:gap-2">
                {/* Current Time Display */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg px-3 py-2 border border-blue-200/40 min-w-[110px]">
                  <div className="flex items-center space-x-1">
                    <Clock className="w-3 h-3 text-blue-600" />
                    <div className="text-xs text-blue-600 font-medium uppercase tracking-wide">
                      Time
                    </div>
                  </div>
                  <div className="font-mono text-slate-700 font-semibold mt-0.5 text-xs">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </div>
                </div>

                {/* Volume Display */}
                <div className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-lg px-3 py-2 border border-emerald-200/40 min-w-[110px]">
                  <div className="flex items-center space-x-1">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-3 w-3 text-emerald-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.536a5 5 0 010-7.072m12.728 0l-4.242 4.242m-6.364 6.364l-4.242-4.242"
                      />
                    </svg>
                    <div className="text-xs text-emerald-600 font-medium uppercase tracking-wide">
                      Volume
                    </div>
                  </div>
                  <div className="font-mono text-slate-700 font-semibold mt-0.5 text-xs">
                    {currentVolumeDisplay.toFixed(2)}x
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

export default WaveformSelector;
