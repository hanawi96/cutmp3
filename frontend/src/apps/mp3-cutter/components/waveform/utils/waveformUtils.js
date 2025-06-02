// ===================================================================
// WAVEFORM UTILITIES - Pure functions extracted from WaveformSelector.jsx
// ===================================================================

// Throttle helper - giới hạn tần suất thực thi
export const throttle = (func, limit) => {
  let inThrottle;
  return function () {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

// DEBOUNCE HELPER 
export const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), delay);
  };
};

// ===================================================================
// THEME COLORS CONFIGURATION
// ===================================================================
export const THEME_COLORS = {
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

// ===================================================================
// CONSTANTS
// ===================================================================
export const DRAW_INTERVAL = 1000 / 60; // 60 FPS
export const PREVIEW_TIME_BEFORE_END = 3; // 3 seconds preview before end

// ===================================================================
// TIME FORMATTING FUNCTIONS
// ===================================================================

// Format time as mm:ss
export const formatTime = (seconds) => {
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min}:${sec.toString().padStart(2, "0")}`;
};

// Format display time as mm:ss.d
export const formatDisplayTime = (seconds) => {
  console.log(`[formatDisplayTime] Input: ${seconds}`);
  
  if (typeof seconds !== 'number' || !isFinite(seconds) || isNaN(seconds) || seconds < 0) {
    console.warn(`[formatDisplayTime] Invalid input: ${seconds}, returning default`);
    return "00:00.0";
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  const wholeSeconds = Math.floor(remainingSeconds);
  const tenths = Math.floor((remainingSeconds - wholeSeconds) * 10);
  
  const result = `${minutes.toString().padStart(2, '0')}:${wholeSeconds.toString().padStart(2, '0')}.${tenths}`;
  console.log(`[formatDisplayTime] Output: ${result}`);
  
  return result;
};

// Format duration time as mm:ss
export const formatDurationTime = (seconds) => {
  if (!isFinite(seconds) || seconds < 0) return "00:00";
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};

// ===================================================================
// POSITION CALCULATION HELPERS
// ===================================================================

// Calculate preview position (3 seconds before end)
export const calculatePreviewPosition = (endTime, currentTime) => {
  const previewTime = Math.max(0, endTime - PREVIEW_TIME_BEFORE_END);
  console.log(
    `[calculatePreviewPosition] End: ${endTime.toFixed(
      2
    )}s, Current: ${currentTime.toFixed(
      2
    )}s, Preview: ${previewTime.toFixed(
      2
    )}s (${PREVIEW_TIME_BEFORE_END}s before end)`
  );
  return previewTime;
};

// ===================================================================
// VALIDATION HELPERS
// ===================================================================

// Validate region bounds
export const validateRegionBounds = (start, end, duration) => {
  if (typeof start !== 'number' || typeof end !== 'number' || typeof duration !== 'number') {
    return false;
  }
  
  if (isNaN(start) || isNaN(end) || isNaN(duration)) {
    return false;
  }
  
  if (start < 0 || end <= start || end > duration) {
    return false;
  }
  
  return true;
};

// Validate position within region
export const validatePosition = (position, regionStart, regionEnd) => {
  if (typeof position !== 'number' || typeof regionStart !== 'number' || typeof regionEnd !== 'number') {
    return false;
  }
  
  if (isNaN(position) || isNaN(regionStart) || isNaN(regionEnd)) {
    return false;
  }
  
  return position >= regionStart && position <= regionEnd;
};

// Clamp position to region bounds
export const clampToRegion = (position, regionStart, regionEnd) => {
  if (!isFinite(position) || !isFinite(regionStart) || !isFinite(regionEnd)) {
    return regionStart;
  }
  
  return Math.max(regionStart, Math.min(regionEnd, position));
}; 