import { useCallback } from 'react';

/**
 * Hook quản lý playback control logic
 */
export const usePlaybackControl = (refs, state, setters, props, dependencies) => {
  const { loop, onPlayStateChange, onPlayEnd } = props;
  const { syncPositions, updateVolume, resetToRegionStart } = dependencies;
  
  console.log('[usePlaybackControl] Initializing with props:', props);

  // ✅ Copy togglePlayPause từ WaveformSelector.jsx
  const togglePlayPause = useCallback(() => {
    console.log('[usePlaybackControl] togglePlayPause called');
    
    if (!refs.wavesurferRef.current || !refs.regionRef.current) return;

    if (state.isPlaying) {
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
    } else {
      const start = refs.regionRef.current.start;
      const end = refs.regionRef.current.end;

      // === FIX: Ưu tiên vị trí hiện tại thay vì resumePosition ===
      const currentWsPosition = refs.wavesurferRef.current.getCurrentTime();
      const syncedPosition = refs.syncPositionRef.current;

      let playFrom;

      // Logic mới: Ưu tiên vị trí hiện tại nếu nó trong region
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

      refs.currentProfileRef.current =
        refs.fadeEnabledRef.current && props.volumeProfile === "uniform"
          ? "fadeInOut"
          : props.volumeProfile;

      // CRITICAL: Special handling for fadeIn profile
      const isFadeInProfile = refs.currentProfileRef.current === "fadeIn";

      syncPositions(playFrom, "togglePlayPausePlay");
      updateVolume(playFrom, true, true);

      refs.wavesurferRef.current.play(playFrom, end);

      setters.setIsPlaying(true);
      onPlayStateChange(true);

      if (loop) {
        // Silent loop mode activation
      }
    }
  }, [state.isPlaying, syncPositions, updateVolume, refs, setters, onPlayStateChange, loop, props.volumeProfile]);

  // ✅ Copy handlePlaybackEnd từ WaveformSelector.jsx
  const handlePlaybackEnd = useCallback(() => {
    console.log('[usePlaybackControl] handlePlaybackEnd called');
    
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
  }, [refs, setters, onPlayStateChange, onPlayEnd, resetToRegionStart]);

  // ✅ Copy handleLoopPlayback từ WaveformSelector.jsx
  const handleLoopPlayback = useCallback(() => {
    console.log('[usePlaybackControl] handleLoopPlayback called');
    
    if (!refs.wavesurferRef.current || !refs.regionRef.current) return;

    const start = refs.regionRef.current.start;
    const end = refs.regionRef.current.end;

    // === SYNC FIX: Update synchronized position for loop restart ===
    syncPositions(start, "handleLoopPlayback");

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

      updateVolume(start, true, true);

      refs.wavesurferRef.current.play(start, end);

      if (refs.animationFrameRef.current) {
        cancelAnimationFrame(refs.animationFrameRef.current);
      }
      // Note: updateRealtimeVolume would need to be passed as dependency or recreated
    }, 50);
  }, [refs, state.isPlaying, setters, onPlayStateChange, loop, syncPositions, updateVolume]);

  console.log('[usePlaybackControl] Hook initialized successfully');

  return {
    togglePlayPause,
    handlePlaybackEnd,
    handleLoopPlayback
  };
}; 