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
    const [displayRegionStart, setDisplayRegionStart] = useState(0);
    const [displayRegionEnd, setDisplayRegionEnd] = useState(0);

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
    const throttledFunctionsRef = useRef({});

    // ADDED: New refs to track click source
    const clickSourceRef = useRef(null);
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

    // === SYNC FIX: Master position synchronization function ===
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

        console.log(`[syncPositions] ${source}: ${newPosition.toFixed(4)}s`);
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

    // Common function to update region styles
    const updateRegionStyles = useCallback(() => {
      if (!regionRef.current || !regionRef.current.element) return;
    
      try {
        console.log(`[updateRegionStyles] Current mode: ${isDeleteMode ? 'DELETE' : 'NORMAL'}`);
        
        // Cache colors to avoid recalculation
        const currentColor = isDeleteMode
          ? "rgba(239, 68, 68, 0.2)"  // Đỏ cho delete mode
          : "rgba(59, 130, 246, 0.2)"; // Xanh cho normal mode
          
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
    
        console.log(`[updateRegionStyles] ✅ Applied ${isDeleteMode ? 'RED' : 'BLUE'} styles`);
      } catch (error) {
        console.error("[updateRegionStyles] Error:", error);
      }
    }, [isDeleteMode, theme, colors]); // Dependencies properly specified
    
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
      console.log(
        `[volumeProfileEffect] TRIGGERED - volume=${volume}, profile=${volumeProfile}, fade=${fade}, isPlaying=${isPlaying}`
      );

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

        console.log(`[volumeProfileEffect] Position analysis:`);
        console.log(`  - WS position: ${currentWsPosition.toFixed(4)}s`);
        console.log(`  - Synced position: ${syncedPos.toFixed(4)}s`);
        console.log(
          `  - Region: ${regionStart.toFixed(4)}s - ${regionEnd.toFixed(4)}s`
        );

        if (isPlaying) {
          // If playing, always use current wavesurfer position
          targetPosition = currentWsPosition;
          console.log(
            `[volumeProfileEffect] Playing - using WS position: ${targetPosition.toFixed(
              4
            )}s`
          );
        } else {
          // IMPROVED LOGIC: If not playing, prioritize recently synced position
          const wsInRegion =
            currentWsPosition >= regionStart && currentWsPosition <= regionEnd;
          const syncedInRegion =
            syncedPos >= regionStart && syncedPos <= regionEnd;
          const syncTimeDiff = performance.now() - lastSyncTimeRef.current;

          console.log(
            `  - WS in region: ${wsInRegion}, Synced in region: ${syncedInRegion}`
          );
          console.log(`  - Time since last sync: ${syncTimeDiff.toFixed(0)}ms`);

          if (syncTimeDiff < 1000 && syncedInRegion) {
            // Recently synced position within region - use it
            targetPosition = syncedPos;
            console.log(
              `[volumeProfileEffect] Using recent synced position: ${targetPosition.toFixed(
                4
              )}s`
            );
          } else if (wsInRegion) {
            // WS position is valid within region
            targetPosition = currentWsPosition;
            console.log(
              `[volumeProfileEffect] Using WS position within region: ${targetPosition.toFixed(
                4
              )}s`
            );
          } else if (syncedInRegion) {
            // Synced position is valid within region
            targetPosition = syncedPos;
            console.log(
              `[volumeProfileEffect] Using synced position within region: ${targetPosition.toFixed(
                4
              )}s`
            );
          } else {
            // Neither position is valid - default to region start
            targetPosition = regionStart;
            console.log(
              `[volumeProfileEffect] No valid position - defaulting to region start: ${targetPosition.toFixed(
                4
              )}s`
            );
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
          console.log(
            `[volumeProfileEffect] Position change detected (${positionDiff.toFixed(
              4
            )}s) - syncing to: ${targetPosition.toFixed(4)}s`
          );
          syncPositions(targetPosition, "volumeProfileChange");
          updateVolume(targetPosition, true, true);
        } else {
          console.log(
            `[volumeProfileEffect] Position unchanged - just updating volume`
          );
          updateVolume(targetPosition, true, true);
        }

        if (isPlaying) {
          animationFrameRef.current =
            requestAnimationFrame(updateRealtimeVolume);
        }

        drawVolumeOverlay();
        console.log(
          `[volumeProfileEffect] COMPLETED - Effects updated: volume=${volume}, profile=${volumeProfile}, fade=${fade}, position=${targetPosition.toFixed(
            4
          )}s`
        );
      } else {
        console.log(
          `[volumeProfileEffect] Missing refs - wavesurfer: ${!!wavesurferRef.current}, region: ${!!regionRef.current}`
        );
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
      syncPositions(playFrom, "playCommand");
      updateVolume(playFrom, true, true);
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

      console.log(`[togglePlayPause] CALLED - Current isPlaying: ${isPlaying}`);

      if (isPlaying) {
        console.log("Pausing playback");
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
        console.log("[togglePlayPause] Set isPlaying to false");

        onPlayStateChange(false);
        console.log("[togglePlayPause] Called onPlayStateChange(false)");

        drawVolumeOverlay();
      } else {
        const start = regionRef.current.start;
        const end = regionRef.current.end;

        // === FIX: Ưu tiên vị trí hiện tại thay vì resumePosition ===
        const currentWsPosition = wavesurferRef.current.getCurrentTime();
        const syncedPosition = syncPositionRef.current;

        console.log("[togglePlayPause] STARTING PLAYBACK");
        console.log(
          `[togglePlayPause] Current WS position: ${currentWsPosition.toFixed(
            4
          )}s`
        );
        console.log(
          `[togglePlayPause] Synced position: ${syncedPosition.toFixed(4)}s`
        );
        console.log(
          `[togglePlayPause] Resume position: ${lastPositionRef.current.toFixed(
            4
          )}s`
        );
        console.log(
          `[togglePlayPause] Region: ${start.toFixed(4)}s - ${end.toFixed(4)}s`
        );

        let playFrom;

        // Logic mới: Ưu tiên vị trí hiện tại nếu nó trong region
        if (currentWsPosition >= start && currentWsPosition < end) {
          playFrom = currentWsPosition;
          console.log(
            `[togglePlayPause] ✅ Using current WS position: ${playFrom.toFixed(
              4
            )}s`
          );
        } else if (syncedPosition >= start && syncedPosition < end) {
          playFrom = syncedPosition;
          console.log(
            `[togglePlayPause] ✅ Using synced position: ${playFrom.toFixed(
              4
            )}s`
          );
        } else {
          // Fallback về resumePosition hoặc region start
          const resumePosition = lastPositionRef.current;
          playFrom =
            resumePosition >= start && resumePosition < end
              ? resumePosition
              : start;
          console.log(
            `[togglePlayPause] ✅ Using fallback position: ${playFrom.toFixed(
              4
            )}s`
          );
        }

        console.log(
          `[togglePlayPause] FINAL playFrom: ${playFrom.toFixed(4)}s`
        );
        console.log(
          `[togglePlayPause] Will play from ${playFrom.toFixed(
            4
          )}s to ${end.toFixed(4)}s`
        );

        currentProfileRef.current =
          fadeEnabledRef.current && volumeProfile === "uniform"
            ? "fadeInOut"
            : volumeProfile;
        syncPositions(playFrom, "togglePlayPausePlay");
        updateVolume(playFrom, true, true);

        console.log(
          `Starting playback from ${playFrom.toFixed(4)}s to ${end.toFixed(
            4
          )}s, loop: ${loop}`
        );

        wavesurferRef.current.play(playFrom, end);

        setIsPlaying(true);
        console.log("[togglePlayPause] Set isPlaying to true");

        onPlayStateChange(true);
        console.log("[togglePlayPause] Called onPlayStateChange(true)");

        if (loop) {
          console.log("Starting playback with loop enabled");
        }
      }

      setTimeout(() => {
        verifyPlaybackState();
      }, 100);
    };

