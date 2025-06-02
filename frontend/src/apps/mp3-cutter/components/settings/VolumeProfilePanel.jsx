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
        <div className="space-y-4">
          {/* Hiển thị các thanh custom chỉ khi không có fade nào được bật */}
          {!(fadeIn || fadeOut) && (
            <>
              {/* Thêm thanh kéo Fade In Duration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 flex justify-between">
                  <span>Fade In Duration:</span>{" "}
                  <span className="text-blue-600">{fadeInDuration}s</span>
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
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>

              {/* Thêm thanh kéo Fade Out Duration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 flex justify-between">
                  <span>Fade Out Duration:</span>{" "}
                  <span className="text-blue-600">{fadeOutDuration}s</span>
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
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>

              {["start", "middle", "end"].map((key) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 capitalize flex justify-between">
                    <span>{key}:</span>{" "}
                    <span className="text-blue-600">
                      {Math.min(1.0, customVolume[key]).toFixed(1)}x
                    </span>
                  </label>
                  <input
                    type="range"
                    min="0.0"
                    max="1.0"
                    step="0.1"
                    value={Math.min(1.0, customVolume[key])}
                    onChange={(e) => {
                      const newValue = Math.min(1.0, parseFloat(e.target.value));
                      const newCustomVolume = {
                        ...customVolume,
                        [key]: newValue,
                      };

                      setCustomVolume(newCustomVolume);

                      // OPTIMIZED: Throttled update instead of immediate
                      if (waveformRef.current) {
                        const currentPos =
                          waveformRef.current
                            .getWavesurferInstance?.()
                            ?.getCurrentTime() || 0;

                        // Single update call
                        if (waveformRef.current.updateVolume) {
                          waveformRef.current.updateVolume(currentPos, true, true);
                        }
                      }

                      // OPTIMIZED: Debounced force update
                      clearTimeout(window.customVolumeUpdateTimeout);
                      window.customVolumeUpdateTimeout = setTimeout(() => {
                        if (waveformRef.current) {
                          forceUpdateWaveform();
                        }
                      }, 150);
                    }}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
              ))}
            </>
          )}
          {/* Hiển thị thanh điều chỉnh volume và thông báo khi có fade được bật */}
          {(fadeIn || fadeOut) && (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 flex justify-between">
                  <span>Volume:</span>{" "}
                  <span className="text-blue-600">
                    {Math.min(1.0, volume).toFixed(1)}x
                  </span>
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.1"
                  value={Math.min(1.0, volume)}
                  onChange={(e) => {
                    const newVolume = Math.min(1.0, parseFloat(e.target.value));
                    setVolume(newVolume);
                    // Cập nhật UI ngay lập tức
                    if (waveformRef.current) {
                      if (typeof waveformRef.current.updateVolume === "function") {
                        waveformRef.current.updateVolume(null, true, true);
                      }
                    }
                    setTimeout(forceUpdateWaveform, 10);
                  }}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>
              <div className="text-sm text-blue-600 mt-2 bg-blue-50 p-2 rounded-md border border-blue-100">
                {fadeIn && fadeOut
                  ? "Chế độ Fade In & Out (2s) đang được bật"
                  : fadeIn
                  ? "Chế độ Fade In (2s) đang được bật"
                  : "Chế độ Fade Out (2s) đang được bật"}
                . Các tùy chọn Volume Profile đã bị vô hiệu hóa.
              </div>
            </>
          )}
        </div>
      );
    }
    
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 flex justify-between">
          <span>Volume:</span>{" "}
          <span className="text-blue-600">
            {Math.min(1.0, volume).toFixed(1)}x
          </span>
        </label>
        <input
          type="range"
          min="0.1"
          max="1.0"
          step="0.1"
          value={Math.min(1.0, volume)}
          onChange={(e) => {
            const newVolume = Math.min(1.0, parseFloat(e.target.value));
            setVolume(newVolume);
            // Cập nhật UI ngay lập tức
            if (waveformRef.current) {
              if (typeof waveformRef.current.updateVolume === "function") {
                waveformRef.current.updateVolume(null, true, true);
              }
            }
            setTimeout(forceUpdateWaveform, 10);
          }}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
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
        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="grid grid-cols-3 gap-3 mb-4">
              {["uniform", "fadeIn", "fadeOut", "custom"].map((v) => {
                const isDisabled = (fadeIn || fadeOut) && v !== "uniform";

                return (
                  <label
                    key={v}
                    className={`flex items-center px-3 py-2 border rounded-md ${
                      isDisabled
                        ? "cursor-not-allowed opacity-50 border-gray-200 bg-gray-100 text-gray-400"
                        : `cursor-pointer ${
                            volumeProfile === v
                              ? "border-blue-500 bg-blue-50 text-blue-700"
                              : "border-gray-200 hover:bg-gray-100"
                          }`
                    }`}
                  >
                    <input
                      type="radio"
                      name="volumeProfile"
                      value={v}
                      checked={volumeProfile === v}
                      disabled={isDisabled}
                      onChange={() => {
                        setVolumeProfile(v);
                        setTimeout(forceUpdateWaveform, 10);
                      }}
                      className="h-4 w-4 text-blue-600 mr-2 hidden"
                    />
                    <span className="text-sm capitalize">{v}</span>
                  </label>
                );
              })}
            </div>

            {(fadeIn || fadeOut) && (
              <div className="text-sm text-blue-600 mb-4 bg-blue-50 p-3 rounded-md border border-blue-100">
                <div className="flex items-center">
                  <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>
                    {fadeIn && fadeOut
                      ? "Chế độ Fade In & Out (2s) đang được bật"
                      : fadeIn
                      ? "Chế độ Fade In (2s) đang được bật"
                      : "Chế độ Fade Out (2s) đang được bật"}
                    . Các tùy chọn Volume Profile đã bị vô hiệu hóa.
                  </span>
                </div>
              </div>
            )}

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