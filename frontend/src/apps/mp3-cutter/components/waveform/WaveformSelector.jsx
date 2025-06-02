import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef, useCallback } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import TimeStepper from "./TimeStepper";
import { Clock } from "lucide-react";
import "../../styles/components/DeleteRegion.css";
// ✅ BƯỚC 1: Import constants từ file mới
import { 
  WAVEFORM_COLORS, 
  TIMING_CONSTANTS, 
  REGION_STYLES,
  PERFORMANCE_CONFIG
} from './constants/waveformConstants.js';
// ✅ BƯỚC 2: Import utils functions từ files mới
import { throttle, debounce } from './utils/throttleDebounce.js';
import { formatTime, formatDisplayTime, formatDurationTime } from './utils/timeFormatters.js';
import { calculatePreviewPosition } from './utils/audioUtils.js';

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

	const forceWaveformRedraw = useCallback(() => {
		console.log('[forceWaveformRedraw] Forcing waveform bars update');
		
		if (wavesurferRef.current) {
		  try {
			// Force redraw by seeking to current position
			const currentTime = wavesurferRef.current.getCurrentTime();
			const totalDuration = wavesurferRef.current.getDuration();
			
			if (totalDuration > 0) {
			  const currentProgress = currentTime / totalDuration;
			  
			  // Small seek to trigger redraw
			  wavesurferRef.current.seekTo(currentProgress);
			  
			  console.log('[forceWaveformRedraw] Waveform bars updated successfully');
			}
		  } catch (error) {
			console.error('[forceWaveformRedraw] Error updating bars:', error);
		  }
		}
	  }, []);

    const waveformRef = useRef(null);
    const overlayRef = useRef(null);
    const dimOverlayRef = useRef(null);
    const waveformDimOverlayRef = useRef(null);
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

    // ✅ BƯỚC 1: Thay thế theme colors bằng constant
    const colors = WAVEFORM_COLORS;

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
    // ✅ BƯỚC 1: Thay thế magic number bằng constant
    const DRAW_INTERVAL = TIMING_CONSTANTS.DRAW_INTERVAL;

    // Thêm ref để theo dõi trạng thái region update
    const isRegionUpdatingRef = useRef(false);
    const regionUpdateTimeoutRef = useRef(null);

    // Thêm ref để theo dõi vị trí hiện tại chính xác hơn
    const currentPositionRef = useRef(0);
    const isDraggingRef = useRef(false);
    const isEndingPlaybackRef = useRef(false);
    const isDraggingRegionRef = useRef(false);
    // ✅ BƯỚC 1: Thay thế magic number bằng constant
    const PREVIEW_TIME_BEFORE_END = TIMING_CONSTANTS.PREVIEW_TIME_BEFORE_END;


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
        console.log("[updateRegionStyles] Updating region styles, deleteMode:", isDeleteMode);
        
        // ✅ BƯỚC 1: Thay thế hardcoded styles bằng constants
        const currentColor = isDeleteMode
          ? REGION_STYLES.DELETE_MODE.backgroundColor
          : REGION_STYLES.NORMAL_MODE.backgroundColor;
            
        const currentBorder = isDeleteMode 
          ? REGION_STYLES.DELETE_MODE.border
          : REGION_STYLES.NORMAL_MODE.border;
            
        const currentHandleStyle = {
          borderColor: isDeleteMode
            ? REGION_STYLES.DELETE_MODE.borderColor
            : REGION_STYLES.NORMAL_MODE.borderColor,
          backgroundColor: isDeleteMode
            ? REGION_STYLES.DELETE_MODE.handleBackgroundColor
            : REGION_STYLES.NORMAL_MODE.handleBackgroundColor,
          width: REGION_STYLES.HANDLE_WIDTH,
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
          
          if (element.style.backgroundColor !== currentColor) {
            element.style.backgroundColor = currentColor;
            element.style.border = currentBorder;
    
            const regionElements = element.getElementsByClassName("wavesurfer-region");
            for (let i = 0; i < regionElements.length; i++) {
              const el = regionElements[i];
              el.style.backgroundColor = currentColor;
              el.style.border = currentBorder;
            }
          }
        }
        
        // ✅ THÊM: Cập nhật lớp che mờ trên waveform khi style thay đổi
        setTimeout(() => {
          drawWaveformDimOverlay(true);
        }, 10);
        
        console.log("[updateRegionStyles] Region styles updated successfully, background:", currentColor);
      } catch (error) {
        console.error("[updateRegionStyles] Error:", error);
      }
    }, [isDeleteMode]);
    
    const getThrottledFunction = useCallback((funcName, originalFunc, delay) => {
      if (!throttledFunctionsRef.current[funcName]) {
        throttledFunctionsRef.current[funcName] = throttle(originalFunc, delay);
      }
      return throttledFunctionsRef.current[funcName];
    }, []);
    
    // Helper functions để get throttled versions
    const getThrottledUpdateRegionStyles = useCallback(() => {
      return getThrottledFunction('updateRegionStyles', updateRegionStyles, PERFORMANCE_CONFIG.THROTTLE_DELAY);
    }, [getThrottledFunction, updateRegionStyles]);
    
    const getThrottledDraw = useCallback(() => {
      return getThrottledFunction('drawVolumeOverlay', () => drawVolumeOverlay(), PERFORMANCE_CONFIG.THROTTLE_DELAY);
    }, [getThrottledFunction]);

    
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
    }, [volumeProfile, volume, customVolume, fade, isPlaying]);

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
    
    // ✅ FIX: Update display values after region bounds change
    console.log(`[setRegionBounds] Updating display values for undo/redo`);
    updateDisplayValues("setRegionBounds_undo_redo");
    
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

  // Only log critical errors for fadeIn profile
  const isFadeInProfile = currentProfileRef.current === "fadeIn";
  if (isFadeInProfile) {
    const vol = calculateVolumeForProfile(relPos, currentProfileRef.current);
    
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

      // Draw the volume curve
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
    
    // ✅ THÊM: Vẽ lớp che mờ trên waveform sau khi vẽ volume overlay
    drawWaveformDimOverlay(forceRedraw);
    
  } finally {
    isDrawingOverlayRef.current = false;
  }
};



