// utils/audioUtils.js
import { TIMING_CONSTANTS } from '../constants/waveformConstants.js';

// Helper function to calculate preview position (3 seconds before end)
export const calculatePreviewPosition = (endTime, currentTime) => {
  const previewTime = Math.max(0, endTime - TIMING_CONSTANTS.PREVIEW_TIME_BEFORE_END);
  console.log(
    `[calculatePreviewPosition] End: ${endTime.toFixed(
      2
    )}s, Current: ${currentTime.toFixed(
      2
    )}s, Preview: ${previewTime.toFixed(
      2
    )}s (${TIMING_CONSTANTS.PREVIEW_TIME_BEFORE_END}s before end)`
  );
  return previewTime;
}; 