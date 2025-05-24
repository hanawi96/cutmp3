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
  const regionsPluginRef = useRef(null); // Added to store RegionsPlugin instance
  const animationFrameRef = useRef(null);
  const lastPositionRef = useRef(0);
  const currentVolumeRef = useRef(volume);
  const drawTimerRef = useRef(null);
  const currentProfileRef = useRef(volumeProfile);
  const fadeEnabledRef = useRef(fade);
  const fadeTimeRef = useRef(2); // 2 seconds fade duration
  const intendedVolumeRef = useRef(volume); // Lưu volume người dùng thực sự muốn
  const isDrawingOverlayRef = useRef(false); // Tracking drawing state
  const throttledDrawRef = useRef(null); // Ref cho hàm vẽ throttled
    const customVolumeRef = useRef(customVolume); // Lưu customVolume để luôn có giá trị mới nhất
  const fadeInDurationRef = useRef(fadeInDuration); // Use prop value
  const fadeOutDurationRef = useRef(fadeOutDuration); // Use prop value
  const lastRegionStartRef = useRef(0);
  const lastRegionEndRef = useRef(0);
  
  // ADDED: New refs to track click source
  const clickSourceRef = useRef(null); // Track if change comes from click vs other sources
  const isClickUpdatingEndRef = useRef(false); // Specific for end updates via click
  const isDragUpdatingEndRef = useRef(false); // ADDED: Track drag end updates
  const lastDragEndTimeRef = useRef(null); // ADDED: Track last drag end time
  
  // REALTIME DRAG SEEKING REFS
  const isRealtimeDragSeekingRef = useRef(false); // Track if realtime drag seeking is active
  const lastRealtimeSeekTimeRef = useRef(null); // Track last realtime seek time to prevent spam
  const realtimeSeekThrottleRef = useRef(null); // Throttle realtime seeks

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
  const regionChangeSourceRef = useRef(null); // 'click', 'drag', or null
  // Thêm ref mới để theo dõi việc cập nhật end bởi click
  const justUpdatedEndByClickRef = useRef(false);
  const endUpdateTimeoutRef = useRef(null);
  const lastClickEndTimeRef = useRef(null); // Thêm ref để lưu end time của lần click cuối

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
  const lastDrawPositionRef = useRef(0);
  // Thêm ref để theo dõi trạng thái kết thúc phát
  const isEndingPlaybackRef = useRef(false);  // Constants for auto-seek feature
  const PREVIEW_TIME_BEFORE_END = 3; // 3 seconds preview before end
  
  // Helper function to calculate preview position (3 seconds before end)
  const calculatePreviewPosition = (endTime, currentTime) => {
    const previewTime = Math.max(0, endTime - PREVIEW_TIME_BEFORE_END);
    console.log(`[calculatePreviewPosition] End: ${endTime.toFixed(2)}s, Current: ${currentTime.toFixed(2)}s, Preview: ${previewTime.toFixed(2)}s (${PREVIEW_TIME_BEFORE_END}s before end)`);
    return previewTime;
  };

  

  // Tách riêng hàm vẽ thanh indicator
  const drawVolumeIndicator = (ctx, currentX, currentTime, start, end, height, currentProfile) => {
    // Đảm bảo vị trí nằm trong vùng hợp lệ
    if (currentTime >= start && currentTime <= end) {
      const t = (currentTime - start) / (end - start);
      const vol = calculateVolumeForProfile(t, currentProfile);
      const maxVol = getMaxVolumeForProfile(currentProfile);
      const scaleFactor = Math.max(maxVol, 0.01) > 0 ? Math.min(3, maxVol) / 3 : 1;
      const h = (vol / maxVol) * height * scaleFactor;

      // Lưu vị trí vẽ cuối cùng
      lastDrawPositionRef.current = currentX;

      ctx.strokeStyle = "#f97316";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(currentX, height - h);
      ctx.lineTo(currentX, height);
      ctx.stroke();
    }
  };

  // Xử lý khi volumeProfile hoặc fade thay đổi
  useEffect(() => {
    intendedVolumeRef.current = volume;
    customVolumeRef.current = customVolume;
    
    // Đảm bảo trạng thái Fade In/Out (2s) được giữ nguyên, không bị ảnh hưởng bởi volume profile
    fadeEnabledRef.current = fade;
    setIsFadeEnabled(fade);

    // Giữ nguyên volume profile cho mọi trường hợp 
    currentProfileRef.current = volumeProfile;
    currentVolumeRef.current = volume;

    // Cập nhật UI và visualization ngay lập tức khi các tham số thay đổi
    if (wavesurferRef.current && regionRef.current) {
      const currentPos = isPlaying ? wavesurferRef.current.getCurrentTime() : regionRef.current.start;
      
      // Hủy animation frame hiện tại nếu có
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
      // Cập nhật volume và overlay ngay lập tức
      updateVolume(currentPos, true, true);
      
      // Nếu đang phát, bắt đầu animation frame mới
      if (isPlaying) {
        animationFrameRef.current = requestAnimationFrame(updateRealtimeVolume);
      }
      
      // Vẽ lại overlay volume visualizer 
      drawVolumeOverlay();
      
      console.log(`Effects updated: volume=${volume}, profile=${volumeProfile}, fade=${fade}, fadeIn=${fadeInDurationRef.current}s, fadeOut=${fadeOutDurationRef.current}s`);
    }
  }, [volumeProfile, volume, customVolume, fade, isPlaying]);

  // Thêm useEffect mới để theo dõi thay đổi của customVolume
  useEffect(() => {
    if (volumeProfile === "custom" && wavesurferRef.current && regionRef.current) {
      // Sử dụng throttle để tránh cập nhật quá nhiều lần
      const updateVolumeAndOverlay = throttle(() => {
        const currentPos = isPlaying ? wavesurferRef.current.getCurrentTime() : regionRef.current.start;
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
    
    // Cập nhật hiển thị nếu WaveSurfer đã được khởi tạo
    if (wavesurferRef.current && (volumeProfile === "custom" || volumeProfile === "fadeInOut") && !fadeEnabledRef.current) {
      // Vẽ lại overlay volume để hiển thị fade in duration mới
      drawVolumeOverlay();
      
      // Cập nhật volume hiện tại nếu đang phát
      if (isPlaying) {
        updateVolume(wavesurferRef.current.getCurrentTime(), true, true);
      } else if (regionRef.current) {
        updateVolume(regionRef.current.start, true, true);
      }
    }
  }, [fadeInDuration]);
  useEffect(() => {
    fadeOutDurationRef.current = fadeOutDuration;
    setFadeOutDurationState(fadeOutDuration);
    
    // Cập nhật hiển thị nếu WaveSurfer đã được khởi tạo
    if (wavesurferRef.current && (volumeProfile === "fadeInOut" || volumeProfile === "custom") && !fadeEnabledRef.current) {
      // Vẽ lại overlay để hiển thị fade out duration mới
      drawVolumeOverlay();
      
      // Cập nhật volume hiện tại nếu đang phát
      if (isPlaying) {
        updateVolume(wavesurferRef.current.getCurrentTime(), true, true);
      } else if (regionRef.current) {
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
        updateVolume(playFrom, true, true);
        wavesurferRef.current.play(playFrom, end);
        setIsPlaying(true);
      }
    },
    stop: () => {
      if (wavesurferRef.current) {
        const currentPos = wavesurferRef.current.getCurrentTime();
        lastPositionRef.current = currentPos;
        
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
        // Đảm bảo vẽ lại overlay volume visualization
        drawVolumeOverlay();
        
        // Cập nhật volume hiện tại để áp dụng fade in effects ngay lập tức
        if (isPlaying) {
          const currentPos = wavesurferRef.current.getCurrentTime();
          updateVolume(currentPos, true, true);
        } else if (regionRef.current) {
          // Khi không phát, vẫn cập nhật để hiển thị thay đổi ngay lập tức
          updateVolume(regionRef.current.start, true, true);
        }
        
        // Thêm timeout để đảm bảo cập nhật UI hoàn toàn
        setTimeout(() => {
          if (isDrawingOverlayRef.current) return;
          drawVolumeOverlay();
          
          // Cập nhật volume lần nữa sau một thời gian ngắn
          if (isPlaying && wavesurferRef.current) {
            updateVolume(wavesurferRef.current.getCurrentTime(), true, true);
          }
        }, 50);
      }
    },
    setFadeOutDuration: (duration) => {
      fadeOutDurationRef.current = duration;
      setFadeOutDurationState(duration);
      if (wavesurferRef.current && (volumeProfile === "fadeInOut" || volumeProfile === "custom") && !fadeEnabledRef.current) {
        // Đảm bảo vẽ lại overlay volume visualization
        drawVolumeOverlay();
        
        // Cập nhật volume hiện tại để áp dụng fade out effects ngay lập tức
        if (isPlaying) {
          const currentPos = wavesurferRef.current.getCurrentTime();
          updateVolume(currentPos, true, true);
        } else if (regionRef.current) {
          // Khi không phát, vẫn cập nhật để hiển thị thay đổi ngay lập tức
          updateVolume(regionRef.current.start, true, true);
        }
        
        // Thêm timeout để đảm bảo cập nhật UI hoàn toàn
        setTimeout(() => {
          if (isDrawingOverlayRef.current) return;
          drawVolumeOverlay();
          
          // Cập nhật volume lần nữa sau một thời gian ngắn
          if (isPlaying && wavesurferRef.current) {
            updateVolume(wavesurferRef.current.getCurrentTime(), true, true);
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
            // Với WaveSurfer.js 7.x, cần thay đổi cách cập nhật region
            if (regionRef.current.setOptions) {
              // Phương thức mới trong 7.x
              regionRef.current.setOptions({ start: startTime });
            } else if (regionRef.current.update) {
              // Phương thức cũ trong 6.x
              regionRef.current.update({ start: startTime });
            } else {
              // Cập nhật trực tiếp nếu không có phương thức hỗ trợ
              regionRef.current.start = startTime;
              // Kích hoạt sự kiện nếu có
              if (wavesurferRef.current.fireEvent) {
                wavesurferRef.current.fireEvent('region-updated', regionRef.current);
              }
            }
            
            // Cập nhật UI và các thành phần khác
            onRegionChange(startTime, currentEnd);
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
        if (!wavesurferRef.current) console.warn("wavesurferRef is null");
        if (!regionRef.current) console.warn("regionRef is null");
      }
    },
    // MODIFIED: Updated setRegionEnd with click source detection
    setRegionEnd: (endTime) => {
      console.log("[setRegionEnd] Called with endTime:", endTime);
      
      try {
        if (!wavesurferRef.current) {
          console.log("[setRegionEnd] wavesurferRef.current is null");
          return;
        }
        if (!regionRef.current) {
          console.log("[setRegionEnd] regionRef.current is null");
          return;
        }
        
        const currentStart = regionRef.current.start;
        const currentTime = wavesurferRef.current.getCurrentTime();
        
        console.log("[setRegionEnd] Current start:", currentStart, "Current time:", currentTime, "New end:", endTime);
        
        if (endTime <= currentStart) {
          console.warn("[setRegionEnd] End time cannot be before or equal to start time");
          return;
        }

        // Mark that this is a programmatic update (not from click)
        const wasClickUpdate = clickSourceRef.current === 'click';
        console.log("[setRegionEnd] Is this from click?", wasClickUpdate);

        // --- Update region end ---
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

        // --- Update UI ---
        onRegionChange(currentStart, endTime);
        updateVolume(currentTime, true, true);
        drawVolumeOverlay();

        // --- Handle playback logic ONLY for programmatic calls (not clicks) ---
        if (!wasClickUpdate && isPlaying) {
          console.log(`[setRegionEnd] Programmatic update - checking playback position`);
          if (currentTime >= endTime) {
            console.log(`[setRegionEnd] Current position (${currentTime}) >= new end (${endTime}), stopping playback`);
            wavesurferRef.current.pause();
            const totalDuration = wavesurferRef.current.getDuration();
            wavesurferRef.current.seekTo(currentStart / totalDuration);
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
    // Thêm tiện ích debug để dễ dàng kiểm tra
    getWavesurferInstance: () => wavesurferRef.current,
    getRegionsPlugin: () => regionsPluginRef.current,
    getRegion: () => regionRef.current,
    getRegionBounds: () => regionRef.current ? { start: regionRef.current.start, end: regionRef.current.end } : null
  }));

  const togglePlayPause = () => {
    if (!wavesurferRef.current || !regionRef.current) return;
    
    if (isPlaying) {
      console.log("Pausing playback");
      const currentPos = wavesurferRef.current.getCurrentTime();
      lastPositionRef.current = currentPos;
      
      wavesurferRef.current.pause();
      
      const totalDuration = wavesurferRef.current.getDuration();
      wavesurferRef.current.seekTo(currentPos / totalDuration);
      
      setIsPlaying(false);
      onPlayStateChange(false); // Notify parent component
      
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
      updateVolume(playFrom, true, true);
      
      console.log(`Starting playback from ${playFrom} to ${end}, loop: ${loop}`);
      
      // Always play with explicit start and end to ensure loop works correctly
      wavesurferRef.current.play(playFrom, end);
      
      setIsPlaying(true);
      onPlayStateChange(true); // Notify parent component
      
      // If we're in loop mode, log that we're starting looped playback
      if (loop) {
        console.log("Starting playback with loop enabled");
      }
    }
  };

  const calculateVolumeForProfile = (relPos, profile) => {
    const intendedVolume = intendedVolumeRef.current;
    const currentCustomVolume = customVolumeRef.current;
    
    // Xử lý riêng cho fadeEnabledRef.current (Fade In/Out 2s)
    if (fadeEnabledRef.current) {
      const regionDuration = regionRef.current ? (regionRef.current.end - regionRef.current.start) : 0;
      if (regionDuration <= 0) return intendedVolume;
      
      const posInRegion = relPos * regionDuration;
      const timeToEnd = regionDuration - posInRegion;
      const fadeDuration = fadeTimeRef.current; // 2s
      
      // Chỉ áp dụng fade in ở đầu region
      if (fadeInRef.current && posInRegion < fadeDuration) {
        return intendedVolume * (posInRegion / fadeDuration);
      }
      // Chỉ áp dụng fade out ở cuối region
      else if (fadeOutRef.current && timeToEnd < fadeDuration) {
        return intendedVolume * (timeToEnd / fadeDuration);
      }
      else {
        return intendedVolume;
      }
    }
    
    // Xử lý cho các volume profile khi không bật Fade In/Out 2s
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
        // Custom fadeIn/fadeOut durations for fadeInOut profile
        const regionDuration = regionRef.current ? (regionRef.current.end - regionRef.current.start) : 0;
        if (regionDuration <= 0) return intendedVolume;
        
        const fadeInTime = fadeInDurationRef.current;
        const fadeOutTime = fadeOutDurationRef.current;
        
        // Calculate actual position in seconds within region
        const posInRegion = relPos * regionDuration;
        const timeToEnd = regionDuration - posInRegion;
        
        // Apply fadeIn
        if (posInRegion < fadeInTime) {
          return intendedVolume * (posInRegion / fadeInTime);
        } 
        // Apply fadeOut
        else if (timeToEnd < fadeOutTime) {
          return intendedVolume * (timeToEnd / fadeOutTime);
        } 
        // Full volume in between
        else {
          return intendedVolume;
        }
      }
      case "custom": {
        // Đảm bảo các giá trị custom volume nằm trong khoảng hợp lệ
        const start = Math.max(0, Math.min(3, currentCustomVolume.start));
        const middle = Math.max(0, Math.min(3, currentCustomVolume.middle));
        const end = Math.max(0, Math.min(3, currentCustomVolume.end));
        
        // Xử lý Fade In/Out và Volume profile trong chế độ custom
        const regionDuration = regionRef.current ? (regionRef.current.end - regionRef.current.start) : 0;
        if (regionDuration > 0) {
          const posInRegion = relPos * regionDuration;
          const fadeInTime = fadeInDurationRef.current;
          const fadeOutTime = fadeOutDurationRef.current;
          const timeToEnd = regionDuration - posInRegion;
          
          // Tính toán volume cơ bản theo vị trí tương đối
          let baseVolume = 0;
          if (relPos <= 0.5) {
            // Nửa đầu: chuyển đổi mượt mà từ start đến middle
            const t = relPos * 2; // Chuyển đổi [0, 0.5] thành [0, 1]
            baseVolume = start + (middle - start) * t;
          } else {
            // Nửa sau: chuyển đổi mượt mà từ middle đến end
            const t = (relPos - 0.5) * 2; // Chuyển đổi [0.5, 1] thành [0, 1]
            baseVolume = middle + (end - middle) * t;
          }
          
          // Áp dụng hiệu ứng fadeIn nếu đang trong khoảng fadeIn time
          if (posInRegion < fadeInTime && fadeInTime > 0) {
            const fadeProgress = posInRegion / fadeInTime;
            // Áp dụng fade effect vào volume đã tính theo profile
            return intendedVolume * baseVolume * fadeProgress;
          }
          
          // Áp dụng hiệu ứng fadeOut nếu đang trong khoảng fadeOut time
          if (timeToEnd < fadeOutTime && fadeOutTime > 0) {
            const fadeProgress = timeToEnd / fadeOutTime;
            // Áp dụng fade out effect vào volume đã tính theo profile
            return intendedVolume * baseVolume * fadeProgress;
          }
          
          // Trả về volume theo profile nếu không ảnh hưởng bởi fade
          return intendedVolume * baseVolume;
        }
        
        // Xử lý thông thường nếu không áp dụng fadeIn
        // Tính toán volume dựa trên vị trí tương đối
        if (relPos <= 0.5) {
          // Nửa đầu: chuyển đổi mượt mà từ start đến middle
          const t = relPos * 2; // Chuyển đổi [0, 0.5] thành [0, 1]
          return intendedVolume * (start + (middle - start) * t);
        } else {
          // Nửa sau: chuyển đổi mượt mà từ middle đến end
          const t = (relPos - 0.5) * 2; // Chuyển đổi [0.5, 1] thành [0, 1]
          return intendedVolume * (middle + (end - middle) * t);
        }
      }
      default: {
        return intendedVolume;
      }
    }
  };

  const getMaxVolumeForProfile = (profile) => {
    const intendedVolume = intendedVolumeRef.current;
    const currentCustomVolume = customVolumeRef.current;
    
    switch (profile) {
      case "uniform":
        return intendedVolume;
      case "fadeIn":
      case "fadeOut":
        return intendedVolume;
      case "fadeInOut":
        return intendedVolume;
      case "custom":
        return Math.max(currentCustomVolume.start, currentCustomVolume.middle, currentCustomVolume.end);
      default:
        return intendedVolume;
    }
  };

  // FIXED: Enhanced updateVolume with optimized logging
  const updateVolume = (absPosition = null, forceUpdate = false, forceRedraw = false) => {
    if (!wavesurferRef.current || !regionRef.current) {
      return; // Removed excessive logging
    }

    // Safety check for region bounds
    const regionStart = regionRef.current.start;
    const regionEnd = regionRef.current.end;
    if (regionEnd <= regionStart) {
      console.warn("[updateVolume] Invalid region bounds, skipping update");
      return;
    }

    const currentPos = absPosition ?? (isPlaying ? wavesurferRef.current.getCurrentTime() : lastPositionRef.current);
    
    // OPTIMIZED: Only log when force update or debugging needed
    if (forceUpdate || absPosition !== null) {
      console.log(`[updateVolume] Pos: ${currentPos.toFixed(2)}s, Force: ${forceUpdate}, Redraw: ${forceRedraw}`);
    }
    
    lastPositionRef.current = currentPos;

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
    // Chỉ bỏ qua nếu không force redraw và đang trong khoảng thời gian ngắn
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

        // Đảm bảo vị trí tính toán chính xác
        const startX = Math.max(0, Math.floor((start / totalDuration) * width));
        const endX = Math.min(width, Math.ceil((end / totalDuration) * width));
        const regionWidth = endX - startX;

        const currentProfile = currentProfileRef.current;

        // Vẽ volume overlay
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

        // Luôn vẽ thanh indicator với vị trí hiện tại chính xác
        const currentTime = isPlaying ? wavesurferRef.current.getCurrentTime() : currentPositionRef.current;
        currentPositionRef.current = currentTime;
        
        // Đảm bảo vị trí nằm trong vùng hợp lệ
        if (currentTime >= start && currentTime <= end) {
          const currentX = Math.floor((currentTime / totalDuration) * width);
          drawVolumeIndicator(ctx, currentX, currentTime, start, end, height, currentProfile);
        }

        if (isPlaying) {
          const t = (currentTime - start) / (end - start);
          const vol = calculateVolumeForProfile(t, currentProfile);
          currentVolumeRef.current = vol;
          setCurrentVolumeDisplay(vol);
        }

        // VẼ SÓNG ĐẬM TRONG REGION (KHÔNG CHE OVERLAY)
        ctx.save();
        ctx.globalAlpha = 1.0;
        ctx.strokeStyle = colors[theme].progressColor;
        ctx.lineWidth = 2;
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
    
    // Track loop count
    const loopCount = trackLoop();
    
    // Always reset to start of region for loop
    const start = regionRef.current.start;
    const end = regionRef.current.end;
    
    // Reset position reference
    lastPositionRef.current = start;
    
    console.log(`Loop playback #${loopCount}: restarting from ${start.toFixed(2)}s to ${end.toFixed(2)}s`);
    
    // Đảm bảo trạng thái đang phát
    if (!isPlaying) {
      setIsPlaying(true);
      onPlayStateChange(true);
    }
    
    // IMPORTANT: Dừng trước khi phát lại để tránh xung đột giữa các sự kiện đang xử lý
    // Điều này đảm bảo một chu kỳ mới hoàn toàn
    wavesurferRef.current.pause();
    
    // Đặt lại vị trí hiện tại
    const totalDuration = wavesurferRef.current.getDuration();
    wavesurferRef.current.seekTo(start / totalDuration);

    // Sử dụng setTimeout để đảm bảo UI và các event handler khác có thời gian xử lý
    // Điều này giúp tránh các điều kiện xung đột
    setTimeout(() => {
      if (!wavesurferRef.current || !regionRef.current || !loop) return;
      
      // Đảm bảo rằng wavesurfer đang trong trạng thái đúng
      if (wavesurferRef.current.getCurrentTime() !== start) {
        wavesurferRef.current.seekTo(start / totalDuration);
      }
      
      // Cập nhật volume trước khi phát lại
      updateVolume(start, true, true);
      
      // Phát từ start đến end - quan trọng cho vòng lặp
      console.log(`Loop #${loopCount}: Bắt đầu phát từ ${start.toFixed(2)}s đến ${end.toFixed(2)}s`);
      wavesurferRef.current.play(start, end);
      
      // Đảm bảo animation frame loop được cập nhật
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = requestAnimationFrame(updateRealtimeVolume);
    }, 50); // Tăng timeout để đảm bảo mọi thứ đều ổn định
  };

  const handlePlaybackEnd = () => {
    if (!wavesurferRef.current || !regionRef.current) {
      console.log("[handlePlaybackEnd] Missing refs, cannot handle end");
      return;
    }
  
    console.log("[handlePlaybackEnd] 🏁 HANDLING PLAYBACK END");
    console.log(`[handlePlaybackEnd] Current state - isPlaying: ${isPlaying}, isEndingPlayback: ${isEndingPlaybackRef.current}`);
  
    // Prevent multiple simultaneous end handling
    if (isEndingPlaybackRef.current) {
      console.log("[handlePlaybackEnd] Already handling playback end, ignoring");
      return;
    }
  
    // Only handle if actually playing
    if (!isPlaying) {
      console.log("[handlePlaybackEnd] Not playing, ignoring end signal");
      return;
    }
  
    // Mark as handling end
    isEndingPlaybackRef.current = true;
    console.log("[handlePlaybackEnd] ✋ STOPPING PLAYBACK");
  
    try {
      // Stop wavesurfer
      wavesurferRef.current.pause();
      
      // Reset to region start
      const regionStart = regionRef.current.start;
      const totalDuration = wavesurferRef.current.getDuration();
      wavesurferRef.current.seekTo(regionStart / totalDuration);
      
      // Update position references
      lastPositionRef.current = regionStart;
      currentPositionRef.current = regionStart;
      
      // Update UI state
      setIsPlaying(false);
      onPlayStateChange(false);
      onPlayEnd();
      
      // Redraw overlay
      drawVolumeOverlay(true);
      
      console.log(`[handlePlaybackEnd] ✅ PLAYBACK STOPPED AND RESET TO START: ${regionStart.toFixed(2)}s`);
      
    } catch (error) {
      console.error("[handlePlaybackEnd] Error during end handling:", error);
    } finally {
      // Clear ending flag after a short delay
      setTimeout(() => {
        isEndingPlaybackRef.current = false;
        console.log("[handlePlaybackEnd] 🔓 End handling complete, flag cleared");
      }, 100);
    }
  };

  // CRITICAL FIX: Enhanced updateRealtimeVolume with better end detection
  const updateRealtimeVolume = () => {
    // STEP 1: Basic validation checks
    if (!wavesurferRef.current || !regionRef.current || !isPlaying) {
      console.log(`[updateRealtimeVolume] STOPPING - Missing refs or not playing`);
      return;
    }
  
    // STEP 2: Double-check wavesurfer's playing state
    const isWavesurferPlaying = wavesurferRef.current.isPlaying 
      ? wavesurferRef.current.isPlaying() 
      : (isPlaying && !wavesurferRef.current.paused);
    
    if (!isWavesurferPlaying) {
      console.log(`[updateRealtimeVolume] WaveSurfer not playing, stopping updates`);
      return;
    }
  
    // STEP 3: Get current position and region bounds
    const currentPos = wavesurferRef.current.getCurrentTime();
    const regionEnd = regionRef.current.end;
    const regionStart = regionRef.current.start;
    
    // CRITICAL: Use very small buffer for precise end detection
    const END_DETECTION_BUFFER = 0.005; // 5ms buffer - very precise
    
    // STEP 4: Check if we're at or past the region end
    const isAtEnd = currentPos >= (regionEnd - END_DETECTION_BUFFER);
    
    // Enhanced debugging for end detection
    if (isAtEnd || currentPos >= regionEnd - 0.1) {
      console.log(`[updateRealtimeVolume] 🔍 END CHECK:`);
      console.log(`  Current: ${currentPos.toFixed(4)}s`);
      console.log(`  Region End: ${regionEnd.toFixed(4)}s`);
      console.log(`  End Threshold: ${(regionEnd - END_DETECTION_BUFFER).toFixed(4)}s`);
      console.log(`  Is At End: ${isAtEnd}`);
      console.log(`  Drag Updating: ${isDragUpdatingEndRef.current}`);
      console.log(`  Click Updating: ${isClickUpdatingEndRef.current}`);
      console.log(`  Last Drag End: ${lastDragEndTimeRef.current}`);
      console.log(`  Last Click End: ${lastClickEndTimeRef.current}`);
    }
  
    if (isAtEnd) {
      console.log(`[updateRealtimeVolume] 🚨 AT REGION END - Processing end logic`);
      
      // STEP 5: Final safety check - ensure we're still playing
      if (!isPlaying || !isWavesurferPlaying) {
        console.log(`[updateRealtimeVolume] State changed during processing, exiting`);
        return;
      }
  
      // STEP 6: Check for active end updates (PRIORITY ORDER)
      
      // PRIORITY 1: Active Click End Update
      if (isClickUpdatingEndRef.current && lastClickEndTimeRef.current) {
        console.log(`[updateRealtimeVolume] 🖱️ CLICK END UPDATE ACTIVE`);
        console.log(`  Current: ${currentPos.toFixed(4)}s, Target Click End: ${lastClickEndTimeRef.current.toFixed(4)}s`);
        
        if (currentPos < lastClickEndTimeRef.current) {
          console.log(`[updateRealtimeVolume] Still before click target, continuing...`);
          updateVolume(currentPos, false, false);
          animationFrameRef.current = requestAnimationFrame(updateRealtimeVolume);
          return;
        } else {
          console.log(`[updateRealtimeVolume] Reached click target end, clearing flags`);
          isClickUpdatingEndRef.current = false;
          lastClickEndTimeRef.current = null;
          // Continue to normal end handling
        }
      }
      
      // PRIORITY 2: Active Drag End Update
      if (isDragUpdatingEndRef.current && lastDragEndTimeRef.current) {
        console.log(`[updateRealtimeVolume] 🖱️ DRAG END UPDATE ACTIVE`);
        console.log(`  Current: ${currentPos.toFixed(4)}s, Target Drag End: ${lastDragEndTimeRef.current.toFixed(4)}s`);
        
        if (currentPos < lastDragEndTimeRef.current) {
          console.log(`[updateRealtimeVolume] Still before drag target, continuing...`);
          updateVolume(currentPos, false, false);
          animationFrameRef.current = requestAnimationFrame(updateRealtimeVolume);
          return;
        } else {
          console.log(`[updateRealtimeVolume] Reached drag target end, clearing flags`);
          isDragUpdatingEndRef.current = false;
          lastDragEndTimeRef.current = null;
          // Continue to normal end handling
        }
      }
      
      // PRIORITY 3: Legacy click update flag
      if (justUpdatedEndByClickRef.current) {
        console.log(`[updateRealtimeVolume] Legacy click update flag active, clearing and continuing`);
        justUpdatedEndByClickRef.current = false;
        updateVolume(currentPos, false, false);
        animationFrameRef.current = requestAnimationFrame(updateRealtimeVolume);
        return;
      }
  
      // STEP 7: NORMAL END OF PLAYBACK - No active updates
      console.log(`[updateRealtimeVolume] 🛑 NORMAL PLAYBACK END DETECTED`);
      console.log(`  No active updates, processing normal end`);
      console.log(`  Final check - isPlaying: ${isPlaying}, wavesurferPlaying: ${isWavesurferPlaying}`);
      
      if (isPlaying && isWavesurferPlaying) {
        console.log(`[updateRealtimeVolume] ✅ STOPPING PLAYBACK AT REGION END`);
        
        // Clear animation frame first
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        
        // Handle end of playback
        handlePlaybackEnd();
      } else {
        console.log(`[updateRealtimeVolume] State inconsistent, not handling end`);
      }
      
      return; // Important: exit here to prevent further processing
    }
  
    // STEP 8: Normal operation - continue playing and updating
    updateVolume(currentPos, false, false);
    animationFrameRef.current = requestAnimationFrame(updateRealtimeVolume);
  };

  useEffect(() => {
    console.log(`[useEffect] Animation frame control - isPlaying: ${isPlaying}, isRegionUpdating: ${isRegionUpdatingRef.current}`);
    
    if (isPlaying || isRegionUpdatingRef.current) {
      // Cancel any existing animation frames
      if (animationFrameRef.current) {
        console.log(`[useEffect] Cancelling existing animation frame`);
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (overlayAnimationFrameRef.current) {
        cancelAnimationFrame(overlayAnimationFrameRef.current);
        overlayAnimationFrameRef.current = null;
      }
      
      // Only start animation frames if actually playing
      if (isPlaying) {
        console.log(`[useEffect] Starting animation frame loops for playing state`);
        animationFrameRef.current = requestAnimationFrame(updateRealtimeVolume);
      }
      
      // Always start overlay animation for region updates
      overlayAnimationFrameRef.current = requestAnimationFrame(updateOverlay);
      
      console.log("Animation frame loops started - isPlaying:", isPlaying, "isRegionUpdating:", isRegionUpdatingRef.current);
    } else {
      console.log(`[useEffect] Stopping all animation frames - not playing and not updating region`);
      // Clean up animation frames when not playing
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (overlayAnimationFrameRef.current) {
        cancelAnimationFrame(overlayAnimationFrameRef.current);
        overlayAnimationFrameRef.current = null;
      }
    }
    
    return () => {
      console.log(`[useEffect cleanup] Cleaning up animation frames`);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (overlayAnimationFrameRef.current) {
        cancelAnimationFrame(overlayAnimationFrameRef.current);
        overlayAnimationFrameRef.current = null;
      }
      // ADD: Clear any pending timeouts
      if (endUpdateTimeoutRef.current) {
        clearTimeout(endUpdateTimeoutRef.current);
        endUpdateTimeoutRef.current = null;
      }
    };
  }, [isPlaying]);
        
  // Thêm hàm mới để cập nhật overlay liên tục
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

  // Thêm theo dõi sự kiện error để bắt các vấn đề có thể xảy ra
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
  }, [/* no dependencies */]);

  useEffect(() => {
    if (!audioFile) return;
    setLoading(true);

    throttledDrawRef.current = throttle(() => {
      drawVolumeOverlay();
    }, 16);

    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: '#e5e7eb', // xám nhạt ngoài region
      progressColor: '#e5e7eb',
      height: 120,
      responsive: true,
      cursorColor: colors[theme].cursorColor,
      backend: "WebAudio",
      volume: Math.min(1, volume),
      barWidth: 1,
      barGap: 1,
      barRadius: 3,
      normalize: normalizeAudio,
      barColor: (barIndex, barTime) => {
        if (!regionRef.current) return '#e5e7eb';
        const start = regionRef.current.start;
        const end = regionRef.current.end;
        if (barTime >= start && barTime <= end) {
          return '#06b6d4'; // cyan sáng nổi bật
        }
        return '#e5e7eb'; // xám nhạt ngoài region
      },
    });

    // Sau khi tạo ws, vẽ hiệu ứng đậm trong region bằng overlay
    // Đã có drawVolumeOverlay, ta sẽ vẽ thêm sóng đậm trong region trên overlay

    // MODIFIED: Updated handleWaveformClick with improved logic
    const handleWaveformClick = (e) => {
      try {
        if (!wavesurferRef.current || !regionRef.current) return;
    
        console.log("[handleWaveformClick] Click detected");
    
        // Get click position relative to waveform container
        const rect = waveformRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickTime = (clickX / rect.width) * wavesurferRef.current.getDuration();
    
        const currentStart = regionRef.current.start;
        const currentEnd = regionRef.current.end;
        const wasPlaying = isPlaying;
        const currentTime = wavesurferRef.current.getCurrentTime();
    
        console.log("[handleWaveformClick] Click time:", clickTime, "Current start:", currentStart, "Current end:", currentEnd, "Current playback time:", currentTime, "Was playing:", wasPlaying);        // Mark that this change comes from click
        clickSourceRef.current = 'click';
        regionChangeSourceRef.current = 'click';
    
        // Handle click before region start
        if (clickTime < currentStart) {
          console.log("[handleWaveformClick] Click before region start, updating start to:", clickTime);
          
          // Update region start
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
    
          // Update UI and notify parent
          onRegionChange(clickTime, currentEnd);
          
          // Handle playback state - always reset to new start when changing start
          if (wasPlaying) {
            console.log("[handleWaveformClick] Was playing, resetting to new start and continuing");
            wavesurferRef.current.pause();
            setTimeout(() => {
              if (wavesurferRef.current) {
                wavesurferRef.current.play(clickTime, currentEnd);
                lastPositionRef.current = clickTime;
              }
            }, 50);
          } else {
            console.log("[handleWaveformClick] Not playing, just updating volume and seeking to new start");
            // FIXED: When not playing, seek to new start position
            const totalDuration = wavesurferRef.current.getDuration();
            wavesurferRef.current.seekTo(clickTime / totalDuration);
            lastPositionRef.current = clickTime;
            currentPositionRef.current = clickTime;
            updateVolume(clickTime, true, true);
          }        }
        // Handle click after current region end - create new end and auto-seek
        else if (clickTime > currentEnd + 0.1) {
          console.log("[handleWaveformClick] Click after current region end");
          console.log(`[handleWaveformClick] Current end: ${currentEnd.toFixed(4)}s, Click time: ${clickTime.toFixed(4)}s`);
          
          // Always update region end to click position
          console.log("[handleWaveformClick] Updating region end to:", clickTime);
          
          // Mark this as a click-initiated end update
          isClickUpdatingEndRef.current = true;
          lastClickEndTimeRef.current = clickTime;
          
          // Clear timeout if exists
          if (endUpdateTimeoutRef.current) {
            clearTimeout(endUpdateTimeoutRef.current);
          }
          
          // Set timeout to clear the flag
          endUpdateTimeoutRef.current = setTimeout(() => {
            isClickUpdatingEndRef.current = false;
            lastClickEndTimeRef.current = null;
            console.log("[handleWaveformClick] Cleared click update flags");
          }, 1000);
          
          // Update region end
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
    
          // Update UI and notify parent
          onRegionChange(currentStart, clickTime);

          // ALWAYS auto-seek to preview position (2s before new end) when clicking after current time
          const previewPosition = calculatePreviewPosition(clickTime, currentTime);
          console.log(`[handleWaveformClick] 🎯 Auto-seeking to preview position: ${previewPosition.toFixed(4)}s (2s before ${clickTime.toFixed(4)}s)`);
          
          // Seek to preview position
          const seekRatio = previewPosition / wavesurferRef.current.getDuration();
          wavesurferRef.current.seekTo(seekRatio);
          lastPositionRef.current = previewPosition;
          currentPositionRef.current = previewPosition;
          updateVolume(previewPosition, true, true);
            if (wasPlaying) {
            // Continue playing from preview position to new end
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
        // Handle click within region
        else {
          console.log("[handleWaveformClick] Click within region, seeking to:", clickTime);
          // Click within region - seek to that position
          const totalDuration = wavesurferRef.current.getDuration();
          wavesurferRef.current.seekTo(clickTime / totalDuration);
          lastPositionRef.current = clickTime;
          currentPositionRef.current = clickTime;
          updateVolume(clickTime, true, true);
          
          if (wasPlaying) {
            // Continue playing from new position
            setTimeout(() => {
              if (wavesurferRef.current && isPlaying) {
                wavesurferRef.current.play(clickTime, regionRef.current.end);
              }
            }, 50);
          }
        }        // Reset click source after processing - but keep track of click updates
        setTimeout(() => {
          clickSourceRef.current = null;
          // Only reset regionChangeSourceRef if no longer in click update mode
          if (!isClickUpdatingEndRef.current) {
            regionChangeSourceRef.current = null;
          }
          console.log("[handleWaveformClick] Reset click source flag");
        }, 100);      } catch (error) {
        console.error("[handleWaveformClick] Error processing click:", error);
        // Reset click source on error
        clickSourceRef.current = null;
        if (!isClickUpdatingEndRef.current) {
          regionChangeSourceRef.current = null;
        }
      }
    };

    // Add click event listener
    waveformRef.current.addEventListener('click', handleWaveformClick);

    // Áp dụng các bản vá infinite loop trước khi lưu instance
    applyInfiniteLoopFixes(ws);
    
    wavesurferRef.current = ws;
    
    // Thiết lập theo dõi vòng lặp để gỡ lỗi
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
      
      regionsPluginRef.current = plugin; // Store the RegionsPlugin instance

      regionRef.current = plugin.addRegion({
        start: 0,
        end: dur,
        color: colors[theme].regionColor,
      });
      
      // Khởi tạo giá trị ban đầu cho lastRegionStartRef và lastRegionEndRef
      lastRegionStartRef.current = regionRef.current.start;
      lastRegionEndRef.current = regionRef.current.end;
      
      // Tracking when we leave a region - this is critical for loop playback
      if (regionRef.current.on) {
        // Add event for when playback leaves current region
        regionRef.current.on('out', () => {
          console.log("Region OUT event: Playback has left the current region");
          
          if (loop) {
            console.log("Region OUT: Detect loop mode is ON, handling loop playback");
            handleLoopPlayback();
          }
        });
      }
      
      // Debugging region
      console.log("Region created:", regionRef.current);
      console.log("Region methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(regionRef.current)));
      console.log("Regions plugin:", regionsPluginRef.current);
      if (regionsPluginRef.current) {
        console.log("RegionsPlugin methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(regionsPluginRef.current)));
      }      regionRef.current.on("update", () => {
        console.log(`\n🔄 [UPDATE EVENT] Region update detected`);
        console.log(`📊 Current regionChangeSourceRef: ${regionChangeSourceRef.current}`);
        
        // IMPROVED: Only skip if this is a programmatic update from click handler
        // Allow drag updates to proceed even if recently clicked
        if (regionChangeSourceRef.current === 'click' && isClickUpdatingEndRef.current) {
          console.log(`[update] 🖱️ Skipping - programmatic update from click handler`);
          return;
        }

        const currentProfile = currentProfileRef.current;
        const newStart = regionRef.current.start;
        const newEnd = regionRef.current.end;
        const wasPlaying = isPlaying;
        
        console.log(`[update] 📍 New region bounds: ${newStart.toFixed(4)}s - ${newEnd.toFixed(4)}s`);
        
        // Mark this as drag-initiated change
        regionChangeSourceRef.current = 'drag';
        
        // Xác định xem đang kéo region start hay end
        const isDraggingStart = newStart !== lastRegionStartRef.current;
        const isDraggingEnd = newEnd !== lastRegionEndRef.current;
        
        // Cập nhật giá trị trước đó
        lastRegionStartRef.current = newStart;
        lastRegionEndRef.current = newEnd;
        
        // Luôn cập nhật region bounds ngay lập tức
        onRegionChange(newStart, newEnd);
        
        if (wavesurferRef.current) {
          const currentTime = wavesurferRef.current.getCurrentTime();
          
          if (isDraggingStart) {
            // Xử lý khi kéo region start
            // Luôn dừng phát và reset về start mới khi kéo region start
            if (wasPlaying) {
              wavesurferRef.current.pause();
              setIsPlaying(false);
              onPlayStateChange(false);
            }
            
            // Reset về vị trí start mới
            wavesurferRef.current.seekTo(newStart / wavesurferRef.current.getDuration());
            lastPositionRef.current = newStart;
            
            // Nếu đang phát, tiếp tục phát từ start mới
            if (wasPlaying) {
              setTimeout(() => {
                if (wavesurferRef.current) {
                  wavesurferRef.current.play(newStart, newEnd);
                  setIsPlaying(true);
                  onPlayStateChange(true);
                }
              }, 50);
            }
              // Cập nhật volume và UI
            updateVolume(newStart, true, true);            } else if (isDraggingEnd) {
            // ===== REALTIME AUTO-SEEK DURING DRAG =====
            if (wasPlaying) {
              const currentTimeNow = performance.now();
              const shouldPerformRealtimeSeek = !lastRealtimeSeekTimeRef.current || 
                (currentTimeNow - lastRealtimeSeekTimeRef.current) > 100; // Throttle to 100ms
                
              if (shouldPerformRealtimeSeek) {
                // Calculate preview position (3 seconds before end)
                const previewPosition = Math.max(newStart, newEnd - PREVIEW_TIME_BEFORE_END);
                
                console.log(`🔄 [REALTIME AUTO-SEEK] Seeking to ${previewPosition.toFixed(4)}s (${PREVIEW_TIME_BEFORE_END}s before end: ${newEnd.toFixed(4)}s)`);
                
                // Mark as realtime seeking
                isRealtimeDragSeekingRef.current = true;
                lastRealtimeSeekTimeRef.current = currentTimeNow;
                
                // Perform the seek
                wavesurferRef.current.seekTo(previewPosition / wavesurferRef.current.getDuration());
                lastPositionRef.current = previewPosition;
                
                // Clear realtime seeking flag after a short delay
                clearTimeout(realtimeSeekThrottleRef.current);
                realtimeSeekThrottleRef.current = setTimeout(() => {
                  isRealtimeDragSeekingRef.current = false;
                }, 200);
              }
            } else {
              // Not playing - auto-seek to preview position (3s before new end)
              const previewPosition = Math.max(newStart, newEnd - PREVIEW_TIME_BEFORE_END);
              console.log(`[Drag End] Not playing - auto-seek to preview position: ${previewPosition.toFixed(4)}s`);
              wavesurferRef.current.seekTo(previewPosition / wavesurferRef.current.getDuration());
              lastPositionRef.current = previewPosition;
              currentPositionRef.current = previewPosition;
              updateVolume(previewPosition, true, true);
              drawVolumeOverlay(true);
            }
          }
        }
        
        currentProfileRef.current = currentProfile;
        throttledDrawRef.current();
      });      // FIXED: Enhanced update-end event handler
      regionRef.current.on("update-end", () => {
        if (wavesurferRef.current && regionRef.current) {
    const currentTime = wavesurferRef.current.getCurrentTime();
    const start = regionRef.current.start;
    const end = regionRef.current.end;
    const previewPosition = Math.max(start, end - PREVIEW_TIME_BEFORE_END);

    // Nếu currentTime không nằm trong vùng region mới, luôn seek về preview
    if (currentTime < start || currentTime >= end) {
      // Pause để đảm bảo trạng thái clean (không gây lỗi nếu đã pause)
      wavesurferRef.current.pause();

      setTimeout(() => {
        wavesurferRef.current.seekTo(previewPosition / wavesurferRef.current.getDuration());
        lastPositionRef.current = previewPosition;
        updateVolume(previewPosition, true, true);
        // Nếu đang phát lại, play tiếp; nếu không, chỉ seek về preview
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
        
        // IMPROVED: Only skip if this is a programmatic update from click handler  
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
          
          // Continue playback if in valid range
          if (wasPlaying && currentTime >= newStart && currentTime < newEnd) {
            console.log(`[update-end] ✅ Position valid - continuing playback to new end: ${newEnd.toFixed(4)}s`);
            wavesurferRef.current.play(currentTime, newEnd);
          } else if (wasPlaying) {
            console.log(`[update-end] ⚠️ Position outside valid range - current: ${currentTime.toFixed(4)}s, range: ${newStart.toFixed(4)}s - ${newEnd.toFixed(4)}s`);
          }
        }

        // Reset source
        regionChangeSourceRef.current = null;
        console.log(`[update-end] 🔄 Reset regionChangeSourceRef to null`);
        
        // CRITICAL: Only reset drag update flags if NOT auto-seeking
        // Check if auto-seek is in progress by looking at timing
        if (isDragUpdatingEndRef.current) {
          console.log(`[update-end] 🤔 Drag flags are active - checking if auto-seek in progress...`);
          
          // If we just started auto-seek (flags set very recently), delay the reset
          const currentTimeNow = performance.now();
          const timeSinceSet = currentTimeNow - (window.lastDragFlagSetTime || 0);
          
          if (timeSinceSet < 200) { // Less than 200ms since flags were set
            console.log(`[update-end] ⏳ Auto-seek likely in progress (${timeSinceSet.toFixed(0)}ms ago) - delaying flag reset`);
            // Delay the reset to allow auto-seek to complete
            setTimeout(() => {
              if (isDragUpdatingEndRef.current) {
                console.log(`[update-end] ⏰ [DELAYED] Now resetting drag update flags`);
                isDragUpdatingEndRef.current = false;
                lastDragEndTimeRef.current = null;
              }
            }, 300); // Give auto-seek time to complete
          } else {
            console.log(`[update-end] ✅ Safe to reset flags immediately (${timeSinceSet.toFixed(0)}ms ago)`);
            isDragUpdatingEndRef.current = false;
            lastDragEndTimeRef.current = null;
          }        } else {
          console.log(`[update-end] ℹ️ Drag flags already cleared, nothing to reset`);
        }
          
        // Clear timeout if exists
        if (endUpdateTimeoutRef.current) {
          clearTimeout(endUpdateTimeoutRef.current);
          endUpdateTimeoutRef.current = null;
        }
      });

      // Xử lý sự kiện region-updated
      regionRef.current.on("region-updated", () => {
        // Nếu thay đổi đến từ click, bỏ qua xử lý trong region-updated
        if (regionChangeSourceRef.current === 'click') {
          return;
        }

        if (isPlaying && wavesurferRef.current) {
          const currentTime = wavesurferRef.current.getCurrentTime();
          const start = regionRef.current.start;
          const end = regionRef.current.end;
          
          // Nếu đang phát và vị trí hiện tại nằm trong vùng mới
          if (currentTime >= start && currentTime < end) {
            // Tiếp tục phát đến end mới
            wavesurferRef.current.play(currentTime, end);
          }
        }
      });

      drawVolumeOverlay();
    });
    
    ws.on("audioprocess", () => {
      const t = ws.getCurrentTime();
      setCurrentTime(t);
      lastPositionRef.current = t;
      currentPositionRef.current = t;
      onTimeUpdate(t);
      
      // Chỉ vẽ lại khi đang phát và không đang kéo
      if (isPlaying && !isDraggingRef.current) {
        drawVolumeOverlay();
      }
    });
    
    ws.on("finish", () => {
      console.log("finish event detected");
      
      if (loop && regionRef.current) {
        console.log("finish event: phát hiện chế độ loop được bật, kích hoạt vòng lặp");
        
        // Thêm độ trễ nhỏ để đảm bảo các hoạt động khác đã hoàn tất
        setTimeout(() => {
          // Kiểm tra lại xem loop mode vẫn còn hoạt động không
          if (loop && regionRef.current) {
            console.log("finish event timeout: kích hoạt vòng lặp");
            handleLoopPlayback();
          }
        }, 20);
      } else {
        // Hành vi bình thường - dừng phát
        const end = regionRef.current ? regionRef.current.end : ws.getDuration();
        lastPositionRef.current = end;
        setIsPlaying(false);
        onPlayStateChange(false); // Thông báo cho component cha
        onPlayEnd();
      }
    });

    ws.on("seeking", () => {
      const t = ws.getCurrentTime();
      setCurrentTime(t);
      lastPositionRef.current = t;
      currentPositionRef.current = t;
      onTimeUpdate(t);
      updateVolume(t, false, true);
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
      // Reset trạng thái kết thúc
      isEndingPlaybackRef.current = false;
      // Remove click event listener
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

    // Cập nhật UI và visualization ngay lập tức khi các tham số thay đổi
    if (wavesurferRef.current && regionRef.current) {
      const currentPos = isPlaying ? wavesurferRef.current.getCurrentTime() : regionRef.current.start;
      
      // Hủy animation frame hiện tại nếu có
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      
      // Cập nhật volume và overlay ngay lập tức
      updateVolume(currentPos, true, true);
      
      // Nếu đang phát, bắt đầu animation frame mới
      if (isPlaying) {
        animationFrameRef.current = requestAnimationFrame(updateRealtimeVolume);
      }
      
      // Vẽ lại overlay volume visualizer 
      drawVolumeOverlay();
      
      console.log(`Effects updated: fadeIn=${fadeIn}, fadeOut=${fadeOut}, fadeEnabled=${fadeEnabledRef.current}`);
    }
  }, [fadeIn, fadeOut, isPlaying]);

  // Thêm xử lý trong region-updated event
  useEffect(() => {
    if (regionRef.current) {
      const handleRegionUpdated = () => {
        isDraggingRef.current = true;
        isRegionUpdatingRef.current = true;
        
        if (regionUpdateTimeoutRef.current) {
          clearTimeout(regionUpdateTimeoutRef.current);
        }
  
        // Vẽ lại overlay ngay lập tức
        drawVolumeOverlay(true);
  
        // Reset trạng thái sau 150ms để tránh nhấp nháy
        regionUpdateTimeoutRef.current = setTimeout(() => {
          isDraggingRef.current = false;
          isRegionUpdatingRef.current = false;
          
          // FIXED: Chỉ kiểm tra khi thực sự đang phát
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
  
        // Xử lý playback nếu cần
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

  const renderFadeIndicator = () => {
    if (!isFadeEnabled) return null;
    return (
      <div className="absolute top-2 right-2 bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded dark:bg-blue-900 dark:text-blue-300">
        Fade In/Out (2s)
      </div>
    );
  };
    const renderCustomFadeIndicator = () => {
    if (volumeProfile !== "fadeInOut" || fadeEnabledRef.current) return null;
    return (
      <div className="absolute top-2 left-2 bg-indigo-100 text-indigo-800 text-xs font-medium px-2.5 py-0.5 rounded dark:bg-indigo-900 dark:text-indigo-300">
        Custom Fade: In ({fadeInDurationState}s) / Out ({fadeOutDurationState}s)
      </div>
    );
  };

  // Add rendering for fade duration controls
  const renderFadeDurationControls = () => {
    if (volumeProfile !== "fadeInOut" || fadeEnabledRef.current) return null;
    
    return (
      <div className="mt-2 space-y-2">
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Volume: {intendedVolumeRef.current.toFixed(2)}x
            </label>
          </div>
          <input
            type="range"
            min="0"
            max="3"
            step="0.05"
            value={intendedVolumeRef.current}
            onChange={(e) => {
              intendedVolumeRef.current = parseFloat(e.target.value);
              if (wavesurferRef.current) {
                updateVolume(null, true, true);
              }
            }}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
          />
        </div>
        
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Fade In Duration: {fadeInDurationState}s
            </label>
          </div>
          <input
            type="range"
            min="0.1"
            max="10"
            step="0.1"
            value={fadeInDurationState}
            onChange={(e) => {
              const newValue = parseFloat(e.target.value);
              setFadeInDurationState(newValue);
              // Notify parent component through ref method
              if (typeof ref.current === 'object' && ref.current && ref.current.setFadeInDuration) {
                ref.current.setFadeInDuration(newValue);
              }
            }}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
          />
        </div>
        
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Fade Out Duration: {fadeOutDurationState}s
            </label>
          </div>
          <input
            type="range"
            min="0.1"
            max="10"
            step="0.1"
            value={fadeOutDurationState}
            onChange={(e) => {
              const newValue = parseFloat(e.target.value);
              setFadeOutDurationState(newValue);
              // Notify parent component through ref method
              if (typeof ref.current === 'object' && ref.current && ref.current.setFadeOutDuration) {
                ref.current.setFadeOutDuration(newValue);
              }
            }}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
          />
        </div>
      </div>
    );
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
        {renderFadeIndicator()}
        {renderCustomFadeIndicator()}
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
        {/* Nút phát đã được di chuyển lên component cha Mp3Cutter */}
      </div>
    </div>
  );
});

export default WaveformSelector;