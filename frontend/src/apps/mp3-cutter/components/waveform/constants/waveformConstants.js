// constants/waveformConstants.js

// Theme colors cho waveform (từ dòng 144-162 trong file gốc)
export const WAVEFORM_COLORS = {
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

// Timing constants (từ các dòng khác nhau trong file gốc)
export const TIMING_CONSTANTS = {
  DRAW_INTERVAL: 1000 / 60, // 60 FPS (dòng 176)
  PREVIEW_TIME_BEFORE_END: 3, // seconds (dòng 184)
  END_TOLERANCE: 0.02, // 20ms tolerance (dòng 1975)
  END_TOLERANCE_NATURAL: 0.05, // 50ms tolerance for natural playback end (dòng 1867)
  FADE_DURATION: 2.0, // seconds (dòng 1536)
  FIXED_FADE_DURATION: 2.0, // seconds (dòng 1306)
  SYNC_TIME_LIMIT: 16, // ~60fps sync limit
  POSITION_DIFF_THRESHOLD: 0.01,
  VOLUME_UPDATE_THRESHOLD: 0.001,
};

// Canvas constants
export const CANVAS_CONSTANTS = {
  DEFAULT_WIDTH: 1000,
  DEFAULT_HEIGHT_WAVEFORM: 120,
  DEFAULT_HEIGHT_OVERLAY: 50,
};

// Region style constants (từ updateRegionStyles function)
export const REGION_STYLES = {
  DELETE_MODE: {
    backgroundColor: "transparent",
    borderColor: "transparent",
    border: "none",
    handleBackgroundColor: "transparent",
  },
  NORMAL_MODE: {
    backgroundColor: "transparent",
    borderColor: "transparent", 
    border: "none",
    handleBackgroundColor: "transparent",
  },
  HANDLE_WIDTH: "4px", // Từ dòng 308
};

// Waveform configuration constants
export const WAVEFORM_CONFIG = {
  HEIGHT: 120,
  BAR_WIDTH: 2,
  BAR_GAP: 1,
  BAR_RADIUS: 3,
  BAR_HEIGHT: 1,
  RESPONSIVE: true,
  BACKEND: "WebAudio",
  NORMALIZE: false, // có thể override bởi props
};

// Volume profile constants
export const VOLUME_PROFILES = {
  UNIFORM: "uniform",
  CUSTOM: "custom",
  FADE_IN: "fadeIn",
  FADE_OUT: "fadeOut",
  BELL: "bell",
  VALLEY: "valley",
  EXPONENTIAL_IN: "exponential_in",
  EXPONENTIAL_OUT: "exponential_out",
};

// Fade effect constants
export const FADE_CONFIG = {
  MIN_AUDIBLE_VOLUME: 0.02, // Từ calculateVolumeForProfile
  DEFAULT_FADE_IN_DURATION: 3,
  DEFAULT_FADE_OUT_DURATION: 3,
};

// Performance và throttling constants
export const PERFORMANCE_CONFIG = {
  THROTTLE_DELAY: 16,
  DEBOUNCE_DELAY: 50,
  MOUSE_INTERACTION_THROTTLE: 16,
  OVERLAY_ANIMATION_FRAME_DELAY: 100,
  REGION_UPDATE_TIMEOUT: 150,
  CLICK_UPDATE_TIMEOUT: 150,
};

// Overlay styling constants cho fade zones
export const OVERLAY_STYLES = {
  DIM_NORMAL: "rgba(100, 116, 139, 0.8)",
  DIM_DELETE: "rgba(100, 116, 139, 0.7)",
  FADE_IN_GRADIENT: {
    start: 'rgba(34, 197, 94, 0.3)',
    end: 'rgba(34, 197, 94, 0.1)',
    border: 'rgba(34, 197, 94, 0.6)',
  },
  FADE_OUT_GRADIENT: {
    start: 'rgba(100, 116, 139, 0.1)',
    end: 'rgba(100, 116, 139, 0.3)',
    border: 'rgba(100, 116, 139, 0.6)',
  },
};

// Default values
export const DEFAULT_VALUES = {
  VOLUME: 1.0,
  CUSTOM_VOLUME: {
    start: 1.0,
    middle: 1.0,
    end: 1.0,
  },
}; 