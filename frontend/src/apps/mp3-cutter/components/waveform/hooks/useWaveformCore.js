// ===================================================================
// WAVEFORM CORE HOOK - Core WaveSurfer + Region logic
// ===================================================================
import { useCallback, useRef } from 'react';

// CRITICAL: Function to ensure playback stays within region bounds
export const useWaveformCore = (dependencies = {}) => {
  const {
    wavesurferRef,
    regionRef,
    isPlaying,
    regionStartTime,
    regionEndTime,
    syncPositionRef,
    currentPositionRef,
    lastPositionRef,
    currentVolumeRef,
    currentProfileRef,
    fadeEnabledRef,
    fadeInRef,
    fadeOutRef,
    intendedVolumeRef,
    customVolumeRef,
    fadeInDurationRef,
    fadeOutDurationRef,
    syncPositions,
    setCurrentTime,
    onTimeUpdate,
    setCurrentPosition,
    setCurrentVolumeDisplay,
    drawVolumeOverlay,
    isDraggingRef,
    lastSyncTimeRef,
    isSyncingRef,
    animationFrameRef,
    DRAW_INTERVAL,
    volumeProfile
  } = dependencies;

  // ===================================================================
  // VOLUME CALCULATION - Pure function for calculating volume based on profile
  // ===================================================================
  const calculateVolumeForProfile = useCallback((relPos, profile) => {
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
  }, [regionRef, fadeEnabledRef, fadeInRef, fadeOutRef, intendedVolumeRef, customVolumeRef, fadeInDurationRef, fadeOutDurationRef]);

  // ===================================================================
  // VOLUME UPDATE - Update volume based on current position and profile
  // ===================================================================
  const updateVolume = useCallback((absPosition = null, forceUpdate = false, forceRedraw = false) => {
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
  }, [wavesurferRef, regionRef, isPlaying, syncPositionRef, lastPositionRef, currentVolumeRef, currentProfileRef, isDraggingRef, syncPositions, setCurrentVolumeDisplay, drawVolumeOverlay, calculateVolumeForProfile]);

  // ===================================================================
  // TOGGLE PLAY/PAUSE - Main playback control
  // ===================================================================
  const togglePlayPause = useCallback(() => {
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

      // Note: setIsPlaying and onPlayStateChange should be handled by parent
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

      // Note: setIsPlaying and onPlayStateChange should be handled by parent
    }
  }, [wavesurferRef, regionRef, isPlaying, syncPositionRef, lastPositionRef, currentProfileRef, fadeEnabledRef, animationFrameRef, syncPositions, updateVolume, drawVolumeOverlay]);

  // ===================================================================
  // ENSURE PLAYBACK WITHIN BOUNDS - Correct position if outside region
  // ===================================================================
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
  }, [wavesurferRef, regionRef, isPlaying, syncPositions, updateVolume]);

  return {
    calculateVolumeForProfile,
    updateVolume,
    togglePlayPause,
    ensurePlaybackWithinBounds
  };
}; 