import React from 'react';
import { Clock } from 'lucide-react';
import TimeStepper from '../TimeStepper';
import { 
  formatTime, 
  formatDisplayTime, 
  formatDurationTime 
} from '../utils/timeFormatters';

/**
 * Component render UI cho WaveformSelector
 * Tách từ WaveformSelector.jsx JSX return
 */
const WaveformUI = ({
  // States
  loading,
  isDeleteMode,
  audioFile,
  currentTime,
  duration,
  currentVolumeDisplay,
  isPlaying,
  regionStartTime,
  regionEndTime,
  displayRegionStart,
  displayRegionEnd,
  currentPosition,
  
  // Refs
  waveformRef,
  waveformDimOverlayRef,
  overlayRef,
  dimOverlayRef,
  wavesurferRef,
  
  // Setters
  setDisplayRegionStart,
  setDisplayRegionEnd,
  setRegionStartTime,
  setRegionEndTime,
  
  // Functions
  syncPositions,
  updateVolume,
  drawVolumeOverlay,
  saveRegionToHistory,
  
  // Imperative ref
  imperativeRef,
}) => {


  return (
    <div className="relative space-y-3 max-w-7xl mx-auto">
      {loading && (
        <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center z-50 rounded-lg">
          <div className="flex items-center space-x-2 bg-white shadow-md rounded-full px-4 py-2">
            <svg
              className="animate-spin h-4 w-4 text-blue-600"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span className="text-slate-700 font-medium text-sm">
              Loading audio...
            </span>
          </div>
        </div>
      )}

      {/* Delete Mode Indicator - Compact */}
      {isDeleteMode && (
        <div className="bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-lg p-2">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <p className="text-red-700 font-medium text-xs">
              Delete Mode: Red regions will be deleted, blue regions kept
            </p>
          </div>
        </div>
      )}

      {/* INTEGRATED WAVEFORM + CONTROLS */}
      <div className="bg-gradient-to-br from-slate-50 to-blue-50/30 rounded-xl border border-slate-200/60 shadow-lg relative">
        {/* Header with integrated controls */}
        <div className="bg-white/60 backdrop-blur-sm border-b border-slate-200/40 px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Current Time */}
            <div className="flex items-center gap-2 min-w-[100px]">
              <Clock className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <div className="font-mono text-slate-700 font-semibold text-sm">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>

            {/* Center: Time Steppers - Compact */}
            <div className="flex items-center gap-3 bg-white/80 rounded-lg px-3 py-2 shadow-sm">
              <TimeStepper
                value={isPlaying ? currentTime : regionStartTime || 0}
                onChange={(val) => {
    
                  const currentEnd = regionEndTime || duration || 0;


                  if (val >= 0 && val < currentEnd && val <= duration) {


                    // Save current region to history before making changes
                    if (saveRegionToHistory && regionStartTime !== undefined && regionEndTime !== undefined) {
                      const hasSignificantChange = Math.abs(val - regionStartTime) > 0.001;
                      if (hasSignificantChange) {
                        console.log("[TIMESTEPPER_START] Saving history before change:", {
                          currentStart: regionStartTime,
                          currentEnd: regionEndTime,
                          newStart: val
                        });
                        saveRegionToHistory(regionStartTime, regionEndTime, "timestepper_start");
                      }
                    }

                    if (imperativeRef?.current?.setRegionStart) {
                      imperativeRef.current.setRegionStart(val);
                    }
                    setDisplayRegionStart(formatDisplayTime(val));
                    setRegionStartTime(val);

                    if (wavesurferRef.current && waveformRef.current) {
                      const totalDuration = wavesurferRef.current.getDuration();
                      wavesurferRef.current.seekTo(val / totalDuration);
                      syncPositions(val, "waveformUI_timeStepperStartEdit");
                      updateVolume(val, true, true);
                      drawVolumeOverlay(true);
                    }
                  } else {
                    console.warn("[WaveformUI][TimeStepper-Start] Invalid start time:", {
                      val,
                      currentEnd,
                      duration,
                    });
                    alert(
                      `❌ Invalid start time. Must be between 0 and ${formatTime(
                        currentEnd - 0.01
                      )}`
                    );
                  }
                }}
                label={isPlaying ? "Now" : "Start"}
                maxValue={Math.max(
                  0,
                  (regionEndTime || duration || 30) - 0.01
                )}
                minValue={0}
                compact={true}
                disabled={loading || !audioFile}
                isRealTime={isPlaying}
                showEditButton={!isPlaying}
              />

              <div className="w-px h-6 bg-slate-300"></div>

              <TimeStepper
                value={regionEndTime || duration || 30}
                onChange={(val) => {

                  const currentStart = isPlaying
                    ? currentTime
                    : regionStartTime || 0;


                  if (val > currentStart && val <= duration) {


                    // Save current region to history before making changes
                    if (saveRegionToHistory && regionStartTime !== undefined && regionEndTime !== undefined) {
                      const hasSignificantChange = Math.abs(val - regionEndTime) > 0.001;
                      if (hasSignificantChange) {
                        console.log("[TIMESTEPPER_END] Saving history before change:", {
                          currentStart: regionStartTime,
                          currentEnd: regionEndTime,
                          newEnd: val
                        });
                        saveRegionToHistory(regionStartTime, regionEndTime, "timestepper_end");
                      }
                    }

                    if (imperativeRef?.current?.setRegionEnd) {
                      imperativeRef.current.setRegionEnd(val);
                    }
                    setDisplayRegionEnd(formatDisplayTime(val));
                    setRegionEndTime(val);

                    const previewPosition = Math.max(currentStart, val - 3);


                    if (wavesurferRef.current && waveformRef.current) {
                      const totalDuration = wavesurferRef.current.getDuration();
                      wavesurferRef.current.seekTo(
                        previewPosition / totalDuration
                      );
                      syncPositions(previewPosition, "waveformUI_timeStepperEndEdit");
                      updateVolume(previewPosition, true, true);
                      drawVolumeOverlay(true);
                    }
                  } else {
                    console.warn("[WaveformUI][TimeStepper-End] Invalid end time:", {
                      val,
                      currentStart,
                      duration,
                    });
                    alert(
                      `❌ Invalid end time. Must be between ${formatTime(
                        currentStart + 0.01
                      )} and ${formatTime(duration)}`
                    );
                  }
                }}
                label="End"
                minValue={Math.max(
                  0.01,
                  (isPlaying ? currentTime : regionStartTime || 0) + 0.01
                )}
                maxValue={duration || 30}
                compact={true}
                disabled={loading || !audioFile}
                isRealTime={false}
                showEditButton={true}
              />
            </div>

            {/* Right: Volume */}
            <div className="flex items-center gap-2 min-w-[80px] justify-end">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 text-emerald-600 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.536a5 5 0 010-7.072m12.728 0l-4.242 4.242m-6.364 6.364l-4.242-4.242"
                />
              </svg>
              <div className="font-mono text-slate-700 font-semibold text-sm">
                {currentVolumeDisplay.toFixed(2)}x
              </div>
            </div>
          </div>
        </div>

        {/* TOOLTIPS POSITIONED RELATIVE TO WAVEFORM CONTAINER */}
        {audioFile && (
          <div
            className="absolute w-full pointer-events-none"
            style={{ top: "80px", left: "0px", zIndex: 999999 }}
          >
            {/* Region Start Time Tooltip - Green Background */}
            {regionStartTime !== undefined && (
              <div
                className="absolute bg-green-600 text-white text-xs font-mono px-1 py-0.5 rounded-md shadow-lg border border-green-500"
                style={{
                  left: `calc(12px + ${
                    (regionStartTime /
                      (wavesurferRef.current?.getDuration() || 1)) *
                    (100 - 2.4)
                  }%)`,
                  top: "0px",
                  transform: "translateX(-50%)",
                  zIndex: 999999,
                  fontSize: "10px",
                  pointerEvents: "none",
                }}
              >
                {displayRegionStart}
                <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-green-600 rotate-45 border-l border-b border-green-500"></div>
              </div>
            )}

            {/* Region End Time Tooltip - Green Background */}
            {regionEndTime !== undefined && (
              <div
                className="absolute bg-green-600 text-white text-xs font-mono px-1 py-0.5 rounded-md shadow-lg border border-green-500"
                style={{
                  left: `calc(12px + ${
                    (regionEndTime /
                      (wavesurferRef.current?.getDuration() || 1)) *
                    (100 - 2.4)
                  }%)`,
                  top: "0px",
                  transform: "translateX(-50%)",
                  zIndex: 999999,
                  fontSize: "10px",
                  pointerEvents: "none",
                }}
              >
                {displayRegionEnd}
                <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-green-600 rotate-45 border-l border-b border-green-500"></div>
              </div>
            )}

            {/* Region Duration Display - Text Only */}
            {regionStartTime !== undefined && regionEndTime !== undefined && (
              <div
                className="absolute text-emerald-600 font-mono font-bold drop-shadow-lg"
                style={{
                  left: `calc(12px + ${
                    ((regionStartTime + regionEndTime) /
                      2 /
                      (wavesurferRef.current?.getDuration() || 1)) *
                    (100 - 2.4)
                  }%)`,
                  bottom: "-120px",
                  transform: "translateX(-50%)",
                  zIndex: 999999,
                  fontSize: "12px",
                  textShadow: "1px 1px 2px rgba(0,0,0,0.5)",
                  pointerEvents: "none",
                }}
              >
                {formatDurationTime(regionEndTime - regionStartTime)}
              </div>
            )}

            {/* Current Playback Time Tooltip - Text Only */}
            {isPlaying && currentPosition !== undefined && (
              <div
                className="absolute text-orange-600 font-mono font-bold drop-shadow-lg animate-pulse"
                style={{
                  left: `calc(12px + ${
                    (currentPosition /
                      (wavesurferRef.current?.getDuration() || 1)) *
                    (100 - 2.4)
                  }%)`,
                  top: "25px",
                  transform: "translateX(-50%)",
                  zIndex: 999999,
                  fontSize: "12px",
                  textShadow: "1px 1px 2px rgba(0,0,0,0.5)",
                  pointerEvents: "none",
                }}
              >
                {formatDisplayTime(currentPosition)}
              </div>
            )}
          </div>
        )}

        {/* Waveform Section */}
        <div
          className="relative bg-gradient-to-b from-slate-900 to-slate-800 p-3"
          style={{ minHeight: "140px" }}
        >
          {/* Waveform element */}
          <div
            ref={waveformRef}
            className="w-full h-full rounded-lg overflow-hidden"
          />

          {/* Canvas che mờ phần ngoài region trên waveform */}
          <canvas
            ref={waveformDimOverlayRef}
            width={1000}
            height={120}
            className="absolute top-3 left-3 right-3 bottom-3 w-[calc(100%-24px)] h-[calc(100%-24px)] rounded-lg pointer-events-none"
            style={{ zIndex: 10, pointerEvents: "none" }}
          />
        </div>

        {/* Volume Overlay Section - Integrated */}
        <div className="bg-gradient-to-r from-slate-50/80 to-blue-50/40 border-t border-slate-200/40 p-3">
          <div className="relative">
            <canvas
              ref={overlayRef}
              width={1000}
              height={50}
              className={`w-full border border-slate-200/60 rounded-lg bg-gradient-to-r from-white to-blue-50/30 shadow-inner ${
                isDeleteMode ? "waveform-delete-canvas" : ""
              }`}
              style={{ zIndex: 1, pointerEvents: "none" }}
            />
            {/* Canvas che mờ phần ngoài region */}
            <canvas
              ref={dimOverlayRef}
              width={1000}
              height={50}
              className="absolute top-0 left-0 w-full h-full rounded-lg pointer-events-none"
              style={{ zIndex: 2, pointerEvents: "none" }}
            />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {/* Add any additional content you want to render here */}
      </div>
    </div>
  );
};

export default WaveformUI;