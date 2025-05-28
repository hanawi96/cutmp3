/**
 * Trình theo dõi vòng lặp - giúp gỡ lỗi các vấn đề lặp lại
 */

// Biến global để theo dõi số lần lặp
window.loopCounter = 0;
window.lastLoopTime = 0;

/**
 * Theo dõi một lần lặp mới
 */
export function trackLoop() {
  window.loopCounter++;
  const now = Date.now();
  const elapsed = now - window.lastLoopTime;
  window.lastLoopTime = now;
  
  // Silent tracking - no logging during normal operation
  
  return window.loopCounter;
}

/**
 * Reset bộ đếm vòng lặp
 */
export function resetLoopCounter() {
  const oldValue = window.loopCounter;
  window.loopCounter = 0;
  window.lastLoopTime = Date.now();
  // Silent reset - no logging needed
  return oldValue;
}

/**
 * Đăng ký theo dõi sự kiện loop của WaveSurfer
 * @param {Object} wavesurfer - Instance của WaveSurfer
 */
export function monitorWavesurferLoop(wavesurfer) {
  if (!wavesurfer) return;
  
  resetLoopCounter();
  
  // Remove all existing event listeners to avoid duplicates
  wavesurfer.un('audioprocess');
  wavesurfer.un('pause');
  wavesurfer.un('play');
  wavesurfer.un('finish');
  wavesurfer.un('seeking');
  wavesurfer.un('seek');

  // Add optimized event listeners with minimal logging
  wavesurfer.on('audioprocess', () => {
    // Silent monitoring - only track internally
    trackLoop();
  });

  wavesurfer.on('pause', () => {
    // Silent pause tracking
  });

  wavesurfer.on('play', () => {
    // Silent play tracking
  });

  wavesurfer.on('finish', () => {
    // Only log finish events as they are important for debugging loops
    console.log(`[LOOP TRACKER] Finish event detected - checking loop continuation`);
  });

  wavesurfer.on('seeking', () => {
    // Silent seeking tracking
  });

  wavesurfer.on('seek', () => {
    // Silent seek tracking
  });
  
  // Silent setup - monitoring established without logging
}