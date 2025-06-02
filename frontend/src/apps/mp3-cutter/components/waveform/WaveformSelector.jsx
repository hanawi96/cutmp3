import React, {
  useState,
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useCallback,
  useMemo,
} from "react";
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
  PERFORMANCE_CONFIG,
} from "./constants/waveformConstants.js";
// ✅ BƯỚC 2: Import utils functions từ files mới
import { throttle, debounce } from "./utils/throttleDebounce.js";
import {
  formatTime,
  formatDisplayTime,
  formatDurationTime,
} from "./utils/timeFormatters.js";
import { calculatePreviewPosition } from "./utils/audioUtils.js";
// ✅ BƯỚC 3: Import services từ files mới
import { calculateVolumeForProfile } from "./services/volumeCalculator.js";
import { createPositionSynchronizer } from "./services/positionSynchronizer.js";
import {
  drawVolumeOverlay as drawVolumeOverlayService,
  drawWaveformDimOverlay as drawWaveformDimOverlayService,
  updateRegionStyles as updateRegionStylesService,
} from "./services/canvasRenderer.js";
// ✅ BƯỚC 4: Import custom hooks
import { useWaveformState } from "./hooks/useWaveformState.js";
import { useVolumeControl } from "./hooks/useVolumeControl.js";
import { usePlaybackControl } from "./hooks/usePlaybackControl.js";
import { useRegionManagement } from "./hooks/useRegionManagement.js";

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
    // ✅ BƯỚC 4: Sử dụng useWaveformState hook
    // ✅ CORRECT ORDER: Thứ tự đúng để tránh temporal dead zone

    // 1. KHỞI TẠO STATE VÀ REFS
    console.log("[WaveformSelector] Initializing with useWaveformState");
    const { state, setters, refs } = useWaveformState({
      removeMode,
      volume,
      fadeInDuration,
      fadeOutDuration,
      fade,
      fadeIn,
      fadeOut,
      volumeProfile,
      customVolume,
    });

    // 2. DESTRUCTURE STATE VÀ SETTERS
    const {
      isDeleteMode,
      deletePreview,
      isPlaying,
      currentTime,
      duration,
      currentVolumeDisplay,
      loading,
      fadeInDurationState,
      fadeOutDurationState,
      displayRegionStart,
      displayRegionEnd,
      currentPosition,
      regionStartTime,
      regionEndTime,
    } = state;

    const {
      setIsDeleteMode,
      setDeletePreview,
      setIsPlaying,
      setCurrentTime,
      setDuration,
      setCurrentVolumeDisplay,
      setLoading,
      setFadeInDurationState,
      setFadeOutDurationState,
      setDisplayRegionStart,
      setDisplayRegionEnd,
      setCurrentPosition,
      setRegionStartTime,
      setRegionEndTime,
    } = setters;

    // 3. DESTRUCTURE REFS
    const {
      waveformRef,
      overlayRef,
      dimOverlayRef,
      waveformDimOverlayRef,
      wavesurferRef,
      regionRef,
      regionsPluginRef,
      animationFrameRef,
      lastPositionRef,
      currentVolumeRef,
      drawTimerRef,
      currentProfileRef,
      fadeEnabledRef,
      fadeTimeRef,
      intendedVolumeRef,
      isDrawingOverlayRef,
      throttledDrawRef,
      customVolumeRef,
      fadeInDurationRef,
      fadeOutDurationRef,
      lastRegionStartRef,
      lastRegionEndRef,
      throttledFunctionsRef,
      clickSourceRef,
      removeModeRef,
      isClickUpdatingEndRef,
      isDragUpdatingEndRef,
      lastDragEndTimeRef,
      isRealtimeDragSeekingRef,
      lastRealtimeSeekTimeRef,
      realtimeSeekThrottleRef,
      positionSynchronizer,
      lastDrawPositionRef,
      syncPositionRef,
      lastSyncTimeRef,
      isSyncingRef,
      fadeInRef,
      fadeOutRef,
      regionChangeSourceRef,
      justUpdatedEndByClickRef,
      endUpdateTimeoutRef,
      lastClickEndTimeRef,
      dragStartRegionRef,
      overlayAnimationFrameRef,
      lastDrawTimeRef,
      isRegionUpdatingRef,
      regionUpdateTimeoutRef,
      currentPositionRef,
      isDraggingRef,
      isEndingPlaybackRef,
      isDraggingRegionRef,
    } = refs;

    // 4. INITIALIZE POSITION SYNCHRONIZER
useEffect(() => {
    console.log('[WaveformSelector] Initializing positionSynchronizer');
    positionSynchronizer.current = createPositionSynchronizer();
    console.log('[WaveformSelector] positionSynchronizer initialized:', positionSynchronizer.current);
  }, []);

      // 6. DEFINE BASIC WRAPPER FUNCTIONS
      const syncPositions = useCallback(
        (newPosition, source = "unknown") => {
          console.log("[syncPositions] Called with:", newPosition, source);
  
          if (!positionSynchronizer.current) {
            console.error("[syncPositions] positionSynchronizer not initialized");
            return;
          }
  
          const callbacks = {
            syncPositionRef,
            currentPositionRef,
            lastPositionRef,
            setCurrentTime,
            onTimeUpdate,
            setCurrentPosition,
          };
  
          console.log(
            "[syncPositions] Calling positionSynchronizer.syncPositions"
          );
          positionSynchronizer.current.syncPositions(
            newPosition,
            source,
            callbacks
          );
          console.log("[syncPositions] Completed successfully");
        },
        [onTimeUpdate, setCurrentTime, setCurrentPosition]
      );

