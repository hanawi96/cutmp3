import React, {
  useEffect, useRef, useState, forwardRef, useImperativeHandle,
} from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/plugins/regions";
import TimeStepper from './TimeStepper';
import { trackLoop, resetLoopCounter, monitorWavesurferLoop } from "./debug-loop";
import { applyInfiniteLoopFixes } from "./infinite-loop-fix";
import { Clock } from "lucide-react";
import './DeleteRegion.css';

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
  removeMode = false,
  onDeleteModeChange = () => {},
  onDeleteConfirm = () => {},
}, ref) => {
  // Move state declarations to the top
  const [isDeleteMode, setIsDeleteMode] = useState(removeMode);
  const [deletePreview, setDeletePreview] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentVolumeDisplay, setCurrentVolumeDisplay] = useState(volume);
  const [loading, setLoading] = useState(true);
  const [fadeInDurationState, setFadeInDurationState] = useState(fadeInDuration);
  const [fadeOutDurationState, setFadeOutDurationState] = useState(fadeOutDuration);
  const [displayRegionStart, setDisplayRegionStart] = useState(0);
  const [displayRegionEnd, setDisplayRegionEnd] = useState(0);

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
  const isDraggingRegionRef = useRef(false);
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

  // Helper function to ensure cursor resets to region start
