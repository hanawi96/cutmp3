import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Gauge, RotateCcw, Clock, FastForward } from 'lucide-react';

const SpeedControl = ({
  value = 1.0,
  onChange,
  disabled = false,
  compact = false,
  panel = false,
  onToggle
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tempSpeed, setTempSpeed] = useState(value);
  const containerRef = useRef(null);
  const isUpdatingRef = useRef(false);
  const throttleTimeoutRef = useRef(null); // NEW: For throttling slider

  // Update temp speed when value prop changes
  useEffect(() => {
    if (Math.abs(tempSpeed - value) > 0.01) {
      console.log('[SpeedControl] Value prop changed to:', value);
    }
    setTempSpeed(value);
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen && !panel) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen, panel]);

  const toggleDropdown = useCallback(() => {
    if (panel) return;
    const newState = !isOpen;
    setIsOpen(newState);
    if (onToggle) {
      onToggle(newState);
    }
  }, [isOpen, panel, onToggle]);

// OPTIMIZED: Prevent double updates and improve performance
const handleSpeedChange = useCallback((newSpeed, isImmediate = false) => {
    // Skip if speed hasn't actually changed significantly
    if (Math.abs(tempSpeed - newSpeed) < 0.01) {
      console.log('[SpeedControl] Speed change skipped - no significant difference');
      return;
    }
    
    // Prevent rapid successive calls for non-immediate changes
    if (!isImmediate && isUpdatingRef.current) {
      console.log('[SpeedControl] Speed change skipped - already updating');
      return;
    }
    
    if (!isImmediate) {
      isUpdatingRef.current = true;
    }
    
    console.log('[SpeedControl] Speed changed to:', newSpeed);
    
    // Always update UI immediately for responsiveness
    setTempSpeed(newSpeed);
    
    if (onChange) {
      if (isImmediate) {
        // For preset buttons - immediate but on next frame
        requestAnimationFrame(() => {
          onChange(newSpeed);
        });
      } else {
        // For slider - use requestAnimationFrame with longer delay
        requestAnimationFrame(() => {
          onChange(newSpeed);
          setTimeout(() => {
            isUpdatingRef.current = false;
          }, 32); // Two frame delay for stability
        });
      }
    } else if (!isImmediate) {
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 32);
    }
  }, [tempSpeed, onChange]);

  // NEW: Throttled slider handler
  const handleSliderChange = useCallback((newSpeed) => {
    // Update UI immediately for smooth visual feedback
    setTempSpeed(newSpeed);
    
    // Throttle the actual onChange call
    if (throttleTimeoutRef.current) {
      clearTimeout(throttleTimeoutRef.current);
    }
    
    throttleTimeoutRef.current = setTimeout(() => {
      if (onChange && Math.abs(newSpeed - value) > 0.01) {
        console.log('[SpeedControl] Throttled slider change to:', newSpeed);
        onChange(newSpeed);
      }
    }, 50); // 50ms throttle - smooth but not overwhelming
  }, [onChange, value]);

  const resetSpeed = useCallback(() => {
    console.log('[SpeedControl] Resetting speed to 1.0x');
    handleSpeedChange(1.0, true); // Immediate reset
  }, [handleSpeedChange]);

  const formatSpeed = useCallback((speed) => {
    return speed === 1.0 ? '1x' : `${speed.toFixed(2)}x`;
  }, []);

  const getSpeedColor = useCallback((speed) => {
    if (speed === 1.0) return 'text-blue-600';
    if (speed > 1.0) return 'text-orange-600';
    return 'text-green-600';
  }, []);

  // Thay thế hàm getSpeedBgColor cũ bằng hàm này
