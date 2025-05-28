import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Music, RotateCcw } from 'lucide-react';

const PitchControl = ({ 
  value = 0,
  onChange,
  onSpeedChange,
  disabled = false, 
  classes = {},
  currentSpeed = 1.0,
  panel = false  // Thêm prop panel
}) => {
  const [tempPitch, setTempPitch] = useState(value || 0);
  const [isOpen, setIsOpen] = useState(false);
  const isUpdatingRef = useRef(false);

  console.log('[PitchControl] Rendering with props:', { value, panel, disabled });
  console.log('[PitchControl] Current tempPitch:', tempPitch);

  // Update tempPitch when external value changes
  useEffect(() => {
    const safeValue = value || 0;
    if (!isUpdatingRef.current && Math.abs(tempPitch - safeValue) > 0.01) {
      console.log('[PitchControl] External pitch change:', safeValue);
      setTempPitch(safeValue);
    }
  }, [value, tempPitch]);

  // Throttled pitch change handler
  const handlePitchChange = useCallback((newPitch, isImmediate = false) => {
    console.log('[PitchControl] Handling pitch change:', newPitch, 'immediate:', isImmediate);
    
    if (Math.abs(newPitch - tempPitch) < 0.01) {
      console.log('[PitchControl] Pitch change too small, ignoring');
      return;
    }

    isUpdatingRef.current = true;
    setTempPitch(newPitch);

    if (onChange) {
      if (isImmediate) {
        console.log('[PitchControl] Executing immediate onChange for pitch:', newPitch);
        onChange(newPitch);
        // Reset flag immediately for immediate changes
        setTimeout(() => {
          isUpdatingRef.current = false;
        }, 16);
      } else {
        // For slider - use requestAnimationFrame with delay
        requestAnimationFrame(() => {
          console.log('[PitchControl] Executing non-immediate onChange for pitch:', newPitch);
          onChange(newPitch);
          setTimeout(() => {
            console.log('[PitchControl] Clearing isUpdatingRef flag after non-immediate change');
            isUpdatingRef.current = false;
          }, 32);
        });
      }
    } else {
      console.log('[PitchControl] No onChange callback provided');
      if (!isImmediate) {
        setTimeout(() => {
          console.log('[PitchControl] Clearing isUpdatingRef flag (no onChange)');
          isUpdatingRef.current = false;
        }, 32);
      }
    }
  }, [tempPitch, onChange]);

  // Reset pitch to 0
  const resetPitch = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('[PitchControl] Reset pitch button clicked - ONLY resetting pitch, NOT submitting form');
    console.log('[PitchControl] Current pitch before reset:', tempPitch);
    
    handlePitchChange(0, true);
    
    console.log('[PitchControl] ✅ Pitch reset completed - NO FORM SUBMISSION');
  }, [handlePitchChange, tempPitch]);

  const formatPitch = useCallback((pitch) => {
    if (pitch === undefined || pitch === null || isNaN(pitch)) {
      console.warn('[PitchControl] formatPitch received invalid value:', pitch);
      return '0';
    }
    
    if (pitch === 0) return '0';
    return pitch > 0 ? `+${pitch.toFixed(1)}` : pitch.toFixed(1);
  }, []);

  const getPitchColor = useCallback((pitch) => {
    if (pitch === undefined || pitch === null || isNaN(pitch)) {
      return 'text-blue-600';
    }
    
    if (pitch === 0) return 'text-blue-600';
    if (pitch > 0) return 'text-orange-600';
    return 'text-green-600';
  }, []);

  const getPitchBgColor = useCallback((pitch) => {
    console.log('[PitchControl] getPitchBgColor called with pitch:', pitch);
    
    if (pitch === undefined || pitch === null || isNaN(pitch)) {
      console.warn('[PitchControl] getPitchBgColor received invalid value:', pitch);
      return 'bg-blue-50 border-blue-200';
    }
    
    if (pitch === 0) {
      console.log('[PitchControl] Pitch = 0, returning blue background');
      return 'bg-blue-50 border-blue-200';
    }
    if (pitch > 0) {
      console.log('[PitchControl] Pitch > 0, returning orange background');
      return 'bg-orange-50 border-orange-200';
    }
    console.log('[PitchControl] Pitch < 0, returning green background');
    return 'bg-green-50 border-green-200';
  }, []);

  const presetPitches = [
    { pitch: -12, label: '-12', icon: '🔽', desc: 'Một octave thấp hơn' },
    { pitch: -7, label: '-7', icon: '⬇️', desc: 'Quint thấp hơn' },
    { pitch: -5, label: '-5', icon: '↘️', desc: 'Quart thấp hơn' },
    { pitch: -3, label: '-3', icon: '↙️', desc: 'Tiểu tam thấp hơn' },
    { pitch: 0, label: '0', icon: '🎵', desc: 'Pitch gốc' },
    { pitch: 3, label: '+3', icon: '↗️', desc: 'Tiểu tam cao hơn' },
    { pitch: 5, label: '+5', icon: '↗️', desc: 'Quart cao hơn' },
    { pitch: 7, label: '+7', icon: '⬆️', desc: 'Quint cao hơn' },
    { pitch: 12, label: '+12', icon: '🔼', desc: 'Một octave cao hơn' },
  ];

  const getPresetColor = (pitch, active) => {
    console.log('[PitchControl] getPresetColor for pitch:', pitch, 'active:', active);
    
    if (active) {
      if (pitch === 0) {
        console.log('[PitchControl] Active neutral preset');
        return 'bg-blue-500 text-white shadow-md';
      }
      if (pitch > 0) {
        console.log('[PitchControl] Active positive preset');
        return 'bg-orange-500 text-white shadow-md';
      }
      console.log('[PitchControl] Active negative preset');
      return 'bg-green-500 text-white shadow-md';
    } else {
      return 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:scale-105 active:scale-95';
    }
  };

  // Calculate effective pitch considering speed compensation
  const getEffectivePitch = useCallback((pitch) => {
    if (pitch === 0) return 0;
    
    const absPitch = Math.abs(pitch);
    let compensationStrength;
    
    if (absPitch <= 1) {
      compensationStrength = 0.95;
    } else if (absPitch <= 3) {
      compensationStrength = 0.90;
    } else if (absPitch <= 6) {
      compensationStrength = 0.85;
    } else {
      compensationStrength = 0.80;
    }
    
    return pitch * compensationStrength;
  }, []);

  if (disabled) {
    return (
      <div className={`opacity-50 cursor-not-allowed ${classes.container || ''}`}>
        <button
          type="button"
          disabled
          className={`flex items-center space-x-2 px-3 py-2 bg-gray-100 text-gray-400 rounded-lg border border-gray-200 ${classes.button || ''}`}
        >
          <Music className="w-4 h-4" />
          <span className={`text-sm font-medium ${classes.text || ''}`}>
            Pitch: {formatPitch(tempPitch)}
          </span>
        </button>
      </div>
    );
  }

  // PANEL MODE - Render as full panel (similar to SpeedControl)
