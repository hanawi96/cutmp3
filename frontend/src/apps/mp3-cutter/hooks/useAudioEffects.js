import { useCallback } from 'react';

// Audio effects handlers hook
export const useAudioEffects = (state, forceUpdateWaveform) => {
  // Update fadeDuration handlers - SIMPLIFIED
  const handleFadeInDurationChange = useCallback((duration) => {
    console.log("[handleFadeInDurationChange] Duration changed to:", duration);

    // Update state
    state.setFadeInDuration(duration);

    if (state.waveformRef.current) {
      // Update waveform fade duration
      if (state.waveformRef.current.setFadeInDuration) {
        state.waveformRef.current.setFadeInDuration(duration);
      }

      // Get current position for volume calculation
      const currentPos = state.waveformRef.current.getWavesurferInstance?.()?.getCurrentTime() || 0;

      // Update volume calculation immediately for realtime effect
      if (state.waveformRef.current.updateVolume) {
        state.waveformRef.current.updateVolume(currentPos, true, true);
      }

      // Update visual overlay
      if (state.waveformRef.current.drawVolumeOverlay) {
        state.waveformRef.current.drawVolumeOverlay(true);
      }

      // Force waveform update
      requestAnimationFrame(() => {
        if (state.waveformRef.current) {
          forceUpdateWaveform();
        }
      });
    }
  }, [state, forceUpdateWaveform]);

  const handleFadeOutDurationChange = useCallback((duration) => {
    console.log("[handleFadeOutDurationChange] Duration changed to:", duration);

    state.setFadeOutDuration(duration);

    if (state.waveformRef.current) {
      // Cập nhật fade duration
      if (state.waveformRef.current.setFadeOutDuration) {
        state.waveformRef.current.setFadeOutDuration(duration);
      }

      // OPTIMIZED: Single update call instead of multiple
      const currentPos =
        state.waveformRef.current.getWavesurferInstance?.()?.getCurrentTime() ||
        0;

      // Batch all updates together
      if (state.waveformRef.current.updateVolume) {
        state.waveformRef.current.updateVolume(currentPos, true, true);
      }

      // OPTIMIZED: Single delayed update instead of multiple timeouts
      setTimeout(() => {
        if (state.waveformRef.current) {
          forceUpdateWaveform();
          if (state.waveformRef.current.drawVolumeOverlay) {
            state.waveformRef.current.drawVolumeOverlay(true);
          }
        }
      }, 100); // Increased delay to avoid rapid updates
    }
  }, [state, forceUpdateWaveform]);

  const handleSpeedChange = useCallback((speed) => {
    // Update state immediately for UI responsiveness
    state.setPlaybackSpeed(speed);

    if (state.waveformRef.current) {
      const wavesurferInstance =
        state.waveformRef.current.getWavesurferInstance?.();
      if (wavesurferInstance) {
        try {
          // CRITICAL: Preserve current position and playing state
          const currentPosition = wavesurferInstance.getCurrentTime();
          const wasPlaying = wavesurferInstance.state && wavesurferInstance.state.isPlaying
            ? wavesurferInstance.state.isPlaying()
            : false;

          // Use requestAnimationFrame to avoid blocking UI
          requestAnimationFrame(() => {
            // Additional check in case component unmounted
            if (state.waveformRef.current) {
              const currentInstance =
                state.waveformRef.current.getWavesurferInstance?.();
              if (currentInstance) {
                // ENHANCED: Set speed without pausing if possible
                try {
                  // Set new playback rate directly without pausing
                  currentInstance.setPlaybackRate(speed);

                  // Verify position is still correct after speed change
                  const newPosition = currentInstance.getCurrentTime();
                  const positionDrift = Math.abs(newPosition - currentPosition);

                  if (positionDrift > 0.1) {
                    // Only log significant position corrections
                    console.log(
                      `[MP3CUTTER] Position drift detected (${positionDrift.toFixed(
                        4
                      )}s), correcting...`
                    );
                    const totalDuration = currentInstance.getDuration();
                    if (totalDuration > 0) {
                      const seekRatio = currentPosition / totalDuration;
                      currentInstance.seekTo(seekRatio);
                    }
                  }

                  // CRITICAL: Ensure playback continues if it was playing
                  if (wasPlaying) {
                    const regionBounds =
                      state.waveformRef.current.getRegionBounds?.();
                    if (regionBounds) {
                      const regionEnd = regionBounds.end;
                      const actualPosition = currentInstance.getCurrentTime();

                      // Only restart playback if WaveSurfer stopped
                      const isStillPlaying = currentInstance.state && currentInstance.state.isPlaying
                        ? currentInstance.state.isPlaying()
                        : false;

                      if (!isStillPlaying) {
                        setTimeout(() => {
                          if (currentInstance && state.waveformRef.current) {
                            currentInstance.play(actualPosition, regionEnd);

                            // CRITICAL: Ensure UI state stays in sync
                            setTimeout(() => {
                              if (state.waveformRef.current) {
                                const stillPlaying = currentInstance.state && currentInstance.state.isPlaying
                                  ? currentInstance.state.isPlaying()
                                  : false;
                                if (stillPlaying && !state.isPlaying) {
                                  state.setIsPlaying(true);
                                } else if (!stillPlaying && state.isPlaying) {
                                  state.setIsPlaying(false);
                                }
                              }
                            }, 100);
                          }
                        }, 50);
                      }
                    }
                  }
                } catch (speedError) {
                  console.error(
                    "[MP3CUTTER] state.Error setting speed directly, trying with pause method:",
                    speedError
                  );

                  // Fallback: pause and resume method
                  if (wasPlaying) {
                    currentInstance.pause();
                  }

                  currentInstance.setPlaybackRate(speed);

                  if (wasPlaying) {
                    const totalDuration = currentInstance.getDuration();
                    const seekRatio = currentPosition / totalDuration;
                    currentInstance.seekTo(seekRatio);

                    const regionBounds =
                      state.waveformRef.current.getRegionBounds?.();
                    if (regionBounds) {
                      setTimeout(() => {
                        currentInstance.play(currentPosition, regionBounds.end);
                        state.setIsPlaying(true); // Explicitly restore playing state
                      }, 100);
                    }
                  }
                }
              }
            }
          });
        } catch (error) {
          console.error(
            "[MP3CUTTER] ❌ state.Error setting playback rate:",
            error
          );
        }
      } else {
        console.warn("[MP3CUTTER] WaveSurfer instance not available");
      }
    }
  }, [state]);

  const handlePitchChange = useCallback((semitones) => {
    // Update UI immediately
    state.setPitchShift(semitones);

    if (state.waveformRef.current) {
      const wavesurferInstance =
        state.waveformRef.current.getWavesurferInstance?.();
      if (wavesurferInstance) {
        try {
          // Convert semitones to playback rate
          // Each semitone = 2^(1/12) ratio
          const pitchRatio = Math.pow(2, semitones / 12);

          // Preserve current position and playing state
          const currentPosition = wavesurferInstance.getCurrentTime();
          const wasPlaying = wavesurferInstance.state && wavesurferInstance.state.isPlaying
            ? wavesurferInstance.state.isPlaying()
            : false;

          // Apply new playback rate
          wavesurferInstance.setPlaybackRate(pitchRatio);

          // If was playing, ensure it continues with new rate
          if (wasPlaying) {
            const regionBounds = state.waveformRef.current.getRegionBounds?.();
            if (regionBounds) {
              // Small delay to ensure rate change is applied
              setTimeout(() => {
                if (wavesurferInstance && state.waveformRef.current) {
                  const currentPos = wavesurferInstance.getCurrentTime();
                  wavesurferInstance.play(currentPos, regionBounds.end);
                }
              }, 50);
            }
          }
        } catch (error) {
          console.error(
            "[MP3CUTTER] state.Error applying pitch change:",
            error
          );
        }
      } else {
        console.warn("[MP3CUTTER] WaveSurfer instance not available");
      }
    }
  }, [state]);

  return {
    handleFadeInDurationChange,
    handleFadeOutDurationChange,
    handleSpeedChange,
    handlePitchChange
  };
}; 