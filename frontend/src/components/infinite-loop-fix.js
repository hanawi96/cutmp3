/**
 * infinite-loop-fix.js - Thêm functionality để xử lý playback liên tục
 * Tệp này chứa các cải tiến cụ thể cho Wavesurfer để đảm bảo vòng lặp liên tục
 */

/**
 * Áp dụng các bản vá cho WaveSurfer để cải thiện khả năng loop chơi
 * @param {Object} wavesurfer - Instance WaveSurfer
 */
export function applyInfiniteLoopFixes(wavesurfer) {
  if (!wavesurfer) return;
  
  console.log("Đang áp dụng các bản vá WaveSurfer để hỗ trợ loop vô hạn");
  
  // Duy trì phiên bản gốc của play
  const originalPlay = wavesurfer.play.bind(wavesurfer);
  
  // Hook vào phương thức play
  wavesurfer.play = function(start, end) {
    console.log(`WaveSurfer play hooked: ${start}s to ${end}s`);
    
    // Gắn trực tiếp với phiên bản gốc
    const result = originalPlay(start, end);
    
    // Lưu ranh giới phát
    wavesurfer._loopStart = start;
    wavesurfer._loopEnd = end;
    
    return result;
  };
  
  // Đảm bảo chúng ta có một API cho vòng lặp
  wavesurfer.setLoopingEnabled = function(enabled) {
    wavesurfer._loopingEnabled = enabled;
    console.log(`WaveSurfer loop ${enabled ? 'enabled' : 'disabled'}`);
    return this;
  };
  
  wavesurfer.isLoopingEnabled = function() {
    return !!wavesurfer._loopingEnabled;
  };
  
  // Thêm API để cập nhật ranh giới vòng lặp mà không cần chơi lại
  wavesurfer.updateLoopBoundaries = function(start, end) {
    if (typeof start !== 'undefined') {
      wavesurfer._loopStart = start;
    }
    if (typeof end !== 'undefined') {
      wavesurfer._loopEnd = end;
    }
    console.log(`WaveSurfer loop boundaries updated: ${wavesurfer._loopStart?.toFixed(2)}s - ${wavesurfer._loopEnd?.toFixed(2)}s`);
    return this;
  };
  
  // Đặt cờ để đánh dấu rằng chúng ta đã áp dụng các bản vá
  wavesurfer._infiniteLoopFixesApplied = true;
  
  return wavesurfer;
}

/**
 * Xử lý vòng lặp khi vị trí hiện tại đạt đến ngoài giới hạn kết thúc
 * @param {Object} wavesurfer - Instance WaveSurfer
 * @param {Function} callback - Hàm gọi lại để thông báo cho ứng dụng
 */
export function handleLoopReset(wavesurfer, callback) {
  if (!wavesurfer || !wavesurfer._infiniteLoopFixesApplied) return false;
  
  const currentTime = wavesurfer.getCurrentTime();
  
  // Nếu vòng lặp không được kích hoạt, không cần xử lý
  if (!wavesurfer._loopingEnabled) return false;
  
  // Nếu chúng ta vượt quá giới hạn kết thúc và vòng lặp được kích hoạt
  if (currentTime >= wavesurfer._loopEnd) {
    console.log(`Loop reset: ${currentTime.toFixed(2)}s > ${wavesurfer._loopEnd.toFixed(2)}s`);
    
    // Đặt lại về điểm bắt đầu
    wavesurfer.play(wavesurfer._loopStart);
    
    // Thông báo qua callback
    if (typeof callback === 'function') {
      callback(wavesurfer._loopStart);
    }
    
    return true;
  }
  
  return false;
}
