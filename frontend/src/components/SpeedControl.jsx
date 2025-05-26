import React, { useState, useRef, useEffect } from 'react';
import { Gauge, RotateCcw, Clock, FastForward } from 'lucide-react';

const SpeedControl = ({
  value = 1.0,
  onChange,
  disabled = false,
  compact = false,
  panel = false, // NEW: Panel mode for full display
  onToggle
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tempSpeed, setTempSpeed] = useState(value);
  const containerRef = useRef(null);

  // Update temp speed when value prop changes
  useEffect(() => {
    console.log('[SpeedControl] Value prop changed to:', value);
    setTempSpeed(value);
  }, [value]);

  // Close dropdown when clicking outside (only for dropdown mode)
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        console.log('[SpeedControl] Clicked outside, closing dropdown');
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

  const toggleDropdown = () => {
    if (panel) return; // Don't toggle in panel mode
    console.log('[SpeedControl] Toggle dropdown, current state:', isOpen);
    const newState = !isOpen;
    setIsOpen(newState);
    if (onToggle) {
      onToggle(newState);
    }
  };

  const handleSpeedChange = (newSpeed) => {
    console.log('[SpeedControl] Speed changed to:', newSpeed);
    setTempSpeed(newSpeed);
    if (onChange) {
      onChange(newSpeed);
    }
  };

  const resetSpeed = () => {
    console.log('[SpeedControl] Resetting speed to 1.0x');
    handleSpeedChange(1.0);
  };

  const formatSpeed = (speed) => {
    return speed === 1.0 ? '1x' : `${speed.toFixed(2)}x`;
  };

  const getSpeedColor = (speed) => {
    if (speed === 1.0) return 'text-blue-600';
    if (speed > 1.0) return 'text-orange-600';
    return 'text-green-600';
  };

  const getSpeedBgColor = (speed) => {
    if (speed === 1.0) return 'bg-blue-50 border-blue-200';
    if (speed > 1.0) return 'bg-orange-50 border-orange-200';
    return 'bg-green-50 border-green-200';
  };

  const getSliderTrackColor = () => {
    if (tempSpeed === 1.0) return 'accent-blue-500';
    if (tempSpeed > 1.0) return 'accent-orange-500';
    return 'accent-green-500';
  };

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

  const getCurrentPreset = () => {
    return presetSpeeds.find(preset => Math.abs(preset.speed - tempSpeed) < 0.05);
  };

  const currentPreset = getCurrentPreset();

  // Compact classes for dropdown mode
  const getCompactClasses = () => {
    if (!compact) return {};
    return {
      button: "p-1.5",
      icon: "w-4 h-4",
      text: "text-xs",
      dropdown: "text-xs",
      slider: "h-1"
    };
  };

  const classes = getCompactClasses();

 // Panel Mode - Compact Display
if (panel) {
    // Chỉ log lần đầu render hoặc khi có thay đổi quan trọng
// console.log('[SPEED_PANEL] Rendering compact panel mode');
return (
    <div 
        className={`bg-white rounded-lg shadow-md border p-4 ${getSpeedBgColor(tempSpeed)} ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
        style={{ 
            opacity: 1,
            visibility: 'visible',
            transform: 'translateZ(0)' // Force hardware acceleration
        }}
    >
        {/* Compact Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div className={`p-1.5 rounded-full ${tempSpeed === 1.0 ? 'bg-blue-100' : tempSpeed > 1.0 ? 'bg-orange-100' : 'bg-green-100'}`}>
              <Gauge className={`w-4 h-4 ${getSpeedColor(tempSpeed)}`} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-800">Tốc độ phát</h3>
            </div>
          </div>
  
          <div className="flex items-center space-x-2">
            {/* Current Speed Display - Inline */}
            <div className={`text-xl font-bold ${getSpeedColor(tempSpeed)}`}>
              {formatSpeed(tempSpeed)}
            </div>
            
            <button
              onClick={() => {
                console.log('[SPEED_PANEL] Reset button clicked');
                resetSpeed();
              }}
              className="flex items-center px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors group text-xs"
              title="Đặt lại về 1x"
            >
              <RotateCcw className="w-3 h-3 text-gray-600 group-hover:rotate-180 transition-transform duration-300" />
            </button>
          </div>
        </div>
  
        {/* Compact Speed Slider */}
        <div className="mb-4">
          <div className="relative">
            <input
              type="range"
              min="0.25"
              max="2.5"
              step="0.05"
              value={tempSpeed}
              onChange={(e) => {
                const newSpeed = parseFloat(e.target.value);
                console.log('[SPEED_PANEL] Slider changed to:', newSpeed);
                handleSpeedChange(newSpeed);
              }}
              className={`w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer ${getSliderTrackColor()} slider-thumb`}
              style={{
                background: `linear-gradient(to right, 
                  ${tempSpeed <= 1.0 ? '#10b981' : tempSpeed <= 1.5 ? '#3b82f6' : '#f59e0b'} 0%, 
                  ${tempSpeed <= 1.0 ? '#10b981' : tempSpeed <= 1.5 ? '#3b82f6' : '#f59e0b'} ${((tempSpeed - 0.25) / (2.5 - 0.25)) * 100}%, 
                  #e5e7eb ${((tempSpeed - 0.25) / (2.5 - 0.25)) * 100}%, 
                  #e5e7eb 100%)`
              }}
            />
            
            {/* Compact Speed markers */}
            <div className="flex justify-between text-xs text-gray-400 mt-1 px-0.5">
              <span>0.25x</span>
              <span>1x</span>
              <span>2.5x</span>
            </div>
          </div>
        </div>
  
        {/* Compact Preset Speed Buttons */}
        <div className="grid grid-cols-4 md:grid-cols-8 gap-1.5 mb-3">
          {presetSpeeds.map((preset) => {
            const isActive = Math.abs(tempSpeed - preset.speed) < 0.05;
            // Chỉ log khi preset được click, không log khi render
// console.log(`[SPEED_PANEL] Rendering compact preset ${preset.speed}x, active: ${isActive}`);
            return (
              <button
                key={preset.speed}
                onClick={() => {
                  console.log(`[SPEED_PANEL] Compact preset clicked: ${preset.speed}x`);
                  handleSpeedChange(preset.speed);
                }}
                className={`relative p-1.5 rounded-md text-center transform hover:scale-105 ${
                  isActive
                    ? preset.speed === 1.0
                      ? 'bg-blue-500 text-white shadow-md'
                      : preset.speed > 1.0
                      ? 'bg-orange-500 text-white shadow-md'
                      : 'bg-green-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title={`${preset.label} - ${preset.desc}`}
              >
                <div className="text-xs mb-0.5">{preset.icon}</div>
                <div className="text-xs font-bold leading-none">{preset.label}</div>
                
                {/* Compact Active indicator */}
                {isActive && (
                  <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-white rounded-full">
                    <div className="w-full h-full bg-current rounded-full animate-pulse opacity-80"></div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
  
        {/* Compact Speed Info */}
        <div className="p-2 bg-gray-50 rounded-md">
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

  // Dropdown Mode - Original compact design
  return (
    <div className="relative" ref={containerRef}>
      {/* Speed Control Button */}
      <button
        onClick={toggleDropdown}
        disabled={disabled}
        className={`inline-flex items-center ${classes.button || 'px-3 py-2'} bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all duration-200 ${
          isOpen ? 'bg-blue-100 ring-2 ring-blue-300' : ''
        } ${value !== 1.0 ? 'ring-2 ring-orange-300 bg-orange-50' : ''}`}
        title={`Tốc độ phát: ${formatSpeed(value)}`}
      >
        <Gauge className={`${classes.icon || 'w-5 h-5'} mr-1.5 ${getSpeedColor(value)}`} />
        <span className={`font-medium ${classes.text || 'text-sm'} ${getSpeedColor(value)}`}>
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

      {/* Speed Control Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[280px] p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <h3 className={`font-semibold text-gray-800 ${classes.text || 'text-sm'}`}>
              Tốc độ phát
            </h3>
            <button
              onClick={resetSpeed}
              className="flex items-center text-gray-500 hover:text-gray-700 transition-colors"
              title="Đặt lại về 1x"
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              <span className="text-xs">Reset</span>
            </button>
          </div>

          {/* Current Speed Display */}
          <div className="text-center mb-4">
            <div className={`text-2xl font-bold ${getSpeedColor(tempSpeed)}`}>
              {formatSpeed(tempSpeed)}
            </div>
            <div className="text-xs text-gray-500">
              {tempSpeed > 1.0 ? 'Nhanh hơn' : tempSpeed < 1.0 ? 'Chậm hơn' : 'Bình thường'}
            </div>
          </div>

          {/* Speed Slider */}
          <div className="mb-4">
            <input
              type="range"
              min="0.25"
              max="2.5"
              step="0.05"
              value={tempSpeed}
              onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
              className={`w-full ${classes.slider || 'h-2'} bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600`}
            />
            {/* Speed markers */}
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
                onClick={() => handleSpeedChange(preset.speed)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  Math.abs(tempSpeed - preset.speed) < 0.05
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
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