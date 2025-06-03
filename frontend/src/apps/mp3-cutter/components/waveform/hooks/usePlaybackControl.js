import { useCallback } from 'react';
import { TIMING_CONSTANTS } from '../constants/waveformConstants.js';

/**
 * Hook quản lý playback control logic
 */
export const usePlaybackControl = (refs, state, setters, config, dependencies) => {


  
  // ✅ FIXED: Destructure từ 2 objects riêng biệt
  const { loop, onPlayStateChange, onPlayEnd, volumeProfile } = config;
  const { 
    syncPositions, 
    updateVolume, 
    drawVolumeOverlay, 
    onTimeUpdate
  } = dependencies;

  // ✅ VALIDATION: Check required functions exist
  if (!syncPositions) {
    console.error('[usePlaybackControl] syncPositions is missing from dependencies!');
    console.error('[usePlaybackControl] Available dependencies:', Object.keys(dependencies));
  }
  if (!updateVolume) {
    console.error('[usePlaybackControl] updateVolume is missing from dependencies!');
  }

  // ✅ THÊM: Helper function resetToRegionStart
  const resetToRegionStart = useCallback((source = "unknown") => {

    
    if (!refs.wavesurferRef.current || !refs.regionRef.current) {

      return;
    }

    const regionStart = refs.regionRef.current.start;
    const currentPos = refs.wavesurferRef.current.getCurrentTime();
    const positionDiff = Math.abs(currentPos - regionStart);



    // ALWAYS reset, regardless of difference - for instant response


    const totalDuration = refs.wavesurferRef.current.getDuration();
    const seekRatio = regionStart / totalDuration;

    // INSTANT operations - no setTimeout
    refs.wavesurferRef.current.seekTo(seekRatio);

    // IMMEDIATE position sync - multiple calls to ensure it sticks
    if (syncPositions) {
      syncPositions(regionStart, `resetToRegionStart_${source}`);
    }
    refs.syncPositionRef.current = regionStart;
    refs.currentPositionRef.current = regionStart;
    refs.lastPositionRef.current = regionStart;

    // IMMEDIATE volume and overlay update
    if (updateVolume) {
      updateVolume(regionStart, true, true);
    }
    if (drawVolumeOverlay) {
      drawVolumeOverlay(true);
    }


  }, [syncPositions, updateVolume, drawVolumeOverlay]);

  // ✅ Copy togglePlayPause function từ WaveformSelector.jsx (dòng 650-750)
  const togglePlayPause = useCallback(() => {
    console.log("[DEBUG_PLAY] ========== TOGGLE PLAY PAUSE CALLED ==========");
    console.log("[DEBUG_PLAY] Current delete mode:", refs.removeModeRef?.current);
    console.log("[DEBUG_PLAY] Current wavesurfer position:", refs.wavesurferRef.current?.getCurrentTime()?.toFixed(2));
    console.log("[DEBUG_PLAY] Current sync position:", refs.syncPositionRef?.current?.toFixed(2));
    console.log("[DEBUG_PLAY] State isPlaying:", state.isPlaying);
    
    if (!refs.wavesurferRef.current || !refs.regionRef.current) {
      console.log("[DEBUG_PLAY] Missing refs - exiting");
      return;
    }

    if (!syncPositions) {
      console.error('[togglePlayPause] CRITICAL: syncPositions is not available!');
      return;
    }

    if (state.isPlaying) {
      console.log("[DEBUG_PLAY] Pausing playback");
      const currentPos = refs.wavesurferRef.current.getCurrentTime();
      syncPositions(currentPos, "togglePlayPausePause");

      if (refs.animationFrameRef.current) {
        cancelAnimationFrame(refs.animationFrameRef.current);
        refs.animationFrameRef.current = null;
      }

      refs.wavesurferRef.current.pause();

      const totalDuration = refs.wavesurferRef.current.getDuration();
      refs.wavesurferRef.current.seekTo(currentPos / totalDuration);

      setters.setIsPlaying(false);
      onPlayStateChange(false);
      if (drawVolumeOverlay) drawVolumeOverlay();
    } else {
      console.log("[DEBUG_PLAY] Starting playback");
      const start = refs.regionRef.current.start;
      const end = refs.regionRef.current.end;

      // === FIX: Ưu tiên vị trí hiện tại thay vì resumePosition ===
      const currentWsPosition = refs.wavesurferRef.current.getCurrentTime();
      const syncedPosition = refs.syncPositionRef.current;

      let playFrom;
      
      // ✅ Define region bounds for all logic (both normal and delete mode)
      const regionStart = refs.regionRef.current.start;
      const regionEnd = refs.regionRef.current.end;
      
      // ✅ SIMPLIFIED: Delete mode logic - always play from current/smart position
      const currentDeleteMode = refs.removeModeRef?.current;
      if (currentDeleteMode) {
        // Smart position selection for delete mode
        if (currentWsPosition < regionStart) {
          // Currently before delete region - play from current position
          playFrom = currentWsPosition;
          console.log("[DELETE_MODE_PLAY] Playing from current position before delete region:", playFrom.toFixed(2));
        } else if (currentWsPosition >= regionStart && currentWsPosition <= regionEnd) {
          // Currently inside delete region - start from region end
          playFrom = regionEnd;
          console.log("[DELETE_MODE_PLAY] Currently in delete region - starting from region end:", playFrom.toFixed(2));
        } else {
          // Currently after delete region - play from current position
          playFrom = currentWsPosition;
          console.log("[DELETE_MODE_PLAY] Playing from current position after delete region:", playFrom.toFixed(2));
        }
        
        console.log("[DELETE_MODE_PLAY] ====== DELETE MODE PLAY START ======");
        console.log("[DELETE_MODE_PLAY] Simplified logic - play from smart position:");
        console.log("[DELETE_MODE_PLAY] Final play position:", {
          currentPosition: currentWsPosition.toFixed(2),
          regionStart: regionStart.toFixed(2),
          regionEnd: regionEnd.toFixed(2),
          playFrom: playFrom.toFixed(2),
          strategy: "smart_position_auto_skip"
        });
        console.log("[DELETE_MODE_PLAY] ===================================");
        
        // ✅ CRITICAL: In delete mode, seek to calculated position before playing
        const totalDuration = refs.wavesurferRef.current.getDuration();
        const playRatio = playFrom / totalDuration;
        console.log("[DELETE_MODE_PLAY] Seeking to play position - ratio:", playRatio.toFixed(4));
        refs.wavesurferRef.current.seekTo(playRatio);
        syncPositions(playFrom, "deletePlaySeekToPosition");
        
        // ✅ NEW: Set a timeout to clear the drag operation flag after use to prevent it persisting indefinitely
        setTimeout(() => {
          if (refs.currentDragOperationRef) {
            console.log("[DELETE_MODE_PLAY] Auto-clearing drag operation flag after use:", refs.currentDragOperationRef.current);
            refs.currentDragOperationRef.current = null;
          }
        }, 1000); // Clear after 1 second
        
        // Small delay to ensure seek completes
        setTimeout(() => {
          const verifyPosition = refs.wavesurferRef.current.getCurrentTime();
          console.log("[DELETE_MODE_PLAY] Position verification after seek:", verifyPosition.toFixed(2));
        }, 10);
      } else {
        // Normal mode logic: Ưu tiên vị trí hiện tại nếu nó trong region
        if (currentWsPosition >= start && currentWsPosition < end) {
          playFrom = currentWsPosition;
        } else if (syncedPosition >= start && syncedPosition < end) {
          playFrom = syncedPosition;
        } else {
          // Fallback về resumePosition hoặc region start
          const resumePosition = refs.lastPositionRef.current;
          playFrom =
            resumePosition >= start && resumePosition < end
              ? resumePosition
              : start;
        }
        console.log("[NORMAL_MODE_PLAY] Playing from calculated position:", playFrom.toFixed(2));
      }

      const newProfile = state.fadeIn && state.fadeOut 
        ? "uniform"  // Use uniform when both fade options are active
        : state.fadeIn 
          ? "fadeIn"
          : state.fadeOut 
            ? "fadeOut"
            : "uniform";

      // CRITICAL: Special handling for fadeIn profile
      const isFadeInProfile = newProfile === "fadeIn";

      console.log("[DEBUG_PLAY] Final playFrom position:", playFrom.toFixed(2));
      syncPositions(playFrom, currentDeleteMode ? "deletePlayStart" : "togglePlayPausePlay");
      if (updateVolume) {
        updateVolume(playFrom, true, true);
      }

      // ENHANCED: Force immediate volume update for fadeIn to prevent silence
      if (isFadeInProfile) {
        console.log("[DEBUG_PLAY] FadeIn profile - forcing volume updates");
        // Force multiple volume updates to ensure it takes effect
        setTimeout(() => {
          if (refs.wavesurferRef.current && refs.regionRef.current && updateVolume) {
            const currentPos = refs.wavesurferRef.current.getCurrentTime();
            updateVolume(currentPos, true, true);
            if (drawVolumeOverlay) drawVolumeOverlay(true);
          }
        }, 50);
        
        setTimeout(() => {
          if (refs.wavesurferRef.current && refs.regionRef.current && updateVolume) {
            const currentPos = refs.wavesurferRef.current.getCurrentTime();
            updateVolume(currentPos, true, true);
          }
        }, 100);
      }

      // ✅ UPDATED: Delete mode playback logic - let updateRealtimeVolume handle skip
      if (currentDeleteMode) {
        // ✅ DEBUG: Reset delete frame counter when starting new playback
        if (refs.deleteFrameCountRef) {
          refs.deleteFrameCountRef.current = 0;
        }
        
        // In delete mode, start playing from calculated position
        // updateRealtimeVolume will automatically skip the delete region when reached
        const trackDuration = refs.wavesurferRef.current.getDuration();
        
        console.log("[DELETE_MODE_PLAY] ====== CALLING WAVESURFER PLAY ======");
        console.log("[DELETE_MODE_PLAY] Starting seamless playback with auto-skip");
        console.log("[DELETE_MODE_PLAY] play(", playFrom.toFixed(2), ",", trackDuration.toFixed(2), ")");
        console.log("[DELETE_MODE_PLAY] Delete region [", regionStart.toFixed(2), "-", regionEnd.toFixed(2), "] will be auto-skipped");
        
        // ✅ CRITICAL: Add delay to ensure seek completed before play
        setTimeout(() => {
          const actualPosition = refs.wavesurferRef.current.getCurrentTime();
          console.log("[DELETE_MODE_PLAY] Actual position before play:", actualPosition.toFixed(2));
          console.log("[DELETE_MODE_PLAY] Expected position:", playFrom.toFixed(2));
          
          // ✅ Start playing from calculated position to track end
          // updateRealtimeVolume will handle the skip automatically
          refs.wavesurferRef.current.play(playFrom, trackDuration);
          console.log("[DELETE_MODE_PLAY] Play call completed - auto-skip enabled");
        }, 50);
        console.log("[DELETE_MODE_PLAY] ===================================");
      } else {
        // Normal mode: play within region
        console.log("[NORMAL_MODE_PLAY] Playing within region from", playFrom.toFixed(2), "to", end.toFixed(2));
        refs.wavesurferRef.current.play(playFrom, end);
      }

      setters.setIsPlaying(true);
      onPlayStateChange(true);

      if (loop) {
        console.log("[DEBUG_PLAY] Loop is enabled");
      }
    }

    setTimeout(() => {
      verifyPlaybackState();
    }, 100);
  }, [state.isPlaying, syncPositions, updateVolume, drawVolumeOverlay, onPlayStateChange, loop]);

  // ✅ Copy handlePlaybackEnd function từ WaveformSelector.jsx (dòng 1050-1100)
  const handlePlaybackEnd = useCallback(() => {
    // Critical validation
    if (!refs.wavesurferRef.current || !refs.regionRef.current) {
      console.error(
        "[handlePlaybackEnd] Missing refs - wavesurfer:",
        !!refs.wavesurferRef.current,
        "region:",
        !!refs.regionRef.current
      );
      return;
    }

    // Prevent recursive calls
    if (refs.isEndingPlaybackRef.current) {
      return;
    }

    // Lock the handler
    refs.isEndingPlaybackRef.current = true;
    try {
      // Stop all animations immediately
      if (refs.animationFrameRef.current) {
        cancelAnimationFrame(refs.animationFrameRef.current);
        refs.animationFrameRef.current = null;
      }

      if (refs.overlayAnimationFrameRef.current) {
        cancelAnimationFrame(refs.overlayAnimationFrameRef.current);
        refs.overlayAnimationFrameRef.current = null;
      }

      // Pause WaveSurfer if playing
      if (
        refs.wavesurferRef.current.isPlaying &&
        refs.wavesurferRef.current.isPlaying()
      ) {
        refs.wavesurferRef.current.pause();
      }

      // Update state immediately
      setters.setIsPlaying(false);
      if (onPlayStateChange) onPlayStateChange(false);
      if (onPlayEnd) onPlayEnd();

      // ✅ NEW: Different reset behavior for delete mode
      const currentDeleteMode = refs.removeModeRef?.current;
      if (currentDeleteMode) {
        // In delete mode, reset to track beginning for full preview
        console.log("[handlePlaybackEnd] DELETE MODE: Resetting to track beginning");
        const totalDuration = refs.wavesurferRef.current.getDuration();
        refs.wavesurferRef.current.seekTo(0);
        syncPositions(0, "deletePlaybackEnd");
        if (updateVolume) updateVolume(0, true, true);
      } else {
        // Normal mode: reset to region start
        resetToRegionStart("handlePlaybackEnd_force");
      }
    } catch (error) {
      console.error("[handlePlaybackEnd] Exception:", error);
    } finally {
      // Unlock handler
      setTimeout(() => {
        refs.isEndingPlaybackRef.current = false;
      }, 100);
    }
  }, [onPlayStateChange, onPlayEnd, resetToRegionStart, syncPositions, updateVolume]);

  // ✅ Copy handleLoopPlayback function từ WaveformSelector.jsx (dòng 1000-1050)  
  const handleLoopPlayback = useCallback(() => {

    
    if (!refs.wavesurferRef.current || !refs.regionRef.current) {

      return;
    }

    const start = refs.regionRef.current.start;
    const end = refs.regionRef.current.end;



    // === SYNC FIX: Update synchronized position for loop restart ===
    if (syncPositions) {
      syncPositions(start, "handleLoopPlayback");
    }

    if (!state.isPlaying) {
      setters.setIsPlaying(true);
      onPlayStateChange(true);
    }

    refs.wavesurferRef.current.pause();

    const totalDuration = refs.wavesurferRef.current.getDuration();
    refs.wavesurferRef.current.seekTo(start / totalDuration);

    setTimeout(() => {
      if (!refs.wavesurferRef.current || !refs.regionRef.current || !loop) return;

      if (refs.wavesurferRef.current.getCurrentTime() !== start) {
        refs.wavesurferRef.current.seekTo(start / totalDuration);
      }

      if (updateVolume) {
        updateVolume(start, true, true);
      }

      refs.wavesurferRef.current.play(start, end);

      if (refs.animationFrameRef.current) {
        cancelAnimationFrame(refs.animationFrameRef.current);
      }
      refs.animationFrameRef.current = requestAnimationFrame(updateRealtimeVolume);
    }, 50);
  }, [state.isPlaying, syncPositions, updateVolume, onPlayStateChange, loop]);

  // ✅ Copy updateRealtimeVolume function từ WaveformSelector.jsx (dòng 1150-1250)
  const updateRealtimeVolume = useCallback(() => {
    // Basic validation checks
    if (!refs.wavesurferRef.current || !refs.regionRef.current || !state.isPlaying) return;
  
    const isWavesurferPlaying = refs.wavesurferRef.current.isPlaying 
      ? refs.wavesurferRef.current.isPlaying() 
      : state.isPlaying && !refs.wavesurferRef.current.paused;
  
    if (!isWavesurferPlaying) {
      handlePlaybackEnd();
      return;
    }
  
    // Get current position and region bounds
    const currentPos = refs.wavesurferRef.current.getCurrentTime();
    const regionStart = refs.regionRef.current.start;
    const regionEnd = refs.regionRef.current.end;
    const currentDeleteMode = refs.removeModeRef?.current;
    
    // ✅ FIXED: Skip delete region in delete mode for seamless playback
    if (currentDeleteMode) {
      // ✅ NEW: Check if we're approaching or inside the delete region
      const SKIP_TOLERANCE = 0.1; // 100ms before region start to ensure smooth transition
      const isApproachingDeleteRegion = currentPos >= (regionStart - SKIP_TOLERANCE) && currentPos < regionStart;
      const isInsideDeleteRegion = currentPos >= regionStart && currentPos <= regionEnd;
      
      if (isApproachingDeleteRegion || isInsideDeleteRegion) {
        console.log(`[DELETE_MODE_SKIP] Skipping delete region - currentPos: ${currentPos.toFixed(3)}s, jumping to regionEnd: ${regionEnd.toFixed(3)}s`);
        
        // ✅ CRITICAL: Jump to region end to skip the delete region
        const totalDuration = refs.wavesurferRef.current.getDuration();
        const seekRatio = regionEnd / totalDuration;
        
        refs.wavesurferRef.current.seekTo(seekRatio);
        if (syncPositions) syncPositions(regionEnd, "deleteRegionSkip");
        
        // ✅ Continue playing from region end to track end
        refs.wavesurferRef.current.play(regionEnd, totalDuration);
        console.log(`[DELETE_MODE_SKIP] Resumed playback from ${regionEnd.toFixed(3)}s to ${totalDuration.toFixed(3)}s`);
        
        // Update volume for new position
        if (updateVolume) updateVolume(regionEnd, true, true);
        if (drawVolumeOverlay) drawVolumeOverlay(true);
        
        refs.animationFrameRef.current = requestAnimationFrame(updateRealtimeVolume);
        return;
      }
      
      // ✅ NORMAL: Regular delete mode playback (before region start or after region end)
      // ✅ DEBUG: Add first call detection for delete mode
      if (!refs.deleteFrameCountRef) {
        refs.deleteFrameCountRef = { current: 0 };
        console.log(`[updateRealtimeVolume] DELETE MODE: First call - position: ${currentPos.toFixed(3)}s, region: [${regionStart.toFixed(3)}s-${regionEnd.toFixed(3)}s]`);
      }
      
      // ✅ PERFORMANCE FIX: Reduced frequency updates in delete mode
      refs.deleteFrameCountRef.current++;
      
      // Add occasional debug logs
      if (refs.deleteFrameCountRef.current % 30 === 0) {
        console.log(`[updateRealtimeVolume] DELETE MODE: Playing outside delete region - position: ${currentPos.toFixed(3)}s (frame ${refs.deleteFrameCountRef.current})`);
      }
      
      if (refs.deleteFrameCountRef.current % 5 === 0) {
        if (updateVolume) updateVolume(currentPos, false, false);
        if (drawVolumeOverlay) drawVolumeOverlay(false); // ✅ Don't force redraw
      }
      
      // ✅ FIXED: Track end detection - check against total duration, not region end
      const totalDuration = refs.wavesurferRef.current.getDuration();
      const END_TOLERANCE = TIMING_CONSTANTS.END_TOLERANCE * 2;
      const distanceToTrackEnd = totalDuration - currentPos;
      
      if (distanceToTrackEnd <= END_TOLERANCE) {
        console.log(`[DELETE_MODE_END] Reached track end at ${currentPos.toFixed(3)}s`);
        if (refs.animationFrameRef.current) {
          cancelAnimationFrame(refs.animationFrameRef.current);
          refs.animationFrameRef.current = null;
        }
        handlePlaybackEnd();
        return;
      }
      
      refs.animationFrameRef.current = requestAnimationFrame(updateRealtimeVolume);
      return;
    }
    
    // ✅ NORMAL MODE: Standard bounds checking and correction
    if (currentPos < regionStart) {
      // Only log significant corrections (>0.5s drift)
      if (Math.abs(currentPos - regionStart) > 0.5) {
        console.warn(`[updateRealtimeVolume] Position correction: ${currentPos.toFixed(3)}s → ${regionStart.toFixed(3)}s`);
      }
      
      const totalDuration = refs.wavesurferRef.current.getDuration();
      refs.wavesurferRef.current.seekTo(regionStart / totalDuration);
      refs.wavesurferRef.current.play(regionStart, regionEnd);
      return;
    }
  
    // Volume update with minimal logging
    const currentProfile = refs.currentProfileRef.current;
    if (currentProfile === "fadeIn") {
      const relPos = (currentPos - regionStart) / (regionEnd - regionStart);
      if (updateVolume) updateVolume(currentPos, true, true);
      
      // Only log critical errors
      const currentVol = refs.currentVolumeRef.current;
      if (currentVol < 0.01 && relPos > 0.02) {
        console.error(`[updateRealtimeVolume] FADEIN ERROR: Volume=${currentVol.toFixed(4)} at relPos=${relPos.toFixed(4)}`);
        
        setTimeout(() => {
          if (refs.wavesurferRef.current && updateVolume) {
            updateVolume(refs.wavesurferRef.current.getCurrentTime(), true, true);
          }
        }, 10);
      }
    } else {
      if (updateVolume) updateVolume(currentPos, false, false);
    }
  
    // ✅ PERFORMANCE: Normal mode - throttled volume overlay updates
    if (drawVolumeOverlay) {
      if (!refs.normalFrameCountRef) refs.normalFrameCountRef = { current: 0 };
      refs.normalFrameCountRef.current++;
      
      // Update overlay every 3rd frame for smoother performance
      if (refs.normalFrameCountRef.current % 3 === 0) {
        drawVolumeOverlay(true);
      }
    }
  
    // End detection
    const END_TOLERANCE = TIMING_CONSTANTS.END_TOLERANCE;
    const distanceToEnd = regionEnd - currentPos;
  
    if (distanceToEnd <= END_TOLERANCE) {
      if (refs.animationFrameRef.current) {
        cancelAnimationFrame(refs.animationFrameRef.current);
        refs.animationFrameRef.current = null;
      }
      
      handlePlaybackEnd();
      return;
    }
  
    refs.animationFrameRef.current = requestAnimationFrame(updateRealtimeVolume);
  }, [state.isPlaying, handlePlaybackEnd, updateVolume, drawVolumeOverlay, onTimeUpdate]);

  // ✅ Copy verifyPlaybackState function từ WaveformSelector.jsx (dòng 1250-1300)
  const verifyPlaybackState = useCallback(() => {
    if (!refs.wavesurferRef.current || !refs.regionRef.current) return;
  
    const wavesurferPlaying = refs.wavesurferRef.current.isPlaying 
      ? refs.wavesurferRef.current.isPlaying() 
      : false;
    const internalPlaying = state.isPlaying;
  
    if (wavesurferPlaying !== internalPlaying) {
      if (wavesurferPlaying && !internalPlaying) {
        setters.setIsPlaying(true);
        if (onPlayStateChange) onPlayStateChange(true);
      } else if (!wavesurferPlaying && internalPlaying) {
        // Get current position BEFORE changing isPlaying state
        const currentPos = refs.wavesurferRef.current.getCurrentTime();
        const regionStart = refs.regionRef.current.start;
        const regionEnd = refs.regionRef.current.end;
        const END_TOLERANCE = 0.05; // 50ms tolerance for natural playback end
        
        // ✅ FIX: Check delete mode before position correction
        const currentDeleteMode = refs.removeModeRef?.current;
  
        // Check if this is a natural playback end (position slightly past region end)
        const pastRegionEnd = currentPos > regionEnd;
        const endDistance = currentPos - regionEnd;
        const isNaturalEnd = pastRegionEnd && endDistance <= END_TOLERANCE;
  
        if (isNaturalEnd) {
          // Use resetToRegionStart helper for smooth reset
          resetToRegionStart("verifyPlaybackState_naturalEnd");
        } else if (currentPos >= regionStart && currentPos <= regionEnd) {
          if (syncPositions) syncPositions(currentPos, "verifyPlaybackStatePreserve");
        } else if (!currentDeleteMode) {
          // ✅ FIX: Only reset position if NOT in delete mode
          resetToRegionStart("verifyPlaybackState_correction");
        } else {
          // ✅ FIX: In delete mode, preserve current position
          console.log(`[verifyPlaybackState] DELETE MODE: Preserving position ${currentPos.toFixed(3)}s outside region [${regionStart.toFixed(3)}s-${regionEnd.toFixed(3)}s]`);
          if (syncPositions) syncPositions(currentPos, "verifyPlaybackStateDeleteMode");
        }
  
        // Change the state - position has been handled appropriately
        setters.setIsPlaying(false);
        if (onPlayStateChange) onPlayStateChange(false);
      }
    }
  }, [state.isPlaying, onPlayStateChange, syncPositions, resetToRegionStart]);

  // ✅ Copy ensurePlaybackWithinBounds function từ WaveformSelector.jsx (dòng 1300-1350)
  const ensurePlaybackWithinBounds = useCallback(() => {
    if (!refs.wavesurferRef.current || !refs.regionRef.current || !state.isPlaying) return;
    
    const currentPos = refs.wavesurferRef.current.getCurrentTime();
    const regionStart = refs.regionRef.current.start;
    const regionEnd = refs.regionRef.current.end;
    
    // ✅ FIX: Skip bounds correction in delete mode
    const currentDeleteMode = refs.removeModeRef?.current;
    if (currentDeleteMode) {
      console.log(`[ensurePlaybackWithinBounds] DELETE MODE: Skipping bounds check - position: ${currentPos.toFixed(3)}s, regionStart: ${regionStart.toFixed(3)}s`);
      return;
    }
    
    // Only log when significant bounds violations occur
    const isOutOfBounds = currentPos < regionStart || currentPos >= regionEnd;
    
    // If position is outside bounds, correct it
    if (isOutOfBounds) {
      // Only log significant position corrections
      const drift = Math.min(Math.abs(currentPos - regionStart), Math.abs(currentPos - regionEnd));
      if (drift > 0.5) {
        console.log(`[ensurePlaybackWithinBounds] Correcting position drift: ${drift.toFixed(3)}s`);
      }
      
      // Stop current playback
      refs.wavesurferRef.current.pause();
      
      // Seek to region start
      const totalDuration = refs.wavesurferRef.current.getDuration();
      refs.wavesurferRef.current.seekTo(regionStart / totalDuration);
      
      // Restart playback from region start to end
      setTimeout(() => {
        if (refs.wavesurferRef.current && refs.regionRef.current && state.isPlaying) {
          refs.wavesurferRef.current.play(regionStart, regionEnd);
          
          // Update position references
          if (syncPositions) syncPositions(regionStart, "ensurePlaybackWithinBounds");
          if (updateVolume) updateVolume(regionStart, true, true);
        }
      }, 50);
    }
  }, [state.isPlaying, syncPositions, updateVolume]);

  return {
    togglePlayPause,
    handlePlaybackEnd,
    handleLoopPlayback,
    updateRealtimeVolume,
    verifyPlaybackState,
    ensurePlaybackWithinBounds,
    resetToRegionStart
  };
};