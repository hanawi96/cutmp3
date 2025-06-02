import React from 'react';
import { Scissors, Music, Gauge, TrendingUp, TrendingDown, RotateCcw, X } from 'lucide-react';
import SpeedControl from './SpeedControl.jsx';
import PitchControl from './PitchControl.jsx';
import FadeInControl from './FadeInControl.jsx';
import FadeOutControl from './FadeOutControl.jsx';

function AudioButtonsPanel({
  // Fade states
  fadeIn, setFadeIn,
  fadeOut, setFadeOut,
  
  // UI states  
  showSpeedControl, setShowSpeedControl,
  showPitchControl, setShowPitchControl,
  showFadeInControl, setShowFadeInControl,
  showFadeOutControl, setShowFadeOutControl,
  removeMode, setRemoveMode,
  
  // Settings states
  setVolumeProfile,
  setActiveIcons,
  
  // NEW: Speed + Pitch states (di chuyển từ AudioControls)
  playbackSpeed, setPlaybackSpeed,
  pitchShift, setPitchShift,
  
  // NEW: Fade duration states
  fadeInDuration, setFadeInDuration,
  fadeOutDuration, setFadeOutDuration,
  
  isLoading,
  
  // NEW: Callback functions (di chuyển từ AudioControls)
  handleSpeedChange,
  handlePitchChange,
  handleFadeInDurationChange,
  handleFadeOutDurationChange,
}) {

  return (
    <div className="space-y-4">
      {/* ========== BUTTONS SECTION ========== */}
      <div className="flex flex-wrap items-center justify-center gap-2 mb-2 px-4">
        {/* Fade In Button */}
        <button
          type="button"
          onClick={() => {
            console.log("[AudioButtonsPanel] FadeIn button clicked");
            setShowFadeInControl(!showFadeInControl);
            
            if (!showFadeInControl) {
              // Activate FadeIn with 2s default
              setFadeIn(true);
              setVolumeProfile("uniform");
              setRemoveMode(false);
              if (showSpeedControl) setShowSpeedControl(false);
              if (showPitchControl) setShowPitchControl(false);
              
              // Set default 2s duration - simple and direct
              if (handleFadeInDurationChange) {
                handleFadeInDurationChange(2.0);
              }
            } else {
              setFadeIn(false);
            }
          }}
          className={`group relative flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
            showFadeInControl || fadeIn
              ? "bg-green-500 text-white shadow-md hover:bg-green-600"
              : "bg-white text-green-600 border border-green-300 hover:bg-green-50 hover:border-green-400"
          }`}
          style={{
            backgroundColor: showFadeInControl || fadeIn ? "#10b981" : "#ffffff",
            color: showFadeInControl || fadeIn ? "#ffffff" : "#059669",
            borderColor: showFadeInControl || fadeIn ? "#059669" : "#86efac",
            borderWidth: "1px",
            borderStyle: "solid",
          }}
          title="Fade In Control"
        >
          <TrendingUp
            className="w-4 h-4"
            style={{ color: "inherit" }}
          />
          <span className="ml-2" style={{ color: "inherit" }}>
            Fade In
          </span>
        </button>

        {/* Fade Out Button */}
        <button
          type="button"
          onClick={() => {
            console.log("[AudioButtonsPanel] FadeOut button clicked");
            setShowFadeOutControl(!showFadeOutControl);
            
            if (!showFadeOutControl) {
              // Activate FadeOut with 2s default
              setFadeOut(true);
              setVolumeProfile("uniform");
              setRemoveMode(false);
              if (showSpeedControl) setShowSpeedControl(false);
              if (showPitchControl) setShowPitchControl(false);
              if (showFadeInControl) setShowFadeInControl(false);
              
              // Set default 2s duration - simple and direct
              if (handleFadeOutDurationChange) {
                handleFadeOutDurationChange(2.0);
              }
            } else {
              setFadeOut(false);
            }
          }}
          className={`group relative flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
            showFadeOutControl || fadeOut
              ? "bg-red-500 text-white shadow-md hover:bg-red-600"
              : "bg-white text-red-600 border border-red-300 hover:bg-red-50 hover:border-red-400"
          }`}
          style={{
            backgroundColor: showFadeOutControl || fadeOut ? "#ef4444" : "#ffffff",
            color: showFadeOutControl || fadeOut ? "#ffffff" : "#dc2626",
            borderColor: showFadeOutControl || fadeOut ? "#dc2626" : "#fca5a5",
            borderWidth: "1px",
            borderStyle: "solid",
          }}
          title="Fade Out Control"
        >
          <TrendingDown
            className="w-4 h-4"
            style={{ color: "inherit" }}
          />
          <span className="ml-2" style={{ color: "inherit" }}>
            Fade Out
          </span>
        </button>

        {/* Speed Control Button */}
        <button
          type="button"
          onClick={() => {
            console.log("[AudioButtonsPanel] Speed button clicked");
            setShowSpeedControl(!showSpeedControl);
            if (!showSpeedControl) {
              if (showPitchControl) setShowPitchControl(false);
              if (showFadeInControl) setShowFadeInControl(false);
              if (showFadeOutControl) setShowFadeOutControl(false);
            }
          }}
          className={`group relative flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
            showSpeedControl
              ? "bg-purple-500 text-white shadow-md hover:bg-purple-600"
              : "bg-white text-purple-600 border border-purple-300 hover:bg-purple-50 hover:border-purple-400"
          }`}
          style={{
            backgroundColor: showSpeedControl ? "#a855f7" : "#ffffff",
            color: showSpeedControl ? "#ffffff" : "#9333ea",
            borderColor: showSpeedControl ? "#9333ea" : "#d8b4fe",
            borderWidth: "1px",
            borderStyle: "solid",
          }}
          title="Speed Control"
        >
          <Gauge className="w-4 h-4" style={{ color: "inherit" }} />
          <span className="ml-2" style={{ color: "inherit" }}>
            Speed
          </span>
        </button>

        {/* Pitch Control Button */}
        <button
          type="button"
          onClick={() => {
            console.log("[AudioButtonsPanel] Pitch button clicked");
            setShowPitchControl(!showPitchControl);
            if (!showPitchControl) {
              if (showSpeedControl) setShowSpeedControl(false);
              if (showFadeInControl) setShowFadeInControl(false);
              if (showFadeOutControl) setShowFadeOutControl(false);
            }
          }}
          className={`group relative flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
            showPitchControl
              ? "bg-orange-500 text-white shadow-md hover:bg-orange-600"
              : "bg-white text-orange-600 border border-orange-300 hover:bg-orange-50 hover:border-orange-400"
          }`}
          style={{
            backgroundColor: showPitchControl ? "#f97316" : "#ffffff",
            color: showPitchControl ? "#ffffff" : "#ea580c",
            borderColor: showPitchControl ? "#ea580c" : "#fdba74",
            borderWidth: "1px",
            borderStyle: "solid",
          }}
          title="Pitch Control"
        >
          <Music className="w-4 h-4" style={{ color: "inherit" }} />
          <span className="ml-2" style={{ color: "inherit" }}>
            Pitch
          </span>
        </button>

        {/* Remove Selection Button */}
        <button
          type="button"
          onClick={() => {
            console.log("[AudioButtonsPanel] Remove button clicked");
            setRemoveMode(!removeMode);
            if (!removeMode) {
              setFadeIn(false);
              setFadeOut(false);
              setVolumeProfile("uniform");
              if (showFadeInControl) setShowFadeInControl(false);
              if (showFadeOutControl) setShowFadeOutControl(false);
            }
          }}
          className={`group relative flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
            removeMode
              ? "bg-blue-500 text-white shadow-md hover:bg-blue-600"
              : "bg-white text-blue-600 border border-blue-300 hover:bg-blue-50 hover:border-blue-400"
          }`}
          style={{
            backgroundColor: removeMode ? "#3b82f6" : "#ffffff",
            color: removeMode ? "#ffffff" : "#2563eb",
            borderColor: removeMode ? "#2563eb" : "#93c5fd",
            borderWidth: "1px",
            borderStyle: "solid",
          }}
          title="Remove Selection"
        >
          <Scissors className="w-4 h-4" style={{ color: "inherit" }} />
          <span className="ml-2" style={{ color: "inherit" }}>
            Remove
          </span>
        </button>
      </div>

      {/* ========== FADE IN CONTROL PANEL ========== */}
      {showFadeInControl && (
        <div className="mb-4">
          <FadeInControl
            value={fadeInDuration}
            onChange={handleFadeInDurationChange}
            disabled={isLoading}
            panel={true}
            onClose={() => {
              console.log("[AudioButtonsPanel] Fade In Control close button clicked");
              setShowFadeInControl(false);
              setFadeIn(false);
              setActiveIcons((prev) => ({ ...prev, fadeIn: false }));
            }}
          />
        </div>
      )}

      {/* ========== FADE OUT CONTROL PANEL ========== */}
      {showFadeOutControl && (
        <div className="mb-4">
          <FadeOutControl
            value={fadeOutDuration}
            onChange={handleFadeOutDurationChange}
            disabled={isLoading}
            panel={true}
            onClose={() => {
              console.log("[AudioButtonsPanel] Fade Out Control close button clicked");
              setShowFadeOutControl(false);
              setFadeOut(false);
              setActiveIcons((prev) => ({ ...prev, fadeOut: false }));
            }}
          />
        </div>
      )}

      {/* ========== SPEED CONTROL PANEL ========== */}
      {showSpeedControl && (
        <div className="mb-4">
          <SpeedControl
            value={playbackSpeed}
            onChange={handleSpeedChange}
            disabled={isLoading}
            panel={true}
            onClose={() => {
              console.log("[AudioButtonsPanel] Speed Control close button clicked");
              setShowSpeedControl(false);
              setActiveIcons((prev) => ({ ...prev, speed: false }));
            }}
          />
        </div>
      )}

      {/* ========== PITCH CONTROL PANEL ========== */}
      {showPitchControl && (
        <div className="mb-3">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-orange-100 to-orange-200 shadow-sm transition-all duration-200">
                  <Music className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-800">Pitch Control</h3>
                  <p className="text-xs text-gray-500">Điều chỉnh độ cao âm thanh</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                {/* Hiển thị giá trị pitch hiện tại - Redesigned */}
                <div className="flex items-center justify-center h-10 px-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200 shadow-sm min-w-[80px] hover:shadow-md transition-all duration-200">
                  <div className="text-base font-bold text-orange-600">
                    {pitchShift === 0 ? '0' : pitchShift > 0 ? `+${pitchShift.toFixed(1)}` : pitchShift.toFixed(1)}
                  </div>
                </div>
                
                {/* Nút Reset - Redesigned hiện đại */}
                <button
                  type="button"
                  onClick={() => {
                    console.log("[AudioButtonsPanel] Pitch reset button clicked");
                    if (handlePitchChange) {
                      handlePitchChange(0);
                    }
                  }}
                  className="group flex items-center justify-center w-10 h-10 bg-gradient-to-br from-emerald-50 to-emerald-100 hover:from-emerald-100 hover:to-emerald-200 rounded-xl border border-emerald-200 hover:border-emerald-300 shadow-sm hover:shadow-md transition-all duration-200 active:scale-95"
                  title="Đặt lại về 0"
                >
                  <RotateCcw className="w-5 h-5 text-emerald-600 group-hover:text-emerald-700 group-hover:rotate-180 transition-all duration-300" />
                </button>
                
                {/* Nút Close - Redesigned hiện đại */}
                <button
                  type="button"
                  onClick={() => {
                    console.log("[AudioButtonsPanel] Pitch panel close button clicked");
                    setShowPitchControl(false);
                    setActiveIcons((prev) => ({ ...prev, pitch: false }));
                  }}
                  className="group flex items-center justify-center w-10 h-10 bg-gradient-to-br from-rose-50 to-rose-100 hover:from-rose-100 hover:to-rose-200 rounded-xl border border-rose-200 hover:border-rose-300 shadow-sm hover:shadow-md transition-all duration-200 active:scale-95"
                  title="Đóng Pitch Control"
                >
                  <X className="w-5 h-5 text-rose-600 group-hover:text-rose-700 group-hover:scale-110 transition-all duration-200" />
                </button>
              </div>
            </div>

            <PitchControl
              value={pitchShift}
              onChange={handlePitchChange}
              onSpeedChange={handleSpeedChange}
              currentSpeed={playbackSpeed}
              disabled={isLoading}
              panel={true}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default AudioButtonsPanel;