// PANEL MODE - Render as full panel (OPTIMIZED COMPACT VERSION)
  if (panel) {
    console.log('[PitchControl] Rendering in COMPACT PANEL mode');
    return (
      <div className="space-y-3">
        {/* Compact Header with Current Value and Reset */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border ${getPitchBgColor(tempPitch)}`}>
              <Music className={`w-4 h-4 ${getPitchColor(tempPitch)}`} />
              <div>
                <div className={`text-lg font-bold ${getPitchColor(tempPitch)}`}>
                  {formatPitch(tempPitch)}
                </div>
                <div className="text-xs text-gray-500 -mt-0.5">semitones</div>
              </div>
            </div>
            <div className="text-xs text-gray-600">
              {tempPitch === 0 ? "Gốc" : tempPitch > 0 ? "Cao hơn" : "Thấp hơn"}
            </div>
          </div>
          
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('[PitchControl] Compact reset button clicked');
              resetPitch(e);
            }}
            className="flex items-center space-x-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-md transition-colors duration-200"
          >
            <RotateCcw className="w-3 h-3" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>

        {/* Compact Slider */}
        <div>
          <input
            type="range"
            min="-12"
            max="12"
            step="0.1"
            value={tempPitch}
            onChange={(e) => {
              const newPitch = parseFloat(e.target.value);
              console.log('[PitchControl] Compact slider changed to:', newPitch);
              handlePitchChange(newPitch);
            }}
            className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer pitch-slider"
            style={{
              background: `linear-gradient(to right, 
                #10b981 0%, 
                #10b981 ${((0 + 12) / 24) * 100}%, 
                ${tempPitch === 0 ? '#3b82f6' : tempPitch > 0 ? '#f97316' : '#10b981'} ${((tempPitch + 12) / 24) * 100}%, 
                #f97316 100%)`,
            }}
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>-12</span>
            <span className="font-medium text-gray-600">0</span>
            <span>+12</span>
          </div>
        </div>

        {/* Ultra Compact Presets - Single Row */}
        <div>
          <div className="text-xs font-medium text-gray-600 mb-1.5">Preset nhanh</div>
          <div className="grid grid-cols-5 sm:grid-cols-9 gap-1 sm:gap-1.5">
            {presetPitches.map((preset) => (
              <button
                key={preset.pitch}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('[PitchControl] Compact preset clicked:', preset.pitch);
                  handlePitchChange(preset.pitch, true);
                }}
                className={`group relative flex flex-col items-center justify-center p-1 sm:p-1.5 rounded-md text-xs font-medium transition-all duration-200 hover:scale-110 active:scale-95 min-h-[32px] sm:min-h-[36px] ${
                  Math.abs(tempPitch - preset.pitch) < 0.1
                    ? preset.pitch === 0
                      ? 'bg-blue-500 text-white shadow-md ring-2 ring-blue-300'
                      : preset.pitch > 0
                      ? 'bg-orange-500 text-white shadow-md ring-2 ring-orange-300'
                      : 'bg-green-500 text-white shadow-md ring-2 ring-green-300'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-sm'
                }`}
                title={`${preset.desc} (${preset.label})`}
              >
                <span className="text-xs sm:text-sm leading-none">{preset.icon}</span>
                <span className="text-xs font-semibold leading-none mt-0.5">{preset.label}</span>
                
                {/* Tooltip on hover for desktop */}
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10 hidden sm:block">
                  {preset.desc}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Compact Info Footer */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2 text-blue-600">
            <span>🎯</span>
            <span>Độc lập với tốc độ</span>
          </div>
          <div className="text-gray-500">
            Hiệu quả: {formatPitch(getEffectivePitch(tempPitch))}
          </div>
        </div>
      </div>
    );
  }

  // BUTTON MODE - Render as dropdown button (existing functionality)
  return (
    <div className={`relative ${classes.container || ''}`}>
      {/* Main Pitch Button */}
      <button
        type="button"
        onClick={() => {
          console.log('[PitchControl] Button mode - toggle dropdown:', !isOpen);
          setIsOpen(!isOpen);
        }}
        className={`flex items-center justify-between px-3 py-2 bg-white rounded-lg shadow-md border transition-all duration-200 hover:shadow-lg min-w-[140px] ${getPitchBgColor(tempPitch)} ${classes.button || ''}`}
        style={{ 
          opacity: disabled ? 0.7 : 1,
          visibility: 'visible',
          transform: 'translateZ(0)',
          willChange: 'background-color',
          pointerEvents: disabled ? 'none' : 'auto'
        }}
      >
        <div className="flex items-center space-x-2">
          <div className={`p-1.5 rounded-full transition-colors duration-200 ${tempPitch === 0 ? 'bg-blue-100' : tempPitch > 0 ? 'bg-orange-100' : 'bg-green-100'}`}>
            <Music className={`w-4 h-4 transition-colors duration-200 ${getPitchColor(tempPitch)}`} />
          </div>
          <div className="text-left">
            <div className={`text-sm font-medium ${getPitchColor(tempPitch)} ${classes.text || ''}`}>
              {formatPitch(tempPitch)}
            </div>
            <div className="text-xs text-gray-500">
              semitones
            </div>
          </div>
        </div>

        <svg
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''} ${getPitchColor(tempPitch)}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[320px] p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <h3 className={`font-semibold text-gray-800 ${classes.text || 'text-sm'}`}>
              Điều chỉnh Pitch
            </h3>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('[PitchControl] Reset button clicked with prevent defaults');
                resetPitch(e);
              }}
              className="flex items-center space-x-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors duration-200"
              style={{
                transform: 'translateZ(0)',
                willChange: 'background-color'
              }}
            >
              <RotateCcw className="w-3 h-3" />
              <span className="text-xs">Reset</span>
            </button>
          </div>

          {/* Current Pitch Display */}
          <div className="text-center mb-4">
            <div className={`text-2xl font-bold transition-colors duration-200 ${getPitchColor(tempPitch)}`}>
              {formatPitch(tempPitch)}
            </div>
            <div className="text-xs text-gray-500">
              {tempPitch > 0 ? 'Cao hơn' : tempPitch < 0 ? 'Thấp hơn' : 'Pitch gốc'}
            </div>
            <div className="text-xs text-blue-600 mt-1">
              Hiệu quả: {formatPitch(getEffectivePitch(tempPitch))} (có bù trừ)
            </div>
          </div>

          {/* Pitch Slider */}
          <div className="mb-4">
            <input
              type="range"
              min="-12"
              max="12"
              step="0.1"
              value={tempPitch}
              onChange={(e) => {
                const newPitch = parseFloat(e.target.value);
                handlePitchChange(newPitch);
              }}
              className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer slider-thumb transition-all duration-50"
              style={{
                background: `linear-gradient(to right, 
                  ${tempPitch < 0 ? '#10b981' : tempPitch > 0 ? '#f97316' : '#3b82f6'} 0%, 
                  ${tempPitch < 0 ? '#10b981' : tempPitch > 0 ? '#f97316' : '#3b82f6'} ${((tempPitch + 12) / 24) * 100}%, 
                  #e5e7eb ${((tempPitch + 12) / 24) * 100}%, 
                  #e5e7eb 100%)`,
                transform: 'translateZ(0)',
                willChange: 'background'
              }}
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>-12</span>
              <span>0</span>
              <span>+12</span>
            </div>
          </div>

          {/* Preset Buttons */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {presetPitches.map((preset) => (
              <button
                key={preset.pitch}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('[PitchControl] Preset button clicked:', preset.pitch);
                  handlePitchChange(preset.pitch, true);
                }}
                className={`flex flex-col items-center justify-center p-2 rounded-lg text-xs font-medium transition-all duration-200 hover:scale-105 active:scale-95 ${getPresetColor(preset.pitch, Math.abs(tempPitch - preset.pitch) < 0.1)}`}
                style={{
                  transform: 'translateZ(0)',
                  willChange: 'transform, background-color'
                }}
              >
                <span className="text-base mb-1">{preset.icon}</span>
                <span>{preset.label}</span>
              </button>
            ))}
          </div>

{/* Pitch Description */}
          <div className="mt-3 text-xs text-gray-500 text-center">
            {tempPitch === 0 && "Pitch gốc - Không thay đổi"}
            {tempPitch > 0 && tempPitch <= 3 && "Cao hơn nhẹ - Tươi sáng hơn"}
            {tempPitch > 3 && tempPitch <= 7 && "Cao hơn rõ rệt - Sắc nét hơn"}
            {tempPitch > 7 && "Cao hơn nhiều - Giọng chipmunk"}
            {tempPitch < 0 && tempPitch >= -3 && "Thấp hơn nhẹ - Ấm áp hơn"}
            {tempPitch < -3 && tempPitch >= -7 && "Thấp hơn rõ rệt - Trầm ấm hơn"}
            {tempPitch < -7 && "Thấp hơn nhiều - Giọng trầm bass"}
          </div>

          {/* Speed Independence Notice */}
          <div className="mt-3 p-2 bg-blue-50 rounded text-xs text-blue-700 text-center">
            🎯 Pitch độc lập với Speed - Không ảnh hưởng đến tốc độ phát
          </div>
        </div>
      )}
    </div>
  );
};

export default PitchControl;
