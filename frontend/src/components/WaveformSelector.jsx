import React, {
  useEffect, useRef, useState, forwardRef, useImperativeHandle,
} from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/plugins/regions";
import { trackLoop, resetLoopCounter, monitorWavesurferLoop } from "./debug-loop";
import { applyInfiniteLoopFixes, handleLoopReset } from "./infinite-loop-fix";

// Debounce helper
const debounce = (func, wait) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// Throttle helper - giới hạn tần suất thực thi
const throttle = (func, limit) => {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

const WaveformSelector = forwardRef(({
  audioFile,
  onRegionChange,
  volumeProfile = "uniform",
  volume = 1.0,
  customVolume = { start: 1.0, middle: 1.0, end: 1.0 },
  normalizeAudio = false,
  fade = false,
  fadeIn = false,
  fadeOut = false,
  isPreviewMode = false,
  onPlayEnd = () => {},
  theme = "light",
  onTimeUpdate = () => {},
  fadeInDuration = 3,
  fadeOutDuration = 3,
  onPlayStateChange = () => {},
  loop = false,
}, ref) => {
  const waveformRef = useRef(null);
  const overlayRef = useRef(null);
  const wavesurferRef = useRef(null);
  const regionRef = useRef(null);
  const regionsPluginRef = useRef(null);
  const animationFrameRef = useRef(null);
  const lastPositionRef = useRef(0);
  const currentVolumeRef = useRef(volume);
  const drawTimerRef = useRef(null);
  const currentProfileRef = useRef(volumeProfile);
  const fadeEnabledRef = useRef(fade);
  const fadeTimeRef = useRef(2);
  const intendedVolumeRef = useRef(volume);
  const isDrawingOverlayRef = useRef(false);
  const throttledDrawRef = useRef(null);
  const customVolumeRef = useRef(customVolume);
  const fadeInDurationRef = useRef(fadeInDuration);
  const fadeOutDurationRef = useRef(fadeOutDuration);
  const lastRegionStartRef = useRef(0);
  const lastRegionEndRef = useRef(0);
  
  // ADDED: New refs to track click source
  const clickSourceRef = useRef(null);
  const isClickUpdatingEndRef = useRef(false);
  const isDragUpdatingEndRef = useRef(false);
  const lastDragEndTimeRef = useRef(null);
  
  // REALTIME DRAG SEEKING REFS
  const isRealtimeDragSeekingRef = useRef(false);
  const lastRealtimeSeekTimeRef = useRef(null);
  const realtimeSeekThrottleRef = useRef(null);

  // === SYNC FIX: Add refs for position synchronization ===
  const lastDrawPositionRef = useRef(0);
  const syncPositionRef = useRef(0); // Master position for both waveform and overlay
  const lastSyncTimeRef = useRef(0); // Time when last sync occurred
  const isSyncingRef = useRef(false); // Prevent recursive syncing

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentVolumeDisplay, setCurrentVolumeDisplay] = useState(volume);
  const [loading, setLoading] = useState(true);
  const [isFadeEnabled, setIsFadeEnabled] = useState(fade);
  const [fadeInDurationState, setFadeInDurationState] = useState(fadeInDuration);
  const [fadeOutDurationState, setFadeOutDurationState] = useState(fadeOutDuration);

  // Theme colors
  const colors = {
    light: {
      waveColor: "#e5e7eb",
      progressColor: "#3b82f6",
      cursorColor: "#f97316",
      volumeOverlayColor: "rgba(59, 130, 246, 0.5)",
      regionColor: "rgba(219, 234, 254, 0.3)",
      regionBorderColor: "#93c5fd",
    },
    dark: {
      waveColor: "#374151",
      progressColor: "#60a5fa",
      cursorColor: "#f97316",
      volumeOverlayColor: "rgba(96, 165, 250, 0.5)",
      regionColor: "rgba(30, 58, 138, 0.3)",
      regionBorderColor: "#3b82f6",
    },
  };

  // Thêm refs để theo dõi trạng thái fade in/out riêng biệt
  const fadeInRef = useRef(fadeIn);
  const fadeOutRef = useRef(fadeOut);

  // Thêm ref để theo dõi nguồn gốc của thay đổi region
  const regionChangeSourceRef = useRef(null);
  const justUpdatedEndByClickRef = useRef(false);
  const endUpdateTimeoutRef = useRef(null);
  const lastClickEndTimeRef = useRef(null);

  // Thêm ref để theo dõi animation frame cho việc vẽ overlay
  const overlayAnimationFrameRef = useRef(null);
  const lastDrawTimeRef = useRef(0);
  const DRAW_INTERVAL = 1000 / 60; // 60 FPS

  // Thêm ref để theo dõi trạng thái region update
  const isRegionUpdatingRef = useRef(false);
  const regionUpdateTimeoutRef = useRef(null);

  // Thêm ref để theo dõi vị trí hiện tại chính xác hơn
  const currentPositionRef = useRef(0);
  const isDraggingRef = useRef(false);
  const isEndingPlaybackRef = useRef(false);
  
  const PREVIEW_TIME_BEFORE_END = 3; // 3 seconds preview before end
  
  // === SYNC FIX: Master position synchronization function ===
  const syncPositions = (newPosition, source = "unknown") => {
    if (isSyncingRef.current) return; // Prevent recursive syncing
    
    const now = performance.now();
    const timeSinceLastSync = now - lastSyncTimeRef.current;
    
    // Only sync if enough time has passed or if this is a forced sync
    if (timeSinceLastSync < 16 && source !== "force") return; // ~60fps limit
    
    isSyncingRef.current = true;
    lastSyncTimeRef.current = now;
    
    try {
      // Update master position
      syncPositionRef.current = newPosition;
      currentPositionRef.current = newPosition;
      lastPositionRef.current = newPosition;
      
      // Update UI time display
      setCurrentTime(newPosition);
      onTimeUpdate(newPosition);
      
      console.log(`[syncPositions] ${source}: ${newPosition.toFixed(4)}s`);
      
    } finally {
      isSyncingRef.current = false;
    }
  };
  
  // Helper function to calculate preview position (3 seconds before end)
  const calculatePreviewPosition = (endTime, currentTime) => {
    const previewTime = Math.max(0, endTime - PREVIEW_TIME_BEFORE_END);
    console.log(`[calculatePreviewPosition] End: ${endTime.toFixed(2)}s, Current: ${currentTime.toFixed(2)}s, Preview: ${previewTime.toFixed(2)}s (${PREVIEW_TIME_BEFORE_END}s before end)`);
    return previewTime;
  };

  // === SYNC FIX: Enhanced drawVolumeIndicator with synchronized position ===
  const drawVolumeIndicator = (ctx, currentTime, start, end, height, currentProfile) => {
    // Use synchronized position
    const syncedPosition = syncPositionRef.current;
    
    // Ensure position is within valid range
    if (syncedPosition >= start && syncedPosition <= end) {
      const totalDuration = wavesurferRef.current ? wavesurferRef.current.getDuration() : 1;
      const currentX = Math.floor((syncedPosition / totalDuration) * ctx.canvas.width);
      
      const t = (syncedPosition - start) / (end - start);
      const vol = calculateVolumeForProfile(t, currentProfile);
      const maxVol = getMaxVolumeForProfile(currentProfile);
      const scaleFactor = Math.max(maxVol, 0.01) > 0 ? Math.min(3, maxVol) / 3 : 1;
      const h = (vol / maxVol) * height * scaleFactor;

      // Draw the orange indicator line
      ctx.strokeStyle = "#f97316";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(currentX, height - h);
      ctx.lineTo(currentX, height);
      ctx.stroke();
      
      // Update last draw position for reference
      lastDrawPositionRef.current = currentX;
      
      console.log(`[drawVolumeIndicator] Synced position: ${syncedPosition.toFixed(4)}s, X: ${currentX}`);
    }
  };

  // Xử lý khi volumeProfile hoặc fade thay đổi
  useEffect(() => {
    intendedVolumeRef.current = volume;
    customVolumeRef.current = customVolume;
    
    fadeEnabledRef.current = fade;
    setIsFadeEnabled(fade);

    currentProfileRef.current = volumeProfile;
    currentVolumeRef.current = volume;

    if (wavesurferRef.current && regionRef.current) {
      const currentPos = isPlaying ? wavesurferRef.current.getCurrentTime() : regionRef.current.start;
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
      // === SYNC FIX: Use synchronized position update ===
      syncPositions(currentPos, "volumeProfileChange");
      updateVolume(currentPos, true, true);
      
      if (isPlaying) {
        animationFrameRef.current = requestAnimationFrame(updateRealtimeVolume);
      }
      
      drawVolumeOverlay();
      
      console.log(`Effects updated: volume=${volume}, profile=${volumeProfile}, fade=${fade}, fadeIn=${fadeInDurationRef.current}s, fadeOut=${fadeOutDurationRef.current}s`);
    }
  }, [volumeProfile, volume, customVolume, fade, isPlaying]);

  // Thêm useEffect mới để theo dõi thay đổi của customVolume
  useEffect(() => {
    if (volumeProfile === "custom" && wavesurferRef.current && regionRef.current) {
      const updateVolumeAndOverlay = throttle(() => {
        const currentPos = isPlaying ? wavesurferRef.current.getCurrentTime() : regionRef.current.start;
        syncPositions(currentPos, "customVolumeChange");
        updateVolume(currentPos, true, true);
        drawVolumeOverlay();
      }, 16);

      updateVolumeAndOverlay();
    }
  }, [customVolume.start, customVolume.middle, customVolume.end, volumeProfile]);

  // Update refs when props change
  useEffect(() => {
    fadeInDurationRef.current = fadeInDuration;
    setFadeInDurationState(fadeInDuration);
    
    if (wavesurferRef.current && (volumeProfile === "custom" || volumeProfile === "fadeInOut") && !fadeEnabledRef.current) {
      drawVolumeOverlay();
      
      if (isPlaying) {
        const currentPos = wavesurferRef.current.getCurrentTime();
        syncPositions(currentPos, "fadeInDurationChange");
        updateVolume(currentPos, true, true);
      } else if (regionRef.current) {
        syncPositions(regionRef.current.start, "fadeInDurationChange");
        updateVolume(regionRef.current.start, true, true);
      }
    }
  }, [fadeInDuration]);

  useEffect(() => {
    fadeOutDurationRef.current = fadeOutDuration;
    setFadeOutDurationState(fadeOutDuration);
    
    if (wavesurferRef.current && (volumeProfile === "fadeInOut" || volumeProfile === "custom") && !fadeEnabledRef.current) {
      drawVolumeOverlay();
      
      if (isPlaying) {
        const currentPos = wavesurferRef.current.getCurrentTime();
        syncPositions(currentPos, "fadeOutDurationChange");
        updateVolume(currentPos, true, true);
      } else if (regionRef.current) {
        syncPositions(regionRef.current.start, "fadeOutDurationChange");
        updateVolume(regionRef.current.start, true, true);
      }
    }
  }, [fadeOutDuration]);

  useImperativeHandle(ref, () => ({
    play: () => {
      if (wavesurferRef.current && regionRef.current) {
        const resumePosition = lastPositionRef.current;
        const start = regionRef.current.start;
        const end = regionRef.current.end;
        
        const playFrom = (resumePosition >= start && resumePosition < end) ? resumePosition : start;
        
        currentProfileRef.current = fadeEnabledRef.current && volumeProfile === "uniform" ? "fadeInOut" : volumeProfile;
        syncPositions(playFrom, "playCommand");
        updateVolume(playFrom, true, true);
        wavesurferRef.current.play(playFrom, end);
        setIsPlaying(true);
      }
    },
    stop: () => {
      if (wavesurferRef.current) {
        const currentPos = wavesurferRef.current.getCurrentTime();
        syncPositions(currentPos, "stopCommand");
        
        wavesurferRef.current.pause();
        
        const totalDuration = wavesurferRef.current.getDuration();
        wavesurferRef.current.seekTo(currentPos / totalDuration);
        
        setIsPlaying(false);
      }
    },
    togglePlayPause: () => togglePlayPause(),
    seekTo: (position) => {
      if (wavesurferRef.current && regionRef.current) {
        const start = regionRef.current.start;
        const end = regionRef.current.end;
        const seekPos = start + position * (end - start);
        wavesurferRef.current.seekTo(seekPos / wavesurferRef.current.getDuration());
        syncPositions(seekPos, "seekToCommand");
        updateVolume(seekPos, false, true);
      }
    },
    toggleFade: (fadeInState, fadeOutState) => {
      fadeInRef.current = fadeInState;
      fadeOutRef.current = fadeOutState;
      fadeEnabledRef.current = fadeInState || fadeOutState;
      setIsFadeEnabled(fadeInState || fadeOutState);
      
      if (wavesurferRef.current && regionRef.current) {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        const currentPos = isPlaying ? wavesurferRef.current.getCurrentTime() : regionRef.current.start;
        syncPositions(currentPos, "toggleFade");
        updateVolume(currentPos, true, true);
        if (isPlaying) {
          animationFrameRef.current = requestAnimationFrame(updateRealtimeVolume);
        }
      }
      return true;
    },
    setFadeInDuration: (duration) => {
      fadeInDurationRef.current = duration;
      setFadeInDurationState(duration);
      if (wavesurferRef.current && (volumeProfile === "fadeInOut" || volumeProfile === "custom") && !fadeEnabledRef.current) {
        drawVolumeOverlay();
        
        if (isPlaying) {
          const currentPos = wavesurferRef.current.getCurrentTime();
          syncPositions(currentPos, "setFadeInDuration");
          updateVolume(currentPos, true, true);
        } else if (regionRef.current) {
          syncPositions(regionRef.current.start, "setFadeInDuration");
          updateVolume(regionRef.current.start, true, true);
        }
        
        setTimeout(() => {
          if (isDrawingOverlayRef.current) return;
          drawVolumeOverlay();
          
          if (isPlaying && wavesurferRef.current) {
            const currentPos = wavesurferRef.current.getCurrentTime();
            syncPositions(currentPos, "setFadeInDurationDelayed");
            updateVolume(currentPos, true, true);
          }
        }, 50);
      }
    },
    setFadeOutDuration: (duration) => {
      fadeOutDurationRef.current = duration;
      setFadeOutDurationState(duration);
      if (wavesurferRef.current && (volumeProfile === "fadeInOut" || volumeProfile === "custom") && !fadeEnabledRef.current) {
        drawVolumeOverlay();
        
        if (isPlaying) {
          const currentPos = wavesurferRef.current.getCurrentTime();
          syncPositions(currentPos, "setFadeOutDuration");
          updateVolume(currentPos, true, true);
        } else if (regionRef.current) {
          syncPositions(regionRef.current.start, "setFadeOutDuration");
          updateVolume(regionRef.current.start, true, true);
        }
        
        setTimeout(() => {
          if (isDrawingOverlayRef.current) return;
          drawVolumeOverlay();
          
          if (isPlaying && wavesurferRef.current) {
            const currentPos = wavesurferRef.current.getCurrentTime();
            syncPositions(currentPos, "setFadeOutDurationDelayed");
            updateVolume(currentPos, true, true);
          }
        }, 50);
      }
    },
    getFadeInDuration: () => fadeInDurationState,
    getFadeOutDuration: () => fadeOutDurationState,
    isFadeEnabled: () => fadeEnabledRef.current,
    canEnableFade: () => volumeProfile === "uniform",
    isPlaying: () => isPlaying,
    setRegionStart: (startTime) => {
      if (wavesurferRef.current && regionRef.current) {
        const currentEnd = regionRef.current.end;
        if (startTime < currentEnd) {
          try {
            if (regionRef.current.setOptions) {
              regionRef.current.setOptions({ start: startTime });
            } else if (regionRef.current.update) {
              regionRef.current.update({ start: startTime });
            } else {
              regionRef.current.start = startTime;
              if (wavesurferRef.current.fireEvent) {
                wavesurferRef.current.fireEvent('region-updated', regionRef.current);
              }
            }
            
            onRegionChange(startTime, currentEnd);
            syncPositions(startTime, "setRegionStart");
            updateVolume(startTime, true, true);
            drawVolumeOverlay();
            
            console.log("Successfully updated region start to:", startTime);
          } catch (err) {
            console.error("Error updating region start:", err);
          }
        } else {
          console.warn("Start time cannot be after end time");
        }
      } else {
        console.warn("wavesurferRef or regionRef is not available");
      }
    },
    setRegionEnd: (endTime) => {
      console.log("[setRegionEnd] Called with endTime:", endTime);
      
      try {
        if (!wavesurferRef.current || !regionRef.current) {
          console.log("[setRegionEnd] Missing refs");
          return;
        }
        
        const currentStart = regionRef.current.start;
        const currentTime = wavesurferRef.current.getCurrentTime();
        
        console.log("[setRegionEnd] Current start:", currentStart, "Current time:", currentTime, "New end:", endTime);
        
        if (endTime <= currentStart) {
          console.warn("[setRegionEnd] End time cannot be before or equal to start time");
          return;
        }

        const wasClickUpdate = clickSourceRef.current === 'click';
        console.log("[setRegionEnd] Is this from click?", wasClickUpdate);

        if (regionRef.current.setOptions) {
          regionRef.current.setOptions({ end: endTime });
        } else if (regionRef.current.update) {
          regionRef.current.update({ end: endTime });
        } else {
          regionRef.current.end = endTime;
          if (wavesurferRef.current.fireEvent) {
            wavesurferRef.current.fireEvent('region-updated', regionRef.current);
          }
        }
        console.log(`[setRegionEnd] Region end updated to ${endTime}`);

        onRegionChange(currentStart, endTime);
        syncPositions(currentTime, "setRegionEnd");
        updateVolume(currentTime, true, true);
        drawVolumeOverlay();

        if (!wasClickUpdate && isPlaying) {
          console.log(`[setRegionEnd] Programmatic update - checking playback position`);
          if (currentTime >= endTime) {
            console.log(`[setRegionEnd] Current position (${currentTime}) >= new end (${endTime}), stopping playback`);
            wavesurferRef.current.pause();
            const totalDuration = wavesurferRef.current.getDuration();
            wavesurferRef.current.seekTo(currentStart / totalDuration);
            syncPositions(currentStart, "setRegionEndStop");
            setIsPlaying(false);
            onPlayStateChange(false);
          } else {
            console.log(`[setRegionEnd] Current position (${currentTime}) < new end (${endTime}), continuing playback`);
          }
        } else if (wasClickUpdate) {
          console.log(`[setRegionEnd] Click update - playback logic handled by click handler`);
        }
        
        console.log("[setRegionEnd] Finished execution successfully");
      } catch (err) {
        console.error("[setRegionEnd] Error:", err);
      }
    },
    getWavesurferInstance: () => wavesurferRef.current,
    getRegionsPlugin: () => regionsPluginRef.current,
    getRegion: () => regionRef.current,
    getRegionBounds: () => regionRef.current ? { start: regionRef.current.start, end: regionRef.current.end } : null
  }));

  const togglePlayPause = () => {
    if (!wavesurferRef.current || !regionRef.current) return;
    
    console.log(`[togglePlayPause] CALLED - Current isPlaying: ${isPlaying}`);
    
    if (isPlaying) {
      console.log("Pausing playback");
      const currentPos = wavesurferRef.current.getCurrentTime();
      syncPositions(currentPos, "togglePlayPausePause");
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
      wavesurferRef.current.pause();
      
      const totalDuration = wavesurferRef.current.getDuration();
      wavesurferRef.current.seekTo(currentPos / totalDuration);
      
      setIsPlaying(false);
      console.log("[togglePlayPause] Set isPlaying to false");
      
      onPlayStateChange(false);
      console.log("[togglePlayPause] Called onPlayStateChange(false)");
      
      drawVolumeOverlay();
      
    } else {
      const resumePosition = lastPositionRef.current;
      const start = regionRef.current.start;
      const end = regionRef.current.end;
      
      console.log("[togglePlayPause] STARTING PLAYBACK");
      console.log("[togglePlayPause] resumePosition:", resumePosition);
      console.log("[togglePlayPause] region start:", start, "end:", end);
      
      const playFrom = (resumePosition >= start && resumePosition < end) ? resumePosition : start;
      
      console.log("[togglePlayPause] FINAL playFrom:", playFrom);
      console.log("[togglePlayPause] Will play from", playFrom, "to", end);
      
      currentProfileRef.current = fadeEnabledRef.current && volumeProfile === "uniform" ? "fadeInOut" : volumeProfile;
      syncPositions(playFrom, "togglePlayPausePlay");
      updateVolume(playFrom, true, true);
      
      console.log(`Starting playback from ${playFrom} to ${end}, loop: ${loop}`);
      
      wavesurferRef.current.play(playFrom, end);
      
      setIsPlaying(true);
      console.log("[togglePlayPause] Set isPlaying to true");
      
      onPlayStateChange(true);
      console.log("[togglePlayPause] Called onPlayStateChange(true)");
      
      if (loop) {
        console.log("Starting playback with loop enabled");
      }
    }
    
    setTimeout(() => {
      verifyPlaybackState();
    }, 100);
  };

  const calculateVolumeForProfile = (relPos, profile) => {
    // Ensure volume never exceeds 1.0 (original volume)
    const intendedVolume = Math.min(1.0, intendedVolumeRef.current);
    const currentCustomVolume = {
      start: Math.min(1.0, customVolumeRef.current.start),
      middle: Math.min(1.0, customVolumeRef.current.middle),
      end: Math.min(1.0, customVolumeRef.current.end)
    };
    
    if (fadeEnabledRef.current) {
      const regionDuration = regionRef.current ? (regionRef.current.end - regionRef.current.start) : 0;
      if (regionDuration <= 0) return intendedVolume;
      
      const posInRegion = relPos * regionDuration;
      const timeToEnd = regionDuration - posInRegion;
      const fadeDuration = fadeTimeRef.current;
      
      if (fadeInRef.current && posInRegion < fadeDuration) {
        return intendedVolume * (posInRegion / fadeDuration);
      }
      else if (fadeOutRef.current && timeToEnd < fadeDuration) {
        return intendedVolume * (timeToEnd / fadeDuration);
      }
      else {
        return intendedVolume;
      }
    }
    
    switch (profile) {
      case "uniform": {
        return intendedVolume;
      }
      case "fadeIn": {
        return intendedVolume * relPos;
      }
      case "fadeOut": {
        return intendedVolume * (1 - relPos);
      }
      case "fadeInOut": {
        const regionDuration = regionRef.current ? (regionRef.current.end - regionRef.current.start) : 0;
        if (regionDuration <= 0) return intendedVolume;
        
        const fadeInTime = fadeInDurationRef.current;
        const fadeOutTime = fadeOutDurationRef.current;
        
        const posInRegion = relPos * regionDuration;
        const timeToEnd = regionDuration - posInRegion;
        
        if (posInRegion < fadeInTime) {
          return intendedVolume * (posInRegion / fadeInTime);
        } 
        else if (timeToEnd < fadeOutTime) {
          return intendedVolume * (timeToEnd / fadeOutTime);
        } 
        else {
          return intendedVolume;
        }
      }
      case "custom": {
        // Ensure all custom volume values are <= 1.0
        const start = Math.min(1.0, currentCustomVolume.start);
        const middle = Math.min(1.0, currentCustomVolume.middle);
        const end = Math.min(1.0, currentCustomVolume.end);
        
        const regionDuration = regionRef.current ? (regionRef.current.end - regionRef.current.start) : 0;
        if (regionDuration > 0) {
          const posInRegion = relPos * regionDuration;
          const fadeInTime = fadeInDurationRef.current;
          const fadeOutTime = fadeOutDurationRef.current;
          const timeToEnd = regionDuration - posInRegion;
          
          let baseVolume = 0;
          if (relPos <= 0.5) {
            const t = relPos * 2;
            baseVolume = start + (middle - start) * t;
          } else {
            const t = (relPos - 0.5) * 2;
            baseVolume = middle + (end - middle) * t;
          }
          
          // Ensure baseVolume never exceeds 1.0
          baseVolume = Math.min(1.0, baseVolume);
          
          if (posInRegion < fadeInTime && fadeInTime > 0) {
            const fadeProgress = posInRegion / fadeInTime;
            return intendedVolume * baseVolume * fadeProgress;
          }
          
          if (timeToEnd < fadeOutTime && fadeOutTime > 0) {
            const fadeProgress = timeToEnd / fadeOutTime;
            return intendedVolume * baseVolume * fadeProgress;
          }
          
          return intendedVolume * baseVolume;
        }
        
        if (relPos <= 0.5) {
          const t = relPos * 2;
          return intendedVolume * Math.min(1.0, start + (middle - start) * t);
        } else {
          const t = (relPos - 0.5) * 2;
          return intendedVolume * Math.min(1.0, middle + (end - middle) * t);
        }
      }
      default: {
        return intendedVolume;
      }
    }
  };

  const getMaxVolumeForProfile = (profile) => {
    // Maximum volume is always 1.0 (original volume)
    const intendedVolume = Math.min(1.0, intendedVolumeRef.current);
    const currentCustomVolume = {
      start: Math.min(1.0, customVolumeRef.current.start),
      middle: Math.min(1.0, customVolumeRef.current.middle),
      end: Math.min(1.0, customVolumeRef.current.end)
    };
    
    switch (profile) {
      case "uniform":
        return intendedVolume;
      case "fadeIn":
      case "fadeOut":
        return intendedVolume;
      case "fadeInOut":
        return intendedVolume;
      case "custom":
        return Math.min(1.0, Math.max(currentCustomVolume.start, currentCustomVolume.middle, currentCustomVolume.end));
      default:
        return intendedVolume;
    }
  };

  // === SYNC FIX: Enhanced updateVolume with synchronized position tracking ===
  const updateVolume = (absPosition = null, forceUpdate = false, forceRedraw = false) => {
    if (!wavesurferRef.current || !regionRef.current) {
      return;
    }

    const regionStart = regionRef.current.start;
    const regionEnd = regionRef.current.end;
    if (regionEnd <= regionStart) {
      console.warn("[updateVolume] Invalid region bounds, skipping update");
      return;
    }

    // === SYNC FIX: Use master synchronized position ===
    const currentPos = absPosition ?? (isPlaying ? wavesurferRef.current.getCurrentTime() : syncPositionRef.current);
    
    // Update synchronized position if this is a new position
    if (absPosition !== null) {
      syncPositions(currentPos, "updateVolume");
    }
    
    if (forceUpdate || absPosition !== null) {
      console.log(`[updateVolume] Pos: ${currentPos.toFixed(2)}s, Force: ${forceUpdate}, Redraw: ${forceRedraw}`);
    }

    const start = regionRef.current.start;
    const end = regionRef.current.end;
    const regionDuration = end - start;
    const relPos = Math.max(0, Math.min(1, (currentPos - start) / regionDuration));

    const vol = calculateVolumeForProfile(relPos, currentProfileRef.current);
    
    const normalizedVol = Math.min(1, vol);
    wavesurferRef.current.setVolume(normalizedVol);
    
    setCurrentVolumeDisplay(vol);
    currentVolumeRef.current = vol;

    if (forceRedraw) {
      drawVolumeOverlay();
    }
  };

  const drawVolumeOverlay = (forceRedraw = false) => {
    if (!overlayRef.current || !regionRef.current || !wavesurferRef.current) return;

    const now = performance.now();
    if (!forceRedraw && !isDraggingRef.current && now - lastDrawTimeRef.current < DRAW_INTERVAL) {
      return;
    }
    lastDrawTimeRef.current = now;

    if (drawTimerRef.current) {
      clearTimeout(drawTimerRef.current);
      drawTimerRef.current = null;
    }

    if (isDrawingOverlayRef.current) return;
    isDrawingOverlayRef.current = true;

    try {
      const ctx = overlayRef.current.getContext("2d");
      const width = overlayRef.current.width;
      const height = overlayRef.current.height;

      ctx.clearRect(0, 0, width, height);

      if (regionRef.current) {
        const start = regionRef.current.start;
        const end = regionRef.current.end;
        const totalDuration = wavesurferRef.current.getDuration();

        const startX = Math.max(0, Math.floor((start / totalDuration) * width));
        const endX = Math.min(width, Math.ceil((end / totalDuration) * width));
        const regionWidth = endX - startX;

        const currentProfile = currentProfileRef.current;

        // Draw volume overlay
        ctx.fillStyle = colors[theme].volumeOverlayColor;
        ctx.beginPath();
        ctx.moveTo(startX, height);

        let maxVol = getMaxVolumeForProfile(currentProfile);
        const samplePoints = (currentProfile === "custom" || currentProfile === "fadeInOut") ? 500 : 20;
        
        if (currentProfile !== "uniform") {
          for (let i = 0; i <= samplePoints; i++) {
            const t = i / samplePoints;
            const vol = calculateVolumeForProfile(t, currentProfile);
            maxVol = Math.max(maxVol, vol);
          }
        }

        maxVol = Math.max(maxVol, 0.01);
        const scaleFactor = maxVol > 0 ? Math.min(3, maxVol) / 3 : 1;
        
        const stepSize = (currentProfile === "custom" || currentProfile === "fadeInOut") ? 
          Math.max(1, Math.floor(regionWidth / 800)) : 
          Math.max(1, Math.floor(regionWidth / 300));
        
        for (let i = 0; i <= regionWidth; i += stepSize) {
          const x = startX + i;
          const t = i / regionWidth;
          const vol = calculateVolumeForProfile(t, currentProfile);
          const h = (vol / maxVol) * height * scaleFactor;
          ctx.lineTo(x, height - h);
        }
        
        const vol = calculateVolumeForProfile(1, currentProfile);
        const h = (vol / maxVol) * height * scaleFactor;
        ctx.lineTo(endX, height - h);

        ctx.lineTo(endX, height);
        ctx.closePath();
        ctx.fill();

        // === SYNC FIX: Use synchronized position for indicator ===
        const currentTime = syncPositionRef.current;
        
        if (currentTime >= start && currentTime <= end) {
          drawVolumeIndicator(ctx, currentTime, start, end, height, currentProfile);
        }

        if (isPlaying) {
          const t = (currentTime - start) / (end - start);
          const vol = calculateVolumeForProfile(t, currentProfile);
          currentVolumeRef.current = vol;
          setCurrentVolumeDisplay(vol);
        }

        // Draw waveform outline in region
        ctx.save();
        ctx.globalAlpha = 1.0;
        ctx.strokeStyle = colors[theme].progressColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i <= regionWidth; i++) {
          const x = startX + i;
          const t = i / regionWidth;
          const vol = calculateVolumeForProfile(t, currentProfile);
          const h = (vol / maxVol) * height * scaleFactor;
          if (i === 0) {
            ctx.moveTo(x, height - h);
          } else {
            ctx.lineTo(x, height - h);
          }
        }
        ctx.stroke();
        ctx.restore();
      }
    } finally {
      isDrawingOverlayRef.current = false;
    }
  };

  const handleLoopPlayback = () => {
    if (!wavesurferRef.current || !regionRef.current) return;
    
    const loopCount = trackLoop();
    
    const start = regionRef.current.start;
    const end = regionRef.current.end;
    
    // === SYNC FIX: Update synchronized position for loop restart ===
    syncPositions(start, "handleLoopPlayback");
    
    console.log(`Loop playback #${loopCount}: restarting from ${start.toFixed(2)}s to ${end.toFixed(2)}s`);
    
    if (!isPlaying) {
      setIsPlaying(true);
      onPlayStateChange(true);
    }
    
    wavesurferRef.current.pause();
    
    const totalDuration = wavesurferRef.current.getDuration();
    wavesurferRef.current.seekTo(start / totalDuration);

    setTimeout(() => {
      if (!wavesurferRef.current || !regionRef.current || !loop) return;
      
      if (wavesurferRef.current.getCurrentTime() !== start) {
        wavesurferRef.current.seekTo(start / totalDuration);
      }
      
      updateVolume(start, true, true);
      
      console.log(`Loop #${loopCount}: Starting playback from ${start.toFixed(2)}s to ${end.toFixed(2)}s`);
      wavesurferRef.current.play(start, end);
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = requestAnimationFrame(updateRealtimeVolume);
    }, 50);
  };

  const handlePlaybackEnd = () => {
  console.log("[handlePlaybackEnd] 🏁 === PLAYBACK END HANDLER STARTED ===");
  
  // STEP 1: Critical validation
  if (!wavesurferRef.current || !regionRef.current) {
    console.error("[handlePlaybackEnd] ❌ Missing refs - wavesurfer:", !!wavesurferRef.current, "region:", !!regionRef.current);
    return;
  }

  // STEP 2: Prevent recursive calls
  if (isEndingPlaybackRef.current) {
    console.log("[handlePlaybackEnd] ⚠️ Already processing end, skipping duplicate call");
    return;
  }

  console.log("[handlePlaybackEnd] 📊 Current state:");
  console.log(`  - isPlaying: ${isPlaying}`);
  console.log(`  - WS isPlaying: ${wavesurferRef.current.isPlaying ? wavesurferRef.current.isPlaying() : false}`);
  console.log(`  - Current time: ${wavesurferRef.current.getCurrentTime().toFixed(4)}s`);
  console.log(`  - Region: ${regionRef.current.start.toFixed(4)}s - ${regionRef.current.end.toFixed(4)}s`);

  // STEP 3: Lock the handler
  isEndingPlaybackRef.current = true;

  try {
    const regionStart = regionRef.current.start;
    const regionEnd = regionRef.current.end;
    const totalDuration = wavesurferRef.current.getDuration();
    const currentPos = wavesurferRef.current.getCurrentTime();

    console.log("[handlePlaybackEnd] 🎯 Processing end - Current:", currentPos.toFixed(4), "Target:", regionStart.toFixed(4));

    // STEP 4: IMMEDIATE stop all animations and timers
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
      console.log("[handlePlaybackEnd] ✅ Cleared main animation frame");
    }
    
    if (overlayAnimationFrameRef.current) {
      cancelAnimationFrame(overlayAnimationFrameRef.current);
      overlayAnimationFrameRef.current = null;
      console.log("[handlePlaybackEnd] ✅ Cleared overlay animation frame");
    }

    // STEP 5: FORCE pause WaveSurfer
    wavesurferRef.current.pause();
    console.log("[handlePlaybackEnd] ⏸️ WaveSurfer paused");

    // STEP 6: IMMEDIATE state updates
    setIsPlaying(false);
    if (onPlayStateChange) onPlayStateChange(false);
    if (onPlayEnd) onPlayEnd();
    console.log("[handlePlaybackEnd] 🔄 State updated to stopped");

    // STEP 7: CRITICAL - Force position reset with multiple methods
    console.log("[handlePlaybackEnd] 🎯 === FORCING POSITION RESET ===");
    
    const performPositionReset = (attempt = 1) => {
      console.log(`[handlePlaybackEnd] 🔧 Reset attempt ${attempt}`);
      
      const seekRatio = regionStart / totalDuration;
      wavesurferRef.current.seekTo(seekRatio);
      
      // Verify immediately
      setTimeout(() => {
        const verifyPos = wavesurferRef.current.getCurrentTime();
        const diff = Math.abs(verifyPos - regionStart);
        
        console.log(`[handlePlaybackEnd] 🔍 Attempt ${attempt} - Position: ${verifyPos.toFixed(4)}s, Diff: ${diff.toFixed(4)}s`);
        
        if (diff > 0.01 && attempt < 5) {
          console.log(`[handlePlaybackEnd] ⚠️ Position not accurate, retrying...`);
          performPositionReset(attempt + 1);
        } else if (diff > 0.01) {
          console.error(`[handlePlaybackEnd] ❌ FAILED after 5 attempts - Final diff: ${diff.toFixed(4)}s`);
          // Emergency: Force to 0 then to start
          wavesurferRef.current.seekTo(0);
          setTimeout(() => wavesurferRef.current.seekTo(seekRatio), 10);
        } else {
          console.log(`[handlePlaybackEnd] ✅ SUCCESS - Position reset to ${verifyPos.toFixed(4)}s`);
        }
      }, 5);
    };

    performPositionReset();

    // STEP 8: Update all position references
    syncPositionRef.current = regionStart;
    currentPositionRef.current = regionStart;
    lastPositionRef.current = regionStart;
    console.log("[handlePlaybackEnd] 📝 All position refs updated to", regionStart.toFixed(4));

    // STEP 9: Update volume and overlay
    updateVolume(regionStart, true, true);
    drawVolumeOverlay(true);
    console.log("[handlePlaybackEnd] 🎨 Volume and overlay updated");

    // STEP 10: Final verification after all operations
    setTimeout(() => {
      const finalPos = wavesurferRef.current.getCurrentTime();
      const finalDiff = Math.abs(finalPos - regionStart);
      
      console.log("[handlePlaybackEnd] 🏁 === FINAL VERIFICATION ===");
      console.log(`  Target: ${regionStart.toFixed(4)}s`);
      console.log(`  Actual: ${finalPos.toFixed(4)}s`);
      console.log(`  Difference: ${finalDiff.toFixed(6)}s`);
      console.log(`  Success: ${finalDiff <= 0.01 ? '✅ YES' : '❌ NO'}`);
      
      if (finalDiff > 0.01) {
        console.error("[handlePlaybackEnd] ❌ CRITICAL FAILURE - Position not reset properly!");
        
        // Last resort - nuclear option
        for (let i = 0; i < 3; i++) {
          setTimeout(() => {
            console.log(`[handlePlaybackEnd] 🚨 Nuclear reset ${i + 1}`);
            wavesurferRef.current.seekTo(regionStart / totalDuration);
          }, i * 5);
        }
      }
    }, 50);

  } catch (error) {
    console.error("[handlePlaybackEnd] ❌ EXCEPTION:", error);
  } finally {
    // Always unlock after delay
    setTimeout(() => {
      isEndingPlaybackRef.current = false;
      console.log("[handlePlaybackEnd] 🔓 Handler unlocked");
    }, 100);
  }

  console.log("[handlePlaybackEnd] 🏁 === HANDLER COMPLETED ===");
};

  const verifyPlaybackState = () => {
    if (!wavesurferRef.current) return;
    
    const wavesurferPlaying = wavesurferRef.current.isPlaying ? wavesurferRef.current.isPlaying() : false;
    const internalPlaying = isPlaying;
    
    if (wavesurferPlaying !== internalPlaying) {
      console.warn(`[verifyPlaybackState] STATE MISMATCH - WaveSurfer: ${wavesurferPlaying}, Internal: ${internalPlaying}`);
      
      if (wavesurferPlaying && !internalPlaying) {
        console.log("[verifyPlaybackState] SYNC: Setting internal state to playing");
        setIsPlaying(true);
        if (onPlayStateChange) onPlayStateChange(true);
      } else if (!wavesurferPlaying && internalPlaying) {
        console.log("[verifyPlaybackState] SYNC: Setting internal state to stopped");
        setIsPlaying(false);
        if (onPlayStateChange) onPlayStateChange(false);
      }
    }
  };

  // === SYNC FIX: Enhanced updateRealtimeVolume with synchronized position updates ===
  const updateRealtimeVolume = () => {
  // STEP 1: Basic validation checks
  if (!wavesurferRef.current || !regionRef.current || !isPlaying) {
    console.log(`[updateRealtimeVolume] STOPPING - Missing refs or not playing`);
    return;
  }

  // STEP 2: Verify state consistency every few frames
  if (Math.random() < 0.01) { // 1% chance per frame = ~once per second at 60fps
    verifyPlaybackState();
  }

  // STEP 3: Double-check wavesurfer's playing state
  const isWavesurferPlaying = wavesurferRef.current.isPlaying 
    ? wavesurferRef.current.isPlaying() 
    : (isPlaying && !wavesurferRef.current.paused);
  
  if (!isWavesurferPlaying) {
    console.log(`[updateRealtimeVolume] WaveSurfer not playing, stopping updates`);
    return;
  }

  // === SYNC FIX: Get current position and immediately sync all components ===
  const currentPos = wavesurferRef.current.getCurrentTime();
  const regionEnd = regionRef.current.end;
  const regionStart = regionRef.current.start;
  
  // CRITICAL: Update ALL position references immediately and synchronously
  syncPositionRef.current = currentPos;
  currentPositionRef.current = currentPos;
  lastPositionRef.current = currentPos;
  
  // Update UI time display immediately
  setCurrentTime(currentPos);
  onTimeUpdate(currentPos);
  
  // CRITICAL: Force immediate overlay redraw with current position
  drawVolumeOverlay(true);
  
  // STEP 5: End detection with buffer
  // STEP 5: Enhanced end detection - SINGLE SOURCE OF TRUTH
const END_BUFFER = 0.002; // 2ms buffer for maximum precision
const isAtRegionEnd = currentPos >= (regionEnd - END_BUFFER);
const distanceToEnd = regionEnd - currentPos;

// Log when approaching end
if (distanceToEnd <= 0.1) {
  console.log(`[updateRealtimeVolume] 🔍 Approaching end: ${distanceToEnd.toFixed(4)}s remaining`);
}

if (isAtRegionEnd) {
  console.log(`[updateRealtimeVolume] 🚨 === REACHED REGION END ===`);
  console.log(`  Current: ${currentPos.toFixed(4)}s`);
  console.log(`  Region End: ${regionEnd.toFixed(4)}s`);
  console.log(`  Over by: ${(currentPos - regionEnd).toFixed(4)}s`);
  
  // CRITICAL: Stop animation frame FIRST
  if (animationFrameRef.current) {
    cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
    console.log("[updateRealtimeVolume] ✅ Animation frame cleared");
  }
  
  // Check for active end updates
  const hasActiveUpdates = isClickUpdatingEndRef.current || 
                          isDragUpdatingEndRef.current || 
                          justUpdatedEndByClickRef.current;
  
  console.log("[updateRealtimeVolume] 📊 Active updates check:");
  console.log(`  Click updating: ${isClickUpdatingEndRef.current}`);
  console.log(`  Drag updating: ${isDragUpdatingEndRef.current}`);
  console.log(`  Just updated by click: ${justUpdatedEndByClickRef.current}`);
  console.log(`  Has active updates: ${hasActiveUpdates}`);
  
  if (hasActiveUpdates) {
    console.log("[updateRealtimeVolume] ⏳ Active updates detected, clearing flags and continuing");
    
    // Clear all update flags
    isClickUpdatingEndRef.current = false;
    isDragUpdatingEndRef.current = false;
    justUpdatedEndByClickRef.current = false;
    lastClickEndTimeRef.current = null;
    lastDragEndTimeRef.current = null;
    
    // Continue for a short while to let updates complete
    updateVolume(currentPos, false, false);
    setTimeout(() => {
      if (isPlaying && wavesurferRef.current) {
        animationFrameRef.current = requestAnimationFrame(updateRealtimeVolume);
      }
    }, 16);
    
    return;
  }
  
  // NORMAL END - No active updates
  console.log("[updateRealtimeVolume] 🛑 NORMAL PLAYBACK END - Triggering stop sequence");
  
  // Update state immediately
  setIsPlaying(false);
  if (onPlayStateChange) {
    onPlayStateChange(false);
    console.log("[updateRealtimeVolume] ✅ State changed to stopped");
  }
  
  // Trigger the end handler
  console.log("[updateRealtimeVolume] 🎯 Calling handlePlaybackEnd");
  handlePlaybackEnd();
  
  return; // CRITICAL: Exit here
}

// STEP 6: Continue normal operation
updateVolume(currentPos, false, false);
animationFrameRef.current = requestAnimationFrame(updateRealtimeVolume);
};
  
  useEffect(() => {
    let stateVerificationInterval;
    
    if (isPlaying) {
      stateVerificationInterval = setInterval(() => {
        verifyPlaybackState();
      }, 2000);
    }
    
    return () => {
      if (stateVerificationInterval) {
        clearInterval(stateVerificationInterval);
      }
    };
  }, [isPlaying]);
        
  const updateOverlay = () => {
    if (!isPlaying && !isDraggingRef.current && !isRegionUpdatingRef.current) {
      if (overlayAnimationFrameRef.current) {
        cancelAnimationFrame(overlayAnimationFrameRef.current);
        overlayAnimationFrameRef.current = null;
      }
      return;
    }

    drawVolumeOverlay();
    overlayAnimationFrameRef.current = requestAnimationFrame(updateOverlay);
  };

  useEffect(() => {
    const current = wavesurferRef.current;
    if (current) {
      current.on('error', (err) => {
        console.error("WaveSurfer error:", err);
      });
    }
    
    return () => {
      if (current) {
        // Cleanup if needed
      }
    };
  }, []);

  useEffect(() => {
    if (!audioFile) return;
    setLoading(true);

    throttledDrawRef.current = throttle(() => {
      drawVolumeOverlay();
    }, 16);

    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: '#e5e7eb',
      progressColor: '#e5e7eb',
      height: 120,
      responsive: true,
      cursorColor: colors[theme].cursorColor,
      backend: "WebAudio",
      volume: Math.min(1, volume),
      barWidth: 1.8,
      barGap: 1,
      barRadius: 3,
      normalize: normalizeAudio,
      barColor: (barIndex, barTime) => {
        if (!regionRef.current) return '#e5e7eb';
        const start = regionRef.current.start;
        const end = regionRef.current.end;
        if (barTime >= start && barTime <= end) {
          return '#06b6d4';
        }
        return '#e5e7eb';
      },
    });

    const handleWaveformClick = (e) => {
      try {
        if (!wavesurferRef.current || !regionRef.current) return;
    
        console.log("[handleWaveformClick] Click detected");
    
        const rect = waveformRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickTime = (clickX / rect.width) * wavesurferRef.current.getDuration();
    
        const currentStart = regionRef.current.start;
        const currentEnd = regionRef.current.end;
        const wasPlaying = isPlaying;
        const currentTime = wavesurferRef.current.getCurrentTime();
    
        console.log("[handleWaveformClick] Click time:", clickTime, "Current start:", currentStart, "Current end:", currentEnd, "Current playback time:", currentTime, "Was playing:", wasPlaying);
    
        clickSourceRef.current = 'click';
        regionChangeSourceRef.current = 'click';
    
        if (clickTime < currentStart) {
          console.log("[handleWaveformClick] Click before region start, updating start to:", clickTime);
          
          if (regionRef.current.setOptions) {
            regionRef.current.setOptions({ start: clickTime });
          } else if (regionRef.current.update) {
            regionRef.current.update({ start: clickTime });
          } else {
            regionRef.current.start = clickTime;
            if (wavesurferRef.current.fireEvent) {
              wavesurferRef.current.fireEvent('region-updated', regionRef.current);
            }
          }
    
          onRegionChange(clickTime, currentEnd);
          
          if (wasPlaying) {
            console.log("[handleWaveformClick] Was playing, resetting to new start and continuing");
            wavesurferRef.current.pause();
            setTimeout(() => {
              if (wavesurferRef.current) {
                wavesurferRef.current.play(clickTime, currentEnd);
                syncPositions(clickTime, "handleWaveformClickNewStart");
              }
            }, 50);
          } else {
            console.log("[handleWaveformClick] Not playing, just updating volume and seeking to new start");
            const totalDuration = wavesurferRef.current.getDuration();
            wavesurferRef.current.seekTo(clickTime / totalDuration);
            syncPositions(clickTime, "handleWaveformClickSeekStart");
            updateVolume(clickTime, true, true);
          }
        }
        else if (clickTime > currentEnd + 0.1) {
          console.log("[handleWaveformClick] Click after current region end");
          console.log(`[handleWaveformClick] Current end: ${currentEnd.toFixed(4)}s, Click time: ${clickTime.toFixed(4)}s`);
          
          console.log("[handleWaveformClick] Updating region end to:", clickTime);
          
          isClickUpdatingEndRef.current = true;
          lastClickEndTimeRef.current = clickTime;
          
          if (endUpdateTimeoutRef.current) {
            clearTimeout(endUpdateTimeoutRef.current);
          }
          
          endUpdateTimeoutRef.current = setTimeout(() => {
            isClickUpdatingEndRef.current = false;
            lastClickEndTimeRef.current = null;
            console.log("[handleWaveformClick] Cleared click update flags");
          }, 1000);
          
          if (regionRef.current.setOptions) {
            regionRef.current.setOptions({ end: clickTime });
          } else if (regionRef.current.update) {
            regionRef.current.update({ end: clickTime });
          } else {
            regionRef.current.end = clickTime;
            if (wavesurferRef.current.fireEvent) {
              wavesurferRef.current.fireEvent('region-updated', regionRef.current);
            }
          }
    
          onRegionChange(currentStart, clickTime);

          const previewPosition = calculatePreviewPosition(clickTime, currentTime);
          console.log(`[handleWaveformClick] 🎯 Auto-seeking to preview position: ${previewPosition.toFixed(4)}s (2s before ${clickTime.toFixed(4)}s)`);
          
          const seekRatio = previewPosition / wavesurferRef.current.getDuration();
          wavesurferRef.current.seekTo(seekRatio);
          syncPositions(previewPosition, "handleWaveformClickPreview");
          updateVolume(previewPosition, true, true);
            
          if (wasPlaying) {
            console.log(`[handleWaveformClick] ▶️ Continuing playback from ${previewPosition.toFixed(4)}s to ${clickTime.toFixed(4)}s`);
            setTimeout(() => {
              if (wavesurferRef.current && isPlaying) {
                wavesurferRef.current.play(previewPosition, clickTime);
              }
            }, 50);
          } else {
            console.log(`[handleWaveformClick] ⏸️ Not playing - positioned at preview point ${previewPosition.toFixed(4)}s`);
          }
        }
        else {
          console.log("[handleWaveformClick] Click within region, seeking to:", clickTime);
          const totalDuration = wavesurferRef.current.getDuration();
          wavesurferRef.current.seekTo(clickTime / totalDuration);
          syncPositions(clickTime, "handleWaveformClickWithin");
          updateVolume(clickTime, true, true);
          
          if (wasPlaying) {
            setTimeout(() => {
              if (wavesurferRef.current && isPlaying) {
                wavesurferRef.current.play(clickTime, regionRef.current.end);
              }
            }, 50);
          }
        }
    
        setTimeout(() => {
          clickSourceRef.current = null;
          if (!isClickUpdatingEndRef.current) {
            regionChangeSourceRef.current = null;
          }
          console.log("[handleWaveformClick] Reset click source flag");
        }, 100);
      } catch (error) {
        console.error("[handleWaveformClick] Error processing click:", error);
        clickSourceRef.current = null;
        if (!isClickUpdatingEndRef.current) {
          regionChangeSourceRef.current = null;
        }
      }
    };

    waveformRef.current.addEventListener('click', handleWaveformClick);

    applyInfiniteLoopFixes(ws);
    
    wavesurferRef.current = ws;
    
    monitorWavesurferLoop(ws);
    resetLoopCounter();

    ws.on("ready", () => {
      const dur = ws.getDuration();
      setDuration(dur);
      setLoading(false);

      const plugin = ws.registerPlugin(
        RegionsPlugin.create({
          dragSelection: true,
          color: colors[theme].regionColor,
          handleStyle: {
            borderColor: colors[theme].regionBorderColor,
            backgroundColor: colors[theme].regionBorderColor,
          },
        })
      );
      
      regionsPluginRef.current = plugin;

      regionRef.current = plugin.addRegion({
        start: 0,
        end: dur,
        color: colors[theme].regionColor,
      });
      
      lastRegionStartRef.current = regionRef.current.start;
      lastRegionEndRef.current = regionRef.current.end;
      
      // === SYNC FIX: Initialize synchronized position ===
      syncPositions(0, "wavesurferReady");
      
      if (regionRef.current.on) {
        regionRef.current.on('out', () => {
  console.log("[Region OUT] 🚪 Playback left region");
  
  if (!isPlaying) {
    console.log("[Region OUT] ℹ️ Not playing, ignoring out event");
    return;
  }
  
  if (loop) {
    console.log("[Region OUT] 🔄 Loop mode enabled - handling loop");
    handleLoopPlayback();
  } else {
    console.log("[Region OUT] 🛑 Normal mode - handling end");
    setTimeout(() => {
      handlePlaybackEnd();
    }, 5);
  }
});
      }
      
      console.log("Region created:", regionRef.current);
      console.log("Region methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(regionRef.current)));
      console.log("Regions plugin:", regionsPluginRef.current);
      if (regionsPluginRef.current) {
        console.log("RegionsPlugin methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(regionsPluginRef.current)));
      }

      regionRef.current.on("update", () => {
        console.log(`\n🔄 [UPDATE EVENT] Region update detected`);
        console.log(`📊 Current regionChangeSourceRef: ${regionChangeSourceRef.current}`);
        
        if (regionChangeSourceRef.current === 'click' && isClickUpdatingEndRef.current) {
          console.log(`[update] 🖱️ Skipping - programmatic update from click handler`);
          return;
        }

        const currentProfile = currentProfileRef.current;
        const newStart = regionRef.current.start;
        const newEnd = regionRef.current.end;
        const wasPlaying = isPlaying;
        
        console.log(`[update] 📍 New region bounds: ${newStart.toFixed(4)}s - ${newEnd.toFixed(4)}s`);
        
        regionChangeSourceRef.current = 'drag';
        
        const isDraggingStart = newStart !== lastRegionStartRef.current;
        const isDraggingEnd = newEnd !== lastRegionEndRef.current;
        
        lastRegionStartRef.current = newStart;
        lastRegionEndRef.current = newEnd;
        
        onRegionChange(newStart, newEnd);
        
        if (wavesurferRef.current) {
          const currentTime = wavesurferRef.current.getCurrentTime();
          
          if (isDraggingStart) {
            if (wasPlaying) {
              wavesurferRef.current.pause();
              setIsPlaying(false);
              onPlayStateChange(false);
            }
            
            wavesurferRef.current.seekTo(newStart / wavesurferRef.current.getDuration());
            syncPositions(newStart, "regionUpdateStart");
            
            if (wasPlaying) {
              setTimeout(() => {
                if (wavesurferRef.current) {
                  wavesurferRef.current.play(newStart, newEnd);
                  setIsPlaying(true);
                  onPlayStateChange(true);
                }
              }, 50);
            }
            
            updateVolume(newStart, true, true);
          } else if (isDraggingEnd) {
            if (wasPlaying) {
              const currentTimeNow = performance.now();
              const shouldPerformRealtimeSeek = !lastRealtimeSeekTimeRef.current || 
                (currentTimeNow - lastRealtimeSeekTimeRef.current) > 100;
                
              if (shouldPerformRealtimeSeek) {
                const previewPosition = Math.max(newStart, newEnd - PREVIEW_TIME_BEFORE_END);
                
                console.log(`🔄 [REALTIME AUTO-SEEK] Seeking to ${previewPosition.toFixed(4)}s (${PREVIEW_TIME_BEFORE_END}s before end: ${newEnd.toFixed(4)}s)`);
                
                isRealtimeDragSeekingRef.current = true;
                lastRealtimeSeekTimeRef.current = currentTimeNow;
                
                wavesurferRef.current.seekTo(previewPosition / wavesurferRef.current.getDuration());
                syncPositions(previewPosition, "realtimeDragSeek");
                
                clearTimeout(realtimeSeekThrottleRef.current);
                realtimeSeekThrottleRef.current = setTimeout(() => {
                  isRealtimeDragSeekingRef.current = false;
                }, 200);
              }
            } else {
              const previewPosition = Math.max(newStart, newEnd - PREVIEW_TIME_BEFORE_END);
              console.log(`[Drag End] Not playing - auto-seek to preview position: ${previewPosition.toFixed(4)}s`);
              wavesurferRef.current.seekTo(previewPosition / wavesurferRef.current.getDuration());
              syncPositions(previewPosition, "dragEndSeek");
              updateVolume(previewPosition, true, true);
              drawVolumeOverlay(true);
            }
          }
        }
        
        currentProfileRef.current = currentProfile;
        throttledDrawRef.current();
      });

      regionRef.current.on("update-end", () => {
        if (wavesurferRef.current && regionRef.current) {
          const currentTime = wavesurferRef.current.getCurrentTime();
          const start = regionRef.current.start;
          const end = regionRef.current.end;
          const previewPosition = Math.max(start, end - PREVIEW_TIME_BEFORE_END);

          if (currentTime < start || currentTime >= end) {
            wavesurferRef.current.pause();

            setTimeout(() => {
              wavesurferRef.current.seekTo(previewPosition / wavesurferRef.current.getDuration());
              syncPositions(previewPosition, "updateEndSeek");
              updateVolume(previewPosition, true, true);
              if (isPlaying) {
                setTimeout(() => {
                  wavesurferRef.current.play(previewPosition, end);
                  setIsPlaying(true);
                }, 30);
              }
            }, 30);
          }
        }
        
        console.log(`\n🏁 [UPDATE-END EVENT] Drag operation completed`);
        console.log(`📊 Current flags state:`);
        console.log(`  - isDragUpdatingEndRef: ${isDragUpdatingEndRef.current}`);
        console.log(`  - lastDragEndTimeRef: ${lastDragEndTimeRef.current}`);
        console.log(`  - regionChangeSourceRef: ${regionChangeSourceRef.current}`);
        console.log(`  - isClickUpdatingEndRef: ${isClickUpdatingEndRef.current}`);
        console.log(`  - isPlaying: ${isPlaying}`);
        
        if (regionChangeSourceRef.current === 'click' && isClickUpdatingEndRef.current) {
          console.log(`[update-end] 🖱️ Skipping - programmatic update from click handler`);
          return;
        }

        const newStart = regionRef.current.start;
        const newEnd = regionRef.current.end;
        const wasPlaying = isPlaying;
        
        console.log(`[update-end] 📍 Final region bounds: ${newStart.toFixed(4)}s - ${newEnd.toFixed(4)}s`);
        
        if (wavesurferRef.current) {
          const currentTime = wavesurferRef.current.getCurrentTime();
          console.log(`[update-end] 🎵 Current playback time: ${currentTime.toFixed(4)}s`);
          
          if (wasPlaying && currentTime >= newStart && currentTime < newEnd) {
            console.log(`[update-end] ✅ Position valid - continuing playback to new end: ${newEnd.toFixed(4)}s`);
            wavesurferRef.current.play(currentTime, newEnd);
          } else if (wasPlaying) {
            console.log(`[update-end] ⚠️ Position outside valid range - current: ${currentTime.toFixed(4)}s, range: ${newStart.toFixed(4)}s - ${newEnd.toFixed(4)}s`);
          }
        }

        regionChangeSourceRef.current = null;
        console.log(`[update-end] 🔄 Reset regionChangeSourceRef to null`);
        
        if (isDragUpdatingEndRef.current) {
          console.log(`[update-end] 🤔 Drag flags are active - checking if auto-seek in progress...`);
          
          const currentTimeNow = performance.now();
          const timeSinceSet = currentTimeNow - (window.lastDragFlagSetTime || 0);
          
          if (timeSinceSet < 200) {
            console.log(`[update-end] ⏳ Auto-seek likely in progress (${timeSinceSet.toFixed(0)}ms ago) - delaying flag reset`);
            setTimeout(() => {
              if (isDragUpdatingEndRef.current) {
                console.log(`[update-end] ⏰ [DELAYED] Now resetting drag update flags`);
                isDragUpdatingEndRef.current = false;
                lastDragEndTimeRef.current = null;
              }
            }, 300);
          } else {
            console.log(`[update-end] ✅ Safe to reset flags immediately (${timeSinceSet.toFixed(0)}ms ago)`);
            isDragUpdatingEndRef.current = false;
            lastDragEndTimeRef.current = null;
          }
        } else {
          console.log(`[update-end] ℹ️ Drag flags already cleared, nothing to reset`);
        }
          
        if (endUpdateTimeoutRef.current) {
          clearTimeout(endUpdateTimeoutRef.current);
          endUpdateTimeoutRef.current = null;
        }
      });

      regionRef.current.on("region-updated", () => {
        if (regionChangeSourceRef.current === 'click') {
          return;
        }

        if (isPlaying && wavesurferRef.current) {
          const currentTime = wavesurferRef.current.getCurrentTime();
          const start = regionRef.current.start;
          const end = regionRef.current.end;
          
          if (currentTime >= start && currentTime < end) {
            wavesurferRef.current.play(currentTime, end);
          }
        }
      });

      drawVolumeOverlay();
    });

    // === SYNC FIX: Enhanced audioprocess event with synchronized position updates ===
    // === ENHANCED EVENT HANDLERS ===
ws.on("finish", () => {
  console.log("[WS finish] 🏁 WaveSurfer finish event");
  
  if (loop && regionRef.current) {
    console.log("[WS finish] 🔄 Loop mode - triggering loop playback");
    setTimeout(() => {
      if (loop && regionRef.current) {
        handleLoopPlayback();
      }
    }, 20);
  } else {
    console.log("[WS finish] 🛑 Normal finish - triggering end handler");
    setTimeout(() => {
      handlePlaybackEnd();
    }, 10);
  }
});

ws.on("audioprocess", () => {
  const currentTime = ws.getCurrentTime();
  
  // Update synchronized position
  syncPositions(currentTime, "audioprocess");
  onTimeUpdate(currentTime);
  
  // Only redraw overlay if playing and not dragging
  if (isPlaying && !isDraggingRef.current) {
    drawVolumeOverlay(true);
  }
});

ws.on("seeking", () => {
  const currentTime = ws.getCurrentTime();
  console.log(`[WS seeking] 🎯 Seeking to ${currentTime.toFixed(4)}s`);
  
  // Update synchronized position
  syncPositions(currentTime, "seeking");
  onTimeUpdate(currentTime);
  updateVolume(currentTime, false, true);
  drawVolumeOverlay(true);
});

    ws.loadBlob(audioFile);

    return () => {
      if (drawTimerRef.current) {
        clearTimeout(drawTimerRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (endUpdateTimeoutRef.current) {
        clearTimeout(endUpdateTimeoutRef.current);
      }
      if (regionUpdateTimeoutRef.current) {
        clearTimeout(regionUpdateTimeoutRef.current);
      }
      isEndingPlaybackRef.current = false;
      if (waveformRef.current) {
        waveformRef.current.removeEventListener('click', handleWaveformClick);
      }
      ws.destroy();
    };
  }, [audioFile, theme, onTimeUpdate]);

  useEffect(() => {
    fadeInRef.current = fadeIn;
    fadeOutRef.current = fadeOut;
    fadeEnabledRef.current = fadeIn || fadeOut;
    setIsFadeEnabled(fadeIn || fadeOut);

    if (wavesurferRef.current && regionRef.current) {
      const currentPos = isPlaying ? wavesurferRef.current.getCurrentTime() : regionRef.current.start;
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
      syncPositions(currentPos, "fadeEffectChange");
      updateVolume(currentPos, true, true);
      
      if (isPlaying) {
        animationFrameRef.current = requestAnimationFrame(updateRealtimeVolume);
      }
      
      drawVolumeOverlay();
      
      console.log(`Effects updated: fadeIn=${fadeIn}, fadeOut=${fadeOut}, fadeEnabled=${fadeEnabledRef.current}`);
    }
  }, [fadeIn, fadeOut, isPlaying]);

  useEffect(() => {
    if (regionRef.current) {
      const handleRegionUpdated = () => {
        isDraggingRef.current = true;
        isRegionUpdatingRef.current = true;
        
        if (regionUpdateTimeoutRef.current) {
          clearTimeout(regionUpdateTimeoutRef.current);
        }
  
        drawVolumeOverlay(true);
  
        regionUpdateTimeoutRef.current = setTimeout(() => {
          isDraggingRef.current = false;
          isRegionUpdatingRef.current = false;
          
          if (isPlaying && wavesurferRef.current) {
            const currentTime = wavesurferRef.current.getCurrentTime();
            const start = regionRef.current.start;
            const end = regionRef.current.end;
            
            if (currentTime < start || currentTime >= end) {
              console.log("[handleRegionUpdated] Position outside region while playing, handling end");
              handlePlaybackEnd();
            }
          } else {
            console.log("[handleRegionUpdated] Not playing, skipping position check");
          }
          
          drawVolumeOverlay(true);
        }, 150);
  
        if (justUpdatedEndByClickRef.current && isPlaying && lastClickEndTimeRef.current) {
          const currentTime = wavesurferRef.current.getCurrentTime();
          if (currentTime < lastClickEndTimeRef.current) {
            wavesurferRef.current.play(currentTime, lastClickEndTimeRef.current);
          }
        }
      };
  
      regionRef.current.on('region-updated', handleRegionUpdated);
      return () => {
        if (regionRef.current) {
          regionRef.current.un('region-updated', handleRegionUpdated);
        }
        if (regionUpdateTimeoutRef.current) {
          clearTimeout(regionUpdateTimeoutRef.current);
        }
      };
    }
  }, [isPlaying]);
  const formatTime = (seconds) => {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${min}:${sec.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
  };

  
  return (
    <div className="relative">
      {loading && (
        <div className="absolute inset-0 bg-gray-100 bg-opacity-80 flex items-center justify-center z-10 rounded-md">
          <div className="animate-pulse text-blue-500 flex items-center">
            <svg
              className="animate-spin h-5 w-5 mr-2"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Loading audio...
          </div>
        </div>
      )}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-4 boxwaveform" style={{ boxShadow: 'none' }}>
        <div ref={waveformRef} className="mb-2" />
        <canvas
          ref={overlayRef}
          width={1000}
          height={80}
          className="w-full border border-gray-200 dark:border-gray-700 rounded-md mb-2"
        />
        
        <div className="flex items-center justify-between mb-2 text-sm text-gray-700 dark:text-gray-300">
          <div className="flex items-center">
            <span className="inline-flex items-center mr-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 mr-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
            <span className="px-2 py-0.5 ml-1 bg-gray-100 rounded-md text-gray-700 text-xs">
              Vị trí hiện tại: {currentTime.toFixed(2)}s
            </span>
          </div>
          <div className="flex items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 mr-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.536a5 5 0 010-7.072m12.728 0l-4.242 4.242m-6.364 6.364l-4.242-4.242"
              />
            </svg>
            Volume: {currentVolumeDisplay.toFixed(2)}x
          </div>
        </div>
      </div>
    </div>
  );
});

export default WaveformSelector;