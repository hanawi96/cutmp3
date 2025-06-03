import { useImperativeHandle } from 'react';

/**
 * Hook quản lý tất cả imperative API methods
 * Tách từ WaveformSelector.jsx useImperativeHandle
 */
export const useImperativeAPI = (
  ref,
  refs,
  state,
  setters,
  config,
  dependencies
) => {

  
  // Destructure config
  const { volumeProfile, loop } = config;
  
  // Destructure dependencies  
  const {
    syncPositions,
    updateVolume,
    drawVolumeOverlay,
    drawWaveformDimOverlay,
    onRegionChange,
    onPlayStateChange,
    updateDisplayValues,
    togglePlayPause,
    updateRealtimeVolume,
    ensurePlaybackWithinBounds,
  } = dependencies;

  // Destructure state
  const { 
    isPlaying, 
    isDeleteMode, 
    fadeInDurationState, 
    fadeOutDurationState 
  } = state;

  // Destructure setters
  const { 
    setIsPlaying, 
    setFadeInDurationState, 
    setFadeOutDurationState 
  } = setters;

  useImperativeHandle(ref, () => ({
    play: () => {

      if (refs.wavesurferRef.current && refs.regionRef.current) {
        const resumePosition = refs.lastPositionRef.current;
        const start = refs.regionRef.current.start;
        const end = refs.regionRef.current.end;

        const playFrom =
          resumePosition >= start && resumePosition < end
            ? resumePosition
            : start;

        refs.currentProfileRef.current = state.fadeIn && state.fadeOut 
          ? "uniform"  // Use uniform when both fade options are active
          : state.fadeIn 
            ? "fadeIn"
            : state.fadeOut 
              ? "fadeOut"
              : volumeProfile;

        // CRITICAL: Special handling for fadeIn profile
        const isFadeInProfile = refs.currentProfileRef.current === "fadeIn";


        syncPositions(playFrom, "imperativePlay");
        updateVolume(playFrom, true, true);

        // ENHANCED: Force immediate volume update for fadeIn to prevent silence
        if (isFadeInProfile) {


          // Force multiple volume updates to ensure it takes effect
          setTimeout(() => {
            if (refs.wavesurferRef.current && refs.regionRef.current) {
              const currentPos = refs.wavesurferRef.current.getCurrentTime();

              updateVolume(currentPos, true, true);
              drawVolumeOverlay(true);
            }
          }, 50);

          setTimeout(() => {
            if (refs.wavesurferRef.current && refs.regionRef.current) {
              const currentPos = refs.wavesurferRef.current.getCurrentTime();

              updateVolume(currentPos, true, true);
            }
          }, 100);
        }


        refs.wavesurferRef.current.play(playFrom, end);
        setIsPlaying(true);
      }
    },

    stop: () => {

      if (refs.wavesurferRef.current) {
        const currentPos = refs.wavesurferRef.current.getCurrentTime();
        syncPositions(currentPos, "imperativeStop");

        refs.wavesurferRef.current.pause();

        const totalDuration = refs.wavesurferRef.current.getDuration();
        refs.wavesurferRef.current.seekTo(currentPos / totalDuration);

        setIsPlaying(false);
      }
    },

    togglePlayPause: () => {

      return togglePlayPause();
    },

    seekTo: (position) => {

      if (refs.wavesurferRef.current && refs.regionRef.current) {
        const start = refs.regionRef.current.start;
        const end = refs.regionRef.current.end;
        const seekPos = start + position * (end - start);
        refs.wavesurferRef.current.seekTo(
          seekPos / refs.wavesurferRef.current.getDuration()
        );
        syncPositions(seekPos, "imperativeSeekTo");
        updateVolume(seekPos, false, true);
      }
    },

    toggleFade: (fadeInState, fadeOutState) => {


      // CRITICAL: Cập nhật refs ngay lập tức
      refs.fadeInRef.current = fadeInState;
      refs.fadeOutRef.current = fadeOutState;
      refs.fadeEnabledRef.current = fadeInState || fadeOutState;


      if (refs.wavesurferRef.current && refs.regionRef.current) {
        // Stop any current animation
        if (isPlaying && updateRealtimeVolume) {
          refs.animationFrameRef.current =
            requestAnimationFrame(updateRealtimeVolume);
        }

        // Determine best position for update
        const wsPosition = refs.wavesurferRef.current.getCurrentTime();
        const syncedPosition = refs.syncPositionRef.current;
        const regionStart = refs.regionRef.current.start;
        const regionEnd = refs.regionRef.current.end;

        let targetPosition;

        if (isPlaying) {
          targetPosition = wsPosition;

        } else {
          const wsInRegion =
            wsPosition >= regionStart && wsPosition <= regionEnd;
          const syncedInRegion =
            syncedPosition >= regionStart && syncedPosition <= regionEnd;

          if (wsInRegion) {
            targetPosition = wsPosition;

          } else if (syncedInRegion) {
            targetPosition = syncedPosition;

          } else {
            targetPosition = regionStart;

          }
        }

        // CRITICAL: Force immediate position sync và volume update
        syncPositions(targetPosition, "imperativeToggleFade");

        // CRITICAL: Force volume recalculation với updated fade states

        updateVolume(targetPosition, true, true);

        // CRITICAL: Force overlay redraw

        drawVolumeOverlay(true);

        // ✅ FORCE: Also redraw dim overlay to maintain delete mode state
        if (drawWaveformDimOverlay) {
          drawWaveformDimOverlay();
        }

        // Restart animation if playing
        if (isPlaying && typeof updateRealtimeVolume === "function") {
          refs.animationFrameRef.current =
            requestAnimationFrame(updateRealtimeVolume);
        }


      } else {

      }


      return true;
    },

    setFadeInDuration: (duration) => {

      refs.fadeInDurationRef.current = duration;
      setFadeInDurationState(duration);
      if (
        refs.wavesurferRef.current &&
        volumeProfile === "custom" &&
        !refs.fadeEnabledRef.current
      ) {
        drawVolumeOverlay();
        
        // ✅ FORCE: Also redraw dim overlay to maintain delete mode state
        if (drawWaveformDimOverlay) {
          drawWaveformDimOverlay();
        }

        if (isPlaying) {
          const currentPos = refs.wavesurferRef.current.getCurrentTime();
          syncPositions(currentPos, "imperativeSetFadeInDuration");
          updateVolume(currentPos, true, true);
        } else if (refs.regionRef.current) {
          syncPositions(refs.regionRef.current.start, "imperativeSetFadeInDuration");
          updateVolume(refs.regionRef.current.start, true, true);
        }

        setTimeout(() => {
          if (refs.isDrawingOverlayRef.current) return;
          drawVolumeOverlay();
          
          // ✅ FORCE: Also redraw dim overlay to maintain delete mode state
          if (drawWaveformDimOverlay) {
            drawWaveformDimOverlay();
          }

          if (isPlaying && refs.wavesurferRef.current) {
            const currentPos = refs.wavesurferRef.current.getCurrentTime();
            syncPositions(currentPos, "imperativeSetFadeInDurationDelayed");
            updateVolume(currentPos, true, true);
          }
        }, 50);
      }
    },

    setFadeOutDuration: (duration) => {

      refs.fadeOutDurationRef.current = duration;
      setFadeOutDurationState(duration);
      if (
        refs.wavesurferRef.current &&
        volumeProfile === "custom" &&
        !refs.fadeEnabledRef.current
      ) {
        drawVolumeOverlay();
        
        // ✅ FORCE: Also redraw dim overlay to maintain delete mode state
        if (drawWaveformDimOverlay) {
          drawWaveformDimOverlay();
        }

        if (isPlaying) {
          const currentPos = refs.wavesurferRef.current.getCurrentTime();
          syncPositions(currentPos, "imperativeSetFadeOutDuration");
          updateVolume(currentPos, true, true);
        } else if (refs.regionRef.current) {
          syncPositions(refs.regionRef.current.start, "imperativeSetFadeOutDuration");
          updateVolume(refs.regionRef.current.start, true, true);
        }

        setTimeout(() => {
          if (refs.isDrawingOverlayRef.current) return;
          drawVolumeOverlay();
          
          // ✅ FORCE: Also redraw dim overlay to maintain delete mode state
          if (drawWaveformDimOverlay) {
            drawWaveformDimOverlay();
          }

          if (isPlaying && refs.wavesurferRef.current) {
            const currentPos = refs.wavesurferRef.current.getCurrentTime();
            syncPositions(currentPos, "imperativeSetFadeOutDurationDelayed");
            updateVolume(currentPos, true, true);
          }
        }, 50);
      }
    },

    getFadeInDuration: () => {

      return fadeInDurationState;
    },

    getFadeOutDuration: () => {

      return fadeOutDurationState;
    },

    isFadeEnabled: () => {
      const result = refs.fadeEnabledRef.current;

      return result;
    },

    canEnableFade: () => {
      const result = volumeProfile === "uniform";

      return result;
    },

    isPlaying: () => {

      return isPlaying;
    },

    setRegionStart: (startTime) => {

      if (refs.wavesurferRef.current && refs.regionRef.current) {
        const currentEnd = refs.regionRef.current.end;
        if (startTime < currentEnd) {
          try {
            if (refs.regionRef.current.setOptions) {
              refs.regionRef.current.setOptions({ start: startTime });
            } else if (refs.regionRef.current.update) {
              refs.regionRef.current.update({ start: startTime });
            } else {
              refs.regionRef.current.start = startTime;
              if (refs.wavesurferRef.current.fireEvent) {
                refs.wavesurferRef.current.fireEvent(
                  "region-updated",
                  refs.regionRef.current
                );
              }
            }

            onRegionChange(startTime, currentEnd);
            syncPositions(startTime, "imperativeSetRegionStart");
            updateVolume(startTime, true, true);
            drawVolumeOverlay();
            
            // ✅ FORCE: Also redraw dim overlay to maintain delete mode state
            if (drawWaveformDimOverlay) {
              drawWaveformDimOverlay();
            }

          } catch (err) {
            console.error("[setRegionStart] Error updating region start:", err);
          }
        } else {
          console.warn("[setRegionStart] Start time cannot be after end time");
        }
      } else {
        console.warn("[setRegionStart] wavesurferRef or regionRef is not available");
      }
    },

    setRegionEnd: (endTime) => {


      try {
        if (!refs.wavesurferRef.current || !refs.regionRef.current) {

          return;
        }

        const currentStart = refs.regionRef.current.start;
        const currentTime = refs.wavesurferRef.current.getCurrentTime();


        if (endTime <= currentStart) {
          console.warn(
            "[setRegionEnd] End time cannot be before or equal to start time"
          );
          return;
        }

        const wasClickUpdate = refs.clickSourceRef.current === "click";


        if (refs.regionRef.current.setOptions) {
          refs.regionRef.current.setOptions({ end: endTime });
        } else if (refs.regionRef.current.update) {
          refs.regionRef.current.update({ end: endTime });
        } else {
          refs.regionRef.current.end = endTime;
          if (refs.wavesurferRef.current.fireEvent) {
            refs.wavesurferRef.current.fireEvent(
              "region-updated",
              refs.regionRef.current
            );
          }
        }


        onRegionChange(currentStart, endTime);
        syncPositions(currentTime, "imperativeSetRegionEnd");
        updateVolume(currentTime, true, true);
        drawVolumeOverlay();
        
        // ✅ FORCE: Also redraw dim overlay to maintain delete mode state
        if (drawWaveformDimOverlay) {
          drawWaveformDimOverlay();
        }

        if (!wasClickUpdate && isPlaying) {

          if (currentTime >= endTime) {

            refs.wavesurferRef.current.pause();
            const totalDuration = refs.wavesurferRef.current.getDuration();
            refs.wavesurferRef.current.seekTo(currentStart / totalDuration);
            syncPositions(currentStart, "imperativeSetRegionEndStop");
            setIsPlaying(false);
            onPlayStateChange(false);
          } else {

          }
        } else if (wasClickUpdate) {

        }


      } catch (err) {
        console.error("[setRegionEnd] Error:", err);
      }
    },

    getWavesurferInstance: () => {

      return refs.wavesurferRef.current;
    },

    getRegionsPlugin: () => {

      return refs.regionsPluginRef.current;
    },

    getRegion: () => {

      return refs.regionRef.current;
    },

    getRegionBounds: () => {


      if (!refs.regionRef.current) {

        return null;
      }

      const start = refs.regionRef.current.start;
      const end = refs.regionRef.current.end;
      const duration = refs.wavesurferRef.current
        ? refs.wavesurferRef.current.getDuration()
        : 0;



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

      return result;
    },

    setRegionBounds: (start, end) => {


      if (!refs.wavesurferRef.current || !refs.regionRef.current) {
        console.error("[setRegionBounds] Missing refs");
        return false;
      }

      // Validate input
      if (!isFinite(start) || !isFinite(end) || start < 0 || end <= start) {
        console.error("[setRegionBounds] Invalid bounds:", { start, end });
        return false;
      }

      const duration = refs.wavesurferRef.current.getDuration();
      if (end > duration) {
        console.error("[setRegionBounds] End time exceeds duration:", {
          end,
          duration,
        });
        return false;
      }

      try {
        // Update region bounds
        if (refs.regionRef.current.setOptions) {
          refs.regionRef.current.setOptions({ start: start, end: end });
        } else if (refs.regionRef.current.update) {
          refs.regionRef.current.update({ start: start, end: end });
        } else {
          refs.regionRef.current.start = start;
          refs.regionRef.current.end = end;
          if (refs.wavesurferRef.current.fireEvent) {
            refs.wavesurferRef.current.fireEvent(
              "region-updated",
              refs.regionRef.current
            );
          }
        }


        // Update position and volume
        const currentPos = refs.wavesurferRef.current.getCurrentTime();
        let targetPos = currentPos;

        // If current position is outside new bounds, move to start
        if (currentPos < start || currentPos > end) {
          targetPos = start;
          const totalDuration = refs.wavesurferRef.current.getDuration();
          refs.wavesurferRef.current.seekTo(targetPos / totalDuration);

        }

        syncPositions(targetPos, "imperativeSetRegionBounds");
        updateVolume(targetPos, true, true);
        drawVolumeOverlay(true);
        
        // ✅ FORCE: Also redraw dim overlay to maintain delete mode state
        if (drawWaveformDimOverlay) {
          drawWaveformDimOverlay();
        }

        // ✅ FIX: Update display values after region bounds change

        updateDisplayValues("setRegionBounds_undo_redo");

        return true;
      } catch (error) {
        console.error("[setRegionBounds] Error setting bounds:", error);
        return false;
      }
    },

    deleteRegion: () => {

      if (!refs.regionRef.current) {
        console.warn("[deleteRegion] No region available to delete");
        return null;
      }

      const regionToDelete = {
        start: refs.regionRef.current.start,
        end: refs.regionRef.current.end,
      };


      return regionToDelete;
    },

    getCurrentRegion: () => {

      if (!refs.regionRef.current) {
        console.warn("[getCurrentRegion] No region available");
        return null;
      }

      return {
        start: refs.regionRef.current.start,
        end: refs.regionRef.current.end,
        mode: isDeleteMode ? "delete" : "keep",
      };
    },

    isDeleteMode: () => {

      return isDeleteMode;
    },

    getDeletePreview: () => {

      if (!refs.regionRef.current || !refs.wavesurferRef.current) {
        console.warn("[getDeletePreview] Missing refs for delete preview");
        return null;
      }

      const totalDuration = refs.wavesurferRef.current.getDuration();
      const regionStart = refs.regionRef.current.start;
      const regionEnd = refs.regionRef.current.end;

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

      // This should call the function from usePlaybackControl
      // We'll need to pass this as a dependency
      if (dependencies.ensurePlaybackWithinBounds) {
        dependencies.ensurePlaybackWithinBounds();
      }
    },
  }));


};