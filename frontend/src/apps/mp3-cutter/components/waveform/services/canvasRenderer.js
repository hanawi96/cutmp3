import { WAVEFORM_COLORS, REGION_STYLES, TIMING_CONSTANTS } from '../constants/waveformConstants.js';
import { calculatePreviewPosition } from '../utils/audioUtils.js';

/**
 * Vẽ volume overlay trên canvas
 */
export const drawVolumeOverlay = (canvasRef, regionRef, wavesurferRef, config = {}) => {
  const {
    overlayRef,
    theme,
    isDrawingOverlayRef,
    lastDrawTimeRef,
    drawTimerRef,
    isDraggingRef,
    currentProfileRef,
    currentVolumeRef,
    isPlaying,
    fadeEnabledRef,
    fadeInRef,
    fadeOutRef,
    isClickUpdatingEndRef,
    lastClickEndTimeRef,
    syncPositionRef,
    lastSyncTimeRef,
    lastDrawPositionRef,
    colors,
    calculateVolumeForProfile,
    drawWaveformDimOverlay,
    forceRedraw = false
  } = config;

  if (!overlayRef.current || !regionRef.current || !wavesurferRef.current) return;

  const now = performance.now();
  if (!forceRedraw && !isDraggingRef.current && now - lastDrawTimeRef.current < TIMING_CONSTANTS.DRAW_INTERVAL) {
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

      // Draw volume overlay background
      ctx.fillStyle = colors[theme].volumeOverlayColor;
      ctx.beginPath();
      ctx.moveTo(startX, height);

      // Calculate max volume
      let maxVol = currentVolume;
      if (currentProfile !== "uniform") {
        const samplePoints = (() => {
          switch (currentProfile) {
            case "custom":
            case "bell":
            case "valley":
              return Math.min(200, regionWidth);
            case "exponential_in":
            case "exponential_out":
              return Math.min(100, regionWidth / 2);
            default:
              return 20;
          }
        })();
        
        for (let i = 0; i <= samplePoints; i++) {
          const t = i / samplePoints;
          const vol = calculateVolumeForProfile(t, currentProfile);
          maxVol = Math.max(maxVol, vol);
        }
      }
      maxVol = Math.max(1.0, maxVol);

      // Draw the volume curve
      const stepSize = (() => {
        switch (currentProfile) {
          case "custom":
            return Math.max(2, Math.floor(regionWidth / 200));
          case "bell":
          case "valley":
            return Math.max(1, Math.floor(regionWidth / 300));
          default:
            return Math.max(1, Math.floor(regionWidth / 400));
        }
      })();

      for (let i = 0; i <= regionWidth; i += stepSize) {
        const x = startX + i;
        const t = i / regionWidth;
        const vol = calculateVolumeForProfile(t, currentProfile);
        const h = (vol / maxVol) * height;
        ctx.lineTo(x, height - h);
      }

      ctx.lineTo(endX, height);
      ctx.closePath();
      ctx.fill();

      // CRITICAL: Draw fade zones if fade is enabled
      if (fadeEnabledRef.current && regionRef.current) {
        const regionDuration = end - start;
        
        // Use actual fade durations from refs instead of hardcoded values
        const fadeInDuration = config.fadeInDurationRef?.current || 2.0;
        const fadeOutDuration = config.fadeOutDurationRef?.current || 3.0;
        
        console.log('[drawVolumeOverlay] Drawing fade zones with durations:', {
          fadeInDuration,
          fadeOutDuration,
          regionDuration
        });
        
        ctx.save();
        
        // Draw fade in zone (using actual fadeInDuration)
        if (fadeInRef.current && regionDuration > fadeInDuration && fadeInDuration > 0) {
          const fadeInWidth = (fadeInDuration / regionDuration) * regionWidth;
          
          // Fade in gradient overlay
          const fadeInGradient = ctx.createLinearGradient(startX, 0, startX + fadeInWidth, 0);
          fadeInGradient.addColorStop(0, 'rgba(34, 197, 94, 0.3)');
          fadeInGradient.addColorStop(1, 'rgba(34, 197, 94, 0.1)');
          
          ctx.fillStyle = fadeInGradient;
          ctx.fillRect(startX, 0, fadeInWidth, height);
          
          // Fade in border
          ctx.strokeStyle = 'rgba(34, 197, 94, 0.6)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(startX + fadeInWidth, 0);
          ctx.lineTo(startX + fadeInWidth, height);
          ctx.stroke();
          
          console.log('[drawVolumeOverlay] Drew fadeIn zone:', {
            width: fadeInWidth,
            duration: fadeInDuration
          });
        }
        
        // Draw fade out zone (using actual fadeOutDuration)
        if (fadeOutRef.current && regionDuration > fadeOutDuration && fadeOutDuration > 0) {
          const fadeOutWidth = (fadeOutDuration / regionDuration) * regionWidth;
          const fadeOutStartX = endX - fadeOutWidth;
          
          // Fade out gradient overlay
          const fadeOutGradient = ctx.createLinearGradient(fadeOutStartX, 0, endX, 0);
          fadeOutGradient.addColorStop(0, 'rgba(239, 68, 68, 0.1)');
          fadeOutGradient.addColorStop(1, 'rgba(239, 68, 68, 0.3)');
          
          ctx.fillStyle = fadeOutGradient;
          ctx.fillRect(fadeOutStartX, 0, fadeOutWidth, height);
          
          // Fade out border
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(fadeOutStartX, 0);
          ctx.lineTo(fadeOutStartX, height);
          ctx.stroke();
          
          console.log('[drawVolumeOverlay] Drew fadeOut zone:', {
            width: fadeOutWidth,
            duration: fadeOutDuration
          });
        }
        
        ctx.restore();
      }

      // Draw waveform outline
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

      // Get current position for indicator
      let currentTime;
      if (isClickUpdatingEndRef.current && lastClickEndTimeRef.current) {
        currentTime = calculatePreviewPosition(lastClickEndTimeRef.current, wavesurferRef.current.getCurrentTime());
      } else {
        const wsPosition = wavesurferRef.current.getCurrentTime();
        const syncedPosition = syncPositionRef.current;
        
        if (isPlaying) {
          currentTime = wsPosition;
        } else {
          const wsInRegion = wsPosition >= start && wsPosition <= end;
          const syncedInRegion = syncedPosition >= start && syncedPosition <= end;
          const syncTimeDiff = performance.now() - lastSyncTimeRef.current;
          
          if (syncTimeDiff < 500 && syncedInRegion) {
            currentTime = syncedPosition;
          } else if (wsInRegion) {
            currentTime = wsPosition;
          } else {
            currentTime = start;
          }
        }
      }

      // Draw volume indicator
      if (currentTime >= start && currentTime <= end) {
        ctx.save();
        
        const currentX = Math.floor((currentTime / totalDuration) * width);
        const t = (currentTime - start) / (end - start);
        const vol = calculateVolumeForProfile(t, currentProfile);
        const h = (vol / maxVol) * height;

        // Draw the orange indicator line
        ctx.strokeStyle = "#f97316";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(currentX, height - h);
        ctx.lineTo(currentX, height);
        ctx.stroke();
        
        // Add a small circle at the top
        ctx.beginPath();
        ctx.arc(currentX, height - h, 3, 0, Math.PI * 2);
        ctx.fillStyle = "#f97316";
        ctx.fill();
        
        ctx.restore();
        lastDrawPositionRef.current = currentX;
      }
    }
    
    // ✅ THÊM: Vẽ lớp che mờ trên waveform sau khi vẽ volume overlay
    if (config.drawWaveformDimOverlay) {
      console.log('[drawVolumeOverlay Service] Calling drawWaveformDimOverlay callback');
      config.drawWaveformDimOverlay(forceRedraw);
    }
    
  } finally {
    isDrawingOverlayRef.current = false;
  }
};

