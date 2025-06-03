import React from 'react';
import { Scissors } from 'lucide-react';

export default function VolumeProfilePanel({
  // Volume & Fade states
  volume, setVolume,
  fadeIn, fadeOut,
  volumeProfile, setVolumeProfile,
  customVolume, setCustomVolume,
  fadeInDuration, setFadeInDuration,
  fadeOutDuration, setFadeOutDuration,
  
  // Callback functions từ parent
  handleFadeInDurationChange,
  handleFadeOutDurationChange,
  forceUpdateWaveform,
  waveformRef
}) {

  // ========== RENDER VOLUME OPTIONS ==========
  const renderVolumeOptions = () => {
    if (volumeProfile === "custom") {
      return (
        <div className="space-y-3">
          {/* Hiển thị các thanh custom chỉ khi không có fade nào được bật */}
          {!(fadeIn || fadeOut) && (
            <div className="space-y-3">
              {/* Fade Duration Controls */}
              <div className="bg-white p-3 rounded-md border border-gray-200">
                
                {/* Thêm thanh kéo Fade In Duration */}
                <div className="mb-3">
                  <label className="block text-xs font-medium text-gray-700 flex justify-between mb-1">
                    <span className="flex items-center space-x-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M3 17l6-6 4 4 8-8"/>
                        <path d="M21 7v6h-6"/>
                      </svg>
                      <span>Fade In</span>
                    </span>
                    <span className="text-green-600 font-semibold bg-green-50 px-1.5 py-0.5 rounded text-xs">
                      {fadeInDuration}s
                    </span>
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="10"
                    step="0.1"
                    value={fadeInDuration}
                    onChange={(e) => {
                      handleFadeInDurationChange(parseFloat(e.target.value));
                    }}
                    className="w-full h-2 bg-gray-200 rounded-md appearance-none cursor-pointer accent-green-500 hover:accent-green-600 transition-colors"
                  />
                  
                </div>

                {/* Thêm thanh kéo Fade Out Duration */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 flex justify-between mb-1">
                    <span className="flex items-center space-x-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M21 17l-6-6-4 4-8-8"/>
                        <path d="M3 7v6h6"/>
                      </svg>
                      <span>Fade Out</span>
                    </span>
                    <span className="text-red-600 font-semibold bg-red-50 px-1.5 py-0.5 rounded text-xs">
                      {fadeOutDuration}s
                    </span>
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="10"
                    step="0.1"
                    value={fadeOutDuration}
                    onChange={(e) => {
                      handleFadeOutDurationChange(parseFloat(e.target.value));
                    }}
                    className="w-full h-2 bg-gray-200 rounded-md appearance-none cursor-pointer accent-red-500 hover:accent-red-600 transition-colors"
                  />
                </div>
              </div>

              {/* Custom Volume Points */}
              <div className="bg-white p-3 rounded-md border border-gray-200">
                
                <div className="space-y-3">
                  {["start", "middle", "end"].map((key) => {
                    const configs = { 
                      start: { icon: "🚀", label: "Start", color: "green" },
                      middle: { icon: "🎯", label: "Middle", color: "blue" }, 
                      end: { icon: "🏁", label: "End", color: "purple" }
                    };
                    
                    const config = configs[key];
                    
                    return (
                      <div key={key}>
                        <label className="block text-xs font-medium text-gray-700 flex justify-between mb-1">
                          <span className="flex items-center space-x-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <circle cx="12" cy="12" r="10"/>
                              <path d="M12 6v6l4 2"/>
                            </svg>
                            <span>{config.label}</span>
                          </span>
                          <span className={`text-${config.color}-600 font-semibold bg-${config.color}-50 px-1.5 py-0.5 rounded text-xs`}>
                            {customVolume[key].toFixed(2)}x
                          </span>
                        </label>
                        <input
                          type="range"
                          min="0.0"
                          max="1.0"
                          step="0.01"
                          value={customVolume[key]}
                          onChange={(e) => {
                            const newValue = parseFloat(e.target.value);
                            const newCustomVolume = {
                              ...customVolume,
                              [key]: newValue,
                            };

                            setCustomVolume(newCustomVolume);

                            // OPTIMIZED: Immediate volume overlay update using requestAnimationFrame
                            if (waveformRef.current) {
                              const currentPos =
                                waveformRef.current
                                  .getWavesurferInstance?.()
                                  ?.getCurrentTime() || 0;

                              if (waveformRef.current.updateVolume) {
                                waveformRef.current.updateVolume(currentPos, true, true);
                              }
                              
                              // OPTIMIZED: Immediate visual feedback with requestAnimationFrame
                              if (typeof waveformRef.current.drawVolumeOverlay === "function") {
                                requestAnimationFrame(() => {
                                  waveformRef.current.drawVolumeOverlay(true); // Force redraw
                                });
                              }
                            }

                            // OPTIMIZED: Faster debouncing for better real-time response
                            clearTimeout(window.customVolumeUpdateTimeout);
                            window.customVolumeUpdateTimeout = setTimeout(() => {
                              if (waveformRef.current) {
                                forceUpdateWaveform(true); // Volume-only fast path
                              }
                            }, 16);
                          }}
                          className={`w-full h-2 bg-gray-200 rounded-md appearance-none cursor-pointer accent-${config.color}-500 hover:accent-${config.color}-600 transition-colors`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          
          {/* Hiển thị thanh điều chỉnh volume và thông báo khi có fade được bật */}
          {(fadeIn || fadeOut) && (
            <div className="space-y-3">
              <div className="bg-white p-3 rounded-md border border-gray-200">
                <label className="block text-xs font-medium text-gray-700 flex justify-between mb-2">
                  <span className="flex items-center space-x-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                    </svg>
                    <span>Volume Level</span>
                  </span>
                  <span className="text-blue-600 font-semibold bg-blue-50 px-1.5 py-0.5 rounded text-xs">
                    {Math.min(1.0, volume).toFixed(2)}x
                  </span>
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.01"
                  value={Math.min(1.0, volume)}
                  onChange={(e) => {
                    const newVolume = Math.min(1.0, parseFloat(e.target.value));
                    setVolume(newVolume);
                    
                    // OPTIMIZED: Immediate volume overlay update using requestAnimationFrame
                    if (waveformRef.current) {
                      if (typeof waveformRef.current.updateVolume === "function") {
                        waveformRef.current.updateVolume(null, true, true);
                      }
                      
                      // OPTIMIZED: Immediate visual feedback with requestAnimationFrame
                      if (typeof waveformRef.current.drawVolumeOverlay === "function") {
                        requestAnimationFrame(() => {
                          waveformRef.current.drawVolumeOverlay(true); // Force redraw
                        });
                      }
                    }
                    
                    // OPTIMIZED: Reduced timeout for faster updates
                    clearTimeout(window.volumeUpdateTimeout);
                    window.volumeUpdateTimeout = setTimeout(() => forceUpdateWaveform(true), 16);
                  }}
                  className="w-full h-2 bg-gray-200 rounded-md appearance-none cursor-pointer accent-blue-500 hover:accent-blue-600 transition-colors"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>Quiet</span>
                  <span>Original volume</span>
                </div>
              </div>
              
              <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded-md border border-blue-100">
                {fadeIn && fadeOut
                  ? "Chế độ Fade In & Out (2s) đang được bật"
                  : fadeIn
                  ? "Chế độ Fade In (2s) đang được bật"
                  : "Chế độ Fade Out (2s) đang được bật"}
                . Các tùy chọn Volume Profile đã bị vô hiệu hóa.
              </div>
            </div>
          )}
        </div>
      );
    }

    // Bell và Valley profiles - chỉ hiển thị volume control và mô tả
    if (volumeProfile === "bell" || volumeProfile === "valley") {
      const profileDescriptions = {
        bell: "Âm thanh bắt đầu nhỏ, tăng dần lên đỉnh ở giữa, rồi giảm xuống cuối. Phù hợp cho nhạc nền, intro/outro.",
        valley: "Âm thanh bắt đầu to, giảm xuống thấp nhất ở giữa, rồi tăng lên cuối. Phù hợp cho voice-over."
      };

      const profileIcons = {
        bell: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
        ),
        valley: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M3 20h18L12 4Z"/>
            <path d="M12 4v16"/>
          </svg>
        )
      };

      const colors = {
        bell: "purple",
        valley: "indigo"
      };

      return (
        <div className="space-y-3">
          {/* Profile description */}
          <div className={`text-xs text-${colors[volumeProfile]}-800 bg-gradient-to-r from-${colors[volumeProfile]}-50 to-${colors[volumeProfile]}-50 p-3 rounded-md border border-${colors[volumeProfile]}-200`}>
            <div className="flex items-start space-x-2">
              <div className={`text-${colors[volumeProfile]}-600 flex-shrink-0 mt-0.5`}>
                {profileIcons[volumeProfile]}
              </div>
              <div>
                <div className={`font-semibold mb-1 text-${colors[volumeProfile]}-900 text-sm`}>
                  {volumeProfile === "bell" ? "Bell Profile" : "Valley Profile"}
                </div>
                <div className="leading-snug">
                  {profileDescriptions[volumeProfile]}
                </div>
              </div>
            </div>
          </div>
          
          {/* Volume control */}
          <div className="bg-white p-3 rounded-md border border-gray-200">
            <label className="block text-xs font-medium text-gray-700 flex justify-between mb-2">
              <span className="flex items-center space-x-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                </svg>
                <span>Volume Level</span>
              </span>
              <span className={`text-${colors[volumeProfile]}-600 font-semibold bg-${colors[volumeProfile]}-50 px-1.5 py-0.5 rounded text-xs`}>
                {Math.min(1.0, volume).toFixed(2)}x
              </span>
            </label>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.01"
              value={Math.min(1.0, volume)}
              onChange={(e) => {
                const newVolume = Math.min(1.0, parseFloat(e.target.value));
                setVolume(newVolume);
                
                // OPTIMIZED: Immediate volume overlay update using requestAnimationFrame
                if (waveformRef.current) {
                  if (typeof waveformRef.current.updateVolume === "function") {
                    waveformRef.current.updateVolume(null, true, true);
                  }
                  
                  // OPTIMIZED: Immediate visual feedback with requestAnimationFrame
                  if (typeof waveformRef.current.drawVolumeOverlay === "function") {
                    requestAnimationFrame(() => {
                      waveformRef.current.drawVolumeOverlay(true); // Force redraw
                    });
                  }
                }
                
                // OPTIMIZED: Reduced timeout for faster updates
                clearTimeout(window.volumeUpdateTimeout);
                window.volumeUpdateTimeout = setTimeout(() => forceUpdateWaveform(true), 16);
              }}
              className={`w-full h-2 bg-gray-200 rounded-md appearance-none cursor-pointer accent-${colors[volumeProfile]}-500 hover:accent-${colors[volumeProfile]}-600 transition-colors`}
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>Quiet</span>
              <span>Original volume</span>
            </div>
          </div>
        </div>
      );
    }
    
    // Uniform, fadeIn, fadeOut profiles - volume control only
    return (
      <div className="bg-white p-3 rounded-md border border-gray-200">
        <label className="block text-xs font-medium text-gray-700 flex justify-between mb-2">
          <span className="flex items-center space-x-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
            </svg>
            <span>Volume Level</span>
          </span>
          <span className="text-blue-600 font-semibold bg-blue-50 px-1.5 py-0.5 rounded text-xs">
            {Math.min(1.0, volume).toFixed(2)}x
          </span>
        </label>
        <input
          type="range"
          min="0.1"
          max="1.0"
          step="0.01"
          value={Math.min(1.0, volume)}
          onChange={(e) => {
            const newVolume = Math.min(1.0, parseFloat(e.target.value));
            setVolume(newVolume);
            
            // OPTIMIZED: Immediate volume overlay update using requestAnimationFrame
            if (waveformRef.current) {
              if (typeof waveformRef.current.updateVolume === "function") {
                waveformRef.current.updateVolume(null, true, true);
              }
              
              // OPTIMIZED: Immediate visual feedback with requestAnimationFrame
              if (typeof waveformRef.current.drawVolumeOverlay === "function") {
                requestAnimationFrame(() => {
                  waveformRef.current.drawVolumeOverlay(true); // Force redraw
                });
              }
            }
            
            // OPTIMIZED: Reduced timeout for faster updates
            clearTimeout(window.volumeUpdateTimeout);
            window.volumeUpdateTimeout = setTimeout(() => forceUpdateWaveform(true), 16);
          }}
          className="w-full h-2 bg-gray-200 rounded-md appearance-none cursor-pointer accent-blue-500 hover:accent-blue-600 transition-colors"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>Quiet</span>
          <span>Original volume</span>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">
        <Scissors className="w-5 h-5 inline mr-2 text-blue-600" />
        Volume Profile
      </h3>

      <div className="flex flex-col gap-6">
        <div className="space-y-3">
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            {/* Volume Profile Grid - 2 rows x 3 columns */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {["uniform", "fadeIn", "fadeOut", "bell", "valley", "custom"].map((v) => {
                const isDisabled = (fadeIn || fadeOut) && v !== "uniform";

                // Profile configurations with Lucide-style icons
                const profileConfigs = {
                  uniform: { 
                    name: "Uniform", 
                    icon: (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <rect x="3" y="4" width="18" height="16" rx="2"/>
                        <path d="M7 10h10M7 14h10"/>
                      </svg>
                    ), 
                    desc: "Âm lượng đồng đều",
                    color: "green"
                  },
                  fadeIn: { 
                    name: "Fade In All", 
                    icon: (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M3 17l6-6 4 4 8-8"/>
                        <path d="M21 7v6h-6"/>
                      </svg>
                    ), 
                    desc: "Tăng dần từ đầu",
                    color: "green"
                  },
                  fadeOut: { 
                    name: "Fade Out All", 
                    icon: (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M21 17l-6-6-4 4-8-8"/>
                        <path d="M3 7v6h6"/>
                      </svg>
                    ), 
                    desc: "Giảm dần xuống cuối",
                    color: "green"
                  },
                  bell: { 
                    name: "Bell", 
                    icon: (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                      </svg>
                    ), 
                    desc: "Hình chuông",
                    color: "green"
                  },
                  valley: { 
                    name: "Valley", 
                    icon: (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M3 20h18L12 4Z"/>
                        <path d="M12 4v16"/>
                      </svg>
                    ), 
                    desc: "Hình thung lũng",
                    color: "green"
                  },
                  custom: { 
                    name: "Custom", 
                    icon: (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="3"/>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                      </svg>
                    ), 
                    desc: "Tùy chỉnh",
                    color: "green"
                  }
                };

                const config = profileConfigs[v];

                return (
                  <button
                    key={v}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => {
                      setVolumeProfile(v);
                      setTimeout(forceUpdateWaveform, 10);
                    }}
                    className={`
                      relative flex flex-col items-center justify-center p-3 rounded-lg border transition-all duration-200 group
                      ${isDisabled
                        ? "cursor-not-allowed opacity-40 border-gray-200 bg-gray-50 text-gray-400"
                        : volumeProfile === v
                          ? `border-${config.color}-400 bg-${config.color}-50 text-${config.color}-700 shadow-sm`
                          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 text-gray-600"
                      }
                      ${!isDisabled && "hover:shadow-sm"}
                    `}
                  >
                    {/* Icon */}
                    <div className={`mb-1.5 transition-colors duration-200 ${
                      volumeProfile === v && !isDisabled 
                        ? `text-${config.color}-600` 
                        : "text-gray-500 group-hover:text-gray-600"
                    }`}>
                      {config.icon}
                    </div>
                    
                    {/* Name */}
                    <div className="text-xs font-medium text-center leading-tight">
                      {config.name}
                    </div>
                    
                    {/* Active indicator */}
                    {volumeProfile === v && !isDisabled && (
                      <div className={`absolute -top-1 -right-1 w-3 h-3 bg-${config.color}-500 rounded-full flex items-center justify-center`}>
                        <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Fade warning message */}
            {(fadeIn || fadeOut) && (
              <div className="text-xs text-blue-700 mb-3 bg-blue-50 p-3 rounded-md border border-blue-200 flex items-start space-x-2">
                <svg className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div>
                  <div className="font-medium mb-0.5">
                    {fadeIn && fadeOut
                      ? "Fade In & Out (2s) đang được bật"
                      : fadeIn
                      ? "Fade In (2s) đang được bật"
                      : "Fade Out (2s) đang được bật"}
                  </div>
                  <div className="text-blue-600">
                    Các Volume Profile khác đã bị vô hiệu hóa.
                  </div>
                </div>
              </div>
            )}

            {/* Volume Profile Content */}
            {volumeProfile === "custom" ? (
              renderVolumeOptions()
            ) : (
              renderVolumeOptions()
            )}
          </div>
        </div>
      </div>
    </div>
  );
}