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
      
      // ✅ NEW: Delete mode logic - always play from current position
      const currentDeleteMode = refs.removeModeRef?.current;
      if (currentDeleteMode) {
        // In delete mode, always play from current position (which has been positioned correctly)
        playFrom = currentWsPosition;
        console.log("[DELETE_MODE_PLAY] ====== DELETE MODE PLAY START ======");
        console.log("[DELETE_MODE_PLAY] Playing from current position:", {
          currentPosition: currentWsPosition.toFixed(2),
          regionStart: start.toFixed(2),
          regionEnd: end.toFixed(2),
          purpose: "Respect positioned playback in delete mode"
        });
        console.log("[DELETE_MODE_PLAY] ===================================");
        
        // ✅ CRITICAL: In delete mode, ensure position is correct before playing
        // Force seek to ensure position is exactly where we want
        const totalDuration = refs.wavesurferRef.current.getDuration();
        const currentRatio = currentWsPosition / totalDuration;
        console.log("[DELETE_MODE_PLAY] Force seeking to ensure position - ratio:", currentRatio.toFixed(4));
        refs.wavesurferRef.current.seekTo(currentRatio);
        
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

      // ✅ NEW: Delete mode playback logic
      if (currentDeleteMode) {
        // In delete mode, play from current position to track end (to hear what remains after delete)
        const trackDuration = refs.wavesurferRef.current.getDuration();
        console.log("[DELETE_MODE_PLAY] ====== CALLING WAVESURFER PLAY ======");
        console.log("[DELETE_MODE_PLAY] play(", playFrom.toFixed(2), ",", trackDuration.toFixed(2), ")");
        
        // ✅ CRITICAL: Add delay to ensure seek completed before play
        setTimeout(() => {
          const actualPosition = refs.wavesurferRef.current.getCurrentTime();
          console.log("[DELETE_MODE_PLAY] Actual position before play:", actualPosition.toFixed(2));
          console.log("[DELETE_MODE_PLAY] Expected position:", playFrom.toFixed(2));
          
          refs.wavesurferRef.current.play(playFrom, trackDuration);
          console.log("[DELETE_MODE_PLAY] Play call completed");
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

      // Reset to region start using helper function
      resetToRegionStart("handlePlaybackEnd_force");
    } catch (error) {
      console.error("[handlePlaybackEnd] Exception:", error);
    } finally {
      // Unlock handler
      setTimeout(() => {
        refs.isEndingPlaybackRef.current = false;
      }, 100);
    }
  }, [onPlayStateChange, onPlayEnd, resetToRegionStart]);

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
  
    // CRITICAL: Check if position is outside region bounds
    if (currentPos < regionStart) {
      // Only log significant corrections (>0.5s drift)
      if (Math.abs(currentPos - regionStart) > 0.5) {
        console.warn(`[updateRealtimeVolume] Position correction: ${currentPos.toFixed(3)}s → ${regionStart.toFixed(3)}s`);
      }
      
      const totalDuration = refs.wavesurferRef.current.getDuration();
      refs.wavesurferRef.current.seekTo(regionStart / totalDuration);
      refs.wavesurferRef.current.play(regionStart, regionEnd);
      
      refs.syncPositionRef.current = regionStart;
      refs.currentPositionRef.current = regionStart;
      refs.lastPositionRef.current = regionStart;
      
      setters.setCurrentTime(regionStart);
      if (onTimeUpdate) onTimeUpdate(regionStart);
      if (updateVolume) updateVolume(regionStart, true, true);
      
      refs.animationFrameRef.current = requestAnimationFrame(updateRealtimeVolume);
      return;
    }
  
    // Validation for position accuracy
    if (currentPos > regionEnd + 0.1) {
      if (refs.animationFrameRef.current) {
        cancelAnimationFrame(refs.animationFrameRef.current);
        refs.animationFrameRef.current = null;
      }
      
      handlePlaybackEnd();
      return;
    }
  
    // Update position references
    refs.syncPositionRef.current = currentPos;
    refs.currentPositionRef.current = currentPos;
    refs.lastPositionRef.current = currentPos;
  
    setters.setCurrentTime(currentPos);
    if (onTimeUpdate) onTimeUpdate(currentPos);
  
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
  
    if (drawVolumeOverlay) drawVolumeOverlay(true);
  
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
  
        // Check if this is a natural playback end (position slightly past region end)
        const pastRegionEnd = currentPos > regionEnd;
        const endDistance = currentPos - regionEnd;
        const isNaturalEnd = pastRegionEnd && endDistance <= END_TOLERANCE;
  
        if (isNaturalEnd) {

          // Use resetToRegionStart helper for smooth reset
          resetToRegionStart("verifyPlaybackState_naturalEnd");
        } else if (currentPos >= regionStart && currentPos <= regionEnd) {
          if (syncPositions) syncPositions(currentPos, "verifyPlaybackStatePreserve");
        } else {

          resetToRegionStart("verifyPlaybackState_correction");
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
    
    // Only log when significant bounds violations occur
    const isOutOfBounds = currentPos < regionStart || currentPos >= regionEnd;
    
    // If position is outside bounds, correct it
    if (isOutOfBounds) {
      // Only log significant position corrections
      const drift = Math.min(Math.abs(currentPos - regionStart), Math.abs(currentPos - regionEnd));
      if (drift > 0.5) {

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