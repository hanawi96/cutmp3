import { useCallback, useRef, useEffect } from 'react';
import { calculateVolumeForProfile } from '../services/volumeCalculator.js';

/**
 * Hook quản lý volume control logic
 */
export const useVolumeControl = (refs, state, setters, props, dependencies) => {
  const { volumeProfile, volume, customVolume, fade, fadeIn, fadeOut } = props;
  const { syncPositions } = dependencies;
  
  // ✅ FIX: Use ref to store dynamic dependency
  const drawVolumeOverlayRef = useRef(dependencies.drawVolumeOverlay);
  
  // ✅ FIX: Update ref when dependency changes
  useEffect(() => {
    drawVolumeOverlayRef.current = dependencies.drawVolumeOverlay;
  }, [dependencies.drawVolumeOverlay]);
  
  console.log('[useVolumeControl] Initializing with props:', props);
  
  // ✅ Copy calculateVolumeForProfileWrapper từ WaveformSelector.jsx (dòng 850-870)
  const calculateVolumeForProfileWrapper = useCallback((relPos, profile) => {
    const volumeRefs = {
      intendedVolume: refs.intendedVolumeRef.current,
      customVolume: refs.customVolumeRef.current,
      fadeEnabled: refs.fadeEnabledRef.current,
      fadeIn: refs.fadeInRef.current,
      fadeOut: refs.fadeOutRef.current,
      regionDuration: refs.regionRef.current ? refs.regionRef.current.end - refs.regionRef.current.start : 0,
      fadeInDuration: refs.fadeInDurationRef.current,
      fadeOutDuration: refs.fadeOutDurationRef.current
    };
    
    return calculateVolumeForProfile(relPos, profile, volumeRefs);
  }, [refs]);

  // ✅ Copy updateVolume function từ WaveformSelector.jsx (dòng 1161-1270)
  const updateVolume = useCallback((absPosition = null, forceUpdate = false, forceRedraw = false) => {
    console.log('[useVolumeControl] updateVolume called', { absPosition, forceUpdate, forceRedraw });
    
    if (!refs.wavesurferRef.current || !refs.regionRef.current) {
      return;
    }

    const regionStart = refs.regionRef.current.start;
    const regionEnd = refs.regionRef.current.end;
    
    // CRITICAL: Validate region bounds
    if (!isFinite(regionStart) || !isFinite(regionEnd) || regionEnd <= regionStart) {
      console.error('[updateVolume] Invalid region bounds:', { regionStart, regionEnd });
      return;
    }

    const currentPos = absPosition ?? (state.isPlaying ? refs.wavesurferRef.current.getCurrentTime() : refs.syncPositionRef.current);
    
    // CRITICAL: Validate currentPos
    if (!isFinite(currentPos) || isNaN(currentPos)) {
      console.error('[updateVolume] Invalid currentPos:', currentPos);
      return;
    }

    if (absPosition !== null) {
      syncPositions(currentPos, "updateVolume");
    }

    const start = refs.regionRef.current.start;
    const end = refs.regionRef.current.end;
    const regionDuration = end - start;
    
    // CRITICAL: Validate regionDuration
    if (!isFinite(regionDuration) || regionDuration <= 0) {
      console.error('[updateVolume] Invalid regionDuration:', regionDuration);
      return;
    }
    
    // Early return if position hasn't changed significantly and not forced
    if (!forceUpdate && Math.abs(currentPos - refs.lastPositionRef.current) < 0.01) {
      return;
    }
    
    const relPos = Math.max(0, Math.min(1, (currentPos - start) / regionDuration));
    
    // CRITICAL: Validate relPos
    if (!isFinite(relPos) || isNaN(relPos)) {
      console.error('[updateVolume] Invalid relPos:', relPos, 'currentPos:', currentPos, 'start:', start, 'regionDuration:', regionDuration);
      return;
    }

    // Only log critical errors for fadeIn profile
    const isFadeInProfile = refs.currentProfileRef.current === "fadeIn";
    if (isFadeInProfile) {
      const vol = calculateVolumeForProfileWrapper(relPos, refs.currentProfileRef.current);
      
      if (!isFinite(vol) || isNaN(vol)) {
        console.error(`[updateVolume] FADEIN CRITICAL: Invalid volume calculated: ${vol} for relPos=${relPos.toFixed(4)}`);
        return;
      }
      
      if (vol < 0.01 && relPos > 0.01) {
        console.error(`[updateVolume] FADEIN EMERGENCY: Volume too low (${vol.toFixed(4)}) for relPos=${relPos.toFixed(4)}`);
      }
    }

    const vol = calculateVolumeForProfileWrapper(relPos, refs.currentProfileRef.current);
    
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
    const volumeChanged = Math.abs(normalizedVol - refs.currentVolumeRef.current) > 0.001;
    
    if (volumeChanged || forceUpdate) {
      try {
        refs.wavesurferRef.current.setVolume(normalizedVol);
        setters.setCurrentVolumeDisplay(vol);
        refs.currentVolumeRef.current = vol;
        
        // Update last position only when we actually made changes
        refs.lastPositionRef.current = currentPos;
        
      } catch (error) {
        console.error('[updateVolume] Error setting volume:', error);
        return;
      }
    }

    // Conditional redraw - only when necessary
    if (forceRedraw || (volumeChanged && !refs.isDraggingRef.current)) {
      requestAnimationFrame(() => {
        if (drawVolumeOverlayRef.current && typeof drawVolumeOverlayRef.current === 'function') {
          drawVolumeOverlayRef.current();
        } else {
          console.warn('[updateVolume] drawVolumeOverlay is not available yet');
        }
      });
    }
  }, [state.isPlaying, calculateVolumeForProfileWrapper, syncPositions, refs, setters]);

  console.log('[useVolumeControl] Hook initialized successfully');

  return {
    updateVolume,
    calculateVolumeForProfileWrapper
  };
}; 