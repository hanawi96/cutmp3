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
  
  console.log(`[LOOP TRACKER] Loop #${window.loopCounter}, khoảng thời gian: ${elapsed}ms`);
  
  return window.loopCounter;
}

/**
 * Reset bộ đếm vòng lặp
 */
export function resetLoopCounter() {
  const oldValue = window.loopCounter;
  window.loopCounter = 0;
  window.lastLoopTime = Date.now();
  console.log(`[LOOP TRACKER] Reset từ ${oldValue} về 0`);
  return oldValue;
}

/**
 * Đăng ký theo dõi sự kiện loop của WaveSurfer
 * @param {Object} wavesurfer - Instance của WaveSurfer
 */
export function monitorWavesurferLoop(wavesurfer) {
  if (!wavesurfer) return;
  
  resetLoopCounter();
  
  // Gắn listener cho các sự kiện quan trọng
  ['play', 'pause', 'finish', 'seeking', 'audioprocess'].forEach(eventName => {
    wavesurfer.on(eventName, () => {
      console.log(`[LOOP TRACKER] WaveSurfer event: ${eventName} at time ${wavesurfer.getCurrentTime().toFixed(2)}s`);
      
      if (eventName === 'finish') {
        console.log(`[LOOP TRACKER] Finish event detected - kiểm tra xem vòng lặp có tiếp tục không`);
      }
    });
  });
  
  console.log('[LOOP TRACKER] Theo dõi vòng lặp đã được thiết lập');
}
