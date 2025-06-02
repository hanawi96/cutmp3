import React from 'react';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  Repeat,
  Undo2,
  Redo2
} from 'lucide-react';

export default function MobileOptimizedControls({
  isPlaying,
  onPlayPause,
  onSkipBack,
  onSkipForward,
  volume,
  onVolumeChange,
  loop,
  onLoopToggle,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  className = ''
}) {
  return (
    <div className={`bg-white rounded-lg shadow-md p-4 ${className}`}>
      {/* Main Playback Controls */}
      <div className="flex items-center justify-center space-x-4 mb-4">
        {/* Undo */}
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className={`p-3 rounded-full transition-all touch-manipulation ${
            canUndo 
              ? 'bg-gray-100 hover:bg-gray-200 text-gray-700' 
              : 'bg-gray-50 text-gray-400 cursor-not-allowed'
          }`}
          aria-label="Undo"
        >
          <Undo2 className="w-5 h-5" />
        </button>

        {/* Skip Back */}
        <button
          onClick={onSkipBack}
          className="p-3 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all touch-manipulation"
          aria-label="Skip back 5 seconds"
        >
          <SkipBack className="w-5 h-5" />
        </button>

        {/* Play/Pause - Larger for primary action */}
        <button
          onClick={onPlayPause}
          className="p-4 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg transition-all touch-manipulation hover:scale-105"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="w-6 h-6" />
          ) : (
            <Play className="w-6 h-6 ml-0.5" />
          )}
        </button>

        {/* Skip Forward */}
        <button
          onClick={onSkipForward}
          className="p-3 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all touch-manipulation"
          aria-label="Skip forward 5 seconds"
        >
          <SkipForward className="w-5 h-5" />
        </button>

        {/* Redo */}
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className={`p-3 rounded-full transition-all touch-manipulation ${
            canRedo 
              ? 'bg-gray-100 hover:bg-gray-200 text-gray-700' 
              : 'bg-gray-50 text-gray-400 cursor-not-allowed'
          }`}
          aria-label="Redo"
        >
          <Redo2 className="w-5 h-5" />
        </button>
      </div>

      {/* Secondary Controls */}
      <div className="flex items-center justify-between">
        {/* Volume Control */}
        <div className="flex items-center space-x-3 flex-1 mr-4">
          <Volume2 className="w-4 h-4 text-gray-500" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            style={{ minHeight: '44px' }} // iOS touch target
          />
          <span className="text-sm text-gray-500 w-8 text-right">
            {Math.round(volume * 100)}%
          </span>
        </div>

        {/* Loop Toggle */}
        <button
          onClick={onLoopToggle}
          className={`p-3 rounded-full transition-all touch-manipulation ${
            loop 
              ? 'bg-blue-100 text-blue-600' 
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
          aria-label="Toggle loop"
        >
          <Repeat className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
} 