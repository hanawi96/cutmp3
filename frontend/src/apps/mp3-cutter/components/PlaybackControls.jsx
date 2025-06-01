import React from 'react';
import { CornerDownLeft, CornerDownRight } from 'lucide-react';

export default function PlaybackControls({
  // Audio playback states
  waveformRef,
  isPlaying,
  loopPlayback,
  setLoopPlayback,
  
  // Undo/Redo states
  canUndo,
  canRedo,
  undoHistory,
  redoHistory,
  
  // Callback functions
  handleUndo,
  handleRedo,
  setRegionStart,
  setRegionEnd,
}) {

  return (
    <div className="flex justify-center items-center space-x-3">
      {/* Play/Pause Button */}
      <button
        type="button"
        onClick={() => {
          if (
            waveformRef.current &&
            waveformRef.current.togglePlayPause
          ) {
            waveformRef.current.togglePlayPause();
          }
        }}
        className={`flex-shrink-0 flex items-center justify-center py-2 px-6 group
            ${
              isPlaying
                ? "bg-green-700 ring-2 ring-green-300 shadow-md"
                : "bg-green-600 hover:bg-green-700"
            } text-white rounded-lg transition-colors focus:outline-none relative overflow-hidden`}
        title={isPlaying ? "Dừng phát" : "Phát vùng đã chọn"}
      >
        {isPlaying ? (
          <>
            <span className="font-medium flex items-center">
              Đang phát
              {/* Thanh sóng âm hoạt họa */}
              <span className="ml-3 flex space-x-0.5 items-center">
                <span className="animate-sound-wave inline-block w-0.5 h-2 bg-green-200 rounded-full will-change-transform"></span>
                <span
                  className="animate-sound-wave inline-block w-0.5 h-3 bg-green-200 rounded-full will-change-transform"
                  style={{ animationDelay: "0.1s" }}
                ></span>
                <span
                  className="animate-sound-wave inline-block w-0.5 h-2.5 bg-green-200 rounded-full will-change-transform"
                  style={{ animationDelay: "0.2s" }}
                ></span>
                <span
                  className="animate-sound-wave inline-block w-0.5 h-3.5 bg-green-200 rounded-full will-change-transform"
                  style={{ animationDelay: "0.3s" }}
                ></span>
                <span
                  className="animate-sound-wave inline-block w-0.5 h-2 bg-green-200 rounded-full will-change-transform"
                  style={{ animationDelay: "0.4s" }}
                ></span>
                <span
                  className="animate-sound-wave inline-block w-0.5 h-3 bg-green-200 rounded-full will-change-transform"
                  style={{ animationDelay: "0.5s" }}
                ></span>
                <span
                  className="animate-sound-wave inline-block w-0.5 h-2.5 bg-green-200 rounded-full will-change-transform"
                  style={{ animationDelay: "0.6s" }}
                ></span>
              </span>
            </span>
          </>
        ) : (
          <>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2 group-hover:animate-pulse"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="font-medium">Phát</span>
          </>
        )}
      </button>

      {/* Loop Button */}
      <button
        type="button"
        onClick={() => setLoopPlayback(!loopPlayback)}
        className={`flex items-center py-2 px-3 group relative overflow-hidden ${
          loopPlayback
            ? "bg-purple-600 hover:bg-purple-700 ring-2 ring-purple-300 shadow-lg shadow-purple-500/50"
            : "bg-gray-600 hover:bg-gray-700"
        } text-white rounded-lg transition-all`}
        title={
          loopPlayback
            ? "Nhấn để dừng phát lặp lại"
            : "Phát lặp lại vùng đã chọn"
        }
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-5 w-5 mr-1 ${
            loopPlayback && isPlaying
              ? "animate-spin text-purple-200 animate-float"
              : loopPlayback
              ? "text-purple-200"
              : "group-hover:animate-pulse"
          }`}
          style={{
            animationDuration:
              loopPlayback && isPlaying ? "2s" : "0s",
            animationTimingFunction: "linear",
          }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        <span className="font-mono text-sm">
          {loopPlayback ? "Dừng lặp" : "Lặp"}
        </span>
        {loopPlayback && (
          <span className="ml-1 text-xs bg-purple-300 text-purple-900 px-1 rounded-full">
            ON
          </span>
        )}
      </button>

      {/* Undo Button */}
      <button
        type="button"
        onClick={handleUndo}
        disabled={!canUndo}
        className={`flex items-center py-2 px-3 rounded-lg transition-all group relative ${
          canUndo
            ? "bg-orange-600 hover:bg-orange-700 text-white"
            : "bg-gray-300 text-gray-500 cursor-not-allowed"
        }`}
        title={
          canUndo
            ? "Hoàn tác vùng cắt (Ctrl+Z)"
            : "Không có thao tác để hoàn tác"
        }
      >
        <svg
          className={`w-4 h-4 mr-1 transition-transform ${
            canUndo ? "group-hover:scale-110" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
          />
        </svg>
        <span className="font-mono text-sm">Undo</span>
        {canUndo && undoHistory.length > 0 && (
          <span className="ml-1 text-xs bg-orange-300 text-orange-900 px-1 rounded-full">
            {undoHistory.length}
          </span>
        )}
      </button>

      {/* Redo Button */}
      <button
        type="button"
        onClick={handleRedo}
        disabled={!canRedo}
        className={`flex items-center py-2 px-3 rounded-lg transition-all group relative ${
          canRedo
            ? "bg-teal-600 hover:bg-teal-700 text-white"
            : "bg-gray-300 text-gray-500 cursor-not-allowed"
        }`}
        title={
          canRedo
            ? "Làm lại vùng cắt (Ctrl+Y)"
            : "Không có thao tác để làm lại"
        }
      >
        <svg
          className={`w-4 h-4 mr-1 transition-transform ${
            canRedo ? "group-hover:scale-110" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6"
          />
        </svg>
        <span className="font-mono text-sm">Redo</span>
        {canRedo && redoHistory.length > 0 && (
          <span className="ml-1 text-xs bg-teal-300 text-teal-900 px-1 rounded-full">
            {redoHistory.length}
          </span>
        )}
      </button>

      {/* Set Start Button */}
      <button
        type="button"
        onClick={setRegionStart}
        className="flex items-center py-2 px-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors group relative"
      >
        <CornerDownLeft className="w-4 h-4 mr-1 group-hover:scale-110 transition-transform" />
        <span className="font-mono text-sm">Set Start</span>
      </button>

      {/* Set End Button */}
      <button
        type="button"
        onClick={setRegionEnd}
        className="flex items-center py-2 px-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors group relative"
      >
        <span className="font-mono text-sm">Set End</span>
        <CornerDownRight className="w-4 h-4 ml-1 group-hover:scale-110 transition-transform" />
      </button>
    </div>
  );
}