const drawWaveformDimOverlay = (forceRedraw = false) => {
	if (!waveformDimOverlayRef.current || !regionRef.current || !wavesurferRef.current) return;
  
	const now = performance.now();
	if (!forceRedraw && now - lastDrawTimeRef.current < DRAW_INTERVAL) {
	  return;
	}
  
	try {
	  const canvas = waveformDimOverlayRef.current;
	  const ctx = canvas.getContext("2d");
	  
	  // ✅ FIX: Lấy kích thước thực tế của waveform container
	  const waveformContainer = waveformRef.current;
	  if (!waveformContainer) return;
	  
	  const containerRect = waveformContainer.getBoundingClientRect();
	  const actualWidth = containerRect.width;
	  const actualHeight = containerRect.height;
	  
	  // ✅ FIX: Đồng bộ canvas size với container size
	  if (canvas.width !== actualWidth || canvas.height !== actualHeight) {
		canvas.width = actualWidth;
		canvas.height = actualHeight;
		// Set CSS size to match
		canvas.style.width = actualWidth + 'px';
		canvas.style.height = actualHeight + 'px';
	  }
	  
	  // Clear canvas
	  ctx.clearRect(0, 0, actualWidth, actualHeight);
  
	  if (regionRef.current) {
		const start = regionRef.current.start;
		const end = regionRef.current.end;
		const totalDuration = wavesurferRef.current.getDuration();
		
		// ✅ FIX: Tính toán vị trí chính xác dựa trên actual width
		const startX = Math.max(0, Math.floor((start / totalDuration) * actualWidth));
		const endX = Math.min(actualWidth, Math.ceil((end / totalDuration) * actualWidth));
  
		console.log("[drawWaveformDimOverlay] Drawing with accurate dimensions:", {
		  actualWidth,
		  actualHeight,
		  startX,
		  endX,
		  regionStart: start.toFixed(3),
		  regionEnd: end.toFixed(3),
		  deleteMode: isDeleteMode
		});
  
		// Set overlay color based on mode
		if (isDeleteMode) {
		  // Delete mode: dim the regions that will be kept (outside selection)
		  ctx.fillStyle = "rgba(100, 116, 139, 0.7)"; // Dark gray overlay
		  
		  // Draw overlay on parts that will be KEPT (outside region)
		  if (startX > 0) {
			ctx.fillRect(0, 0, startX, actualHeight); // Left part
		  }
		  if (endX < actualWidth) {
			ctx.fillRect(endX, 0, actualWidth - endX, actualHeight); // Right part
		  }
		  
		  console.log("[drawWaveformDimOverlay] Delete mode - dimmed keep areas accurately");
		} else {
		  // Normal mode: dim the parts outside selection
		  ctx.fillStyle = "rgba(100, 116, 139, 0.8)"; // Darker overlay for better contrast
		  
		  // Draw overlay on parts OUTSIDE region
		  if (startX > 0) {
			ctx.fillRect(0, 0, startX, actualHeight); // Left part (outside region)
		  }
		  if (endX < actualWidth) {
			ctx.fillRect(endX, 0, actualWidth - endX, actualHeight); // Right part (outside region)
		  }
		  
		  console.log("[drawWaveformDimOverlay] Normal mode - dimmed non-selected areas accurately");
		}
	  }
	} catch (error) {
	  console.error("[drawWaveformDimOverlay] Error:", error);
	}
  };




    const handleLoopPlayback = () => {
      if (!wavesurferRef.current || !regionRef.current) return;

      const start = regionRef.current.start;
      const end = regionRef.current.end;

      // === SYNC FIX: Update synchronized position for loop restart ===
      syncPositions(start, "handleLoopPlayback");

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

        wavesurferRef.current.play(start, end);

        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        animationFrameRef.current = requestAnimationFrame(updateRealtimeVolume);
      }, 50);
    };

    const handlePlaybackEnd = () => {
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
        return;
      }

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
        resetToRegionStart("handlePlaybackEnd_force");
      } catch (error) {
        console.error("[handlePlaybackEnd] Exception:", error);
      } finally {
        // Unlock handler
        setTimeout(() => {
          isEndingPlaybackRef.current = false;
        }, 100);
      }
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
        // Only log significant corrections (>0.5s drift)
        if (Math.abs(currentPos - regionStart) > 0.5) {
          console.warn(`[updateRealtimeVolume] Position correction: ${currentPos.toFixed(3)}s → ${regionStart.toFixed(3)}s`);
        }
        
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
  
  // Only log when significant bounds violations occur
  const isOutOfBounds = currentPos < regionStart || currentPos >= regionEnd;
  
  // If position is outside bounds, correct it
  if (isOutOfBounds) {
    // Only log significant position corrections
    const drift = Math.min(Math.abs(currentPos - regionStart), Math.abs(currentPos - regionEnd));
    if (drift > 0.5) {
      console.log(`[ensurePlaybackWithinBounds] Position outside bounds - correcting to region start`);
    }
    
    // Stop current playback
    wavesurferRef.current.pause();
    
    // Seek to region start
    const totalDuration = wavesurferRef.current.getDuration();
    wavesurferRef.current.seekTo(regionStart / totalDuration);
    
    // Restart playback from region start to end
    setTimeout(() => {
      if (wavesurferRef.current && regionRef.current && isPlaying) {
        wavesurferRef.current.play(regionStart, regionEnd);
        
        // Update position references
        syncPositions(regionStart, "ensurePlaybackWithinBounds");
        updateVolume(regionStart, true, true);
      }
    }, 50);
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
		  waveColor: "#0984e3",
		  progressColor: "#2563eb", 
		  height: 120,
		  responsive: true,
		  cursorColor: colors[theme].cursorColor,
		  backend: "WebAudio",
		  volume: Math.min(1, volume),
		  barWidth: 2,
		  barGap: 1,
		  barRadius: 3,
		  normalize: normalizeAudio,
		  // ✅ FIXED: Use simple bar height for reliable waveform display
		  barHeight: 1,
		});
		
		console.log('[WaveSurfer] Created with standard waveform display');
	  
    const handleWaveformClick = (e) => {
      try {
        if (!wavesurferRef.current || !regionRef.current) return;
    
        const rect = waveformRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickTime = (clickX / rect.width) * wavesurferRef.current.getDuration();
    
        const currentStart = regionRef.current.start;
        const currentEnd = regionRef.current.end;
        const wasPlaying = isPlaying;
        const currentTime = wavesurferRef.current.getCurrentTime();
    
        // Set click flags fresh (ignore previous state)
        clickSourceRef.current = "click";
        regionChangeSourceRef.current = "click";
    
        if (clickTime < currentStart) {
          console.log("[handleWaveformClick] Expanding region start");
    
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
    
          setTimeout(() => {
            updateDisplayValues("click_expand_start");
          }, 100);
          
        } else if (clickTime > currentEnd + 0.1) {
          console.log("[handleWaveformClick] Expanding region end");
    
          // Set flags for UI update
          isClickUpdatingEndRef.current = true;
          lastClickEndTimeRef.current = clickTime;
    
          if (endUpdateTimeoutRef.current) {
            clearTimeout(endUpdateTimeoutRef.current);
            endUpdateTimeoutRef.current = null;
          }
    
          const previewPosition = calculatePreviewPosition(clickTime, currentTime);
    
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
            requestAnimationFrame(() => {
              if (wavesurferRef.current && isPlaying) {
                wavesurferRef.current.play(previewPosition, clickTime);
              }
            });
          }
    
          setTimeout(() => {
            updateDisplayValues("click_expand_end");
          }, 100);
    
          // Clear flags with delay
          setTimeout(() => {
            isClickUpdatingEndRef.current = false;
            lastClickEndTimeRef.current = null;
            clickSourceRef.current = null;
            regionChangeSourceRef.current = null;
          }, 150);
          
        } else {
          // Click within region - seeking only
          const totalDuration = wavesurferRef.current.getDuration();
          wavesurferRef.current.seekTo(clickTime / totalDuration);
          syncPositions(clickTime, "handleWaveformClickWithin");
          updateVolume(clickTime, true, true);
    
          // UI only update for within-region clicks (NO history save)
          onRegionChange(currentStart, currentEnd, false, 'click_within_ui');
    
          setTimeout(() => {
            drawVolumeOverlay(true);
          }, 50);
    
          setTimeout(() => {
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
	  
		wavesurferRef.current = ws;
	  
		ws.on("ready", () => {
		  const dur = ws.getDuration();
		  setDuration(dur);
		  setLoading(false);
	  
		  const plugin = ws.registerPlugin(
			RegionsPlugin.create({
			  dragSelection: true,
			  color: isDeleteMode
				? "rgba(239, 68, 68, 0.2)" // Giữ nguyên cho delete mode
				: "transparent", // ✅ THAY ĐỔI: Bỏ background xanh nhạt, dùng transparent
			  handleStyle: {
				borderColor: isDeleteMode
				  ? "rgba(239, 68, 68, 0.8)"
				  : "transparent", // ✅ XÓA BORDER: Từ "#0984e3" thành "transparent"
				backgroundColor: isDeleteMode
				  ? "rgba(239, 68, 68, 0.3)"
				  : "transparent", // ✅ XÓA BACKGROUND: Từ "#0984e3" thành "transparent"
				width: "4px", // ✅ THÊM: Làm dày thanh handle lên 4px (mặc định là 3px)
			  },
			})
		  );
	  
		  regionsPluginRef.current = plugin;
	  
		  // Create region with initial styles
		  regionRef.current = plugin.addRegion({
			start: 0,
			end: dur,
			color: isDeleteMode
			  ? "rgba(239, 68, 68, 0.2)" // Giữ nguyên cho delete mode
			  : "transparent", // ✅ THAY ĐỔI: Bỏ background xanh nhạt
			handleStyle: {
			  borderColor: isDeleteMode
				? "rgba(239, 68, 68, 0.8)"
				: "transparent", // ✅ XÓA BORDER: Từ "#0984e3" thành "transparent"
			  backgroundColor: isDeleteMode
				? "rgba(239, 68, 68, 0.3)"
				: "transparent", // ✅ XÓA BACKGROUND: Từ "#0984e3" thành "transparent"
			  width: "4px", // ✅ THÊM: Làm dày thanh handle lên 4px (mặc định là 3px)
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
				console.log("[handleMouseInteraction] Mouse interaction completed");
				getDebouncedStyleUpdate()();
			  };
	  
			  // Optimized realtime drag handler với transparent background
			  const handleMouseMove = (e) => {
				if (!e || typeof e.buttons === 'undefined') {
				  console.warn('[handleMouseMove] Invalid event object:', e);
				  return;
				}
				
				if (e.buttons !== 1 || !regionRef.current?.element) return;
				
				const regionElement = regionRef.current.element;
				console.log(`[mousemove] 🎯 Realtime drag - applying ${isDeleteMode ? 'RED' : 'TRANSPARENT'} color`);
				
				const bgColor = isDeleteMode ? 'rgba(239, 68, 68, 0.2)' : 'transparent';
				const borderStyle = isDeleteMode ? '2px solid rgba(239, 68, 68, 0.8)' : 'none'; // ✅ XÓA BORDER: Từ '2px solid #0984e3' thành 'none'
				
				if (regionElement.style.backgroundColor !== bgColor) {
				  regionElement.style.backgroundColor = bgColor;
				  regionElement.style.border = borderStyle;
				  
				  const regionElements = regionElement.getElementsByClassName('wavesurfer-region');
				  for (let i = 0; i < regionElements.length; i++) {
					const el = regionElements[i];
					el.style.backgroundColor = bgColor;
					el.style.border = borderStyle;
				  }
				  
				  console.log("[mousemove] Background set to:", bgColor);
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
				throttledFunc(event);
			  });
			  element.addEventListener('mousedown', () => {
				console.log(`[mousedown] Drag started - current mode: ${isDeleteMode ? 'DELETE' : 'NORMAL'}`);
				
				// Đảm bảo background transparent ngay khi bắt đầu drag cho normal mode
				if (!isDeleteMode && regionRef.current?.element) {
				  const regionElement = regionRef.current.element;
				  regionElement.style.backgroundColor = 'transparent';
				  console.log("[mousedown] Normal mode - forced background to transparent");
				  
				  // Force update child elements too
				  const regionElements = regionElement.getElementsByClassName('wavesurfer-region');
				  Array.from(regionElements).forEach(el => {
					el.style.backgroundColor = 'transparent';
				  });
				}
				
				requestAnimationFrame(updateRegionStyles);
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
			  if (!isPlaying) {
				return;
			  }
	  
			  if (loop) {
				handleLoopPlayback();
			  } else {
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
			if (!dragStartRegionRef.current && regionRef.current) {
			  dragStartRegionRef.current = {
				start: regionRef.current.start,
				end: regionRef.current.end,
				timestamp: Date.now()
			  };
			  console.log(`[UPDATE-START] 📍 Captured initial region: ${dragStartRegionRef.current.start.toFixed(4)}s - ${dragStartRegionRef.current.end.toFixed(4)}s`);
			}
			
			// CRITICAL: Force region style update ngay lập tức với transparent background
			if (regionRef.current && regionRef.current.element) {
			  const regionElement = regionRef.current.element;
			  
			  requestAnimationFrame(() => {
				if (!regionRef.current?.element) return;
				
				console.log("[UPDATE] Forcing transparent background for normal mode, deleteMode:", isDeleteMode);
				
				const bgColor = isDeleteMode ? 'rgba(239, 68, 68, 0.2)' : 'transparent';
				const borderStyle = isDeleteMode ? '2px solid rgba(239, 68, 68, 0.8)' : 'none'; // ✅ XÓA BORDER: Từ '2px solid #0984e3' thành 'none'
				
				regionElement.style.backgroundColor = bgColor;
				regionElement.style.border = borderStyle;
				
				const regionElements = regionElement.getElementsByClassName('wavesurfer-region');
				for (let i = 0; i < regionElements.length; i++) {
				  const el = regionElements[i];
				  el.style.backgroundColor = bgColor;
				  el.style.border = borderStyle;
				}
				
				console.log("[UPDATE] Region background forced to:", bgColor);
			  });
			}
			
			isDraggingRegionRef.current = true;
	  
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
	  
			console.log(`[Region Update] Updating display values during drag: ${newStart.toFixed(4)}s - ${newEnd.toFixed(4)}s`);
			updateDisplayValues("region_update_drag");
	  
			regionChangeSourceRef.current = "drag";
	  
			const isDraggingStart = newStart !== lastRegionStartRef.current;
			const isDraggingEnd = newEnd !== lastRegionEndRef.current;
	  
			lastRegionStartRef.current = newStart;
			lastRegionEndRef.current = newEnd;
	  
			onRegionChange(newStart, newEnd, false, 'drag_realtime');
			
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
	  
			// Force region style update during drag với transparent background
			if (regionRef.current && regionRef.current.element) {
			  const regionElement = regionRef.current.element;
			  
			  console.log("[UPDATE-FINAL] Applying final drag styles, deleteMode:", isDeleteMode);
			  
			  if (isDeleteMode) {
				regionElement.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
				regionElement.style.border = '2px solid rgba(239, 68, 68, 0.8)';
				
				const regionElements = regionElement.getElementsByClassName('wavesurfer-region');
				Array.from(regionElements).forEach(el => {
				  el.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
				  el.style.border = '2px solid rgba(239, 68, 68, 0.8)';
				});
			  } else {
				regionElement.style.backgroundColor = 'transparent';
				regionElement.style.border = 'none'; // ✅ XÓA BORDER: Từ '2px solid #0984e3' thành 'none'
				
				const regionElements = regionElement.getElementsByClassName('wavesurfer-region');
				Array.from(regionElements).forEach(el => {
				  el.style.backgroundColor = 'transparent';
				  el.style.border = 'none'; // ✅ XÓA BORDER: Từ '2px solid #0984e3' thành 'none'
				});
				
				console.log("[UPDATE-FINAL] Normal mode - background set to transparent");
			  }
			}
	  
			throttledDrawRef.current();
	  
			// ✅ NEW: Force waveform redraw when region changes
			// setTimeout(() => {
			//   if (wavesurferRef.current && wavesurferRef.current.drawBuffer) {
			//     console.log('[Region Update] Redrawing waveform bars for new region');
			//     wavesurferRef.current.drawBuffer();
			//   }
			// }, 50);
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
	  
			// ✅ NEW: Force waveform redraw after update-end
			setTimeout(() => {
			  if (wavesurferRef.current && wavesurferRef.current.drawBuffer) {
				console.log('[Update-End] Redrawing waveform bars after region update');
				wavesurferRef.current.drawBuffer();
			  }
			}, 100);
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
		  if (loop && regionRef.current) {
			handleLoopPlayback();
		  } else {
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
	  
		// ✅ TEMPORARY: Debug CSS và waveform visibility
		setTimeout(() => {
		  console.log('[DEBUG] Checking waveform visibility...');
		  const waveformContainer = waveformRef.current;
		  if (waveformContainer) {
			const rect = waveformContainer.getBoundingClientRect();
			console.log('[DEBUG] Waveform container dimensions:', {
			  width: rect.width,
			  height: rect.height,
			  visible: rect.width > 0 && rect.height > 0
			});
			
			// Check for canvas elements
			const canvases = waveformContainer.querySelectorAll('canvas');
			console.log('[DEBUG] Found canvases:', canvases.length);
			canvases.forEach((canvas, index) => {
			  console.log(`[DEBUG] Canvas ${index}:`, {
				width: canvas.width,
				height: canvas.height,
				style: canvas.style.cssText,
				hidden: canvas.hidden
			  });
			});
			
			// Check if waveform has data
			if (wavesurferRef.current) {
			  console.log('[DEBUG] WaveSurfer state:', {
				duration: wavesurferRef.current.getDuration(),
				isReady: wavesurferRef.current.isReady?.() || 'unknown'
			  });
			}
		  }
		}, 1000);
	  
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
	  }, [audioFile, theme, onTimeUpdate]); // Many functions are stable and don't need dependencies

	  useEffect(() => {
		console.log(`[fadeEffect] TRIGGERED - fadeIn: ${fadeIn}, fadeOut: ${fadeOut}, isPlaying: ${isPlaying}`);
	  
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
	  
		  // ✅ NEW: Force waveform redraw when fade changes
		  setTimeout(() => {
			if (wavesurferRef.current && wavesurferRef.current.drawBuffer) {
			  console.log('[Fade Change] Redrawing waveform bars for fade effect');
			  wavesurferRef.current.drawBuffer();
			}
		  }, 100);
	  
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
	  }, [fadeIn, fadeOut, isPlaying]);



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



    useEffect(() => {
      if (regionRef.current && regionRef.current.start !== undefined && regionRef.current.end !== undefined) {
        const newStart = regionRef.current.start;
        const newEnd = regionRef.current.end;
    
        // Update display states
        setDisplayRegionStart(formatDisplayTime(newStart));
        setDisplayRegionEnd(formatDisplayTime(newEnd));
        // Update numeric values for tooltips
        setRegionStartTime(newStart);
        setRegionEndTime(newEnd);
      }
    }, [regionRef.current, duration]);
    

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
	  
		  {/* INTEGRATED WAVEFORM + CONTROLS */}
		  <div className="bg-gradient-to-br from-slate-50 to-blue-50/30 rounded-xl border border-slate-200/60 shadow-lg relative">
			{/* Header with integrated controls */}
			<div className="bg-white/60 backdrop-blur-sm border-b border-slate-200/40 px-4 py-3">
			  <div className="flex items-center justify-between gap-4">
				{/* Left: Current Time */}
				<div className="flex items-center gap-2 min-w-[100px]">
				  <Clock className="w-4 h-4 text-blue-600 flex-shrink-0" />
				  <div className="font-mono text-slate-700 font-semibold text-sm">
					{formatTime(currentTime)} / {formatTime(duration)}
				  </div>
				</div>
	  
				{/* Center: Time Steppers - Compact */}
				<div className="flex items-center gap-3 bg-white/80 rounded-lg px-3 py-2 border border-slate-200/60 shadow-sm">
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
				  
				  <div className="w-px h-6 bg-slate-300"></div>
				  
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
	  
				{/* Right: Volume */}
				<div className="flex items-center gap-2 min-w-[80px] justify-end">
				  <svg
					xmlns="http://www.w3.org/2000/svg"
					className="h-4 w-4 text-emerald-600 flex-shrink-0"
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
				  <div className="font-mono text-slate-700 font-semibold text-sm">
					{currentVolumeDisplay.toFixed(2)}x
				  </div>
				</div>
			  </div>
			</div>
			
			{/* TOOLTIPS POSITIONED RELATIVE TO WAVEFORM CONTAINER */}
			{audioFile && (
			  <div className="absolute w-full pointer-events-none" style={{ top: '80px', left: '0px', zIndex: 999999 }}>
				{/* Region Start Time Tooltip - Green Background */}
				{regionStartTime !== undefined && (
				  <div 
					className="absolute bg-green-600 text-white text-xs font-mono px-1 py-0.5 rounded-md shadow-lg border border-green-500"
					style={{
					  left: `calc(12px + ${(regionStartTime / (wavesurferRef.current?.getDuration() || 1)) * (100 - 2.4)}%)`,
					  top: '0px',
					  transform: 'translateX(-50%)',
					  zIndex: 999999,
					  fontSize: '10px',
					  pointerEvents: 'none'
					}}
				  >
					{displayRegionStart}
					<div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-green-600 rotate-45 border-l border-b border-green-500"></div>
				  </div>
				)}
	  
				{/* Region End Time Tooltip - Green Background */}
				{regionEndTime !== undefined && (
				  <div 
					className="absolute bg-green-600 text-white text-xs font-mono px-1 py-0.5 rounded-md shadow-lg border border-green-500"
					style={{
					  left: `calc(12px + ${(regionEndTime / (wavesurferRef.current?.getDuration() || 1)) * (100 - 2.4)}%)`,
					  top: '0px',
					  transform: 'translateX(-50%)',
					  zIndex: 999999,
					  fontSize: '10px',
					  pointerEvents: 'none'
					}}
				  >
					{displayRegionEnd}
					<div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-green-600 rotate-45 border-l border-b border-green-500"></div>
				  </div>
				)}
	  
				{/* Region Duration Display - Text Only */}
				{regionStartTime !== undefined && regionEndTime !== undefined && (
				  <div 
					className="absolute text-emerald-600 font-mono font-bold drop-shadow-lg"
					style={{
					  left: `calc(12px + ${((regionStartTime + regionEndTime) / 2) / (wavesurferRef.current?.getDuration() || 1) * (100 - 2.4)}%)`,
					  bottom: '-120px',
					  transform: 'translateX(-50%)',
					  zIndex: 999999,
					  fontSize: '12px',
					  textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
					  pointerEvents: 'none'
					}}
				  >
					{formatDurationTime(regionEndTime - regionStartTime)}
				  </div>
				)}
	  
				{/* Current Playback Time Tooltip - Text Only */}
				{isPlaying && currentPosition !== undefined && (
				  <div 
					className="absolute text-orange-600 font-mono font-bold drop-shadow-lg animate-pulse"
					style={{
					  left: `calc(12px + ${(currentPosition / (wavesurferRef.current?.getDuration() || 1)) * (100 - 2.4)}%)`,
					  top: '25px',
					  transform: 'translateX(-50%)',
					  zIndex: 999999,
					  fontSize: '12px',
					  textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
					  pointerEvents: 'none'
					}}
				  >
					{formatDisplayTime(currentPosition)}
				  </div>
				)}
			  </div>
			)}
			
			{/* Waveform Section */}
			<div 
			  className="relative bg-gradient-to-b from-slate-900 to-slate-800 p-3"
			  style={{ minHeight: '140px' }}
			>
			  {/* Waveform element */}
			  <div ref={waveformRef} className="w-full h-full rounded-lg overflow-hidden" />
			  
			  {/* Canvas che mờ phần ngoài region trên waveform */}
			  <canvas
				ref={waveformDimOverlayRef}
				width={1000}
				height={120}
				className="absolute top-3 left-3 right-3 bottom-3 w-[calc(100%-24px)] h-[calc(100%-24px)] rounded-lg pointer-events-none"
				style={{ zIndex: 10, pointerEvents: "none" }}
			  />
			</div>
	  
			{/* Volume Overlay Section - Integrated */}
			<div className="bg-gradient-to-r from-slate-50/80 to-blue-50/40 border-t border-slate-200/40 p-3">
			  <div className="relative">
				<canvas
				  ref={overlayRef}
				  width={1000}
				  height={50}
				  className={`w-full border border-slate-200/60 rounded-lg bg-gradient-to-r from-white to-blue-50/30 shadow-inner ${
					isDeleteMode ? "waveform-delete-canvas" : ""
				  }`}
				  style={{ zIndex: 1, pointerEvents: "none" }}
				/>
				{/* Canvas che mờ phần ngoài region */}
				<canvas
				  ref={dimOverlayRef}
				  width={1000}
				  height={50}
				  className="absolute top-0 left-0 w-full h-full rounded-lg pointer-events-none"
				  style={{ zIndex: 2, pointerEvents: "none" }}
				/>
			  </div>
			</div>
		  </div>
	  
		  <div className="space-y-3">
			{/* Add any additional content you want to render here */}
		  </div>
		</div>
	  );
  }
);

export default WaveformSelector;
