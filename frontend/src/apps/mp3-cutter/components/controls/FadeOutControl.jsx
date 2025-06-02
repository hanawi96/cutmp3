import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TrendingDown, RotateCcw, Clock } from 'lucide-react';

const FadeOutControl = ({
  value = 2.0,
  onChange,
  disabled = false,
  panel = false,
  onClose
}) => {
  const [tempDuration, setTempDuration] = useState(value);
  const isUpdatingRef = useRef(false);
  const throttleTimeoutRef = useRef(null);

  // Update temp duration when value prop changes
  useEffect(() => {
    if (Math.abs(tempDuration - value) > 0.01) {
      console.log('[FadeOutControl] Value prop changed to:', value);
    }
    setTempDuration(value);
  }, [value]);

  // Handle duration change with throttling for slider
  const handleDurationChange = useCallback((newDuration, isImmediate = false) => {
    console.log('[FadeOutControl] handleDurationChange called with:', { newDuration, isImmediate, currentTempDuration: tempDuration });
    
    // Skip if duration hasn't actually changed significantly
    if (Math.abs(tempDuration - newDuration) < 0.01) {
      console.log('[FadeOutControl] Duration change skipped - no significant difference');
      return;
    }
    
    // Prevent rapid successive calls for non-immediate changes
    if (!isImmediate && isUpdatingRef.current) {
      console.log('[FadeOutControl] Duration change skipped - already updating');
      return;
    }
    
    if (!isImmediate) {
      isUpdatingRef.current = true;
    }
    
    console.log('[FadeOutControl] Duration changed to:', newDuration);
    
    // Always update UI immediately for responsiveness
    setTempDuration(newDuration);
    
    if (onChange) {
      if (isImmediate) {
        console.log('[FadeOutControl] Processing immediate change');
        requestAnimationFrame(() => {
          console.log('[FadeOutControl] Executing immediate onChange for duration:', newDuration);
          onChange(newDuration);
        });
      } else {
        console.log('[FadeOutControl] Processing non-immediate change');
        requestAnimationFrame(() => {
          console.log('[FadeOutControl] Executing non-immediate onChange for duration:', newDuration);
          onChange(newDuration);
          setTimeout(() => {
            console.log('[FadeOutControl] Clearing isUpdatingRef flag after non-immediate change');
            isUpdatingRef.current = false;
          }, 32);
        });
      }
    } else {
      if (!isImmediate) {
        setTimeout(() => {
          console.log('[FadeOutControl] Clearing isUpdatingRef flag (no onChange)');
          isUpdatingRef.current = false;
        }, 32);
      }
    }
  }, [tempDuration, onChange]);

  // Throttled slider handler
  const handleSliderChange = useCallback((newDuration) => {
    console.log('[FadeOutControl] Slider change to:', newDuration);
    
    // Update UI immediately for smooth visual feedback
    setTempDuration(newDuration);
    
    // Call onChange immediately for realtime effect
    if (onChange) {
      onChange(newDuration);
    }
  }, [onChange]);

  // Reset to 2s default
  const resetDuration = useCallback((event) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      console.log('[FadeOutControl] PREVENTED form submission from reset button');
    }
    
    console.log('[FadeOutControl] Reset duration button clicked');
    console.log('[FadeOutControl] Current duration before reset:', tempDuration);
    
    handleDurationChange(2.0, true);
    
    console.log('[FadeOutControl] ✅ Duration reset completed');
  }, [handleDurationChange, tempDuration]);

  const formatDuration = useCallback((duration) => {
    return `${duration.toFixed(1)}s`;
  }, []);

  const getDurationColor = useCallback((duration) => {
    if (duration === 2.0) return 'text-red-600';
    if (duration > 2.0) return 'text-purple-600';
    return 'text-orange-600';
  }, []);

  // Preset durations from 1s to 8s
  const presetDurations = [
    { duration: 1.0, label: '1s', icon: '⚡', desc: 'Rất nhanh' },
    { duration: 1.5, label: '1.5s', icon: '🚀', desc: 'Nhanh' },
    { duration: 2.0, label: '2s', icon: '⭐', desc: 'Mặc định' },
    { duration: 3.0, label: '3s', icon: '🎵', desc: 'Nhẹ nhàng' },
    { duration: 4.0, label: '4s', icon: '🎶', desc: 'Mượt mà' },
    { duration: 5.0, label: '5s', icon: '🌊', desc: 'Nhẹ nhàng' },
    { duration: 6.0, label: '6s', icon: '🌅', desc: 'Chậm rãi' },
    { duration: 8.0, label: '8s', icon: '🌸', desc: 'Rất mềm' },
  ];

  // Cleanup throttle timeout
  useEffect(() => {
    return () => {
      if (throttleTimeoutRef.current) {
        clearTimeout(throttleTimeoutRef.current);
      }
    };
  }, []);

  // Panel Mode
  if (panel) {
    return (
      <div 
        className="bg-white rounded-lg shadow-md border p-4"
        style={{ 
          opacity: disabled ? 0.7 : 1,
          visibility: 'visible',
          transform: 'translateZ(0)',
          pointerEvents: disabled ? 'none' : 'auto'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div className={`p-1.5 rounded-full transition-colors duration-100 ${tempDuration === 2.0 ? 'bg-red-100' : tempDuration > 2.0 ? 'bg-purple-100' : 'bg-orange-100'}`}>
              <TrendingDown className={`w-4 h-4 transition-colors duration-100 ${getDurationColor(tempDuration)}`} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-800">Fade Out</h3>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Duration display */}
            <div className="flex items-center justify-center w-16 h-8 bg-gray-50 rounded-lg border border-gray-200">
              <div className={`text-lg font-bold transition-colors duration-100 ${getDurationColor(tempDuration)}`}>
                {formatDuration(tempDuration)}
              </div>
            </div>
            
            {/* Reset button */}
            <button
              type="button"
              onClick={resetDuration}
              className="flex items-center justify-center w-8 h-8 bg-red-100 hover:bg-red-200 rounded-lg transition-all duration-200 group border border-red-200 hover:border-red-400 shadow-sm hover:shadow-md"
              title="Đặt lại về 2s"
            >
              <svg 
                className="w-4 h-4 text-red-600 group-hover:text-red-700 group-hover:rotate-180 transition-all duration-300" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>

            {/* Close button */}
            {onClose && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('[FadeOutControl] Close button clicked');
                  onClose();
                }}
                className="flex items-center justify-center w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all duration-200 group border border-gray-200 hover:border-gray-400 shadow-sm hover:shadow-md"
                title="Đóng Fade Out Control"
              >
                <svg 
                  className="w-4 h-4 text-gray-600 group-hover:text-gray-700 transition-all duration-200 group-hover:scale-110" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Slider */}
        <div className="mb-4">
          <label htmlFor="fadeout-duration-slider" className="sr-only">
            Thời gian Fade Out
          </label>
          <input
            id="fadeout-duration-slider"
            type="range"
            min="0.5"
            max="10.0"
            step="0.1"
            value={tempDuration}
            onChange={(e) => handleSliderChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-gradient-to-r from-red-200 to-red-400 rounded-lg appearance-none cursor-pointer slider-thumb-red"
            disabled={disabled}
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0.5s</span>
            <span className={getDurationColor(tempDuration)}>
              {formatDuration(tempDuration)}
            </span>
            <span>10s</span>
          </div>
        </div>

        {/* Preset buttons */}
        <div className="grid grid-cols-4 md:grid-cols-8 gap-1.5 mb-3">
          {presetDurations.map((preset) => {
            const isActive = Math.abs(tempDuration - preset.duration) < 0.01;
            
            const getPresetColor = (presetDuration, currentDuration) => {
              const isActive = Math.abs(currentDuration - presetDuration) < 0.01;
              
              if (isActive) {
                if (presetDuration === 2.0) return 'bg-red-100 text-red-800 border-red-300 ring-2 ring-red-200';
                if (presetDuration > 2.0) return 'bg-purple-100 text-purple-800 border-purple-300 ring-2 ring-purple-200';
                return 'bg-orange-100 text-orange-800 border-orange-300 ring-2 ring-orange-200';
              }
              
              return 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200';
            };

            return (
              <button
                key={preset.duration}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  
                  if (!isActive) {
                    console.log(`[FadeOutControl] Preset clicked: ${preset.duration}s`);
                    setTempDuration(preset.duration);
                    
                    // Call onChange immediately for realtime effect
                    if (onChange) {
                      onChange(preset.duration);
                    }
                  } else {
                    console.log(`[FadeOutControl] Preset ${preset.duration}s already active, skipping`);
                  }
                }}
                disabled={isActive}
                className={`relative p-1.5 rounded-md text-center transition-all duration-200 cursor-pointer border ${getPresetColor(preset.duration, tempDuration)}`}
                title={`${preset.label} - ${preset.desc}${isActive ? ' (Active)' : ''}`}
                style={{
                  transform: 'translateZ(0)',
                  willChange: isActive ? 'none' : 'transform, background-color',
                  opacity: 1
                }}
              >
                <div className="text-xs mb-0.5">{preset.icon}</div>
                <div className="text-xs font-bold leading-none">{preset.label}</div>
                
                {isActive && (
                  <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-white rounded-full">
                    <div className="w-full h-full bg-current rounded-full animate-pulse opacity-80"></div>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Duration info */}
        <div className="p-2 bg-gray-50 rounded-md transition-colors duration-100">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center space-x-1">
              <Clock className="w-3 h-3 text-gray-500" />
              <span className="text-gray-600">
                {tempDuration === 2.0 ? 'Mặc định' : 
                 tempDuration > 2.0 ? `Chậm hơn mặc định ${(tempDuration - 2.0).toFixed(1)}s` : 
                 `Nhanh hơn mặc định ${(2.0 - tempDuration).toFixed(1)}s`}
              </span>
            </div>
            
            {tempDuration !== 2.0 && (
              <span className={`font-medium ${getDurationColor(tempDuration)}`}>
                {tempDuration > 2.0 ? 
                  `+${((tempDuration - 2.0)).toFixed(1)}s` : 
                  `-${((2.0 - tempDuration)).toFixed(1)}s`}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Compact mode (not used in this case, but keeping for consistency)
  return null;
};

export default FadeOutControl; 