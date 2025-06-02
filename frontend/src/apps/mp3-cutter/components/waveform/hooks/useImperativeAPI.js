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
  console.log('[useImperativeAPI] Initializing...');
  
  // Destructure config
  const { volumeProfile, loop } = config;
  
  // Destructure dependencies  
  const {
    syncPositions,
    updateVolume,
    drawVolumeOverlay,
    onRegionChange,
    onPlayStateChange,
    updateDisplayValues,
    togglePlayPause,
    updateRealtimeVolume
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
      console.log('[useImperativeAPI] play() called');
      if (refs.wavesurferRef.current && refs.regionRef.current) {
        const resumePosition = refs.lastPositionRef.current;
        const start = refs.regionRef.current.start;
        const end = refs.regionRef.current.end;

        const playFrom =
          resumePosition >= start && resumePosition < end
            ? resumePosition
            : start;

        refs.currentProfileRef.current =
          refs.fadeEnabledRef.current && volumeProfile === "uniform"
            ? "fadeInOut"
            : volumeProfile;

        // CRITICAL: Special handling for fadeIn profile
        const isFadeInProfile = refs.currentProfileRef.current === "fadeIn";
        console.log(
          `[play] Starting playback with profile: ${refs.currentProfileRef.current}, isFadeIn: ${isFadeInProfile}`
        );

        syncPositions(playFrom, "imperativePlay");
        updateVolume(playFrom, true, true);

        // ENHANCED: Force immediate volume update for fadeIn to prevent silence
        if (isFadeInProfile) {
          console.log(
            `[play] FADEIN: Forcing immediate volume update at position ${playFrom.toFixed(
              4
            )}s`
          );

          // Force multiple volume updates to ensure it takes effect
          setTimeout(() => {
            if (refs.wavesurferRef.current && refs.regionRef.current) {
              const currentPos = refs.wavesurferRef.current.getCurrentTime();
              console.log(
                `[play] FADEIN: Second volume update at position ${currentPos.toFixed(
                  4
                )}s`
              );
              updateVolume(currentPos, true, true);
              drawVolumeOverlay(true);
            }
          }, 50);

          setTimeout(() => {
            if (refs.wavesurferRef.current && refs.regionRef.current) {
              const currentPos = refs.wavesurferRef.current.getCurrentTime();
              console.log(
                `[play] FADEIN: Third volume update at position ${currentPos.toFixed(
                  4
                )}s`
              );
              updateVolume(currentPos, true, true);
            }
          }, 100);
        }

        console.log(
          `[play] Starting playback from ${playFrom.toFixed(4)}s to ${end.toFixed(
            4
          )}s, loop: ${loop}, profile: ${refs.currentProfileRef.current}`
        );

        refs.wavesurferRef.current.play(playFrom, end);
        setIsPlaying(true);
      }
    },

    stop: () => {
      console.log('[useImperativeAPI] stop() called');
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
      console.log('[useImperativeAPI] togglePlayPause() called');
      return togglePlayPause();
    },

    seekTo: (position) => {
      console.log('[useImperativeAPI] seekTo() called with position:', position);
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
      console.log("[useImperativeAPI] toggleFade() called with fadeIn:", fadeInState, "fadeOut:", fadeOutState);
      console.log("[TOGGLE_FADE] =================");
      console.log(
        "[TOGGLE_FADE] Called with fadeIn:",
        fadeInState,
        "fadeOut:",
        fadeOutState
      );
      console.log("[TOGGLE_FADE] Previous states:");
      console.log("[TOGGLE_FADE] - fadeInRef.current:", refs.fadeInRef.current);
      console.log("[TOGGLE_FADE] - fadeOutRef.current:", refs.fadeOutRef.current);
      console.log(
        "[TOGGLE_FADE] - fadeEnabledRef.current:",
        refs.fadeEnabledRef.current
      );

      // CRITICAL: Cập nhật refs ngay lập tức
      refs.fadeInRef.current = fadeInState;
      refs.fadeOutRef.current = fadeOutState;
      refs.fadeEnabledRef.current = fadeInState || fadeOutState;

      console.log("[TOGGLE_FADE] Updated refs:");
      console.log("[TOGGLE_FADE] - fadeInRef.current:", refs.fadeInRef.current);
      console.log("[TOGGLE_FADE] - fadeOutRef.current:", refs.fadeOutRef.current);
      console.log(
        "[TOGGLE_FADE] - fadeEnabledRef.current:",
        refs.fadeEnabledRef.current
      );

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
        syncPositions(targetPosition, "imperativeToggleFade");

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
          refs.animationFrameRef.current =
            requestAnimationFrame(updateRealtimeVolume);
        }

        console.log("[TOGGLE_FADE] ✅ Toggle fade completed successfully");
      } else {
        console.log(
          "[TOGGLE_FADE] ❌ Missing refs - wavesurfer:",
          !!refs.wavesurferRef.current,
          "region:",
          !!refs.regionRef.current
        );
      }

      console.log("[TOGGLE_FADE] =================");
      return true;
    },

    setFadeInDuration: (duration) => {
      console.log('[useImperativeAPI] setFadeInDuration() called with duration:', duration);
      refs.fadeInDurationRef.current = duration;
      setFadeInDurationState(duration);
      if (
        refs.wavesurferRef.current &&
        (volumeProfile === "fadeInOut" || volumeProfile === "custom") &&
        !refs.fadeEnabledRef.current
      ) {
        drawVolumeOverlay();

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

          if (isPlaying && refs.wavesurferRef.current) {
            const currentPos = refs.wavesurferRef.current.getCurrentTime();
            syncPositions(currentPos, "imperativeSetFadeInDurationDelayed");
            updateVolume(currentPos, true, true);
          }
        }, 50);
      }
    },

    setFadeOutDuration: (duration) => {
      console.log('[useImperativeAPI] setFadeOutDuration() called with duration:', duration);
      refs.fadeOutDurationRef.current = duration;
      setFadeOutDurationState(duration);
      if (
        refs.wavesurferRef.current &&
        (volumeProfile === "fadeInOut" || volumeProfile === "custom") &&
        !refs.fadeEnabledRef.current
      ) {
        drawVolumeOverlay();

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

          if (isPlaying && refs.wavesurferRef.current) {
            const currentPos = refs.wavesurferRef.current.getCurrentTime();
            syncPositions(currentPos, "imperativeSetFadeOutDurationDelayed");
            updateVolume(currentPos, true, true);
          }
        }, 50);
      }
    },

    getFadeInDuration: () => {
      console.log('[useImperativeAPI] getFadeInDuration() called, returning:', fadeInDurationState);
      return fadeInDurationState;
    },

    getFadeOutDuration: () => {
      console.log('[useImperativeAPI] getFadeOutDuration() called, returning:', fadeOutDurationState);
      return fadeOutDurationState;
    },

    isFadeEnabled: () => {
      const result = refs.fadeEnabledRef.current;
      console.log('[useImperativeAPI] isFadeEnabled() called, returning:', result);
      return result;
    },

    canEnableFade: () => {
      const result = volumeProfile === "uniform";
      console.log('[useImperativeAPI] canEnableFade() called, returning:', result);
      return result;
    },

    isPlaying: () => {
      console.log('[useImperativeAPI] isPlaying() called, returning:', isPlaying);
      return isPlaying;
    },

    setRegionStart: (startTime) => {
      console.log('[useImperativeAPI] setRegionStart() called with startTime:', startTime);
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

            console.log("[setRegionStart] Successfully updated region start to:", startTime);
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
      console.log("[useImperativeAPI] setRegionEnd() called with endTime:", endTime);

      try {
        if (!refs.wavesurferRef.current || !refs.regionRef.current) {
          console.log("[setRegionEnd] Missing refs");
          return;
        }

        const currentStart = refs.regionRef.current.start;
        const currentTime = refs.wavesurferRef.current.getCurrentTime();

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

        const wasClickUpdate = refs.clickSourceRef.current === "click";
        console.log("[setRegionEnd] Is this from click?", wasClickUpdate);

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
        console.log(`[setRegionEnd] Region end updated to ${endTime}`);

        onRegionChange(currentStart, endTime);
        syncPositions(currentTime, "imperativeSetRegionEnd");
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
            refs.wavesurferRef.current.pause();
            const totalDuration = refs.wavesurferRef.current.getDuration();
            refs.wavesurferRef.current.seekTo(currentStart / totalDuration);
            syncPositions(currentStart, "imperativeSetRegionEndStop");
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

    getWavesurferInstance: () => {
      console.log('[useImperativeAPI] getWavesurferInstance() called');
      return refs.wavesurferRef.current;
    },

    getRegionsPlugin: () => {
      console.log('[useImperativeAPI] getRegionsPlugin() called');
      return refs.regionsPluginRef.current;
    },

    getRegion: () => {
      console.log('[useImperativeAPI] getRegion() called');
      return refs.regionRef.current;
    },

    getRegionBounds: () => {
      console.log("[useImperativeAPI] getRegionBounds() called");

      if (!refs.regionRef.current) {
        console.log("[getRegionBounds] No region available, returning null");
        return null;
      }

      const start = refs.regionRef.current.start;
      const end = refs.regionRef.current.end;
      const duration = refs.wavesurferRef.current
        ? refs.wavesurferRef.current.getDuration()
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
        `[useImperativeAPI] setRegionBounds() called with start: ${start}, end: ${end}`
      );

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

        console.log(
          `[setRegionBounds] Successfully set region to ${start.toFixed(
            4
          )}s - ${end.toFixed(4)}s`
        );

        // Update position and volume
        const currentPos = refs.wavesurferRef.current.getCurrentTime();
        let targetPos = currentPos;

        // If current position is outside new bounds, move to start
        if (currentPos < start || currentPos > end) {
          targetPos = start;
          const totalDuration = refs.wavesurferRef.current.getDuration();
          refs.wavesurferRef.current.seekTo(targetPos / totalDuration);
          console.log(
            `[setRegionBounds] Moved playhead to region start: ${targetPos.toFixed(
              4
            )}s`
          );
        }

        syncPositions(targetPos, "imperativeSetRegionBounds");
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
      console.log('[useImperativeAPI] deleteRegion() called');
      if (!refs.regionRef.current) {
        console.warn("[deleteRegion] No region available to delete");
        return null;
      }

      const regionToDelete = {
        start: refs.regionRef.current.start,
        end: refs.regionRef.current.end,
      };

      console.log(
        `[deleteRegion] Deleting region: ${regionToDelete.start.toFixed(
          4
        )}s - ${regionToDelete.end.toFixed(4)}s`
      );
      return regionToDelete;
    },

    getCurrentRegion: () => {
      console.log('[useImperativeAPI] getCurrentRegion() called');
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
      console.log('[useImperativeAPI] isDeleteMode() called, returning:', isDeleteMode);
      return isDeleteMode;
    },

    getDeletePreview: () => {
      console.log('[useImperativeAPI] getDeletePreview() called');
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
      console.log(
        "[useImperativeAPI] ensurePlaybackWithinBounds() called via imperative handle"
      );
      // This should call the function from usePlaybackControl
      // We'll need to pass this as a dependency
      if (dependencies.ensurePlaybackWithinBounds) {
        dependencies.ensurePlaybackWithinBounds();
      }
    },
  }));

  console.log('[useImperativeAPI] ✅ Imperative handle setup completed');
};