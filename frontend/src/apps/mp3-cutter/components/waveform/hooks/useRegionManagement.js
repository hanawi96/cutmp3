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
    console.log('[useRegionManagement] updateDisplayValues called from:', source);
    
    if (!refs.regionRef.current) {
      console.log(`[updateDisplayValues] No region available - source: ${source}`);
      return;
    }

    const start = refs.regionRef.current.start;
    const end = refs.regionRef.current.end;
    
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
      setters.setDisplayRegionStart(formatDisplayTime(start));
      setters.setDisplayRegionEnd(formatDisplayTime(end));
      
      // Update numeric values for tooltips
      setters.setRegionStartTime(start);
      setters.setRegionEndTime(end);
      
      console.log(`[updateDisplayValues] Successfully updated display values from ${source}`);
    } catch (error) {
      console.error(`[updateDisplayValues] Error updating display values from ${source}:`, error);
    }
  }, [setters]);

  // ✅ Copy handleWaveformClick function từ WaveformSelector.jsx (dòng ~1200-1400)
  const handleWaveformClick = useCallback((e) => {
    console.log('[useRegionManagement] handleWaveformClick called');
    
    try {
      if (!refs.wavesurferRef.current || !refs.regionRef.current) return;

      const rect = refs.waveformRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickTime = (clickX / rect.width) * refs.wavesurferRef.current.getDuration();

      const currentStart = refs.regionRef.current.start;
      const currentEnd = refs.regionRef.current.end;
      const wasPlaying = state.isPlaying;
      const currentTime = refs.wavesurferRef.current.getCurrentTime();

      // Set click flags fresh (ignore previous state)
      refs.clickSourceRef.current = "click";
      refs.regionChangeSourceRef.current = "click";

      if (clickTime < currentStart) {
        console.log("[handleWaveformClick] Expanding region start");

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

        onRegionChange(clickTime, currentEnd, true, 'click_expand_start');

        if (wasPlaying) {
          refs.wavesurferRef.current.pause();
          setTimeout(() => {
            if (refs.wavesurferRef.current) {
              refs.wavesurferRef.current.play(clickTime, currentEnd);
              syncPositions(clickTime, "handleWaveformClickNewStart");
            }
          }, 50);
        } else {
          const totalDuration = refs.wavesurferRef.current.getDuration();
          refs.wavesurferRef.current.seekTo(clickTime / totalDuration);
          syncPositions(clickTime, "handleWaveformClickSeekStart");
          updateVolume(clickTime, true, true);
        }

        setTimeout(() => {
          updateDisplayValues("click_expand_start");
        }, 100);
        
      } else if (clickTime > currentEnd + 0.1) {
        console.log("[handleWaveformClick] Expanding region end");

        // Set flags for UI update
        refs.isClickUpdatingEndRef.current = true;
        refs.lastClickEndTimeRef.current = clickTime;

        if (refs.endUpdateTimeoutRef.current) {
          clearTimeout(refs.endUpdateTimeoutRef.current);
          refs.endUpdateTimeoutRef.current = null;
        }

        const previewPosition = calculatePreviewPosition(clickTime, currentTime);

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

        onRegionChange(currentStart, clickTime, true, 'click_expand_end');

        // Force seek and sync
        const seekRatio = previewPosition / refs.wavesurferRef.current.getDuration();
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
              refs.wavesurferRef.current.play(previewPosition, clickTime);
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