import { useEffect } from 'react';

export const useKeyboardShortcuts = (state, handleUndo, handleRedo, setRegionStart, setRegionEnd) => {
  // Xử lý phím tắt
  useEffect(() => {
    if (!state.file) return;

    const handleKeyDown = (e) => {
      // Không kích hoạt phím tắt khi focus vào các element input
      if (
        e.target.tagName === "INPUT" ||
        e.target.tagName === "TEXTAREA" ||
        e.target.tagName === "SELECT"
      ) {
        return;
      }

      // Ngăn chặn sự kiện scroll khi sử dụng phím mũi tên
      if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
      }

      if (!state.waveformRef.current) return;

      // Lấy instance WaveSurfer
      const wavesurferInstance =
        state.waveformRef.current.getWavesurferInstance?.();
      if (!wavesurferInstance) return;

      switch (e.key) {
        case " ": // Space - Play/Pause
          if (state.waveformRef.current.togglePlayPause) {
            state.waveformRef.current.togglePlayPause();
          }
          break;

        case "ArrowLeft": // Left Arrow - Di chuyển con trỏ lùi 1 giây
          if (e.shiftKey) {
            // Shift + Left Arrow - Lùi 5 giây
            const currentTime = wavesurferInstance.getCurrentTime();
            const newTime = Math.max(0, currentTime - 5);
            wavesurferInstance.seekTo(
              newTime / wavesurferInstance.getDuration()
            );
          } else if (e.ctrlKey || e.metaKey) {
            // Ctrl/Cmd + Left Arrow - Đặt điểm bắt đầu tại vị trí con trỏ
            setRegionStart();
          } else {
            // Chỉ Left Arrow - Lùi 1 giây
            const currentTime = wavesurferInstance.getCurrentTime();
            const newTime = Math.max(0, currentTime - 1);
            wavesurferInstance.seekTo(
              newTime / wavesurferInstance.getDuration()
            );
          }
          break;

        case "ArrowRight": // Right Arrow - Di chuyển con trỏ tiến 1 giây
          if (e.shiftKey) {
            // Shift + Right Arrow - Tiến 5 giây
            const currentTime = wavesurferInstance.getCurrentTime();
            const newTime = Math.min(
              wavesurferInstance.getDuration(),
              currentTime + 5
            );
            wavesurferInstance.seekTo(
              newTime / wavesurferInstance.getDuration()
            );
          } else if (e.ctrlKey || e.metaKey) {
            // Ctrl/Cmd + Right Arrow - Đặt điểm kết thúc tại vị trí con trỏ
            setRegionEnd();
          } else {
            // Chỉ Right Arrow - Tiến 1 giây
            const currentTime = wavesurferInstance.getCurrentTime();
            const newTime = Math.min(
              wavesurferInstance.getDuration(),
              currentTime + 1
            );
            wavesurferInstance.seekTo(
              newTime / wavesurferInstance.getDuration()
            );
          }
          break;

        case "z": // Ctrl+Z - Undo
        case "Z":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();

            handleUndo();
          }
          break;

        case "y": // Ctrl+Y - Redo
        case "Y":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();

            handleRedo();
          }
          break;

        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [state.file, handleUndo, handleRedo, setRegionStart, setRegionEnd, state.waveformRef]); // ← Dependencies
}; 