// 6. DEFINE CONSTANTS
const colors = WAVEFORM_COLORS;
const DRAW_INTERVAL = TIMING_CONSTANTS.DRAW_INTERVAL;
const PREVIEW_TIME_BEFORE_END = TIMING_CONSTANTS.PREVIEW_TIME_BEFORE_END;

// 7. KHỞI TẠO VOLUME CONTROL
console.log('[WaveformSelector] Initializing useVolumeControl');
const volumeControlDependencies = useMemo(() => ({
  syncPositions,
  drawVolumeOverlay: null // Will be populated later
}), [syncPositions]);

const { updateVolume, calculateVolumeForProfileWrapper } = useVolumeControl(
  refs,
  state,
  setters,
  { volumeProfile, volume, customVolume, fade, fadeIn, fadeOut },
  volumeControlDependencies
);


    // 8. DEFINE DRAW FUNCTIONS AFTER VOLUME CONTROL
    const drawWaveformDimOverlay = useCallback(
      (forceRedraw = false) => {
        console.log(
          "[drawWaveformDimOverlay] Wrapper called with forceRedraw:",
          forceRedraw
        );

        if (
          !waveformDimOverlayRef.current ||
          !regionRef.current ||
          !wavesurferRef.current ||
          !waveformRef.current
        ) {
          console.log("[drawWaveformDimOverlay] Missing refs, skipping");
          return;
        }

        const config = {
          waveformDimOverlayRef,
          waveformRef,
          lastDrawTimeRef,
          isDeleteMode,
          forceRedraw,
        };

        console.log("[drawWaveformDimOverlay] Calling service with config");
        drawWaveformDimOverlayService(
          waveformDimOverlayRef,
          regionRef,
          wavesurferRef,
          config
        );
      },
      [isDeleteMode]
    );

    const drawVolumeOverlay = useCallback(
      (forceRedraw = false) => {
        console.log(
          "[drawVolumeOverlay] Wrapper called with forceRedraw:",
          forceRedraw
        );

        if (
          !overlayRef.current ||
          !regionRef.current ||
          !wavesurferRef.current
        ) {
          console.log("[drawVolumeOverlay] Missing refs, skipping");
          return;
        }

        const config = {
          overlayRef,
          theme,
          isDrawingOverlayRef,
          lastDrawTimeRef,
          drawTimerRef,
          isDraggingRef,
          currentProfileRef,
          currentVolumeRef,
          isPlaying,
          fadeEnabledRef,
          fadeInRef,
          fadeOutRef,
          isClickUpdatingEndRef,
          lastClickEndTimeRef,
          syncPositionRef,
          lastSyncTimeRef,
          lastDrawPositionRef,
          colors,
          calculateVolumeForProfile: calculateVolumeForProfileWrapper,
          drawWaveformDimOverlay,
          forceRedraw,
        };

        console.log("[drawVolumeOverlay] Calling service with config");
        drawVolumeOverlayService(overlayRef, regionRef, wavesurferRef, config);
      },
      [
        theme,
        isPlaying,
        isDeleteMode,
        calculateVolumeForProfileWrapper,
        drawWaveformDimOverlay,
      ]
    );

  // 8.1. CẬP NHẬT VOLUME CONTROL DEPENDENCIES
  volumeControlDependencies.drawVolumeOverlay = drawVolumeOverlay;
  
  // 9. KHỞI TẠO PLAYBACK CONTROL
  console.log("[WaveformSelector] Initializing usePlaybackControl");
    const playbackControlDependencies = useMemo(
      () => ({
        syncPositions,
        updateVolume,
        onTimeUpdate,
        drawVolumeOverlay,
      }),
      [syncPositions, updateVolume, onTimeUpdate, drawVolumeOverlay]
    );

    const {
      togglePlayPause,
      handlePlaybackEnd,
      handleLoopPlayback,
      updateRealtimeVolume,
      verifyPlaybackState,
      ensurePlaybackWithinBounds,
    } = usePlaybackControl(
      refs,
      state,
      setters,
      { loop, onPlayStateChange, onPlayEnd, volumeProfile },
      playbackControlDependencies
    );

    // 10. KHỞI TẠO REGION MANAGEMENT
    console.log("[WaveformSelector] Initializing useRegionManagement");
    const regionManagementDependencies = useMemo(
      () => ({
        syncPositions,
        updateVolume,
        drawVolumeOverlay,
        onRegionChange,
        isPlaying: state.isPlaying,
      }),
      [
        syncPositions,
        updateVolume,
        drawVolumeOverlay,
        onRegionChange,
        state.isPlaying,
      ]
    );

    const { updateDisplayValues, handleWaveformClick } = useRegionManagement(
      refs,
      state,
      setters,
      regionManagementDependencies
    );

    // 11. DEBUG LOG SAU KHI TẤT CẢ ĐƯỢC ĐỊNH NGHĨA
    console.log("[WaveformSelector] Function availability check:", {
      updateRealtimeVolume: typeof updateRealtimeVolume,
      verifyPlaybackState: typeof verifyPlaybackState,
      ensurePlaybackWithinBounds: typeof ensurePlaybackWithinBounds,
      updateDisplayValues: typeof updateDisplayValues,
      handleWaveformClick: typeof handleWaveformClick,
      togglePlayPause: typeof togglePlayPause,
      handlePlaybackEnd: typeof handlePlaybackEnd,
      handleLoopPlayback: typeof handleLoopPlayback,
    });

    // 12. CÁC HELPER FUNCTIONS
    const forceWaveformRedraw = useCallback(() => {
      console.log("[forceWaveformRedraw] Forcing waveform bars update");

      if (wavesurferRef.current) {
        try {
          const currentTime = wavesurferRef.current.getCurrentTime();
          const totalDuration = wavesurferRef.current.getDuration();

          if (totalDuration > 0) {
            const currentProgress = currentTime / totalDuration;
            wavesurferRef.current.seekTo(currentProgress);
            console.log(
              "[forceWaveformRedraw] Waveform bars updated successfully"
            );
          }
        } catch (error) {
          console.error("[forceWaveformRedraw] Error updating bars:", error);
        }
      }
    }, []);

    console.log("[WaveformSelector] All functions initialized successfully");



    const updateRegionStyles = useCallback(() => {
      console.log(
        "[updateRegionStyles] Called with isDeleteMode:",
        isDeleteMode
      );
      updateRegionStylesService(regionRef, isDeleteMode);

      // ✅ THÊM: Cập nhật lớp che mờ trên waveform khi style thay đổi
      setTimeout(() => {
        console.log(
          "[updateRegionStyles] Calling drawWaveformDimOverlay after style update"
        );
        drawWaveformDimOverlay(true);
      }, 10);
    }, [isDeleteMode, drawWaveformDimOverlay]);

    const getThrottledFunction = useCallback(
      (funcName, originalFunc, delay) => {
        if (!throttledFunctionsRef.current[funcName]) {
          throttledFunctionsRef.current[funcName] = throttle(
            originalFunc,
            delay
          );
        }
        return throttledFunctionsRef.current[funcName];
      },
      []
    );

    // Helper functions để get throttled versions
    const getThrottledUpdateRegionStyles = useCallback(() => {
      return getThrottledFunction(
        "updateRegionStyles",
        updateRegionStyles,
        PERFORMANCE_CONFIG.THROTTLE_DELAY
      );
    }, [getThrottledFunction, updateRegionStyles]);

    const getThrottledDraw = useCallback(() => {
      return getThrottledFunction(
        "drawVolumeOverlay",
        () => drawVolumeOverlay(),
        PERFORMANCE_CONFIG.THROTTLE_DELAY
      );
    }, [getThrottledFunction, drawVolumeOverlay]);

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
          const wsInRegion =
            currentWsPosition >= regionStart && currentWsPosition <= regionEnd;
          const syncedInRegion =
            syncedPos >= regionStart && syncedPos <= regionEnd;
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

        if (isPlaying && typeof updateRealtimeVolume === "function") {
          animationFrameRef.current =
            requestAnimationFrame(updateRealtimeVolume);
        }

        drawVolumeOverlay();
      }
    }, [
      volumeProfile,
      volume,
      customVolume,
      fade,
      isPlaying,
      drawVolumeOverlay,
    ]);

    // Thêm useEffect mới để theo dõi thay đổi của customVolume
    useEffect(() => {
      if (
        volumeProfile === "custom" &&
        wavesurferRef.current &&
        regionRef.current
      ) {
        const updateVolumeAndOverlay = () => {
          const throttledUpdate = getThrottledFunction(
            "volumeAndOverlayUpdate",
            () => {
              const currentPos = isPlaying
                ? wavesurferRef.current.getCurrentTime()
                : regionRef.current.start;
              syncPositions(currentPos, "customVolumeChange");
              updateVolume(currentPos, true, true);
              drawVolumeOverlay();
            },
            16
          );

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
      drawVolumeOverlay,
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
    }, [fadeInDuration, drawVolumeOverlay]); // Functions are stable

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
    }, [fadeOutDuration, drawVolumeOverlay]); // Functions are stable

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
          console.log(
            `[togglePlayPause] Starting playback with profile: ${currentProfileRef.current}, isFadeIn: ${isFadeInProfile}`
          );

          syncPositions(playFrom, "togglePlayPausePlay");
          updateVolume(playFrom, true, true);

          // ENHANCED: Force immediate volume update for fadeIn to prevent silence
          if (isFadeInProfile) {
            console.log(
              `[togglePlayPause] FADEIN: Forcing immediate volume update at position ${playFrom.toFixed(
                4
              )}s`
            );

            // Force multiple volume updates to ensure it takes effect
            setTimeout(() => {
              if (wavesurferRef.current && regionRef.current) {
                const currentPos = wavesurferRef.current.getCurrentTime();
                console.log(
                  `[togglePlayPause] FADEIN: Second volume update at position ${currentPos.toFixed(
                    4
                  )}s`
                );
                updateVolume(currentPos, true, true);
                drawVolumeOverlay(true);
              }
            }, 50);

            setTimeout(() => {
              if (wavesurferRef.current && regionRef.current) {
                const currentPos = wavesurferRef.current.getCurrentTime();
                console.log(
                  `[togglePlayPause] FADEIN: Third volume update at position ${currentPos.toFixed(
                    4
                  )}s`
                );
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
        console.log("[TOGGLE_FADE] =================");
        console.log(
          "[TOGGLE_FADE] Called with fadeIn:",
          fadeInState,
          "fadeOut:",
          fadeOutState
        );
        console.log("[TOGGLE_FADE] Previous states:");
        console.log("[TOGGLE_FADE] - fadeInRef.current:", fadeInRef.current);
        console.log("[TOGGLE_FADE] - fadeOutRef.current:", fadeOutRef.current);
        console.log(
          "[TOGGLE_FADE] - fadeEnabledRef.current:",
          fadeEnabledRef.current
        );

        // CRITICAL: Cập nhật refs ngay lập tức
        fadeInRef.current = fadeInState;
        fadeOutRef.current = fadeOutState;
        fadeEnabledRef.current = fadeInState || fadeOutState;

        console.log("[TOGGLE_FADE] Updated refs:");
        console.log("[TOGGLE_FADE] - fadeInRef.current:", fadeInRef.current);
        console.log("[TOGGLE_FADE] - fadeOutRef.current:", fadeOutRef.current);
        console.log(
          "[TOGGLE_FADE] - fadeEnabledRef.current:",
          fadeEnabledRef.current
        );

        if (wavesurferRef.current && regionRef.current) {
          // Stop any current animation
          if (isPlaying && updateRealtimeVolume) {
            animationFrameRef.current =
              requestAnimationFrame(updateRealtimeVolume);
          }

          // Determine best position for update
          const wsPosition = wavesurferRef.current.getCurrentTime();
          const syncedPosition = syncPositionRef.current;
          const regionStart = regionRef.current.start;
          const regionEnd = regionRef.current.end;

          let targetPosition;

          if (isPlaying) {
            targetPosition = wsPosition;
            console.log(
              "[TOGGLE_FADE] Playing - using WS position:",
              targetPosition.toFixed(4),
              "s"
            );
          } else {
            const wsInRegion =
              wsPosition >= regionStart && wsPosition <= regionEnd;
            const syncedInRegion =
              syncedPosition >= regionStart && syncedPosition <= regionEnd;

            if (wsInRegion) {
              targetPosition = wsPosition;
              console.log(
                "[TOGGLE_FADE] Not playing - WS position in region:",
                targetPosition.toFixed(4),
                "s"
              );
            } else if (syncedInRegion) {
              targetPosition = syncedPosition;
              console.log(
                "[TOGGLE_FADE] Not playing - synced position in region:",
                targetPosition.toFixed(4),
                "s"
              );
            } else {
              targetPosition = regionStart;
              console.log(
                "[TOGGLE_FADE] Not playing - fallback to region start:",
                targetPosition.toFixed(4),
                "s"
              );
            }
          }

          // CRITICAL: Force immediate position sync và volume update
          syncPositions(targetPosition, "toggleFade");

          // CRITICAL: Force volume recalculation với updated fade states
          console.log(
            "[TOGGLE_FADE] Forcing volume update at position:",
            targetPosition.toFixed(4),
            "s"
          );
          updateVolume(targetPosition, true, true);

          // CRITICAL: Force overlay redraw
          console.log("[TOGGLE_FADE] Forcing overlay redraw");
          drawVolumeOverlay(true);

          // Restart animation if playing
          if (isPlaying && typeof updateRealtimeVolume === "function") {
            animationFrameRef.current =
              requestAnimationFrame(updateRealtimeVolume);
          }

          console.log("[TOGGLE_FADE] ✅ Toggle fade completed successfully");
        } else {
          console.log(
            "[TOGGLE_FADE] ❌ Missing refs - wavesurfer:",
            !!wavesurferRef.current,
            "region:",
            !!regionRef.current
          );
        }

        console.log("[TOGGLE_FADE] =================");
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
        console.log("[getRegionBounds] Called");

        if (!regionRef.current) {
          console.log("[getRegionBounds] No region available, returning null");
          return null;
        }

        const start = regionRef.current.start;
        const end = regionRef.current.end;
        const duration = wavesurferRef.current
          ? wavesurferRef.current.getDuration()
          : 0;

        console.log("[getRegionBounds] Raw values:", { start, end, duration });

        // Validate values
        if (
          typeof start !== "number" ||
          typeof end !== "number" ||
          isNaN(start) ||
          isNaN(end)
        ) {
          console.error("[getRegionBounds] Invalid start or end values:", {
            start,
            end,
          });
          return {
            start: 0,
            end: duration || 0,
          };
        }

        if (start < 0 || end <= 0 || start >= end) {
          console.error("[getRegionBounds] Invalid region bounds:", {
            start,
            end,
          });
          return {
            start: 0,
            end: duration || 0,
          };
        }

        if (duration > 0 && end > duration) {
          console.warn(
            "[getRegionBounds] End time exceeds duration, clamping:",
            { end, duration }
          );
          return {
            start: Math.max(0, start),
            end: duration,
          };
        }

        const result = { start, end };
        console.log("[getRegionBounds] Valid result:", result);
        return result;
      },
      setRegionBounds: (start, end) => {
        console.log(
          `[setRegionBounds] Called with start: ${start}, end: ${end}`
        );

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
          console.error("[setRegionBounds] End time exceeds duration:", {
            end,
            duration,
          });
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
              wavesurferRef.current.fireEvent(
                "region-updated",
                regionRef.current
              );
            }
          }

          console.log(
            `[setRegionBounds] Successfully set region to ${start.toFixed(
              4
            )}s - ${end.toFixed(4)}s`
          );

          // Update position and volume
          const currentPos = wavesurferRef.current.getCurrentTime();
          let targetPos = currentPos;

          // If current position is outside new bounds, move to start
          if (currentPos < start || currentPos > end) {
            targetPos = start;
            const totalDuration = wavesurferRef.current.getDuration();
            wavesurferRef.current.seekTo(targetPos / totalDuration);
            console.log(
              `[setRegionBounds] Moved playhead to region start: ${targetPos.toFixed(
                4
              )}s`
            );
          }

          syncPositions(targetPos, "setRegionBounds");
          updateVolume(targetPos, true, true);
          drawVolumeOverlay(true);

          // ✅ FIX: Update display values after region bounds change
          console.log(
            `[setRegionBounds] Updating display values for undo/redo`
          );
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
        console.log(
          "[ensurePlaybackWithinBounds] Called via imperative handle"
        );
        ensurePlaybackWithinBounds();
      },
    }));

    useEffect(() => {
      let stateVerificationInterval;

      if (isPlaying && typeof verifyPlaybackState === "function") {
        stateVerificationInterval = setInterval(() => {
          verifyPlaybackState();
        }, 2000);
      }
      return () => {
        if (stateVerificationInterval) {
          clearInterval(stateVerificationInterval);
        }
      };
    }, [isPlaying, verifyPlaybackState]);

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

      console.log("[WaveSurfer] Created with standard waveform display");

      console.log(
        "[WaveSurfer] Using handleWaveformClick from useRegionManagement"
      );

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
        console.log("[WS Ready] Region created, updating display values...");
        setTimeout(() => {
          if (regionRef.current) {
            updateDisplayValues("ws_ready_initial");

            // ✅ THÊM: Trigger onRegionChange để đảm bảo parent component được thông báo
            onRegionChange(0, dur, false, "initial_setup");
          }
        }, 100);

        // ✅ THÊM: Backup update sau khi tất cả đã ready
        setTimeout(() => {
          if (regionRef.current) {
            console.log("[WS Ready] Backup display update...");
            updateDisplayValues("ws_ready_backup");
          }
        }, 500);

        // Add handlers for all region interactions
        if (regionRef.current && regionRef.current.on) {
          // Handle region updates (dragging, resizing) - với throttling
          regionRef.current.on("update", () =>
            getThrottledUpdateRegionStyles()()
          );

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
                throttledFunctionsRef.current.debouncedStyleUpdate = debounce(
                  updateRegionStyles,
                  50
                );
              }
              return throttledFunctionsRef.current.debouncedStyleUpdate;
            };

            const handleMouseInteraction = () => {
              console.log(
                "[handleMouseInteraction] Mouse interaction completed"
              );
              getDebouncedStyleUpdate()();
            };

            // Optimized realtime drag handler với transparent background
            const handleMouseMove = (e) => {
              if (!e || typeof e.buttons === "undefined") {
                console.warn("[handleMouseMove] Invalid event object:", e);
                return;
              }

              if (e.buttons !== 1 || !regionRef.current?.element) return;

              const regionElement = regionRef.current.element;
              console.log(
                `[mousemove] 🎯 Realtime drag - applying ${
                  isDeleteMode ? "RED" : "TRANSPARENT"
                } color`
              );

              const bgColor = isDeleteMode
                ? "rgba(239, 68, 68, 0.2)"
                : "transparent";
              const borderStyle = isDeleteMode
                ? "2px solid rgba(239, 68, 68, 0.8)"
                : "none"; // ✅ XÓA BORDER: Từ '2px solid #0984e3' thành 'none'

              if (regionElement.style.backgroundColor !== bgColor) {
                regionElement.style.backgroundColor = bgColor;
                regionElement.style.border = borderStyle;

                const regionElements =
                  regionElement.getElementsByClassName("wavesurfer-region");
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
              return getThrottledFunction(
                "handleMouseMove",
                handleMouseMove,
                16
              );
            };

            // Add event listeners
            element.addEventListener("mouseup", handleMouseInteraction);
            element.addEventListener("mouseleave", handleMouseInteraction);
            element.addEventListener("mousemove", (event) => {
              const throttledFunc = getThrottledMouseMove();
              throttledFunc(event);
            });
            element.addEventListener("mousedown", () => {
              console.log(
                `[mousedown] Drag started - current mode: ${
                  isDeleteMode ? "DELETE" : "NORMAL"
                }`
              );

              // Đảm bảo background transparent ngay khi bắt đầu drag cho normal mode
              if (!isDeleteMode && regionRef.current?.element) {
                const regionElement = regionRef.current.element;
                regionElement.style.backgroundColor = "transparent";
                console.log(
                  "[mousedown] Normal mode - forced background to transparent"
                );

                // Force update child elements too
                const regionElements =
                  regionElement.getElementsByClassName("wavesurfer-region");
                Array.from(regionElements).forEach((el) => {
                  el.style.backgroundColor = "transparent";
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
              timestamp: Date.now(),
            };
            console.log(
              `[UPDATE-START] 📍 Captured initial region: ${dragStartRegionRef.current.start.toFixed(
                4
              )}s - ${dragStartRegionRef.current.end.toFixed(4)}s`
            );
          }

          // CRITICAL: Force region style update ngay lập tức với transparent background
          if (regionRef.current && regionRef.current.element) {
            const regionElement = regionRef.current.element;

            requestAnimationFrame(() => {
              if (!regionRef.current?.element) return;

              console.log(
                "[UPDATE] Forcing transparent background for normal mode, deleteMode:",
                isDeleteMode
              );

              const bgColor = isDeleteMode
                ? "rgba(239, 68, 68, 0.2)"
                : "transparent";
              const borderStyle = isDeleteMode
                ? "2px solid rgba(239, 68, 68, 0.8)"
                : "none"; // ✅ XÓA BORDER: Từ '2px solid #0984e3' thành 'none'

              regionElement.style.backgroundColor = bgColor;
              regionElement.style.border = borderStyle;

              const regionElements =
                regionElement.getElementsByClassName("wavesurfer-region");
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

          console.log(
            `[Region Update] Updating display values during drag: ${newStart.toFixed(
              4
            )}s - ${newEnd.toFixed(4)}s`
          );
          updateDisplayValues("region_update_drag");

          regionChangeSourceRef.current = "drag";

          const isDraggingStart = newStart !== lastRegionStartRef.current;
          const isDraggingEnd = newEnd !== lastRegionEndRef.current;

          lastRegionStartRef.current = newStart;
          lastRegionEndRef.current = newEnd;

          onRegionChange(newStart, newEnd, false, "drag_realtime");

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

            console.log(
              "[UPDATE-FINAL] Applying final drag styles, deleteMode:",
              isDeleteMode
            );

            if (isDeleteMode) {
              regionElement.style.backgroundColor = "rgba(239, 68, 68, 0.2)";
              regionElement.style.border = "2px solid rgba(239, 68, 68, 0.8)";

              const regionElements =
                regionElement.getElementsByClassName("wavesurfer-region");
              Array.from(regionElements).forEach((el) => {
                el.style.backgroundColor = "rgba(239, 68, 68, 0.2)";
                el.style.border = "2px solid rgba(239, 68, 68, 0.8)";
              });
            } else {
              regionElement.style.backgroundColor = "transparent";
              regionElement.style.border = "none"; // ✅ XÓA BORDER: Từ '2px solid #0984e3' thành 'none'

              const regionElements =
                regionElement.getElementsByClassName("wavesurfer-region");
              Array.from(regionElements).forEach((el) => {
                el.style.backgroundColor = "transparent";
                el.style.border = "none"; // ✅ XÓA BORDER: Từ '2px solid #0984e3' thành 'none'
              });

              console.log(
                "[UPDATE-FINAL] Normal mode - background set to transparent"
              );
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
            console.log(
              "[UPDATE-END] Updating display values after drag completion"
            );
            updateDisplayValues("update_end_completion");

            // ✅ IMPROVED: Better drag vs click detection logic
            const isClickOperation =
              regionChangeSourceRef.current === "click" &&
              isClickUpdatingEndRef.current;
            const isDragOperation =
              regionChangeSourceRef.current === "drag" || !isClickOperation;

            console.log(`[UPDATE-END] 🔍 Operation detection:`, {
              regionChangeSource: regionChangeSourceRef.current,
              isClickUpdatingEnd: isClickUpdatingEndRef.current,
              isClickOperation,
              isDragOperation,
            });

            // ✅ ALWAYS save history for drag operations, even if uncertain
            if (isDragOperation) {
              // ✅ FIXED: Save PREVIOUS region (before drag started) to history
              if (dragStartRegionRef.current) {
                const prevRegion = dragStartRegionRef.current;
                console.log(
                  `[UPDATE-END] 💾 Drag operation detected - saving PREVIOUS region to history: ${prevRegion.start.toFixed(
                    4
                  )}s - ${prevRegion.end.toFixed(4)}s`
                );
                onRegionChange(
                  prevRegion.start,
                  prevRegion.end,
                  true,
                  "drag_complete_save_previous"
                );

                // Clear the captured region after using it
                dragStartRegionRef.current = null;
              } else {
                console.log(
                  `[UPDATE-END] ⚠️ No previous region captured - fallback to current region`
                );
                onRegionChange(start, end, true, "drag_complete_fallback");
              }
            } else {
              console.log(
                `[UPDATE-END] ⏭️ Click operation detected - history already saved in click handler`
              );
              // Clear drag start region for click operations too
              dragStartRegionRef.current = null;
            }

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

          console.log(`\n🏁 [UPDATE-END EVENT] Processing completed`);
          console.log(`📊 Flags before cleanup:`);
          console.log(
            `  - regionChangeSourceRef: ${regionChangeSourceRef.current}`
          );
          console.log(
            `  - isDragUpdatingEndRef: ${isDragUpdatingEndRef.current}`
          );
          console.log(
            `  - isClickUpdatingEndRef: ${isClickUpdatingEndRef.current}`
          );

          // ✅ CRITICAL: Clear ALL flags immediately after update-end
          console.log(
            "[UPDATE-END] 🧹 Clearing all flags to prepare for next operation"
          );

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
          console.log(
            `  - regionChangeSourceRef: ${regionChangeSourceRef.current}`
          );
          console.log(
            `  - isDragUpdatingEndRef: ${isDragUpdatingEndRef.current}`
          );
          console.log(
            `  - isClickUpdatingEndRef: ${isClickUpdatingEndRef.current}`
          );
          console.log(`  - clickSourceRef: ${clickSourceRef.current}`);

          // Rest of existing logic continues...
          if (
            regionChangeSourceRef.current === "click" &&
            isClickUpdatingEndRef.current
          ) {
            console.log(
              `[update-end] 🖱️ This check should never trigger now - flags cleared above`
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

            if (wasPlaying && currentTime >= newStart && currentTime < newEnd) {
              console.log(
                `[update-end] ✅ Position valid - continuing playback to new end: ${newEnd.toFixed(
                  4
                )}s`
              );
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

          console.log(
            "[UPDATE-END] ✅ Event processing completed - ready for next operation"
          );

          // ✅ NEW: Force waveform redraw after update-end
          setTimeout(() => {
            if (wavesurferRef.current && wavesurferRef.current.drawBuffer) {
              console.log(
                "[Update-End] Redrawing waveform bars after region update"
              );
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
        console.log("[DEBUG] Checking waveform visibility...");
        const waveformContainer = waveformRef.current;
        if (waveformContainer) {
          const rect = waveformContainer.getBoundingClientRect();
          console.log("[DEBUG] Waveform container dimensions:", {
            width: rect.width,
            height: rect.height,
            visible: rect.width > 0 && rect.height > 0,
          });

          // Check for canvas elements
          const canvases = waveformContainer.querySelectorAll("canvas");
          console.log("[DEBUG] Found canvases:", canvases.length);
          canvases.forEach((canvas, index) => {
            console.log(`[DEBUG] Canvas ${index}:`, {
              width: canvas.width,
              height: canvas.height,
              style: canvas.style.cssText,
              hidden: canvas.hidden,
            });
          });

          // Check if waveform has data
          if (wavesurferRef.current) {
            console.log("[DEBUG] WaveSurfer state:", {
              duration: wavesurferRef.current.getDuration(),
              isReady: wavesurferRef.current.isReady?.() || "unknown",
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
        console.log("[CLEANUP] Clearing throttled functions cache");

        // Cancel any pending throttled/debounced calls
        Object.values(throttledFunctionsRef.current).forEach((func) => {
          if (func && typeof func.cancel === "function") {
            console.log("[CLEANUP] Cancelling throttled function");
            func.cancel(); // For lodash throttle/debounce
          }
          if (func && typeof func.flush === "function") {
            console.log("[CLEANUP] Flushing throttled function");
            func.flush(); // Execute any pending calls immediately
          }
        });

        // Clear the cache completely
        throttledFunctionsRef.current = {};
        console.log("[CLEANUP] Throttled functions cache cleared");

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
          console.log("[CLEANUP] Destroying WaveSurfer instance");
          ws.destroy();
        }

        console.log("[CLEANUP] Component cleanup completed");
      };
    }, [audioFile, theme, onTimeUpdate]);

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

        // ✅ NEW: Force waveform redraw when fade changes
        setTimeout(() => {
          if (wavesurferRef.current && wavesurferRef.current.drawBuffer) {
            console.log(
              "[Fade Change] Redrawing waveform bars for fade effect"
            );
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
      console.log(
        `[fadeInProfileEffect] TRIGGERED - volumeProfile: ${volumeProfile}`
      );

      if (volumeProfile !== "fadeIn") return;

      if (!wavesurferRef.current || !regionRef.current) {
        console.log(`[fadeInProfileEffect] Missing refs for fadeIn profile`);
        return;
      }

      console.log(
        `[fadeInProfileEffect] FADEIN PROFILE ACTIVATED - Setting up special handling`
      );

      // Force immediate position and volume sync for fadeIn
      const wsPosition = wavesurferRef.current.getCurrentTime();
      const regionStart = regionRef.current.start;
      const regionEnd = regionRef.current.end;

      let targetPosition = wsPosition;

      // Ensure position is within region
      if (wsPosition < regionStart || wsPosition > regionEnd) {
        targetPosition = regionStart;
        console.log(
          `[fadeInProfileEffect] FADEIN: Correcting position to region start: ${targetPosition.toFixed(
            4
          )}s`
        );

        const totalDuration = wavesurferRef.current.getDuration();
        wavesurferRef.current.seekTo(targetPosition / totalDuration);
      }

      // Force multiple volume updates to ensure fadeIn works
      const forceVolumeUpdate = (attempt) => {
        if (
          wavesurferRef.current &&
          regionRef.current &&
          volumeProfile === "fadeIn"
        ) {
          const currentPos = wavesurferRef.current.getCurrentTime();
          console.log(
            `[fadeInProfileEffect] FADEIN: Force update attempt ${attempt} at ${currentPos.toFixed(
              4
            )}s`
          );

          syncPositions(currentPos, `fadeInProfileEffect_${attempt}`);
          updateVolume(currentPos, true, true);
          drawVolumeOverlay(true);

          // Verify volume was set correctly
          const relPos = Math.max(
            0,
            (currentPos - regionRef.current.start) /
              (regionRef.current.end - regionRef.current.start)
          );
          const expectedMinVolume = 0.02 + (volume - 0.02) * relPos;

          console.log(
            `[fadeInProfileEffect] FADEIN: Expected min volume: ${expectedMinVolume.toFixed(
              4
            )}, actual: ${currentVolumeRef.current.toFixed(4)}`
          );
        }
      };

      // Multiple attempts to ensure fadeIn volume is set correctly
      forceVolumeUpdate(1);
      setTimeout(() => forceVolumeUpdate(2), 50);
      setTimeout(() => forceVolumeUpdate(3), 100);
      setTimeout(() => forceVolumeUpdate(4), 200);

      console.log(
        `[fadeInProfileEffect] ✅ FadeIn profile special handling completed`
      );
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
      if (
        regionRef.current &&
        regionRef.current.start !== undefined &&
        regionRef.current.end !== undefined
      ) {
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
      console.log("[Duration Change] Duration updated:", duration);

      if (duration > 0 && regionRef.current) {
        console.log(
          "[Duration Change] Updating display values after duration change"
        );

        // Ensure region end is not greater than duration
        if (regionRef.current.end > duration) {
          console.log(
            "[Duration Change] Region end exceeds duration, adjusting..."
          );
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
      console.log(
        `[removeModeEffect] SIMPLIFIED - removeMode: ${isDeleteMode}`
      );

      // Since barColor now uses removeModeRef.current, we only need to update region styles
      updateRegionStyles();
    }, [isDeleteMode, updateRegionStyles]); // Update delete mode state when prop changes

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
      if (duration > 0 && regionStartTime === 0 && regionEndTime === 0) {
        console.log("[Duration Init] Setting initial region values:", {
          duration,
        });
        setRegionStartTime(0);
        setRegionEndTime(duration);
        setDisplayRegionStart(formatDisplayTime(0));
        setDisplayRegionEnd(formatDisplayTime(duration));
      }
    }, [duration, regionStartTime, regionEndTime]);

    // ✅ THÊM: Update regionEndTime when duration changes (for dynamic audio loading)
    useEffect(() => {
      if (duration > 0 && regionEndTime !== duration) {
        console.log(
          "[Duration Change] Updating regionEndTime from",
          regionEndTime,
          "to",
          duration
        );
        setRegionEndTime(duration);
        setDisplayRegionEnd(formatDisplayTime(duration));
      }
    }, [duration]);

    // ✅ THÊM: Monitor region values for debugging
    useEffect(() => {
      console.log("[Region Values Monitor]", {
        regionStartTime,
        regionEndTime,
        displayRegionStart,
        displayRegionEnd,
        duration,
        loading,
      });
    }, [
      regionStartTime,
      regionEndTime,
      displayRegionStart,
      displayRegionEnd,
      duration,
      loading,
    ]);

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
              <span className="text-slate-700 font-medium text-sm">
                Loading audio...
              </span>
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
              <div className="flex items-center gap-3 bg-white/80 rounded-lg px-3 py-2 shadow-sm">
                <TimeStepper
                  value={isPlaying ? currentTime : regionStartTime || 0}
                  onChange={(val) => {
                    console.log(
                      "[TimeStepper-Start] Direct edit onChange:",
                      val
                    );
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
                        const totalDuration =
                          wavesurferRef.current.getDuration();
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
                  maxValue={Math.max(
                    0,
                    (regionEndTime || duration || 30) - 0.01
                  )}
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
                        const totalDuration =
                          wavesurferRef.current.getDuration();
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
            <div
              className="absolute w-full pointer-events-none"
              style={{ top: "80px", left: "0px", zIndex: 999999 }}
            >
              {/* Region Start Time Tooltip - Green Background */}
              {regionStartTime !== undefined && (
                <div
                  className="absolute bg-green-600 text-white text-xs font-mono px-1 py-0.5 rounded-md shadow-lg border border-green-500"
                  style={{
                    left: `calc(12px + ${
                      (regionStartTime /
                        (wavesurferRef.current?.getDuration() || 1)) *
                      (100 - 2.4)
                    }%)`,
                    top: "0px",
                    transform: "translateX(-50%)",
                    zIndex: 999999,
                    fontSize: "10px",
                    pointerEvents: "none",
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
                    left: `calc(12px + ${
                      (regionEndTime /
                        (wavesurferRef.current?.getDuration() || 1)) *
                      (100 - 2.4)
                    }%)`,
                    top: "0px",
                    transform: "translateX(-50%)",
                    zIndex: 999999,
                    fontSize: "10px",
                    pointerEvents: "none",
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
                    left: `calc(12px + ${
                      ((regionStartTime + regionEndTime) /
                        2 /
                        (wavesurferRef.current?.getDuration() || 1)) *
                      (100 - 2.4)
                    }%)`,
                    bottom: "-120px",
                    transform: "translateX(-50%)",
                    zIndex: 999999,
                    fontSize: "12px",
                    textShadow: "1px 1px 2px rgba(0,0,0,0.5)",
                    pointerEvents: "none",
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
                    left: `calc(12px + ${
                      (currentPosition /
                        (wavesurferRef.current?.getDuration() || 1)) *
                      (100 - 2.4)
                    }%)`,
                    top: "25px",
                    transform: "translateX(-50%)",
                    zIndex: 999999,
                    fontSize: "12px",
                    textShadow: "1px 1px 2px rgba(0,0,0,0.5)",
                    pointerEvents: "none",
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
            style={{ minHeight: "140px" }}
          >
            {/* Waveform element */}
            <div
              ref={waveformRef}
              className="w-full h-full rounded-lg overflow-hidden"
            />

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
