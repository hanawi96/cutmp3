// utils/audioUtils.js
import { TIMING_CONSTANTS } from '../constants/waveformConstants.js';

// Helper function to calculate preview position (3 seconds before end)
export const calculatePreviewPosition = (endTime, currentTime) => {
  const previewTime = Math.max(0, endTime - TIMING_CONSTANTS.PREVIEW_TIME_BEFORE_END);

  return previewTime;
}; 