/**
 * Vẽ lớp che mờ trên waveform
 */
export const drawWaveformDimOverlay = (waveformDimOverlayRef, regionRef, wavesurferRef, config = {}) => {
  console.log('[drawWaveformDimOverlay Service] Called with refs:', {
    waveformDimOverlayRef: !!waveformDimOverlayRef?.current,
    regionRef: !!regionRef?.current,
    wavesurferRef: !!wavesurferRef?.current,
    config
  });

  const {
    waveformRef,
    lastDrawTimeRef,
    isDeleteMode,
    forceRedraw = false
  } = config;

  if (!waveformDimOverlayRef?.current || !regionRef?.current || !wavesurferRef?.current) {
    console.log('[drawWaveformDimOverlay Service] Missing required refs, aborting');
    return;
  }

  const now = performance.now();
  if (!forceRedraw && lastDrawTimeRef?.current && now - lastDrawTimeRef.current < TIMING_CONSTANTS.DRAW_INTERVAL) {
    return;
  }

  try {
    const canvas = waveformDimOverlayRef.current;
    const ctx = canvas.getContext("2d");
    
    // ✅ FIX: Lấy kích thước thực tế của waveform container
    const waveformContainer = waveformRef?.current;
    if (!waveformContainer) {
      console.log('[drawWaveformDimOverlay Service] No waveform container, aborting');
      return;
    }
    
    const containerRect = waveformContainer.getBoundingClientRect();
    const actualWidth = containerRect.width;
    const actualHeight = containerRect.height;
    
    // ✅ FIX: Đồng bộ canvas size với container size
    if (canvas.width !== actualWidth || canvas.height !== actualHeight) {
      canvas.width = actualWidth;
      canvas.height = actualHeight;
      // Set CSS size to match
      canvas.style.width = actualWidth + 'px';
      canvas.style.height = actualHeight + 'px';
    }
    
    // Clear canvas
    ctx.clearRect(0, 0, actualWidth, actualHeight);

    if (regionRef.current) {
      const start = regionRef.current.start;
      const end = regionRef.current.end;
      const totalDuration = wavesurferRef.current.getDuration();
      
      // ✅ FIX: Tính toán vị trí chính xác dựa trên actual width
      const startX = Math.max(0, Math.floor((start / totalDuration) * actualWidth));
      const endX = Math.min(actualWidth, Math.ceil((end / totalDuration) * actualWidth));

      console.log("[drawWaveformDimOverlay Service] Drawing with dimensions:", {
        actualWidth,
        actualHeight,
        startX,
        endX,
        regionStart: start.toFixed(3),
        regionEnd: end.toFixed(3),
        deleteMode: isDeleteMode
      });

      // Set overlay color based on mode
      if (isDeleteMode) {
        // Delete mode: dim the regions that will be kept (outside selection)
        ctx.fillStyle = "rgba(100, 116, 139, 0.7)"; // Dark gray overlay
        
        // Draw overlay on parts that will be KEPT (outside region)
        if (startX > 0) {
          ctx.fillRect(0, 0, startX, actualHeight); // Left part
        }
        if (endX < actualWidth) {
          ctx.fillRect(endX, 0, actualWidth - endX, actualHeight); // Right part
        }
      } else {
        // Normal mode: dim the parts outside selection
        ctx.fillStyle = "rgba(100, 116, 139, 0.8)"; // Darker overlay for better contrast
        
        // Draw overlay on parts OUTSIDE region
        if (startX > 0) {
          ctx.fillRect(0, 0, startX, actualHeight); // Left part (outside region)
        }
        if (endX < actualWidth) {
          ctx.fillRect(endX, 0, actualWidth - endX, actualHeight); // Right part (outside region)
        }
      }
    }
  } catch (error) {
    console.error("[drawWaveformDimOverlay Service] Error:", error);
  }
};