// Helper function to ensure cursor resets to region start INSTANTLY
const resetToRegionStart = (source = "unknown") => {
  if (!wavesurferRef.current || !regionRef.current) {
    console.log(`[resetToRegionStart] Missing refs - source: ${source}`);
    return;
  }
  
  const regionStart = regionRef.current.start;
  const currentPos = wavesurferRef.current.getCurrentTime();
  const positionDiff = Math.abs(currentPos - regionStart);
  
  console.log(`[resetToRegionStart] INSTANT RESET from ${source}`);
  console.log(`[resetToRegionStart] Current: ${currentPos.toFixed(4)}s, Target: ${regionStart.toFixed(4)}s, Diff: ${positionDiff.toFixed(4)}s`);
  
  // ALWAYS reset, regardless of difference - for instant response
  console.log(`[resetToRegionStart] FORCING instant seek to region start`);
  
  const totalDuration = wavesurferRef.current.getDuration();
  const seekRatio = regionStart / totalDuration;
  
  // INSTANT operations - no setTimeout
  wavesurferRef.current.seekTo(seekRatio);
  
  // IMMEDIATE position sync - multiple calls to ensure it sticks
  syncPositions(regionStart, `resetToRegionStart_${source}`);
  syncPositionRef.current = regionStart;
  currentPositionRef.current = regionStart;
  lastPositionRef.current = regionStart;
  
  // IMMEDIATE volume and overlay update
  updateVolume(regionStart, true, true);
  drawVolumeOverlay(true);
  
  console.log(`[resetToRegionStart] INSTANT RESET COMPLETED - All refs set to ${regionStart.toFixed(4)}s`);
  };

  

  // Xử lý khi volumeProfile hoặc fade thay đổi
  // Xử lý khi volumeProfile hoặc fade thay đổi
  // Xử lý khi volumeProfile hoặc fade thay đổi
  useEffect(() => {
  console.log(`[volumeProfileEffect] TRIGGERED - volume=${volume}, profile=${volumeProfile}, fade=${fade}, isPlaying=${isPlaying}`);
  
    intendedVolumeRef.current = volume;
    customVolumeRef.current = customVolume;
    
    fadeEnabledRef.current = fade;

    currentProfileRef.current = volumeProfile;
  currentVolumeRef.current = volume;

  if (wavesurferRef.current && regionRef.current) {
    // CRITICAL FIX: Smarter position determination logic
    let targetPosition;
    const currentWsPosition = wavesurferRef.current.getCurrentTime();
    const syncedPos = syncPositionRef.current;
    const regionStart = regionRef.current.start;
    const regionEnd = regionRef.current.end;
    
    console.log(`[volumeProfileEffect] Position analysis:`);
    console.log(`  - WS position: ${currentWsPosition.toFixed(4)}s`);
    console.log(`  - Synced position: ${syncedPos.toFixed(4)}s`);
    console.log(`  - Region: ${regionStart.toFixed(4)}s - ${regionEnd.toFixed(4)}s`);
    
    if (isPlaying) {
      // If playing, always use current wavesurfer position
      targetPosition = currentWsPosition;
      console.log(`[volumeProfileEffect] Playing - using WS position: ${targetPosition.toFixed(4)}s`);
    } else {
      // IMPROVED LOGIC: If not playing, prioritize recently synced position
      const wsInRegion = currentWsPosition >= regionStart && currentWsPosition <= regionEnd;
      const syncedInRegion = syncedPos >= regionStart && syncedPos <= regionEnd;
      const syncTimeDiff = performance.now() - lastSyncTimeRef.current;
      
      console.log(`  - WS in region: ${wsInRegion}, Synced in region: ${syncedInRegion}`);
      console.log(`  - Time since last sync: ${syncTimeDiff.toFixed(0)}ms`);
      
      if (syncTimeDiff < 1000 && syncedInRegion) {
        // Recently synced position within region - use it
        targetPosition = syncedPos;
        console.log(`[volumeProfileEffect] Using recent synced position: ${targetPosition.toFixed(4)}s`);
      } else if (wsInRegion) {
        // WS position is valid within region
        targetPosition = currentWsPosition;
        console.log(`[volumeProfileEffect] Using WS position within region: ${targetPosition.toFixed(4)}s`);
      } else if (syncedInRegion) {
        // Synced position is valid within region
        targetPosition = syncedPos;
        console.log(`[volumeProfileEffect] Using synced position within region: ${targetPosition.toFixed(4)}s`);
      } else {
        // Neither position is valid - default to region start
        targetPosition = regionStart;
        console.log(`[volumeProfileEffect] No valid position - defaulting to region start: ${targetPosition.toFixed(4)}s`);
      }
    }
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
    // Only sync if position actually changes
    const currentSyncedPos = syncPositionRef.current;
    const positionDiff = Math.abs(targetPosition - currentSyncedPos);
    
    if (positionDiff > 0.001) {
      console.log(`[volumeProfileEffect] Position change detected (${positionDiff.toFixed(4)}s) - syncing to: ${targetPosition.toFixed(4)}s`);
      syncPositions(targetPosition, "volumeProfileChange");
      updateVolume(targetPosition, true, true);
    } else {
      console.log(`[volumeProfileEffect] Position unchanged - just updating volume`);
      updateVolume(targetPosition, true, true);
    }
      
      if (isPlaying) {
        animationFrameRef.current = requestAnimationFrame(updateRealtimeVolume);
      }
      
      drawVolumeOverlay();
        console.log(`[volumeProfileEffect] COMPLETED - Effects updated: volume=${volume}, profile=${volumeProfile}, fade=${fade}, position=${targetPosition.toFixed(4)}s`);
  } else {
    console.log(`[volumeProfileEffect] Missing refs - wavesurfer: ${!!wavesurferRef.current}, region: ${!!regionRef.current}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volumeProfile, volume, customVolume, fade, isPlaying]); // Functions are stable, don't need dependencies

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customVolume.start, customVolume.middle, customVolume.end, volumeProfile]); // Functions are stable

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fadeInDuration]); // Functions are stable

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fadeOutDuration]); // Functions are stable

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
      console.log(`[toggleFade] Called with fadeIn: ${fadeInState}, fadeOut: ${fadeOutState}`);
      
      fadeInRef.current = fadeInState;
      fadeOutRef.current = fadeOutState;
      fadeEnabledRef.current = fadeInState || fadeOutState;
      
      if (wavesurferRef.current && regionRef.current) {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        
        // ENHANCED: Better position determination for fade toggle
        const wsPosition = wavesurferRef.current.getCurrentTime();
        const syncedPosition = syncPositionRef.current;
        const regionStart = regionRef.current.start;
        const regionEnd = regionRef.current.end;
        
        let targetPosition;
        
        if (isPlaying) {
          // When playing, use wavesurfer position
          targetPosition = wsPosition;
          console.log(`[toggleFade] Playing - using WS position: ${targetPosition.toFixed(4)}s`);
        } else {
          // When not playing, use the best available position
          const wsInRegion = wsPosition >= regionStart && wsPosition <= regionEnd;
          const syncedInRegion = syncedPosition >= regionStart && syncedPosition <= regionEnd;
          
          if (wsInRegion) {
            targetPosition = wsPosition;
            console.log(`[toggleFade] Not playing - WS position in region: ${targetPosition.toFixed(4)}s`);
          } else if (syncedInRegion) {
            targetPosition = syncedPosition;
            console.log(`[toggleFade] Not playing - synced position in region: ${targetPosition.toFixed(4)}s`);
          } else {
            targetPosition = regionStart;
            console.log(`[toggleFade] Not playing - fallback to region start: ${targetPosition.toFixed(4)}s`);
          }
        }
        
        // Force immediate position sync
        syncPositions(targetPosition, "toggleFade");
        
        // Update volume immediately
        updateVolume(targetPosition, true, true);
        
        // Force immediate overlay redraw
        drawVolumeOverlay(true);
        
        if (isPlaying) {
          animationFrameRef.current = requestAnimationFrame(updateRealtimeVolume);
        }
        
        console.log(`[toggleFade] ✅ Completed - position: ${targetPosition.toFixed(4)}s, fadeEnabled: ${fadeEnabledRef.current}`);
      } else {
        console.log(`[toggleFade] ❌ Missing refs - wavesurfer: ${!!wavesurferRef.current}, region: ${!!regionRef.current}`);
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
    },    getWavesurferInstance: () => wavesurferRef.current,
    getRegionsPlugin: () => regionsPluginRef.current,
    getRegion: () => regionRef.current,
    getRegionBounds: () => regionRef.current ? { start: regionRef.current.start, end: regionRef.current.end } : null,
    // Delete region functionality
    deleteRegion: () => {
      if (!regionRef.current) {
        console.warn("[deleteRegion] No region available to delete");
        return null;
      }

      const regionToDelete = {
        start: regionRef.current.start,
        end: regionRef.current.end
      };

      console.log(`[deleteRegion] Deleting region: ${regionToDelete.start.toFixed(4)}s - ${regionToDelete.end.toFixed(4)}s`);
      return regionToDelete;
    },
    getCurrentRegion: () => {
      if (!regionRef.current) {
        console.warn("[getCurrentRegion] No region available");
        return null;
      }

      return {
        start: regionRef.current.start,
        end: regionRef.current.end,
        mode: isDeleteMode ? 'delete' : 'keep'
      };
    },
    isDeleteMode: () => isDeleteMode,
    getDeletePreview: () => {
      if (!regionRef.current || !wavesurferRef.current) {
        console.warn("[getDeletePreview] Missing refs for delete preview");
        return null;
      }

      const totalDuration = wavesurferRef.current.getDuration();
      const regionStart = regionRef.current.start;
      const regionEnd = regionRef.current.end;

      if (isDeleteMode) {
        // In delete mode, return the sections that will be kept
        const keepSections = [];
        
        // Section before deleted region
        if (regionStart > 0) {
          keepSections.push({
            start: 0,
            end: regionStart,
            type: 'keep'
          });
        }
        
        // Section after deleted region
        if (regionEnd < totalDuration) {
          keepSections.push({
            start: regionEnd,
            end: totalDuration,
            type: 'keep'
          });
        }

        return {
          mode: 'delete',
          deleteSection: { start: regionStart, end: regionEnd, type: 'delete' },
          keepSections,
          totalDuration
        };
      } else {
        // In normal mode, return the selected section
        return {
          mode: 'keep',
          keepSections: [{ start: regionStart, end: regionEnd, type: 'keep' }],
          deleteSection: null,
          totalDuration
        };
      }
    }
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
      const start = regionRef.current.start;
      const end = regionRef.current.end;
      
      // === FIX: Ưu tiên vị trí hiện tại thay vì resumePosition ===
      const currentWsPosition = wavesurferRef.current.getCurrentTime();
      const syncedPosition = syncPositionRef.current;
      
      console.log("[togglePlayPause] STARTING PLAYBACK");
      console.log(`[togglePlayPause] Current WS position: ${currentWsPosition.toFixed(4)}s`);
      console.log(`[togglePlayPause] Synced position: ${syncedPosition.toFixed(4)}s`);
      console.log(`[togglePlayPause] Resume position: ${lastPositionRef.current.toFixed(4)}s`);
      console.log(`[togglePlayPause] Region: ${start.toFixed(4)}s - ${end.toFixed(4)}s`);
      
      let playFrom;
      
      // Logic mới: Ưu tiên vị trí hiện tại nếu nó trong region
      if (currentWsPosition >= start && currentWsPosition < end) {
        playFrom = currentWsPosition;
        console.log(`[togglePlayPause] ✅ Using current WS position: ${playFrom.toFixed(4)}s`);
      } else if (syncedPosition >= start && syncedPosition < end) {
        playFrom = syncedPosition;
        console.log(`[togglePlayPause] ✅ Using synced position: ${playFrom.toFixed(4)}s`);
      } else {
        // Fallback về resumePosition hoặc region start
        const resumePosition = lastPositionRef.current;
        playFrom = (resumePosition >= start && resumePosition < end) ? resumePosition : start;
        console.log(`[togglePlayPause] ✅ Using fallback position: ${playFrom.toFixed(4)}s`);
      }
      
      console.log(`[togglePlayPause] FINAL playFrom: ${playFrom.toFixed(4)}s`);
      console.log(`[togglePlayPause] Will play from ${playFrom.toFixed(4)}s to ${end.toFixed(4)}s`);
      
      currentProfileRef.current = fadeEnabledRef.current && volumeProfile === "uniform" ? "fadeInOut" : volumeProfile;
      syncPositions(playFrom, "togglePlayPausePlay");
      updateVolume(playFrom, true, true);
      
      console.log(`Starting playback from ${playFrom.toFixed(4)}s to ${end.toFixed(4)}s, loop: ${loop}`);
      
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
  
    console.log(`[drawVolumeOverlay] START - forceRedraw: ${forceRedraw}, isPlaying: ${isPlaying}, fadeEnabled: ${fadeEnabledRef.current}`);

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
        const currentVolume = currentVolumeRef.current;

        // Draw volume overlay background (always use default style regardless of delete mode)
        ctx.fillStyle = colors[theme].volumeOverlayColor;
        ctx.beginPath();
        ctx.moveTo(startX, height);

        // Calculate max volume based on current volume and profile
        let maxVol = currentVolume;
        if (currentProfile !== "uniform") {
          const samplePoints = (currentProfile === "custom" || currentProfile === "fadeInOut") ? 500 : 20;
          for (let i = 0; i <= samplePoints; i++) {
            const t = i / samplePoints;
            const vol = calculateVolumeForProfile(t, currentProfile);
            maxVol = Math.max(maxVol, vol);
          }
        }

        // Ensure maxVol is at least 1.0 for full height display
        maxVol = Math.max(1.0, maxVol);
        
        // Draw the volume curve
        const stepSize = Math.max(1, Math.floor(regionWidth / 800));
        for (let i = 0; i <= regionWidth; i += stepSize) {
          const x = startX + i;
          const t = i / regionWidth;
          const vol = calculateVolumeForProfile(t, currentProfile);
          const h = (vol / maxVol) * height;
          ctx.lineTo(x, height - h);
        }
        
        // Close and fill the path
        ctx.lineTo(endX, height);
        ctx.closePath();
        ctx.fill();

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
          const h = (vol / maxVol) * height;
          if (i === 0) {
            ctx.moveTo(x, height - h);
          } else {
            ctx.lineTo(x, height - h);
          }
        }
        ctx.stroke();
        ctx.restore();
  
        // === FIX: Improved position logic for fade mode compatibility ===
        let currentTime;
        
        console.log(`[drawVolumeOverlay] Position analysis:`);
        console.log(`  - WS current: ${wavesurferRef.current.getCurrentTime().toFixed(4)}s`);
        console.log(`  - Synced pos: ${syncPositionRef.current.toFixed(4)}s`);
        console.log(`  - Last pos: ${lastPositionRef.current.toFixed(4)}s`);
        console.log(`  - isPlaying: ${isPlaying}`);
        console.log(`  - fadeEnabled: ${fadeEnabledRef.current}`);
        console.log(`  - isClickUpdating: ${isClickUpdatingEndRef.current}`);
  
        // Special handling for click updates with preview position
        if (isClickUpdatingEndRef.current && lastClickEndTimeRef.current) {
          currentTime = calculatePreviewPosition(lastClickEndTimeRef.current, wavesurferRef.current.getCurrentTime());
          console.log(`[drawVolumeOverlay] Using click preview position: ${currentTime.toFixed(4)}s`);
        } else {
          // ENHANCED: Better position determination for fade compatibility
          const wsPosition = wavesurferRef.current.getCurrentTime();
          const syncedPosition = syncPositionRef.current;
          const regionStart = start;
          const regionEnd = end;
          
          // Check position validity
          const wsInRegion = wsPosition >= regionStart && wsPosition <= regionEnd;
          const syncedInRegion = syncedPosition >= regionStart && syncedPosition <= regionEnd;
          const syncTimeDiff = performance.now() - lastSyncTimeRef.current;
          
          console.log(`[drawVolumeOverlay] Position validity check:`);
          console.log(`  - WS in region: ${wsInRegion}`);
          console.log(`  - Synced in region: ${syncedInRegion}`);
          console.log(`  - Sync time diff: ${syncTimeDiff.toFixed(0)}ms`);
          
          if (isPlaying) {
            // When playing, always use wavesurfer position
            currentTime = wsPosition;
            console.log(`[drawVolumeOverlay] Playing - using WS position: ${currentTime.toFixed(4)}s`);
          } else {
            // When not playing, use the most appropriate position
            if (syncTimeDiff < 500 && syncedInRegion) {
              // Recent sync position within region
              currentTime = syncedPosition;
              console.log(`[drawVolumeOverlay] Using recent synced position: ${currentTime.toFixed(4)}s`);
            } else if (wsInRegion) {
              // WS position is valid
              currentTime = wsPosition;
              console.log(`[drawVolumeOverlay] Using WS position in region: ${currentTime.toFixed(4)}s`);
            } else {
              // Fallback to region start
              currentTime = regionStart;
              console.log(`[drawVolumeOverlay] Fallback to region start: ${currentTime.toFixed(4)}s`);
            }
          }
        }
        
        console.log(`[drawVolumeOverlay] Final currentTime: ${currentTime.toFixed(4)}s`);
        
        // Draw volume indicator if position is valid
        if (currentTime >= start && currentTime <= end) {
          // Save the current context state
          ctx.save();
          
          // Draw the indicator with a higher z-index effect
          const currentX = Math.floor((currentTime / totalDuration) * width);
          const t = (currentTime - start) / (end - start);
          const vol = calculateVolumeForProfile(t, currentProfile);
          const h = (vol / maxVol) * height;
  
          console.log(`[drawVolumeOverlay] Drawing indicator:`);
          console.log(`  - Position: ${currentTime.toFixed(4)}s`);
          console.log(`  - X coordinate: ${currentX}px`);
          console.log(`  - Volume: ${vol.toFixed(2)}`);
          console.log(`  - Height: ${h.toFixed(0)}px`);
  
          // Draw the orange indicator line
          ctx.strokeStyle = "#f97316";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(currentX, height - h);
          ctx.lineTo(currentX, height);
          ctx.stroke();
          
          // Add a small circle at the top of the indicator
          ctx.beginPath();
          ctx.arc(currentX, height - h, 3, 0, Math.PI * 2);
          ctx.fillStyle = "#f97316";
          ctx.fill();
          
          // Restore the context state
          ctx.restore();
          
          // Update last draw position
          lastDrawPositionRef.current = currentX;
          
          console.log(`[drawVolumeOverlay] ✅ Indicator drawn successfully`);
        } else {
          console.log(`[drawVolumeOverlay] ❌ Current time ${currentTime.toFixed(4)}s outside region ${start.toFixed(4)}s - ${end.toFixed(4)}s`);
        }
      }
    } finally {
      isDrawingOverlayRef.current = false;
      console.log(`[drawVolumeOverlay] COMPLETED`);
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
    console.log("[handlePlaybackEnd] 🏁 PLAYBACK END HANDLER START");
  
    // Critical validation
    if (!wavesurferRef.current || !regionRef.current) {
      console.error("[handlePlaybackEnd] Missing refs - wavesurfer:", !!wavesurferRef.current, "region:", !!regionRef.current);
      return;
    }
  
    // Prevent recursive calls
    if (isEndingPlaybackRef.current) {
      console.log("[handlePlaybackEnd] Already processing end, skipping");
      return;
    }
  
    console.log("[handlePlaybackEnd] Current state:");
    console.log(`  - isPlaying: ${isPlaying}`);
    console.log(`  - Current time: ${wavesurferRef.current.getCurrentTime().toFixed(4)}s`);
    console.log(`  - Region: ${regionRef.current.start.toFixed(4)}s - ${regionRef.current.end.toFixed(4)}s`);
  
    // Lock the handler
    isEndingPlaybackRef.current = true;
    try {
      // Stop all animations immediately
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
      if (overlayAnimationFrameRef.current) {
        cancelAnimationFrame(overlayAnimationFrameRef.current);
        overlayAnimationFrameRef.current = null;
      }
  
      // Pause WaveSurfer if playing
      if (wavesurferRef.current.isPlaying && wavesurferRef.current.isPlaying()) {
        wavesurferRef.current.pause();
      }
  
      // Update state immediately
      setIsPlaying(false);
      if (onPlayStateChange) onPlayStateChange(false);
      if (onPlayEnd) onPlayEnd();
  
      // Reset to region start using helper function
      console.log("[handlePlaybackEnd] Resetting to region start");
      resetToRegionStart("handlePlaybackEnd_force");
  
    } catch (error) {
      console.error("[handlePlaybackEnd] Exception:", error);
    } finally {
      // Unlock handler
      setTimeout(() => {
        isEndingPlaybackRef.current = false;
        console.log("[handlePlaybackEnd] Handler unlocked");
      }, 100);
    }
  
    console.log("[handlePlaybackEnd] 🏁 HANDLER COMPLETED");
  };

  const verifyPlaybackState = () => {
  if (!wavesurferRef.current || !regionRef.current) return;
    
    const wavesurferPlaying = wavesurferRef.current.isPlaying ? wavesurferRef.current.isPlaying() : false;
    const internalPlaying = isPlaying;
  
  console.log(`[verifyPlaybackState] CHECKING STATE - WaveSurfer: ${wavesurferPlaying}, Internal: ${internalPlaying}`);
    
    if (wavesurferPlaying !== internalPlaying) {
      console.warn(`[verifyPlaybackState] STATE MISMATCH - WaveSurfer: ${wavesurferPlaying}, Internal: ${internalPlaying}`);
      
      if (wavesurferPlaying && !internalPlaying) {
        console.log("[verifyPlaybackState] SYNC: Setting internal state to playing");
        setIsPlaying(true);
        if (onPlayStateChange) onPlayStateChange(true);
      } else if (!wavesurferPlaying && internalPlaying) {
      console.log("[verifyPlaybackState] SYNC: Setting internal state to stopped - Analyzing position");
      
      // CRITICAL FIX: Get current position BEFORE changing isPlaying state
      const currentPos = wavesurferRef.current.getCurrentTime();
      const regionStart = regionRef.current.start;
      const regionEnd = regionRef.current.end;
      const END_TOLERANCE = 0.05; // 50ms tolerance for natural playback end
      
      console.log(`[verifyPlaybackState] Current position: ${currentPos.toFixed(4)}s, Region: ${regionStart.toFixed(4)}s - ${regionEnd.toFixed(4)}s`);
      
      // Check if this is a natural playback end (position slightly past region end)
      const pastRegionEnd = currentPos > regionEnd;
      const endDistance = currentPos - regionEnd;
      const isNaturalEnd = pastRegionEnd && endDistance <= END_TOLERANCE;
      
      console.log(`[verifyPlaybackState] Analysis: pastEnd=${pastRegionEnd}, distance=${endDistance.toFixed(4)}s, naturalEnd=${isNaturalEnd}`);
      
      if (isNaturalEnd) {
        console.log(`[verifyPlaybackState] Natural playback end detected - resetting to region start smoothly`);
        // Use resetToRegionStart helper for smooth reset
        resetToRegionStart("verifyPlaybackState_naturalEnd");
      } else if (currentPos >= regionStart && currentPos <= regionEnd) {
        console.log(`[verifyPlaybackState] Position within region bounds - preserving position: ${currentPos.toFixed(4)}s`);
        syncPositions(currentPos, "verifyPlaybackStatePreserve");
      } else {
        console.log(`[verifyPlaybackState] Position significantly outside region bounds - correcting to region start`);
        resetToRegionStart("verifyPlaybackState_correction");
      }
      
      // NOW change the state - position has been handled appropriately
        setIsPlaying(false);
        if (onPlayStateChange) onPlayStateChange(false);
      
      console.log(`[verifyPlaybackState] State changed to stopped, final position: ${syncPositionRef.current.toFixed(4)}s`);
      }
  } else {
    console.log(`[verifyPlaybackState] States are in sync - no action needed`);
    }
  };

  // === SYNC FIX: Enhanced updateRealtimeVolume with synchronized position updates ===
  // === SYNC FIX: Enhanced updateRealtimeVolume with INSTANT end handling ===
// === TRULY INSTANT updateRealtimeVolume - Zero delay end handling ===
const updateRealtimeVolume = () => {
  // Basic validation checks
  if (!wavesurferRef.current || !regionRef.current || !isPlaying) {
    console.log(`[updateRealtimeVolume] STOPPING - Missing refs or not playing`);
    return;
  }

  // Double-check wavesurfer's playing state
  const isWavesurferPlaying = wavesurferRef.current.isPlaying 
    ? wavesurferRef.current.isPlaying() 
    : (isPlaying && !wavesurferRef.current.paused);
  
  if (!isWavesurferPlaying) {
    console.log(`[updateRealtimeVolume] WaveSurfer not playing, handling end`);
    handlePlaybackEnd();
    return;
  }
  // Get current position and sync all components
  const currentPos = wavesurferRef.current.getCurrentTime();
  const regionEnd = regionRef.current.end;
  
  // Update ALL position references immediately
  syncPositionRef.current = currentPos;
  currentPositionRef.current = currentPos;
  lastPositionRef.current = currentPos;
  
  // Update UI time display
  setCurrentTime(currentPos);
  onTimeUpdate(currentPos);
  
  // Force overlay redraw with current position
  drawVolumeOverlay(true);
  
  // End detection with tolerance
  const END_TOLERANCE = 0.02; // 20ms tolerance
  const distanceToEnd = regionEnd - currentPos;

  if (distanceToEnd <= END_TOLERANCE) {
    console.log(`[updateRealtimeVolume] END DETECTED - Distance: ${distanceToEnd.toFixed(4)}s`);
    console.log(`  Current: ${currentPos.toFixed(4)}s, Region End: ${regionEnd.toFixed(4)}s`);
    
    // Stop animation frame immediately
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // Handle end
    handlePlaybackEnd();
    return;
  }

  // Continue normal operation
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]); // verifyPlaybackState is stable
        
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

    // Capture the waveform ref early to avoid stale closure in cleanup
    const currentWaveformElement = waveformRef.current;

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
        console.log('[BARCOLOR] Called with:', { 
          barIndex, 
          barTime: barTime.toFixed(3), 
          removeMode: isDeleteMode,
          hasRegion: !!regionRef.current 
        });
        
        if (!regionRef.current) {
          console.log('[BARCOLOR] No region, returning default gray');
          return '#e5e7eb';
        }
        
        const start = regionRef.current.start;
        const end = regionRef.current.end;
        const isInRegion = barTime >= start && barTime <= end;
        
        console.log('[BARCOLOR] Region analysis:', {
          regionStart: start.toFixed(3),
          regionEnd: end.toFixed(3),
          isInRegion,
          currentMode: isDeleteMode ? 'DELETE' : 'NORMAL'
        });
        
        if (isDeleteMode) {
          // Chế độ xóa: vùng chọn trong suốt, phần ngoài màu xanh
          if (isInRegion) {
            console.log('[BARCOLOR] Delete mode - region (transparent)');
            return 'transparent'; // Vùng sẽ bị xóa - trong suốt
          } else {
            console.log('[BARCOLOR] Delete mode - keep area (blue)');
            return '#3b82f6'; // Phần giữ lại - màu xanh
          }
        } else {
          // Chế độ bình thường: vùng chọn xanh, phần ngoài xám
          if (isInRegion) {
            console.log('[BARCOLOR] Normal mode - selected region (blue)');
            return '#3b82f6'; // Vùng được chọn - màu xanh
          } else {
            console.log('[BARCOLOR] Normal mode - unselected (gray)');
            return '#e5e7eb'; // Phần không chọn - màu xám
          }
        }
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
          
          // CRITICAL: Set flags immediately
          isClickUpdatingEndRef.current = true;
          lastClickEndTimeRef.current = clickTime;
          
          // Clear any existing timeouts immediately
          if (endUpdateTimeoutRef.current) {
            clearTimeout(endUpdateTimeoutRef.current);
            endUpdateTimeoutRef.current = null;
          }
          
          // Calculate preview position immediately
          const previewPosition = calculatePreviewPosition(clickTime, currentTime);
          console.log(`[handleWaveformClick] 🎯 INSTANT preview position: ${previewPosition.toFixed(4)}s`);
          
          // IMMEDIATE region update
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
    
          // IMMEDIATE position sync and UI updates
          onRegionChange(currentStart, clickTime);

          // CRITICAL: Force immediate seek and sync
          const seekRatio = previewPosition / wavesurferRef.current.getDuration();
          wavesurferRef.current.seekTo(seekRatio);
          
          // IMMEDIATE sync of all position references
          syncPositionRef.current = previewPosition;
          currentPositionRef.current = previewPosition;
          lastPositionRef.current = previewPosition;
          
          // IMMEDIATE volume and overlay updates
          updateVolume(previewPosition, true, true);
          drawVolumeOverlay(true);
          
          // Force another immediate sync after a very short delay
          requestAnimationFrame(() => {
            if (wavesurferRef.current) {
              const currentWsPos = wavesurferRef.current.getCurrentTime();
              if (Math.abs(currentWsPos - previewPosition) > 0.001) {
                wavesurferRef.current.seekTo(previewPosition / wavesurferRef.current.getDuration());
                syncPositions(previewPosition, "handleWaveformClickPreviewSync");
                updateVolume(previewPosition, true, true);
                drawVolumeOverlay(true);
              }
            }
          });
          
          // Handle playback continuation
          if (wasPlaying) {
            console.log(`[handleWaveformClick] ▶️ Continuing playback from ${previewPosition.toFixed(4)}s to ${clickTime.toFixed(4)}s`);
            // Use requestAnimationFrame for smoother playback resumption
            requestAnimationFrame(() => {
              if (wavesurferRef.current && isPlaying) {
                wavesurferRef.current.play(previewPosition, clickTime);
              }
            });
          } else {
            console.log(`[handleWaveformClick] ⏸️ Not playing - positioned at preview point ${previewPosition.toFixed(4)}s`);
          }
          
          // Clear click flags after a short delay
          setTimeout(() => {
            isClickUpdatingEndRef.current = false;
            lastClickEndTimeRef.current = null;
            clickSourceRef.current = null;
            regionChangeSourceRef.current = null;
            console.log("[handleWaveformClick] Reset click flags");
          }, 100);
        }
        else {
          console.log("[handleWaveformClick] Click within region, seeking to:", clickTime);
          const totalDuration = wavesurferRef.current.getDuration();
          wavesurferRef.current.seekTo(clickTime / totalDuration);
          syncPositions(clickTime, "handleWaveformClickWithin");
          updateVolume(clickTime, true, true);
          
          // === FIX: Force overlay redraw sau khi click trong region ===
          setTimeout(() => {
            drawVolumeOverlay(true);
            console.log(`[handleWaveformClick] Overlay redrawn after click within region: ${clickTime.toFixed(4)}s`);
          }, 50);
          
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
          color: isDeleteMode ? 'transparent' : 'rgba(59, 130, 246, 0.2)',
          handleStyle: {
            borderColor: isDeleteMode ? 'rgba(239, 68, 68, 0.8)' : colors[theme].regionBorderColor,
            backgroundColor: isDeleteMode ? 'transparent' : colors[theme].regionBorderColor,
          },
        })
      );
      
      regionsPluginRef.current = plugin;

     // Create region with initial styles
regionRef.current = plugin.addRegion({
  start: 0,
  end: dur,
  color: isDeleteMode ? 'transparent' : 'rgba(59, 130, 246, 0.2)',
  handleStyle: {
    borderColor: isDeleteMode ? 'rgba(239, 68, 68, 0.8)' : colors[theme].regionBorderColor,
    backgroundColor: isDeleteMode ? 'transparent' : colors[theme].regionBorderColor,
  }
});

      // Add handlers for all region interactions
      if (regionRef.current && regionRef.current.on) {
        // Common function to update region styles
        const updateRegionStyles = () => {
          if (!regionRef.current || !regionRef.current.element) return;
          
          try {
            // Get current styles based on mode - INVERTED LOGIC
            const currentColor = isDeleteMode ? 'transparent' : 'rgba(59, 130, 246, 0.2)';
const currentHandleStyle = {
  borderColor: isDeleteMode ? 'rgba(239, 68, 68, 0.8)' : colors[theme].regionBorderColor,
  backgroundColor: isDeleteMode ? 'transparent' : colors[theme].regionBorderColor,
};

            // Update through WaveSurfer API
            if (regionRef.current.setOptions) {
              regionRef.current.setOptions({
                color: currentColor,
                handleStyle: currentHandleStyle
              });
            } else if (regionRef.current.update) {
              regionRef.current.update({
                color: currentColor,
                handleStyle: currentHandleStyle
              });
            }

            // Force update element style directly
            if (regionRef.current.element) {
              // Set background color
              regionRef.current.element.style.backgroundColor = currentColor;
              
              // Also update any child elements that might affect the region appearance
              const regionElements = regionRef.current.element.getElementsByClassName('wavesurfer-region');
              Array.from(regionElements).forEach(el => {
                el.style.backgroundColor = currentColor;
              });
            }

            // Force redraw if needed
            if (wavesurferRef.current && wavesurferRef.current.drawer) {
              wavesurferRef.current.drawer.draw();
            }
          } catch (error) {
            console.error('[Region Style Update] Error:', error);
          }
        };

        // Handle region updates (dragging, resizing)
        regionRef.current.on('update', () => {
          updateRegionStyles();
        });

        // Handle region-updated event (after drag/resize completes)
        regionRef.current.on('update-end', () => {
          updateRegionStyles();
        });

        // Handle region-updated event (for any other updates)
        regionRef.current.on('region-updated', () => {
          updateRegionStyles();
        });

        // Handle mouse interactions
        if (regionRef.current.element) {
          const handleMouseInteraction = () => {
            // Small delay to ensure the interaction is complete
            setTimeout(updateRegionStyles, 50);
          };

          regionRef.current.element.addEventListener('mouseup', handleMouseInteraction);
          regionRef.current.element.addEventListener('mouseleave', handleMouseInteraction);
        }
      }
      
      lastRegionStartRef.current = regionRef.current.start;
      lastRegionEndRef.current = regionRef.current.end;
      
      // === SYNC FIX: Initialize synchronized position ===
      syncPositions(0, "wavesurferReady");
      
      if (regionRef.current.on) {
        // Thay thế đoạn region 'out' event handler
        regionRef.current.on('out', () => {
          console.log("[Region OUT] Playback left region");
          
          if (!isPlaying) {
            console.log("[Region OUT] Not playing, ignoring out event");
            return;
          }
          
          if (loop) {
            console.log("[Region OUT] Loop mode enabled - handling loop");
            handleLoopPlayback();
          } else {
            console.log("[Region OUT] Normal mode - handling end");
            handlePlaybackEnd();
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
        
        // CRITICAL: Set dragging state
        isDraggingRegionRef.current = true;
        console.log(`[update] 🖱️ Set isDraggingRegionRef to true`);
        
        // Clear dragging state after delay
        clearTimeout(window.dragTimeout);
        window.dragTimeout = setTimeout(() => {
          isDraggingRegionRef.current = false;
          console.log(`[update] 🖱️ Reset isDraggingRegionRef to false`);
        }, 100);
        
        if (regionChangeSourceRef.current === 'click' && isClickUpdatingEndRef.current) {
          console.log(`[update] 🖱️ Skipping - programmatic update from click handler`);
          return;
        }
      
        const currentProfile = currentProfileRef.current;
        const newStart = regionRef.current.start;
        const newEnd = regionRef.current.end;
        const wasPlaying = isPlaying;
        
        console.log(`[update] 📍 New region bounds: ${newStart.toFixed(4)}s - ${newEnd.toFixed(4)}s`);
        
        // CRITICAL: Cập nhật real-time display times
        console.log(`[update] 🔄 Updating real-time display times`);
        setDisplayRegionStart(newStart);
        setDisplayRegionEnd(newEnd);
          // Note: Manual input editing functionality has been removed
        // Display times are now updated only through TimeStepper components
        
        regionChangeSourceRef.current = 'drag';
        
        const isDraggingStart = newStart !== lastRegionStartRef.current;
        const isDraggingEnd = newEnd !== lastRegionEndRef.current;
        
        lastRegionStartRef.current = newStart;
        lastRegionEndRef.current = newEnd;
        
        onRegionChange(newStart, newEnd);
          if (wavesurferRef.current) {
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
// Thay thế đoạn 'finish' event handler
ws.on("finish", () => {
  console.log("[WS finish] WaveSurfer finish event");
  
  if (loop && regionRef.current) {
    console.log("[WS finish] Loop mode - handling loop playback");
    handleLoopPlayback();
  } else {
    console.log("[WS finish] Normal finish - handling end");
    handlePlaybackEnd();
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
ws.on("seek", () => {
  const currentTime = ws.getCurrentTime();
  console.log(`[WS seek] 🎯 Seek completed to ${currentTime.toFixed(4)}s`);
  
  // Force immediate overlay redraw
  setTimeout(() => {
    drawVolumeOverlay(true);
    console.log(`[WS seek] Overlay synchronized to: ${currentTime.toFixed(4)}s`);
  }, 10);
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
        clearTimeout(regionUpdateTimeoutRef.current);      }      isEndingPlaybackRef.current = false;
      if (currentWaveformElement) {
        currentWaveformElement.removeEventListener('click', handleWaveformClick);
      }      ws.destroy();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioFile, theme, onTimeUpdate]); // Many functions are stable and don't need dependencies

  useEffect(() => {
    console.log(`[fadeEffect] TRIGGERED - fadeIn: ${fadeIn}, fadeOut: ${fadeOut}, isPlaying: ${isPlaying}`);
    
    fadeInRef.current = fadeIn;
    fadeOutRef.current = fadeOut;
    fadeEnabledRef.current = fadeIn || fadeOut;

    if (wavesurferRef.current && regionRef.current) {
      // ENHANCED: Better position determination for fade effect changes
      const wsPosition = wavesurferRef.current.getCurrentTime();
      const syncedPosition = syncPositionRef.current;
      const regionStart = regionRef.current.start;
      const regionEnd = regionRef.current.end;
      
      let targetPosition;
      
      console.log(`[fadeEffect] Position analysis:`);
      console.log(`  - WS position: ${wsPosition.toFixed(4)}s`);
      console.log(`  - Synced position: ${syncedPosition.toFixed(4)}s`);
      console.log(`  - Region: ${regionStart.toFixed(4)}s - ${regionEnd.toFixed(4)}s`);
      
      if (isPlaying) {
        // When playing, always use wavesurfer position
        targetPosition = wsPosition;
        console.log(`[fadeEffect] Playing - using WS position: ${targetPosition.toFixed(4)}s`);
      } else {
        // When not playing, determine best position
        const wsInRegion = wsPosition >= regionStart && wsPosition <= regionEnd;
        const syncedInRegion = syncedPosition >= regionStart && syncedPosition <= regionEnd;
        const syncTimeDiff = performance.now() - lastSyncTimeRef.current;
        
        if (syncTimeDiff < 1000 && syncedInRegion) {
          // Recent sync position within region
          targetPosition = syncedPosition;
          console.log(`[fadeEffect] Using recent synced position: ${targetPosition.toFixed(4)}s`);
        } else if (wsInRegion) {
          // WS position is valid
          targetPosition = wsPosition;
          console.log(`[fadeEffect] Using WS position in region: ${targetPosition.toFixed(4)}s`);
        } else {
          // Fallback to region start
          targetPosition = regionStart;
          console.log(`[fadeEffect] Fallback to region start: ${targetPosition.toFixed(4)}s`);
        }
      }
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
      // Force immediate position sync
      syncPositions(targetPosition, "fadeEffect");
      updateVolume(targetPosition, true, true);
      
      if (isPlaying) {
        animationFrameRef.current = requestAnimationFrame(updateRealtimeVolume);
      }
      
      // Force immediate overlay redraw
      drawVolumeOverlay(true);
      
      console.log(`[fadeEffect] ✅ COMPLETED - position: ${targetPosition.toFixed(4)}s, fadeEnabled: ${fadeEnabledRef.current}`);    } else {
      console.log(`[fadeEffect] ❌ Missing refs - wavesurfer: ${!!wavesurferRef.current}, region: ${!!regionRef.current}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fadeIn, fadeOut, isPlaying]); // Functions are stable



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
        }        if (regionUpdateTimeoutRef.current) {
          clearTimeout(regionUpdateTimeoutRef.current);
        }
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]); // Functions are stable

  const formatTime = (seconds) => {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec.toString().padStart(2, "0")}`;
  };

// useEffect để cập nhật thời gian hiển thị khi region thay đổi
useEffect(() => {
  console.log('[REGION_TIME_UPDATE] useEffect triggered');
  
  if (regionRef.current) {
    const newStart = regionRef.current.start;
    const newEnd = regionRef.current.end;
    
    console.log(`[REGION_TIME_UPDATE] Updating display times - Start: ${newStart.toFixed(4)}s, End: ${newEnd.toFixed(4)}s`);
    
    // Update display states
    setDisplayRegionStart(newStart);
    setDisplayRegionEnd(newEnd);
  }
}, [regionRef.current?.start, regionRef.current?.end]);









useEffect(() => {
  console.log(`[removeModeEffect] TRIGGERED - removeMode: ${isDeleteMode}`);
  
  if (!wavesurferRef.current || !regionRef.current) {
    console.log(`[removeModeEffect] Missing refs - waiting for initialization`);
    return;
  }

  try {
    console.log('[removeModeEffect] Updating region styles...');
    
    // Cập nhật styles cho region handles
    if (regionRef.current.element) {
      const regionElement = regionRef.current.element;
      
      if (isDeleteMode) {
        // Chế độ xóa: region trong suốt với viền đỏ
        regionElement.style.backgroundColor = 'transparent';
        regionElement.style.border = '2px solid rgba(239, 68, 68, 0.8)';
        console.log('[removeModeEffect] Applied delete mode styles - transparent background, red border');
      } else {
        // Chế độ bình thường: region xanh nhạt
        regionElement.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
        regionElement.style.border = '1px solid rgba(59, 130, 246, 0.5)';
        console.log('[removeModeEffect] Applied normal mode styles - blue background');
      }
    }

    // Force waveform redraw bằng cách cập nhật barColor
    console.log('[removeModeEffect] Forcing waveform redraw...');
    
    // Tạo barColor function mới với current removeMode state
    const currentRemoveMode = isDeleteMode;
    const newBarColorFunction = (barIndex, barTime) => {
      if (!regionRef.current) return '#e5e7eb';
      
      const start = regionRef.current.start;
      const end = regionRef.current.end;
      const isInRegion = barTime >= start && barTime <= end;
      
      if (currentRemoveMode) {
        // Chế độ xóa: vùng chọn trong suốt, ngoài vùng xanh
        return isInRegion ? 'transparent' : '#3b82f6';
      } else {
        // Chế độ bình thường: vùng chọn xanh, ngoài vùng xám
        return isInRegion ? '#3b82f6' : '#e5e7eb';
      }
    };

    // Cập nhật barColor function
    wavesurferRef.current.setOptions({
      barColor: newBarColorFunction
    });
    
    console.log('[removeModeEffect] Updated barColor function');

    // Force redraw với multiple methods
    setTimeout(() => {
      if (wavesurferRef.current) {
        // Method 1: Height manipulation để force redraw
        const originalHeight = wavesurferRef.current.options?.height || 120;
        wavesurferRef.current.setOptions({ height: originalHeight + 1 });
        
        setTimeout(() => {
          if (wavesurferRef.current) {
            wavesurferRef.current.setOptions({ height: originalHeight });
            console.log('[removeModeEffect] Completed height manipulation redraw');
          }
        }, 50);
        
        // Method 2: Seek để trigger redraw
        const currentTime = wavesurferRef.current.getCurrentTime();
        const totalDuration = wavesurferRef.current.getDuration();
        wavesurferRef.current.seekTo(currentTime / totalDuration);
        
        console.log('[removeModeEffect] Forced seek redraw');
      }
    }, 100);

    console.log(`[removeModeEffect] ✅ Successfully updated to ${isDeleteMode ? 'DELETE' : 'NORMAL'} mode`);
    
  } catch (error) {
    console.error(`[removeModeEffect] Error updating remove mode:`, error);
  }
}, [isDeleteMode]);

  // Update delete mode state when prop changes
  useEffect(() => {
    setIsDeleteMode(removeMode);
  }, [removeMode]);

  // Handle delete mode toggle
  const handleDeleteModeToggle = (newMode) => {
    setIsDeleteMode(newMode);
    onDeleteModeChange?.(newMode);
    
    if (wavesurferRef.current && regionRef.current) {
      // Force redraw with new mode
      drawVolumeOverlay(true);
      
      // Update preview
      const preview = ref.current?.getDeletePreview();
      setDeletePreview(preview);
      
      // If turning off delete mode, reset to normal view
      if (!newMode) {
        const currentTime = wavesurferRef.current.getCurrentTime();
        syncPositions(currentTime, "deleteModeOff");
        updateVolume(currentTime, true, true);
      }
    }
  };

  // Handle delete confirmation
  const handleDeleteConfirm = () => {
    if (!wavesurferRef.current || !regionRef.current) return;
    
    const regionToDelete = ref.current?.deleteRegion();
    if (regionToDelete) {
      onDeleteConfirm?.(regionToDelete);
      
      // Reset to normal mode after delete
      handleDeleteModeToggle(false);
      
      // Reset region to full duration
      const totalDuration = wavesurferRef.current.getDuration();
      if (regionRef.current.setOptions) {
        regionRef.current.setOptions({ start: 0, end: totalDuration });
      } else if (regionRef.current.update) {
        regionRef.current.update({ start: 0, end: totalDuration });
      } else {
        regionRef.current.start = 0;
        regionRef.current.end = totalDuration;
      }
      
      // Update UI
      onRegionChange(0, totalDuration);
      syncPositions(0, "deleteConfirm");
      updateVolume(0, true, true);
      drawVolumeOverlay(true);
    }
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
        </div>      )}
      
      {/* Delete Mode Indicator */}
      {isDeleteMode && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
          <div className="text-red-600 text-xs">
            Chế độ xóa: Vùng đỏ sẽ bị xóa, vùng xanh sẽ được giữ lại
          </div>
        </div>
      )}
      
      <div className={`bg-white dark:bg-gray-800 rounded-lg p-4 mb-4 boxwaveform relative ${isDeleteMode ? 'waveform-delete-mode' : ''}`} style={{ boxShadow: 'none', zIndex: 0 }}>
        <div ref={waveformRef} className="mb-2" />
        <canvas
  ref={overlayRef}
  width={1000}
  height={80}
  className={`w-full border border-gray-200 dark:border-gray-700 rounded-md mb-2 relative ${isDeleteMode ? 'waveform-delete-canvas' : ''}`}
  style={{ zIndex: 1, pointerEvents: 'none' }}
/>
        
{/* TOÀN BỘ 3 PHẦN: Current Time | Region Time Steppers | Volume, responsive layout */}
<div
  className="flex flex-col md:flex-row items-center justify-between gap-3 md:gap-4 w-full max-w-3xl mx-auto bg-white/80 rounded-lg px-3 py-2 border border-gray-200 shadow mb-2 text-sm text-gray-700 dark:text-gray-300"
  style={{ zIndex: 15 }}
>


{/* === Region Time Steppers: Full width on mobile, centered on desktop === */}
<div className="flex flex-col md:flex-row items-center gap-2 md:gap-x-5.8 bg-white/90 rounded-md px-2 py-1 md:px-1 md:py-0.5 order-1 md:order-2 w-full md:w-auto md:flex-1 md:justify-center">
  <TimeStepper
    value={isPlaying ? currentTime : (displayRegionStart || 0)}
    onChange={(val) => {
      console.log("[TimeStepper-Start] Direct edit onChange:", val);
      const currentEnd = displayRegionEnd || duration || 0;
      console.log("[TimeStepper-Start] Current end value:", currentEnd);
      
      if (val >= 0 && val < currentEnd && val <= duration) {
        console.log("[TimeStepper-Start] Valid start time, updating region:", val);
        if (ref?.current?.setRegionStart) {
          ref.current.setRegionStart(val);
        }
        setDisplayRegionStart(val);
        
        // Force position sync and overlay update
        if (wavesurferRef.current && regionRef.current) {
          const totalDuration = wavesurferRef.current.getDuration();
          wavesurferRef.current.seekTo(val / totalDuration);
          syncPositions(val, "timeStepperStartEdit");
          updateVolume(val, true, true);
          drawVolumeOverlay(true);
        }
      } else {
        console.warn("[TimeStepper-Start] Invalid start time:", { val, currentEnd, duration });
        alert(`❌ Thời gian bắt đầu không hợp lệ. Phải từ 0 đến ${formatTime(currentEnd - 0.01)}`);
      }
    }}
    label={isPlaying ? "Now" : "Start"}
    maxValue={Math.max(0, (displayRegionEnd || duration) - 0.01)}
    minValue={0}
    compact={true}
    disabled={false}
    isRealTime={isPlaying}
    showEditButton={!isPlaying}
  />
  <span className="text-gray-300 text-sm px-0 select-none font-bold hidden md:inline">|</span>
  <span className="text-gray-300 text-sm px-0 select-none font-bold md:hidden">↓</span>
  <TimeStepper
    value={displayRegionEnd || duration || 0}
    onChange={(val) => {
      console.log("[TimeStepper-End] Direct edit onChange:", val);
      const currentStart = isPlaying ? currentTime : (displayRegionStart || 0);
      console.log("[TimeStepper-End] Current start value:", currentStart);
      
      if (val > currentStart && val <= duration) {
        console.log("[TimeStepper-End] Valid end time, updating region:", val);
        if (ref?.current?.setRegionEnd) {
          ref.current.setRegionEnd(val);
        }
        setDisplayRegionEnd(val);
        
        // Calculate preview position (3 seconds before end)
        const previewPosition = Math.max(currentStart, val - 3);
        console.log("[TimeStepper-End] Seeking to preview position:", previewPosition);
        
        // Force position sync and overlay update
        if (wavesurferRef.current && regionRef.current) {
          const totalDuration = wavesurferRef.current.getDuration();
          wavesurferRef.current.seekTo(previewPosition / totalDuration);
          syncPositions(previewPosition, "timeStepperEndEdit");
          updateVolume(previewPosition, true, true);
          drawVolumeOverlay(true);
        }
      } else {
        console.warn("[TimeStepper-End] Invalid end time:", { val, currentStart, duration });
        alert(`❌ Thời gian kết thúc không hợp lệ. Phải từ ${formatTime(currentStart + 0.01)} đến ${formatTime(duration)}`);
      }
    }}
    label="End"
    minValue={Math.max(0.01, (isPlaying ? currentTime : (displayRegionStart || 0)) + 0.01)}
    maxValue={duration || 0}
    compact={true}
    disabled={false}
    isRealTime={false}
    showEditButton={true}
  />
</div>

  {/* Bottom row container for mobile, side elements for desktop */}
  <div className="flex flex-row items-center justify-between w-full md:w-auto gap-2 md:gap-4 order-2 md:order-1 md:flex-none">
    {/* Current Time Display */}
    <div className="flex items-center space-x-1 min-w-[105px]">
      <Clock className="w-4 h-4 text-gray-500" />
      <span className="font-mono">{formatTime(currentTime)} / {formatTime(duration)}</span>
    </div>

    {/* Volume Display - Hidden on desktop as it's moved to the right side */}
    <div className="flex items-center space-x-2 min-w-[105px] justify-end md:hidden">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4 text-gray-500"
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
      <span className="text-sm text-gray-600 dark:text-gray-400">
        Volume: {currentVolumeDisplay.toFixed(2)}x
      </span>
    </div>
  </div>

  {/* Volume Display for desktop - shown on the right side */}
  <div className="hidden md:flex items-center space-x-2 min-w-[105px] justify-end order-3">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4 text-gray-500"
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
    <span className="text-sm text-gray-600 dark:text-gray-400">
      Volume: {currentVolumeDisplay.toFixed(2)}x
    </span>
  </div>
</div>

      </div>
    </div>
  );
});

export default WaveformSelector;