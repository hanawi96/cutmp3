import { useCallback } from 'react';
import { formatDisplayTime } from '../utils/timeFormatters.js';
import { calculatePreviewPosition } from '../utils/audioUtils.js';
import { TIMING_CONSTANTS } from '../constants/waveformConstants.js';

/**
 * Hook quản lý region management logic
 */
export const useRegionManagement = (refs, state, setters, dependencies) => {
  const { 
    syncPositions, 
    updateVolume, 
    drawVolumeOverlay, 
    onRegionChange,
    isPlaying 
  } = dependencies;

  // ✅ Copy updateDisplayValues function từ WaveformSelector.jsx (dòng ~400-450)
  const updateDisplayValues = useCallback((source = "unknown") => {

    
    if (!refs.regionRef.current) {

      return;
    }

    const start = refs.regionRef.current.start;
    const end = refs.regionRef.current.end;
    
    if (typeof start !== 'number' || typeof end !== 'number' || isNaN(start) || isNaN(end)) {
      console.error(`[updateDisplayValues] Invalid start/end values - source: ${source}`, { start, end });
      return;
    }


    try {
      // Update display strings
      setters.setDisplayRegionStart(formatDisplayTime(start));
      setters.setDisplayRegionEnd(formatDisplayTime(end));
      
      // Update numeric values for tooltips
      setters.setRegionStartTime(start);
      setters.setRegionEndTime(end);
      

    } catch (error) {
      console.error(`[updateDisplayValues] Error updating display values from ${source}:`, error);
    }
  }, [setters]);

  // ✅ Copy handleWaveformClick function từ WaveformSelector.jsx (dòng ~1200-1400)
  const handleWaveformClick = useCallback((e) => {

    
    try {
      if (!refs.wavesurferRef.current || !refs.regionRef.current) return;

      const rect = refs.waveformRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickTime = (clickX / rect.width) * refs.wavesurferRef.current.getDuration();

      const currentStart = refs.regionRef.current.start;
      const currentEnd = refs.regionRef.current.end;
      const wasPlaying = state.isPlaying;
      const currentTime = refs.wavesurferRef.current.getCurrentTime();
      
      // ✅ NEW: Check if in delete mode for different positioning behavior
      const currentDeleteMode = refs.removeModeRef.current;

      // Set click flags fresh (ignore previous state)
      refs.clickSourceRef.current = "click";
      refs.regionChangeSourceRef.current = "click";

      if (clickTime < currentStart) {
        
        onRegionChange(currentStart, currentEnd, true, 'click_expand_start_save_before');

        // Update region
        if (refs.regionRef.current.setOptions) {
          refs.regionRef.current.setOptions({ start: clickTime });
        } else if (refs.regionRef.current.update) {
          refs.regionRef.current.update({ start: clickTime });
        } else {
          refs.regionRef.current.start = clickTime;
          if (refs.wavesurferRef.current.fireEvent) {
            refs.wavesurferRef.current.fireEvent("region-updated", refs.regionRef.current);
          }
        }

        // ✅ NEW: Delete mode positioning logic
        let seekPosition = clickTime;
        if (currentDeleteMode) {
          // In delete mode, seek 3 seconds before the new delete region start
          seekPosition = Math.max(0, clickTime - 3);
          console.log("[DELETE_MODE_CLICK_START] ========================================");
          console.log("[DELETE_MODE_CLICK_START] Seeking 3s before new delete start:", {
            clickTime: clickTime.toFixed(2),
            seekPosition: seekPosition.toFixed(2),
            offset: "3s before delete region"
          });
          console.log("[DELETE_MODE_CLICK_START] ========================================");
        } else {
          console.log("[NORMAL_MODE_CLICK_START] Seeking to clicked position:", seekPosition.toFixed(2));
        }

        if (wasPlaying) {
          refs.wavesurferRef.current.pause();
          setTimeout(() => {
            if (refs.wavesurferRef.current) {
              const playStart = currentDeleteMode ? seekPosition : clickTime;
              console.log("[DEBUG_CLICK_START] Playing after positioning - playStart:", playStart.toFixed(2));
              refs.wavesurferRef.current.play(playStart, currentEnd);
              syncPositions(seekPosition, currentDeleteMode ? "deleteClickStart" : "handleWaveformClickNewStart");
            }
          }, 50);
        } else {
          const totalDuration = refs.wavesurferRef.current.getDuration();
          console.log("[DEBUG_CLICK_START] Seeking to position:", seekPosition.toFixed(2), "ratio:", (seekPosition / totalDuration).toFixed(4));
          refs.wavesurferRef.current.seekTo(seekPosition / totalDuration);
          syncPositions(seekPosition, currentDeleteMode ? "deleteClickStartSeek" : "handleWaveformClickSeekStart");
          updateVolume(seekPosition, true, true);
        }

        setTimeout(() => {
          updateDisplayValues("click_expand_start");
        }, 100);
        
      } else if (clickTime > currentEnd + 0.1) {

        
        onRegionChange(currentStart, currentEnd, true, 'click_expand_end_save_before');

        // Set flags for UI update
        refs.isClickUpdatingEndRef.current = true;
        refs.lastClickEndTimeRef.current = clickTime;

        if (refs.endUpdateTimeoutRef.current) {
          clearTimeout(refs.endUpdateTimeoutRef.current);
          refs.endUpdateTimeoutRef.current = null;
        }

        // ✅ NEW: Delete mode positioning logic for end expansion
        let previewPosition;
        if (currentDeleteMode) {
          // In delete mode, position at the end point to hear from end to track end
          previewPosition = clickTime;
          console.log("[DELETE_MODE_CLICK_END] =========================================");
          console.log("[DELETE_MODE_CLICK_END] Positioning at delete end point:", {
            clickTime: clickTime.toFixed(2),
            previewPosition: previewPosition.toFixed(2),
            purpose: "Hear from delete end to track end"
          });
          console.log("[DELETE_MODE_CLICK_END] =========================================");
        } else {
          // Normal mode - use preview calculation
          previewPosition = calculatePreviewPosition(clickTime, currentTime);
          console.log("[NORMAL_MODE_CLICK_END] Using preview position:", previewPosition.toFixed(2));
        }

        // Update region
        if (refs.regionRef.current.setOptions) {
          refs.regionRef.current.setOptions({ end: clickTime });
        } else if (refs.regionRef.current.update) {
          refs.regionRef.current.update({ end: clickTime });
        } else {
          refs.regionRef.current.end = clickTime;
          if (refs.wavesurferRef.current.fireEvent) {
            refs.wavesurferRef.current.fireEvent("region-updated", refs.regionRef.current);
          }
        }

        // Force seek and sync
        const seekRatio = previewPosition / refs.wavesurferRef.current.getDuration();
        console.log("[DEBUG_CLICK_END] Seeking to position:", previewPosition.toFixed(2), "ratio:", seekRatio.toFixed(4));
        refs.wavesurferRef.current.seekTo(seekRatio);

        refs.syncPositionRef.current = previewPosition;
        refs.currentPositionRef.current = previewPosition;
        refs.lastPositionRef.current = previewPosition;

        updateVolume(previewPosition, true, true);
        drawVolumeOverlay(true);

        // Handle playback
        if (wasPlaying) {
          requestAnimationFrame(() => {
            if (refs.wavesurferRef.current && state.isPlaying) {
              if (currentDeleteMode) {
                // In delete mode, play from end position to track end
                const trackDuration = refs.wavesurferRef.current.getDuration();
                refs.wavesurferRef.current.play(clickTime, trackDuration);
                console.log("[DELETE_MODE_CLICK_END] Playing from delete end to track end:", {
                  from: clickTime.toFixed(2),
                  to: trackDuration.toFixed(2)
                });
              } else {
                // Normal mode
                refs.wavesurferRef.current.play(previewPosition, clickTime);
              }
            }
          });
        }

        setTimeout(() => {
          updateDisplayValues("click_expand_end");
        }, 100);

        // Clear flags with delay
        setTimeout(() => {
          refs.isClickUpdatingEndRef.current = false;
          refs.lastClickEndTimeRef.current = null;
          refs.clickSourceRef.current = null;
          refs.regionChangeSourceRef.current = null;
        }, 150);
        
      } else {
        // Click within region - seeking only
        const totalDuration = refs.wavesurferRef.current.getDuration();
        refs.wavesurferRef.current.seekTo(clickTime / totalDuration);
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
            if (refs.wavesurferRef.current && state.isPlaying) {
              refs.wavesurferRef.current.play(clickTime, refs.regionRef.current.end);
            }
          }, 50);
        }
      }

      // Final cleanup with longer delay
      setTimeout(() => {
        if (refs.clickSourceRef.current === "click") {
          refs.clickSourceRef.current = null;
        }
        if (refs.regionChangeSourceRef.current === "click" && !refs.isClickUpdatingEndRef.current) {
          refs.regionChangeSourceRef.current = null;
        }
      }, 300);
      
    } catch (error) {
      console.error("[handleWaveformClick] Error processing click:", error);
      // Clear all flags on error
      refs.clickSourceRef.current = null;
      refs.regionChangeSourceRef.current = null;
      refs.isClickUpdatingEndRef.current = false;
      refs.lastClickEndTimeRef.current = null;
    }
  }, [state.isPlaying, syncPositions, updateVolume, drawVolumeOverlay, onRegionChange, updateDisplayValues]);

  return {
    updateDisplayValues,
    handleWaveformClick
  };
};