const calculateVolumeForProfile = (relPos, profile) => {
  // Chỉ log khi debug mode hoặc khi cần thiết
  const shouldLog = Math.random() < 0.01; // Chỉ log 1% để tránh spam
  
  if (shouldLog) {
    console.log(`[calculateVolumeForProfile] relPos=${relPos.toFixed(3)}, profile=${profile}`);
  }
  
  const intendedVolume = Math.min(1.0, intendedVolumeRef.current);
  const currentCustomVolume = {
    start: Math.min(1.0, customVolumeRef.current.start),
    middle: Math.min(1.0, customVolumeRef.current.middle),
    end: Math.min(1.0, customVolumeRef.current.end),
  };
  
  // Check fade states
  const isFadeEnabled = fadeEnabledRef.current;
  const isFadeIn = fadeInRef.current;
  const isFadeOut = fadeOutRef.current;
  
  // Calculate base volume from profile
  let baseVolume = intendedVolume;
  
  switch (profile) {
    case "uniform":
      baseVolume = intendedVolume;
      break;
      
    case "custom": {
  // OPTIMIZED: Chỉ log khi debug mode hoặc giá trị thay đổi đáng kể
  const shouldLog = Math.random() < 0.001; // Chỉ log 0.1% để tránh spam
  
  if (shouldLog) {
    console.log('[calculateVolumeForProfile] CUSTOM profile - relPos:', relPos.toFixed(3));
    console.log('[calculateVolumeForProfile] CUSTOM - customVolume:', currentCustomVolume);
  }
  
  if (relPos <= 0.5) {
    const t = relPos * 2;
    baseVolume = intendedVolume * (currentCustomVolume.start + (currentCustomVolume.middle - currentCustomVolume.start) * t);
  } else {
    const t = (relPos - 0.5) * 2;
    baseVolume = intendedVolume * (currentCustomVolume.middle + (currentCustomVolume.end - currentCustomVolume.middle) * t);
  }
  
  // OPTIMIZED: Apply fade in/out duration for custom profile - NO LOGGING trong loop
  const regionDuration = regionRef.current ? regionRef.current.end - regionRef.current.start : 0;
  const fadeInDur = fadeInDurationRef.current || 3;
  const fadeOutDur = fadeOutDurationRef.current || 3;
  
  if (regionDuration > 0) {
    const posInRegion = relPos * regionDuration;
    const timeToEnd = regionDuration - posInRegion;
    
    let fadeMultiplier = 1.0;
    
    // Apply fade in effect - NO LOGGING
    if (posInRegion < fadeInDur) {
      const fadeInMultiplier = Math.max(0, Math.min(1, posInRegion / fadeInDur));
      fadeMultiplier *= fadeInMultiplier;
    }
    
    // Apply fade out effect - NO LOGGING
    if (timeToEnd < fadeOutDur) {
      const fadeOutMultiplier = Math.max(0, Math.min(1, timeToEnd / fadeOutDur));
      fadeMultiplier *= fadeOutMultiplier;
    }
    
    baseVolume *= fadeMultiplier;
  }
  
  break;
}
    
    case "fadeIn": {
      // Fade from 0 to full volume
      baseVolume = intendedVolume * relPos;
      break;
    }
    
    case "fadeOut": {
      // Fade from full volume to 0
      baseVolume = intendedVolume * (1 - relPos);
      break;
    }
    
    case "fadeInOut": {
      const fadeInDur = fadeInDurationRef.current || 3;
      const fadeOutDur = fadeOutDurationRef.current || 3;
      const regionDuration = regionRef.current ? regionRef.current.end - regionRef.current.start : 0;
      
      if (regionDuration <= 0) {
        baseVolume = intendedVolume;
        break;
      }
      
      const posInRegion = relPos * regionDuration;
      const timeToEnd = regionDuration - posInRegion;
      
      let fadeMultiplier = 1.0;
      
      // Fade in
      if (posInRegion < fadeInDur) {
        fadeMultiplier *= Math.max(0, Math.min(1, posInRegion / fadeInDur));
      }
      
      // Fade out
      if (timeToEnd < fadeOutDur) {
        fadeMultiplier *= Math.max(0, Math.min(1, timeToEnd / fadeOutDur));
      }
      
      baseVolume = intendedVolume * fadeMultiplier;
      break;
    }
    
    case "crescendo": {
      // Gradual increase from 0 to full volume
      baseVolume = intendedVolume * relPos;
      break;
    }
    
    case "diminuendo": {
      // Gradual decrease from full volume to 0
      baseVolume = intendedVolume * (1 - relPos);
      break;
    }
    
    case "bell": {
      // Bell curve: low at start and end, high in middle
      const bellMultiplier = Math.sin(relPos * Math.PI);
      baseVolume = intendedVolume * bellMultiplier;
      break;
    }
    
    case "valley": {
      // Inverse bell: high at start and end, low in middle
      const valleyMultiplier = 1 - Math.sin(relPos * Math.PI);
      baseVolume = intendedVolume * valleyMultiplier;
      break;
    }
    
    case "exponential_in": {
      // Exponential fade in
      const expMultiplier = Math.pow(relPos, 2);
      baseVolume = intendedVolume * expMultiplier;
      break;
    }
    
    case "exponential_out": {
      // Exponential fade out
      const expMultiplier = Math.pow(1 - relPos, 2);
      baseVolume = intendedVolume * expMultiplier;
      break;
    }
    
    default: {
      if (shouldLog) {
        console.warn(`[calculateVolumeForProfile] Unknown profile: ${profile}, using uniform`);
      }
      baseVolume = intendedVolume;
      break;
    }
  }
  
  // Apply additional fade effects if enabled (on top of profile)
  let finalVolume = baseVolume;
  
  if (isFadeEnabled && (isFadeIn || isFadeOut)) {
    const regionDuration = regionRef.current ? regionRef.current.end - regionRef.current.start : 0;
    
    if (regionDuration > 0) {
      const posInRegion = relPos * regionDuration;
      const timeToEnd = regionDuration - posInRegion;
      const FIXED_FADE_DURATION = 2.0;
      
      // Apply additional fade in
      if (isFadeIn && posInRegion < FIXED_FADE_DURATION) {
        const fadeInMultiplier = Math.max(0, Math.min(1, posInRegion / FIXED_FADE_DURATION));
        finalVolume *= fadeInMultiplier;
      }
      
      // Apply additional fade out
      if (isFadeOut && timeToEnd < FIXED_FADE_DURATION) {
        const fadeOutMultiplier = Math.max(0, Math.min(1, timeToEnd / FIXED_FADE_DURATION));
        finalVolume *= fadeOutMultiplier;
      }
    }
  }
  
  // Clamp final volume
  const result = Math.max(0, Math.min(1, finalVolume));
  
  if (shouldLog) {
    console.log(`[calculateVolumeForProfile] ${profile} -> base=${baseVolume.toFixed(3)}, final=${result.toFixed(3)}`);
  }
  
  return result;
};
    // === SYNC FIX: Enhanced updateVolume with synchronized position tracking ===
