// utils/timeFormatters.js

// Format time for playback display (MM:SS)
export const formatTime = (seconds) => {
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min}:${sec.toString().padStart(2, "0")}`;
};

// Format time for precise display with tenths (MM:SS.T)  
export const formatDisplayTime = (seconds) => {

  
  if (typeof seconds !== 'number' || !isFinite(seconds) || isNaN(seconds) || seconds < 0) {
    console.warn(`[formatDisplayTime] Invalid input: ${seconds}, returning default`);
    return "00:00.0";
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  const wholeSeconds = Math.floor(remainingSeconds);
  const tenths = Math.floor((remainingSeconds - wholeSeconds) * 10);
  
  const result = `${minutes.toString().padStart(2, '0')}:${wholeSeconds.toString().padStart(2, '0')}.${tenths}`;

  
  return result;
};

// Format duration for simple display (MM:SS)
export const formatDurationTime = (seconds) => {
  if (!isFinite(seconds) || seconds < 0) return "00:00";
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}; 