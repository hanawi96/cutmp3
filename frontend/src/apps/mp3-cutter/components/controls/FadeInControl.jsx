import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TrendingUp, RotateCcw, Clock, X } from 'lucide-react';

const FadeInControl = ({
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

    }
    setTempDuration(value);
  }, [value]);

  // Handle duration change with throttling for slider
  const handleDurationChange = useCallback((newDuration, isImmediate = false) => {

    
    // Skip if duration hasn't actually changed significantly
    if (Math.abs(tempDuration - newDuration) < 0.01) {

      return;
    }
    
    // Prevent rapid successive calls for non-immediate changes
    if (!isImmediate && isUpdatingRef.current) {

      return;
    }
    
    if (!isImmediate) {
      isUpdatingRef.current = true;
    }
    

    
    // Always update UI immediately for responsiveness
    setTempDuration(newDuration);
    
    if (onChange) {
      if (isImmediate) {

        requestAnimationFrame(() => {

          onChange(newDuration);
        });
      } else {

        requestAnimationFrame(() => {

          onChange(newDuration);
          setTimeout(() => {

            isUpdatingRef.current = false;
          }, 32);
        });
      }
    } else {
      if (!isImmediate) {
        setTimeout(() => {

          isUpdatingRef.current = false;
        }, 32);
      }
    }
  }, [tempDuration, onChange]);

  // Throttled slider handler
  const handleSliderChange = useCallback((newDuration) => {

    
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

    }
    


    
    handleDurationChange(2.0, true);
    

  }, [handleDurationChange, tempDuration]);

  const formatDuration = useCallback((duration) => {
    return `${duration.toFixed(1)}s`;
  }, []);

  const getDurationColor = useCallback((duration) => {
    if (duration === 2.0) return 'text-green-600';
    if (duration > 2.0) return 'text-blue-600';
    return 'text-orange-600';
  }, []);

  // Preset durations from 1s to 8s
  const presetDurations = [
    { duration: 1.0, label: '1s', icon: '⚡', desc: 'Rất nhanh' },
    { duration: 1.5, label: '1.5s', icon: '🚀', desc: 'Nhanh' },
    { duration: 2.0, label: '2s', icon: '⭐', desc: 'Mặc định' },
    { duration: 2.5, label: '2.5s', icon: '🎵', desc: 'Vừa phải' },
    { duration: 3.0, label: '3s', icon: '🎶', desc: 'Nhẹ nhàng' },
    { duration: 4.0, label: '4s', icon: '🌊', desc: 'Mượt mà' },
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
        {/* Header - Redesigned với buttons hiện đại */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-xl shadow-sm transition-all duration-200 ${tempDuration === 2.0 ? 'bg-gradient-to-br from-green-100 to-green-200' : tempDuration > 2.0 ? 'bg-gradient-to-br from-blue-100 to-blue-200' : 'bg-gradient-to-br from-orange-100 to-orange-200'}`}>
              <TrendingUp className={`w-5 h-5 transition-colors duration-200 ${getDurationColor(tempDuration)}`} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-800">Fade In</h3>
              <p className="text-xs text-gray-500">Hiệu ứng âm thanh tăng dần</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Hiển thị thời gian - Redesigned */}
            <div className="flex items-center justify-center h-10 px-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200 shadow-sm min-w-[80px] hover:shadow-md transition-all duration-200">
              <div className={`text-base font-bold transition-colors duration-200 ${getDurationColor(tempDuration)}`}>
                {formatDuration(tempDuration)}
              </div>
            </div>
            
            {/* Nút Reset - Redesigned hiện đại */}
            <button
              type="button"
              onClick={resetDuration}
              className="group flex items-center justify-center w-10 h-10 bg-gradient-to-br from-emerald-50 to-emerald-100 hover:from-emerald-100 hover:to-emerald-200 rounded-xl border border-emerald-200 hover:border-emerald-300 shadow-sm hover:shadow-md transition-all duration-200 active:scale-95"
              title="Đặt lại về 2s"
            >
              <RotateCcw className="w-5 h-5 text-emerald-600 group-hover:text-emerald-700 group-hover:rotate-180 transition-all duration-300" />
            </button>

            {/* Nút Close - Redesigned hiện đại */}
            {onClose && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();

                  onClose();
                }}
                className="group flex items-center justify-center w-10 h-10 bg-gradient-to-br from-rose-50 to-rose-100 hover:from-rose-100 hover:to-rose-200 rounded-xl border border-rose-200 hover:border-rose-300 shadow-sm hover:shadow-md transition-all duration-200 active:scale-95"
                title="Đóng Fade In Control"
              >
                <X className="w-5 h-5 text-rose-600 group-hover:text-rose-700 group-hover:scale-110 transition-all duration-200" />
              </button>
            )}
          </div>
        </div>

        {/* Duration Slider */}
        <div className="mb-4">
          <div className="relative">
            <input
              type="range"
              min="0.5"
              max="10.0"
              step="0.1"
              value={tempDuration}
              onChange={(e) => {
                const newDuration = parseFloat(e.target.value);
                handleSliderChange(newDuration);
              }}
              className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer slider-thumb transition-all duration-50"
              style={{
                background: `linear-gradient(to right, 
                  ${tempDuration <= 2.0 ? '#10b981' : tempDuration <= 4.0 ? '#3b82f6' : '#f59e0b'} 0%, 
                  ${tempDuration <= 2.0 ? '#10b981' : tempDuration <= 4.0 ? '#3b82f6' : '#f59e0b'} ${((tempDuration - 0.5) / (10.0 - 0.5)) * 100}%, 
                  #e5e7eb ${((tempDuration - 0.5) / (10.0 - 0.5)) * 100}%, 
                  #e5e7eb 100%)`
              }}
            />
            
            <div className="flex justify-between text-xs text-gray-400 mt-1 px-0.5">
              <span>0.5s</span>
              <span>2s</span>
              <span>5s</span>
              <span>10s</span>
            </div>
          </div>
        </div>

        {/* Preset buttons */}
        <div className="grid grid-cols-4 md:grid-cols-8 gap-1.5 mb-3">
          {presetDurations.map((preset) => {
            const isActive = Math.abs(tempDuration - preset.duration) < 0.02;
            
            const getPresetColor = (presetDuration, currentDuration) => {
              const isActive = Math.abs(currentDuration - presetDuration) < 0.01;
              
              if (isActive) {
                return "bg-green-100 text-green-800 border-green-300 ring-2 ring-green-200";
              }
              
              return "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200";
            };
            
            return (
              <button
                key={preset.duration}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  
                  if (!isActive) {

                    setTempDuration(preset.duration);
                    
                    // Call onChange immediately for realtime effect
                    if (onChange) {
                      onChange(preset.duration);
                    }
                  } else {

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

        {/* Duration Info */}
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
              <span className="font-medium text-green-600">
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

  return null; // We only support panel mode for now
};

export default FadeInControl; 