/**
 * Cập nhật styles cho region
 */
export const updateRegionStyles = (regionRef, isDeleteMode) => {
  if (!regionRef.current || !regionRef.current.element) return;

  try {
    console.log("[updateRegionStyles] Updating region styles, deleteMode:", isDeleteMode);
    
    // ✅ BƯỚC 1: Thay thế hardcoded styles bằng constants
    const currentColor = isDeleteMode
      ? REGION_STYLES.DELETE_MODE.backgroundColor
      : REGION_STYLES.NORMAL_MODE.backgroundColor;
        
    const currentBorder = isDeleteMode 
      ? REGION_STYLES.DELETE_MODE.border
      : REGION_STYLES.NORMAL_MODE.border;
        
    const currentHandleStyle = {
      borderColor: isDeleteMode
        ? REGION_STYLES.DELETE_MODE.borderColor
        : REGION_STYLES.NORMAL_MODE.borderColor,
      backgroundColor: isDeleteMode
        ? REGION_STYLES.DELETE_MODE.handleBackgroundColor
        : REGION_STYLES.NORMAL_MODE.handleBackgroundColor,
      width: REGION_STYLES.HANDLE_WIDTH,
    };

    // Update through WaveSurfer API first
    if (regionRef.current.setOptions) {
      regionRef.current.setOptions({
        color: currentColor,
        handleStyle: currentHandleStyle,
      });
    } else if (regionRef.current.update) {
      regionRef.current.update({
        color: currentColor,
        handleStyle: currentHandleStyle,
      });
    }

    // Then force update element style directly
    if (regionRef.current.element) {
      const element = regionRef.current.element;
      
      if (element.style.backgroundColor !== currentColor) {
        element.style.backgroundColor = currentColor;
        element.style.border = currentBorder;

        const regionElements = element.getElementsByClassName("wavesurfer-region");
        for (let i = 0; i < regionElements.length; i++) {
          const el = regionElements[i];
          el.style.backgroundColor = currentColor;
          el.style.border = currentBorder;
        }
      }
    }
    
    console.log("[updateRegionStyles] Region styles updated successfully, background:", currentColor);
  } catch (error) {
    console.error("[updateRegionStyles] Error:", error);
  }
}; 