const updateVolume = (absPosition = null, forceUpdate = false, forceRedraw = false) => {
  if (!wavesurferRef.current || !regionRef.current) return;

  const regionStart = regionRef.current.start;
  const regionEnd = regionRef.current.end;
  if (regionEnd <= regionStart) {
    console.warn("[updateVolume] Invalid region bounds, skipping update");
    return;
  }

  const currentPos = absPosition ?? (isPlaying ? wavesurferRef.current.getCurrentTime() : syncPositionRef.current);

  if (absPosition !== null) {
    syncPositions(currentPos, "updateVolume");
  }

  // OPTIMIZED: Throttled logging - only log significant changes or when forced
  const significantPositionChange = Math.abs(currentPos - lastPositionRef.current) > 0.5;
  const shouldLog = forceUpdate && (significantPositionChange || Math.random() < 0.01); // 1% chance for force updates
  
  if (shouldLog) {
    console.log(`[updateVolume] Position: ${currentPos.toFixed(2)}s, Force: ${forceUpdate}, Change: ${(currentPos - lastPositionRef.current).toFixed(3)}s`);
  }

  const start = regionRef.current.start;
  const end = regionRef.current.end;
  const regionDuration = end - start;
  
  // OPTIMIZED: Early return if position hasn't changed significantly and not forced
  if (!forceUpdate && !significantPositionChange && Math.abs(currentPos - lastPositionRef.current) < 0.01) {
    return;
  }
  
  const relPos = Math.max(0, Math.min(1, (currentPos - start) / regionDuration));

  // OPTIMIZED: Cache volume calculation result
  const vol = calculateVolumeForProfile(relPos, currentProfileRef.current);
  const normalizedVol = Math.min(1, vol);
  
  // OPTIMIZED: Only update if volume actually changed
  const volumeChanged = Math.abs(normalizedVol - currentVolumeRef.current) > 0.001;
  
  if (volumeChanged || forceUpdate) {
    wavesurferRef.current.setVolume(normalizedVol);
    setCurrentVolumeDisplay(vol);
    currentVolumeRef.current = vol;
    
    // Update last position only when we actually made changes
    lastPositionRef.current = currentPos;
  }

  // OPTIMIZED: Conditional redraw - only when necessary
  if (forceRedraw || (volumeChanged && !isDraggingRef.current)) {
    // Use requestAnimationFrame for smoother updates
    requestAnimationFrame(() => {
      drawVolumeOverlay();
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
        // Tối ưu số sample points dựa trên profile complexity
const samplePoints = (() => {
  switch (currentProfile) {
    case "custom":
    case "fadeInOut":
    case "bell":
    case "valley":
      return Math.min(200, regionWidth); // Giảm từ 500 xuống 200
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

      // Draw the volume curve
      // Draw the volume curve - OPTIMIZED: Reduce sample points for custom profile
const stepSize = (() => {
  switch (currentProfile) {
    case "custom":
      return Math.max(2, Math.floor(regionWidth / 200)); // Reduced from 800 to 200
    case "fadeInOut":
    case "bell":
    case "valley":
      return Math.max(1, Math.floor(regionWidth / 300)); // Reduced from 800 to 300
    default:
      return Math.max(1, Math.floor(regionWidth / 400)); // Reduced from 800 to 400
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
          fadeInGradient.addColorStop(0, 'rgba(34, 197, 94, 0.3)'); // Green with transparency
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
          fadeOutGradient.addColorStop(0, 'rgba(239, 68, 68, 0.1)'); // Red with transparency
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

      console.log(
        `[verifyPlaybackState] CHECKING STATE - WaveSurfer: ${wavesurferPlaying}, Internal: ${internalPlaying}`
      );

      if (wavesurferPlaying !== internalPlaying) {
        console.warn(
          `[verifyPlaybackState] STATE MISMATCH - WaveSurfer: ${wavesurferPlaying}, Internal: ${internalPlaying}`
        );

        if (wavesurferPlaying && !internalPlaying) {
          console.log(
            "[verifyPlaybackState] SYNC: Setting internal state to playing"
          );
          setIsPlaying(true);
          if (onPlayStateChange) onPlayStateChange(true);
        } else if (!wavesurferPlaying && internalPlaying) {
          console.log(
            "[verifyPlaybackState] SYNC: Setting internal state to stopped - Analyzing position"
          );

          // CRITICAL FIX: Get current position BEFORE changing isPlaying state
          const currentPos = wavesurferRef.current.getCurrentTime();
          const regionStart = regionRef.current.start;
          const regionEnd = regionRef.current.end;
          const END_TOLERANCE = 0.05; // 50ms tolerance for natural playback end

          console.log(
            `[verifyPlaybackState] Current position: ${currentPos.toFixed(
              4
            )}s, Region: ${regionStart.toFixed(4)}s - ${regionEnd.toFixed(4)}s`
          );

          // Check if this is a natural playback end (position slightly past region end)
          const pastRegionEnd = currentPos > regionEnd;
          const endDistance = currentPos - regionEnd;
          const isNaturalEnd = pastRegionEnd && endDistance <= END_TOLERANCE;

          console.log(
            `[verifyPlaybackState] Analysis: pastEnd=${pastRegionEnd}, distance=${endDistance.toFixed(
              4
            )}s, naturalEnd=${isNaturalEnd}`
          );

          if (isNaturalEnd) {
            console.log(
              `[verifyPlaybackState] Natural playback end detected - resetting to region start smoothly`
            );
            // Use resetToRegionStart helper for smooth reset
            resetToRegionStart("verifyPlaybackState_naturalEnd");
          } else if (currentPos >= regionStart && currentPos <= regionEnd) {
            console.log(
              `[verifyPlaybackState] Position within region bounds - preserving position: ${currentPos.toFixed(
                4
              )}s`
            );
            syncPositions(currentPos, "verifyPlaybackStatePreserve");
          } else {
            console.log(
              `[verifyPlaybackState] Position significantly outside region bounds - correcting to region start`
            );
            resetToRegionStart("verifyPlaybackState_correction");
          }

          // NOW change the state - position has been handled appropriately
          setIsPlaying(false);
          if (onPlayStateChange) onPlayStateChange(false);

          console.log(
            `[verifyPlaybackState] State changed to stopped, final position: ${syncPositionRef.current.toFixed(
              4
            )}s`
          );
        }
      } else {
        console.log(
          `[verifyPlaybackState] States are in sync - no action needed`
        );
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

  // CRITICAL: Check if position is outside region bounds (speed change side effect)
  if (currentPos < regionStart) {
    console.log(`[updateRealtimeVolume] Position ${currentPos.toFixed(3)}s before region start ${regionStart.toFixed(3)}s - correcting`);
    
    // Force position back to region start
    const totalDuration = wavesurferRef.current.getDuration();
    wavesurferRef.current.seekTo(regionStart / totalDuration);
    
    // Restart playback from region start
    wavesurferRef.current.play(regionStart, regionEnd);
    
    // Update all position references
    syncPositionRef.current = regionStart;
    currentPositionRef.current = regionStart;
    lastPositionRef.current = regionStart;
    
    setCurrentTime(regionStart);
    onTimeUpdate(regionStart);
    updateVolume(regionStart, false, false);
    
    animationFrameRef.current = requestAnimationFrame(updateRealtimeVolume);
    return;
  }

  // Update ALL position references immediately
  syncPositionRef.current = currentPos;
  currentPositionRef.current = currentPos;
  lastPositionRef.current = currentPos;

  // Update UI time display
  setCurrentTime(currentPos);
  onTimeUpdate(currentPos);

  // Force overlay redraw with current position
  drawVolumeOverlay(true);

  // End detection with tolerance
  const END_TOLERANCE = 0.02;
  const distanceToEnd = regionEnd - currentPos;

  if (distanceToEnd <= END_TOLERANCE) {
    // ONLY log when actually ending
    console.log(`[END DETECTED] Distance: ${distanceToEnd.toFixed(4)}s`);
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    handlePlaybackEnd();
    return;
  }

  // Continue normal operation
  updateVolume(currentPos, false, false);
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
        normalize: normalizeAudio,
        barColor: (barIndex, barTime) => {
          console.log("[BARCOLOR] Called with:", {
            barIndex,
            barTime: barTime.toFixed(3),
            removeMode: isDeleteMode,
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
            currentMode: isDeleteMode ? "DELETE" : "NORMAL",
          });

          if (isDeleteMode) {
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

          console.log("[handleWaveformClick] Click detected");

          const rect = waveformRef.current.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const clickTime =
            (clickX / rect.width) * wavesurferRef.current.getDuration();

          const currentStart = regionRef.current.start;
          const currentEnd = regionRef.current.end;
          const wasPlaying = isPlaying;
          const currentTime = wavesurferRef.current.getCurrentTime();

          console.log(
            "[handleWaveformClick] Click time:",
            clickTime,
            "Current start:",
            currentStart,
            "Current end:",
            currentEnd,
            "Current playback time:",
            currentTime,
            "Was playing:",
            wasPlaying
          );

          clickSourceRef.current = "click";
          regionChangeSourceRef.current = "click";

          if (clickTime < currentStart) {
            console.log(
              "[handleWaveformClick] Click before region start, updating start to:",
              clickTime
            );

            if (regionRef.current.setOptions) {
              regionRef.current.setOptions({ start: clickTime });
            } else if (regionRef.current.update) {
              regionRef.current.update({ start: clickTime });
            } else {
              regionRef.current.start = clickTime;
              if (wavesurferRef.current.fireEvent) {
                wavesurferRef.current.fireEvent(
                  "region-updated",
                  regionRef.current
                );
              }
            }

            onRegionChange(clickTime, currentEnd);

            if (wasPlaying) {
              console.log(
                "[handleWaveformClick] Was playing, resetting to new start and continuing"
              );
              wavesurferRef.current.pause();
              setTimeout(() => {
                if (wavesurferRef.current) {
                  wavesurferRef.current.play(clickTime, currentEnd);
                  syncPositions(clickTime, "handleWaveformClickNewStart");
                }
              }, 50);
            } else {
              console.log(
                "[handleWaveformClick] Not playing, just updating volume and seeking to new start"
              );
              const totalDuration = wavesurferRef.current.getDuration();
              wavesurferRef.current.seekTo(clickTime / totalDuration);
              syncPositions(clickTime, "handleWaveformClickSeekStart");
              updateVolume(clickTime, true, true);
            }
          } else if (clickTime > currentEnd + 0.1) {
            console.log("[handleWaveformClick] Click after current region end");
            console.log(
              `[handleWaveformClick] Current end: ${currentEnd.toFixed(
                4
              )}s, Click time: ${clickTime.toFixed(4)}s`
            );

            // CRITICAL: Set flags immediately
            isClickUpdatingEndRef.current = true;
            lastClickEndTimeRef.current = clickTime;

            // Clear any existing timeouts immediately
            if (endUpdateTimeoutRef.current) {
              clearTimeout(endUpdateTimeoutRef.current);
              endUpdateTimeoutRef.current = null;
            }

            // Calculate preview position immediately
            const previewPosition = calculatePreviewPosition(
              clickTime,
              currentTime
            );
            console.log(
              `[handleWaveformClick] 🎯 INSTANT preview position: ${previewPosition.toFixed(
                4
              )}s`
            );

            // IMMEDIATE region update
            if (regionRef.current.setOptions) {
              regionRef.current.setOptions({ end: clickTime });
            } else if (regionRef.current.update) {
              regionRef.current.update({ end: clickTime });
            } else {
              regionRef.current.end = clickTime;
              if (wavesurferRef.current.fireEvent) {
                wavesurferRef.current.fireEvent(
                  "region-updated",
                  regionRef.current
                );
              }
            }

            // IMMEDIATE position sync and UI updates
            onRegionChange(currentStart, clickTime);

            // CRITICAL: Force immediate seek and sync
            const seekRatio =
              previewPosition / wavesurferRef.current.getDuration();
            wavesurferRef.current.seekTo(seekRatio);

            // IMMEDIATE sync of all position references
            syncPositionRef.current = previewPosition;
            currentPositionRef.current = previewPosition;
            lastPositionRef.current = previewPosition;

            // IMMEDIATE volume and overlay updates
            updateVolume(previewPosition, true, true);
            drawVolumeOverlay(true);

            // Force another immediate sync after a very short delay
            requestAnimationFrame(() => {
              if (wavesurferRef.current) {
                const currentWsPos = wavesurferRef.current.getCurrentTime();
                if (Math.abs(currentWsPos - previewPosition) > 0.001) {
                  wavesurferRef.current.seekTo(
                    previewPosition / wavesurferRef.current.getDuration()
                  );
                  syncPositions(
                    previewPosition,
                    "handleWaveformClickPreviewSync"
                  );
                  updateVolume(previewPosition, true, true);
                  drawVolumeOverlay(true);
                }
              }
            });

            // Handle playback continuation
            if (wasPlaying) {
              console.log(
                `[handleWaveformClick] ▶️ Continuing playback from ${previewPosition.toFixed(
                  4
                )}s to ${clickTime.toFixed(4)}s`
              );
              // Use requestAnimationFrame for smoother playback resumption
              requestAnimationFrame(() => {
                if (wavesurferRef.current && isPlaying) {
                  wavesurferRef.current.play(previewPosition, clickTime);
                }
              });
            } else {
              console.log(
                `[handleWaveformClick] ⏸️ Not playing - positioned at preview point ${previewPosition.toFixed(
                  4
                )}s`
              );
            }

            // Clear click flags after a short delay
            setTimeout(() => {
              isClickUpdatingEndRef.current = false;
              lastClickEndTimeRef.current = null;
              clickSourceRef.current = null;
              regionChangeSourceRef.current = null;
              console.log("[handleWaveformClick] Reset click flags");
            }, 100);
          } else {
            console.log(
              "[handleWaveformClick] Click within region, seeking to:",
              clickTime
            );
            const totalDuration = wavesurferRef.current.getDuration();
            wavesurferRef.current.seekTo(clickTime / totalDuration);
            syncPositions(clickTime, "handleWaveformClickWithin");
            updateVolume(clickTime, true, true);

            // === FIX: Force overlay redraw sau khi click trong region ===
            setTimeout(() => {
              drawVolumeOverlay(true);
              console.log(
                `[handleWaveformClick] Overlay redrawn after click within region: ${clickTime.toFixed(
                  4
                )}s`
              );
            }, 50);

            if (wasPlaying) {
              setTimeout(() => {
                if (wavesurferRef.current && isPlaying) {
                  wavesurferRef.current.play(clickTime, regionRef.current.end);
                }
              }, 50);
            }
          }

          setTimeout(() => {
            clickSourceRef.current = null;
            if (!isClickUpdatingEndRef.current) {
              regionChangeSourceRef.current = null;
            }
            console.log("[handleWaveformClick] Reset click source flag");
          }, 100);
        } catch (error) {
          console.error("[handleWaveformClick] Error processing click:", error);
          clickSourceRef.current = null;
          if (!isClickUpdatingEndRef.current) {
            regionChangeSourceRef.current = null;
          }
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

        regionRef.current.on("update", () => {
          console.log(`\n🔄 [UPDATE EVENT] Region update detected`);
          console.log(
            `📊 Current regionChangeSourceRef: ${regionChangeSourceRef.current}`
          );
// CRITICAL: Force region style update ngay lập tức
if (regionRef.current && regionRef.current.element) {
  const regionElement = regionRef.current.element;
  
  console.log(`[update] 🎨 Force applying ${isDeleteMode ? 'RED' : 'BLUE'} color during drag`);
  
  // Use requestAnimationFrame for smoother updates
  requestAnimationFrame(() => {
    if (!regionRef.current?.element) return; // Safety check
    
    const bgColor = isDeleteMode ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)';
    const borderStyle = isDeleteMode ? '2px solid rgba(239, 68, 68, 0.8)' : '1px solid rgba(59, 130, 246, 0.5)';
    
    regionElement.style.backgroundColor = bgColor;
    regionElement.style.border = borderStyle;
    
    // More efficient child element updates
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
          console.log(`[update] 🖱️ Set isDraggingRegionRef to true`);

          // Clear dragging state after delay
          clearTimeout(window.dragTimeout);
          window.dragTimeout = setTimeout(() => {
            isDraggingRegionRef.current = false;
            console.log(`[update] 🖱️ Reset isDraggingRegionRef to false`);
          }, 100);

          if (
            regionChangeSourceRef.current === "click" &&
            isClickUpdatingEndRef.current
          ) {
            console.log(
              `[update] 🖱️ Skipping - programmatic update from click handler`
            );
            return;
          }

          const currentProfile = currentProfileRef.current;
          const newStart = regionRef.current.start;
          const newEnd = regionRef.current.end;
          const wasPlaying = isPlaying;

          console.log(
            `[update] 📍 New region bounds: ${newStart.toFixed(
              4
            )}s - ${newEnd.toFixed(4)}s`
          );

          // CRITICAL: Cập nhật real-time display times
          console.log(`[update] 🔄 Updating real-time display times`);
          setDisplayRegionStart(newStart);
          setDisplayRegionEnd(newEnd);
          // Note: Manual input editing functionality has been removed
          // Display times are now updated only through TimeStepper components

          regionChangeSourceRef.current = "drag";

          const isDraggingStart = newStart !== lastRegionStartRef.current;
          const isDraggingEnd = newEnd !== lastRegionEndRef.current;

          lastRegionStartRef.current = newStart;
          lastRegionEndRef.current = newEnd;

          onRegionChange(newStart, newEnd);
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

                  console.log(
                    `🔄 [REALTIME AUTO-SEEK] Seeking to ${previewPosition.toFixed(
                      4
                    )}s (${PREVIEW_TIME_BEFORE_END}s before end: ${newEnd.toFixed(
                      4
                    )}s)`
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
                console.log(
                  `[Drag End] Not playing - auto-seek to preview position: ${previewPosition.toFixed(
                    4
                  )}s`
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

// CRITICAL: Force region style update during drag based on current mode
if (regionRef.current && regionRef.current.element) {
  const regionElement = regionRef.current.element;
  
  if (isDeleteMode) {
    console.log(`[update] 🔴 Delete mode - forcing red region during drag`);
    regionElement.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
    regionElement.style.border = '2px solid rgba(239, 68, 68, 0.8)';
    
    // Also update child elements
    const regionElements = regionElement.getElementsByClassName('wavesurfer-region');
    Array.from(regionElements).forEach(el => {
      el.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
      el.style.border = '2px solid rgba(239, 68, 68, 0.8)';
    });
  } else {
    console.log(`[update] 🔵 Normal mode - forcing blue region during drag`);
    regionElement.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
    regionElement.style.border = '1px solid rgba(59, 130, 246, 0.5)';
    
    // Also update child elements
    const regionElements = regionElement.getElementsByClassName('wavesurfer-region');
    Array.from(regionElements).forEach(el => {
      el.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
      el.style.border = '1px solid rgba(59, 130, 246, 0.5)';
    });
  }
}

throttledDrawRef.current();
        });

        regionRef.current.on("update-end", () => {
          if (wavesurferRef.current && regionRef.current) {
            const currentTime = wavesurferRef.current.getCurrentTime();
            const start = regionRef.current.start;
            const end = regionRef.current.end;
            const previewPosition = Math.max(
              start,
              end - PREVIEW_TIME_BEFORE_END
            );

            if (currentTime < start || currentTime >= end) {
              wavesurferRef.current.pause();

              setTimeout(() => {
                wavesurferRef.current.seekTo(
                  previewPosition / wavesurferRef.current.getDuration()
                );
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

          console.log(`\n🏁 [UPDATE-END EVENT] Drag operation completed`);
          console.log(`📊 Current flags state:`);
          console.log(
            `  - isDragUpdatingEndRef: ${isDragUpdatingEndRef.current}`
          );
          console.log(`  - lastDragEndTimeRef: ${lastDragEndTimeRef.current}`);
          console.log(
            `  - regionChangeSourceRef: ${regionChangeSourceRef.current}`
          );
          console.log(
            `  - isClickUpdatingEndRef: ${isClickUpdatingEndRef.current}`
          );
          console.log(`  - isPlaying: ${isPlaying}`);

          if (
            regionChangeSourceRef.current === "click" &&
            isClickUpdatingEndRef.current
          ) {
            console.log(
              `[update-end] 🖱️ Skipping - programmatic update from click handler`
            );
            return;
          }

          const newStart = regionRef.current.start;
          const newEnd = regionRef.current.end;
          const wasPlaying = isPlaying;

          console.log(
            `[update-end] 📍 Final region bounds: ${newStart.toFixed(
              4
            )}s - ${newEnd.toFixed(4)}s`
          );

          if (wavesurferRef.current) {
            const currentTime = wavesurferRef.current.getCurrentTime();
            console.log(
              `[update-end] 🎵 Current playback time: ${currentTime.toFixed(
                4
              )}s`
            );

            if (wasPlaying && currentTime >= newStart && currentTime < newEnd) {
              console.log(
                `[update-end] ✅ Position valid - continuing playback to new end: ${newEnd.toFixed(
                  4
                )}s`
              );
              wavesurferRef.current.play(currentTime, newEnd);
            } else if (wasPlaying) {
              console.log(
                `[update-end] ⚠️ Position outside valid range - current: ${currentTime.toFixed(
                  4
                )}s, range: ${newStart.toFixed(4)}s - ${newEnd.toFixed(4)}s`
              );
            }
          }

          regionChangeSourceRef.current = null;
          console.log(`[update-end] 🔄 Reset regionChangeSourceRef to null`);

          // CRITICAL: Force region style update after drag ends based on current mode
          if (regionRef.current && regionRef.current.element) {
            // Use updateRegionStyles function instead of inline code
            updateRegionStyles();
            
            // Single delayed refresh instead of multiple
            setTimeout(() => {
              if (regionRef.current && regionRef.current.element) {
                updateRegionStyles();
                console.log(`[update-end] 🎨 Delayed style refresh completed`);
              }
            }, 100); // Single timeout instead of two
          }

          if (isDragUpdatingEndRef.current) {
            console.log(
              `[update-end] 🤔 Drag flags are active - checking if auto-seek in progress...`
            );

            const currentTimeNow = performance.now();
            const timeSinceSet =
              currentTimeNow - (window.lastDragFlagSetTime || 0);

            if (timeSinceSet < 200) {
              console.log(
                `[update-end] ⏳ Auto-seek likely in progress (${timeSinceSet.toFixed(
                  0
                )}ms ago) - delaying flag reset`
              );
              setTimeout(() => {
                if (isDragUpdatingEndRef.current) {
                  console.log(
                    `[update-end] ⏰ [DELAYED] Now resetting drag update flags`
                  );
                  isDragUpdatingEndRef.current = false;
                  lastDragEndTimeRef.current = null;
                }
              }, 300);
            } else {
              console.log(
                `[update-end] ✅ Safe to reset flags immediately (${timeSinceSet.toFixed(
                  0
                )}ms ago)`
              );
              isDragUpdatingEndRef.current = false;
              lastDragEndTimeRef.current = null;
            }
          } else {
            console.log(
              `[update-end] ℹ️ Drag flags already cleared, nothing to reset`
            );
          }

          if (endUpdateTimeoutRef.current) {
            clearTimeout(endUpdateTimeoutRef.current);
            endUpdateTimeoutRef.current = null;
          }
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
        console.log(`[WS seeking] 🎯 Seeking to ${currentTime.toFixed(4)}s`);

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

    // useEffect để cập nhật thời gian hiển thị khi region thay đổi
    useEffect(() => {
      console.log("[REGION_TIME_UPDATE] useEffect triggered");

      if (regionRef.current) {
        const newStart = regionRef.current.start;
        const newEnd = regionRef.current.end;

        console.log(
          `[REGION_TIME_UPDATE] Updating display times - Start: ${newStart.toFixed(
            4
          )}s, End: ${newEnd.toFixed(4)}s`
        );

        // Update display states
        setDisplayRegionStart(newStart);
        setDisplayRegionEnd(newEnd);
      }
    }, [regionRef.current?.start, regionRef.current?.end]);

    useEffect(() => {
      console.log(`[removeModeEffect] TRIGGERED - removeMode: ${isDeleteMode}`);
    
      if (!wavesurferRef.current || !regionRef.current) {
        console.log(`[removeModeEffect] Missing refs - waiting for initialization`);
        return;
      }
    
      try {
        console.log("[removeModeEffect] Updating region styles...");
    
        // Update region styles immediately
        updateRegionStyles();
    
        // Optimize barColor function creation
        const newBarColorFunction = (barIndex, barTime) => {
          if (!regionRef.current) return "#e5e7eb";
          
          const start = regionRef.current.start;
          const end = regionRef.current.end;
          const isInRegion = barTime >= start && barTime <= end;
          
          return isDeleteMode 
            ? (isInRegion ? "transparent" : "#3b82f6")
            : (isInRegion ? "#3b82f6" : "#e5e7eb");
        };
    
        wavesurferRef.current.setOptions({ 
          barColor: newBarColorFunction 
        });
    
        // Reduced force redraws
        const redrawTimer1 = setTimeout(() => {
          if (wavesurferRef.current && regionRef.current) {
            const currentTime = wavesurferRef.current.getCurrentTime();
            const totalDuration = wavesurferRef.current.getDuration();
            if (totalDuration > 0) {
              wavesurferRef.current.seekTo(currentTime / totalDuration);
            }
            updateRegionStyles();
          }
        }, 150);
    
        const redrawTimer2 = setTimeout(() => {
          updateRegionStyles();
        }, 300);
    
        return () => {
          clearTimeout(redrawTimer1);
          clearTimeout(redrawTimer2);
        };
    
        console.log(`[removeModeEffect] ✅ Successfully updated to ${isDeleteMode ? 'DELETE' : 'NORMAL'} mode`);
      } catch (error) {
        console.error(`[removeModeEffect] Error updating remove mode:`, error);
      }
    }, [isDeleteMode]); // XÓA updateRegionStyles khỏi dependency

    // Update delete mode state when prop changes
    useEffect(() => {
      setIsDeleteMode(removeMode);
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

    return (
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 bg-gray-100 bg-opacity-80 flex items-center justify-center z-10 rounded-md">
            <div className="animate-pulse text-blue-500 flex items-center">
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
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Loading audio...
            </div>
          </div>
        )}

        {/* Delete Mode Indicator */}
        {isDeleteMode && (
          <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <div className="text-red-600 text-xs">
              Chế độ xóa: Vùng đỏ sẽ bị xóa, vùng xanh sẽ được giữ lại
            </div>
          </div>
        )}

        <div
          className={`bg-white dark:bg-gray-800 rounded-lg p-4 mb-4 boxwaveform relative ${
            isDeleteMode ? "waveform-delete-mode" : ""
          }`}
          style={{ boxShadow: "none", zIndex: 0 }}
        >
          <div ref={waveformRef} className="mb-2" />
          <canvas
            ref={overlayRef}
            width={1000}
            height={80}
            className={`w-full border border-gray-200 dark:border-gray-700 rounded-md mb-2 relative ${
              isDeleteMode ? "waveform-delete-canvas" : ""
            }`}
            style={{ zIndex: 1, pointerEvents: "none" }}
          />

          {/* TOÀN BỘ 3 PHẦN: Current Time | Region Time Steppers | Volume, responsive layout */}
          <div
            className="flex flex-col md:flex-row items-center justify-between gap-3 md:gap-4 w-full max-w-3xl mx-auto bg-white/80 rounded-lg px-3 py-2 border border-gray-200 shadow mb-2 text-sm text-gray-700 dark:text-gray-300"
            style={{ zIndex: 15 }}
          >
            {/* === Region Time Steppers: Full width on mobile, centered on desktop === */}
            <div className="flex flex-col md:flex-row items-center gap-2 md:gap-x-5.8 bg-white/90 rounded-md px-2 py-1 md:px-1 md:py-0.5 order-1 md:order-2 w-full md:w-auto md:flex-1 md:justify-center">
              <TimeStepper
                value={isPlaying ? currentTime : displayRegionStart || 0}
                onChange={(val) => {
                  console.log("[TimeStepper-Start] Direct edit onChange:", val);
                  const currentEnd = displayRegionEnd || duration || 0;
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
                    setDisplayRegionStart(val);

                    // Force position sync and overlay update
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
                      `❌ Thời gian bắt đầu không hợp lệ. Phải từ 0 đến ${formatTime(
                        currentEnd - 0.01
                      )}`
                    );
                  }
                }}
                label={isPlaying ? "Now" : "Start"}
                maxValue={Math.max(0, (displayRegionEnd || duration) - 0.01)}
                minValue={0}
                compact={true}
                disabled={false}
                isRealTime={isPlaying}
                showEditButton={!isPlaying}
              />
              <span className="text-gray-300 text-sm px-0 select-none font-bold hidden md:inline">
                |
              </span>
              <span className="text-gray-300 text-sm px-0 select-none font-bold md:hidden">
                ↓
              </span>
              <TimeStepper
                value={displayRegionEnd || duration || 0}
                onChange={(val) => {
                  console.log("[TimeStepper-End] Direct edit onChange:", val);
                  const currentStart = isPlaying
                    ? currentTime
                    : displayRegionStart || 0;
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
                    setDisplayRegionEnd(val);

                    // Calculate preview position (3 seconds before end)
                    const previewPosition = Math.max(currentStart, val - 3);
                    console.log(
                      "[TimeStepper-End] Seeking to preview position:",
                      previewPosition
                    );

                    // Force position sync and overlay update
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
                      `❌ Thời gian kết thúc không hợp lệ. Phải từ ${formatTime(
                        currentStart + 0.01
                      )} đến ${formatTime(duration)}`
                    );
                  }
                }}
                label="End"
                minValue={Math.max(
                  0.01,
                  (isPlaying ? currentTime : displayRegionStart || 0) + 0.01
                )}
                maxValue={duration || 0}
                compact={true}
                disabled={false}
                isRealTime={false}
                showEditButton={true}
              />
            </div>

            {/* Bottom row container for mobile, side elements for desktop */}
            <div className="flex flex-row items-center justify-between w-full md:w-auto gap-2 md:gap-4 order-2 md:order-1 md:flex-none">
              {/* Current Time Display */}
              <div className="flex items-center space-x-1 min-w-[105px]">
                <Clock className="w-4 h-4 text-gray-500" />
                <span className="font-mono">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              {/* Volume Display - Hidden on desktop as it's moved to the right side */}
              <div className="flex items-center space-x-2 min-w-[105px] justify-end md:hidden">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 text-gray-500"
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
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Volume: {currentVolumeDisplay.toFixed(2)}x
                </span>
              </div>
            </div>

            {/* Volume Display for desktop - shown on the right side */}
            <div className="hidden md:flex items-center space-x-2 min-w-[105px] justify-end order-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 text-gray-500"
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
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Volume: {currentVolumeDisplay.toFixed(2)}x
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

export default WaveformSelector;