const getSpeedBgColor = useCallback((speed) => {
  console.log('[SpeedControl] getSpeedBgColor called with speed:', speed);
  
  if (speed < 1.0) {
    console.log('[SpeedControl] Speed < 1.0, returning red background');
    return 'bg-red-50 border-red-200';
  }
  if (speed >= 1.0 && speed <= 1.25) {
    console.log('[SpeedControl] Speed 1.0-1.25, returning blue background');
    return 'bg-blue-50 border-blue-200';
  }
  console.log('[SpeedControl] Speed > 1.25, returning green background');
  return 'bg-green-50 border-green-200';
}, []);

  const presetSpeeds = [
    { speed: 0.25, label: '0.25x', icon: '🐌', desc: 'Rất chậm' },
    { speed: 0.5, label: '0.5x', icon: '🚶', desc: 'Chậm' },
    { speed: 0.75, label: '0.75x', icon: '🚶‍♂️', desc: 'Hơi chậm' },
    { speed: 1.0, label: '1x', icon: '▶️', desc: 'Bình thường' },
    { speed: 1.25, label: '1.25x', icon: '🏃', desc: 'Hơi nhanh' },
    { speed: 1.5, label: '1.5x', icon: '🏃‍♂️', desc: 'Nhanh' },
    { speed: 2.0, label: '2x', icon: '🚀', desc: 'Rất nhanh' },
    { speed: 2.5, label: '2.5x', icon: '⚡', desc: 'Siêu nhanh' },
  ];

  const getCompactClasses = useCallback(() => {
    if (!compact) return {};
    return {
      button: "p-1.5",
      icon: "w-4 h-4",
      text: "text-xs",
      dropdown: "text-xs",
      slider: "h-1"
    };
  }, [compact]);

  const classes = getCompactClasses();

  // Cleanup throttle timeout
  useEffect(() => {
    return () => {
      if (throttleTimeoutRef.current) {
        clearTimeout(throttleTimeoutRef.current);
      }
    };
  }, []);

  // Panel Mode - Optimized
  if (panel) {
    return (
      // Thay thế thẻ div container đầu tiên trong Panel Mode
<div 
  className={`bg-white rounded-lg shadow-md border p-4 transition-colors duration-100 ${getSpeedBgColor(tempSpeed)}`}
  style={{ 
    opacity: disabled ? 0.7 : 1, // Chỉ giảm opacity khi disabled, không áp dụng opacity-50
    visibility: 'visible',
    transform: 'translateZ(0)',
    willChange: 'background-color',
    pointerEvents: disabled ? 'none' : 'auto'
  }}
>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div className={`p-1.5 rounded-full transition-colors duration-100 ${tempSpeed === 1.0 ? 'bg-blue-100' : tempSpeed > 1.0 ? 'bg-orange-100' : 'bg-green-100'}`}>
              <Gauge className={`w-4 h-4 transition-colors duration-100 ${getSpeedColor(tempSpeed)}`} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-800">Tốc độ phát</h3>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <div className={`text-xl font-bold transition-colors duration-100 ${getSpeedColor(tempSpeed)}`}>
              {formatSpeed(tempSpeed)}
            </div>
            
            <button
              onClick={resetSpeed}
              className="flex items-center px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors duration-100 group text-xs"
              title="Đặt lại về 1x"
            >
              <RotateCcw className="w-3 h-3 text-gray-600 group-hover:rotate-180 transition-transform duration-300" />
            </button>
          </div>
        </div>

        {/* OPTIMIZED: Throttled Speed Slider */}
        <div className="mb-4">
          <div className="relative">
            <input
              type="range"
              min="0.25"
              max="2.5"
              step="0.01" // Smaller step for smoother UI
              value={tempSpeed}
              onChange={(e) => {
                const newSpeed = parseFloat(e.target.value);
                handleSliderChange(newSpeed); // Use throttled handler
              }}
              className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer slider-thumb transition-all duration-50"
              style={{
                background: `linear-gradient(to right, 
                  ${tempSpeed <= 1.0 ? '#10b981' : tempSpeed <= 1.5 ? '#3b82f6' : '#f59e0b'} 0%, 
                  ${tempSpeed <= 1.0 ? '#10b981' : tempSpeed <= 1.5 ? '#3b82f6' : '#f59e0b'} ${((tempSpeed - 0.25) / (2.5 - 0.25)) * 100}%, 
                  #e5e7eb ${((tempSpeed - 0.25) / (2.5 - 0.25)) * 100}%, 
                  #e5e7eb 100%)`
              }}
            />
            
            <div className="flex justify-between text-xs text-gray-400 mt-1 px-0.5">
              <span>0.25x</span>
              <span>1x</span>
              <span>2.5x</span>
            </div>
          </div>
        </div>

        {/* OPTIMIZED: Preset buttons with immediate response */}
        {/* OPTIMIZED: Preset buttons với click optimization */}
{/* OPTIMIZED: Preset buttons với click optimization */}

<div className="grid grid-cols-4 md:grid-cols-8 gap-1.5 mb-3">
  {presetSpeeds.map((preset) => {
    const isActive = Math.abs(tempSpeed - preset.speed) < 0.02;
    
    // Định nghĩa màu nền dựa trên tốc độ
    const getPresetColor = (speed, active) => {
      console.log('[SpeedControl] getPresetColor for speed:', speed, 'active:', active);
      
      if (active) {
        if (speed < 1.0) {
          console.log('[SpeedControl] Active red preset');
          return 'bg-green-500 text-white shadow-md';
        }
        if (speed >= 1.0 && speed <= 1.25) {
          console.log('[SpeedControl] Active blue preset');
          return 'bg-blue-500 text-white shadow-md';
        }
        console.log('[SpeedControl] Active green preset');
        return 'bg-green-500 text-white shadow-md';
      } else {
        // Không active - màu xám nhạt
        return 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:scale-105 active:scale-95';
      }
    };
    
    return (
      <button
        key={preset.speed}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          
          if (!isActive) {
            console.log(`[SpeedControl] Preset clicked: ${preset.speed}x`);
            setTempSpeed(preset.speed);
            
            requestAnimationFrame(() => {
              if (onChange) {
                onChange(preset.speed);
              }
            });
          } else {
            console.log(`[SpeedControl] Preset ${preset.speed}x already active, skipping`);
          }
        }}
        disabled={isActive}
        className={`relative p-1.5 rounded-md text-center transition-all duration-200 cursor-pointer ${getPresetColor(preset.speed, isActive)}`}
        title={`${preset.label} - ${preset.desc}${isActive ? ' (Active)' : ''}`}
        style={{
          transform: 'translateZ(0)',
          willChange: isActive ? 'none' : 'transform, background-color',
          opacity: 1 // Đảm bảo opacity luôn là 1
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

        {/* Speed Info */}
        <div className="p-2 bg-gray-50 rounded-md transition-colors duration-100">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center space-x-1">
              <Clock className="w-3 h-3 text-gray-500" />
              <span className="text-gray-600">
                {tempSpeed === 1.0 ? 'Bình thường' : 
                 tempSpeed > 1.0 ? `Nhanh hơn ${(tempSpeed).toFixed(1)}x` : 
                 `Chậm hơn ${(1/tempSpeed).toFixed(1)}x`}
              </span>
            </div>
            
            {tempSpeed !== 1.0 && (
              <span className="font-medium text-green-600">
                {tempSpeed > 1.0 ? 
                  `↓${((1 - 1/tempSpeed) * 100).toFixed(0)}%` : 
                  `↑${((1/tempSpeed - 1) * 100).toFixed(0)}%`}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Dropdown Mode - Same optimizations applied
  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={toggleDropdown}
        disabled={disabled}
        className={`inline-flex items-center ${classes.button || 'px-3 py-2'} bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all duration-100 ${
          isOpen ? 'bg-blue-100 ring-2 ring-blue-300' : ''
        } ${value !== 1.0 ? 'ring-2 ring-orange-300 bg-orange-50' : ''}`}
        title={`Tốc độ phát: ${formatSpeed(value)}`}
      >
        <Gauge className={`${classes.icon || 'w-5 h-5'} mr-1.5 transition-colors duration-100 ${getSpeedColor(value)}`} />
        <span className={`font-medium ${classes.text || 'text-sm'} transition-colors duration-100 ${getSpeedColor(value)}`}>
          {formatSpeed(value)}
        </span>
        <svg
          className={`ml-1 w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[280px] p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <h3 className={`font-semibold text-gray-800 ${classes.text || 'text-sm'}`}>
              Tốc độ phát
            </h3>
            <button
              onClick={resetSpeed}
              className="flex items-center text-gray-500 hover:text-gray-700 transition-colors duration-100"
              title="Đặt lại về 1x"
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              <span className="text-xs">Reset</span>
            </button>
          </div>

          {/* Current Speed Display */}
          <div className="text-center mb-4">
            <div className={`text-2xl font-bold transition-colors duration-100 ${getSpeedColor(tempSpeed)}`}>
              {formatSpeed(tempSpeed)}
            </div>
            <div className="text-xs text-gray-500">
              {tempSpeed > 1.0 ? 'Nhanh hơn' : tempSpeed < 1.0 ? 'Chậm hơn' : 'Bình thường'}
            </div>
          </div>

          {/* Throttled Speed Slider */}
          <div className="mb-4">
            <input
              type="range"
              min="0.25"
              max="2.5"
              step="0.01"
              value={tempSpeed}
              onChange={(e) => handleSliderChange(parseFloat(e.target.value))}
              className={`w-full ${classes.slider || 'h-2'} bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600 transition-all duration-50`}
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>0.25x</span>
              <span>1x</span>
              <span>2x</span>
              <span>2.5x</span>
            </div>
          </div>

          {/* Preset Speed Buttons */}
          <div className="grid grid-cols-4 gap-2">
            {presetSpeeds.map((preset) => (
              <button
                key={preset.speed}
                onClick={() => handleSpeedChange(preset.speed, true)}
                className={`px-2 py-1 rounded text-xs font-medium transition-all duration-100 active:scale-95 ${
                  Math.abs(tempSpeed - preset.speed) < 0.02
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                style={{
                  transform: 'translateZ(0)',
                  willChange: 'transform, background-color'
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Speed Description */}
          <div className="mt-3 text-xs text-gray-500 text-center">
            {tempSpeed < 0.5 && "Rất chậm - Tốt để học"}
            {tempSpeed >= 0.5 && tempSpeed < 1.0 && "Chậm - Dễ theo dõi"}
            {tempSpeed === 1.0 && "Tốc độ bình thường"}
            {tempSpeed > 1.0 && tempSpeed <= 2.0 && "Nhanh - Tiết kiệm thời gian"}
            {tempSpeed > 2.0 && "Rất nhanh - Xem trước nhanh"}
          </div>
        </div>
      )}
    </div>
  );
};

export default SpeedControl;