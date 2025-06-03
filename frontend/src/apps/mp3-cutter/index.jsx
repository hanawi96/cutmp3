import { useRegionHistory } from './hooks/useRegionHistory';
import { FileUpload, formatFileSize } from "./components/upload";
import AudioButtonsPanel from "./components/controls/AudioButtonsPanel";
import { VolumeProfilePanel } from "./components/settings";
import { AudioSettings } from "./components/settings";
import { useAudioState } from "./hooks/useAudioState";
import { ProcessingAndResults } from "./components/upload";
import { PlaybackControls } from "./components/controls";
import SharedHeader from "../../components/SharedHeader";
import SharedFooter from "../../components/SharedFooter";
import { FeaturesSection } from "./components/ui";
import { audioService } from './services/audioService';
import { useAudioHandlers } from './hooks/useAudioHandlers';
import { useAudioEffects } from './hooks/useAudioEffects';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useProgressAnimation } from './hooks/useProgressAnimation';
import { generateQRCode, copyShareLink } from './utils';

import { WaveformSelector } from "./components/waveform";
import {
  Music,
  Upload,
  Clock,
  BarChart3,
  Scissors,
  FileAudio,
  Download,
  RefreshCw,
  CornerDownLeft,
  CornerDownRight,
  Gauge,
} from "lucide-react";
import React, {
  useRef,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import "./styles/components/SpeedControl.css";
import "./styles/components/PitchControl.css";
import "./styles/components/FadeControls.css";
import "./styles/components/Mp3Cutter.css";

import "./styles/components/PlayButtonAnimation.css";
// Sử dụng API URL từ state.file cấu hình


export default function Mp3Cutter() {
  const state = useAudioState();


  const handleRegionChange = (
    start,
    end,
    shouldSaveHistory = false,
    source = "unknown"
  ) => {
    // Validate refs before checking for changes
    const hasValidRefs =
      state.startRef.current !== undefined &&
      state.endRef.current !== undefined &&
      isFinite(state.startRef.current) &&
      isFinite(state.endRef.current);


    // Only save history when shouldSaveHistory = true
    if (shouldSaveHistory && hasValidRefs) {
 
      
      saveRegionToHistory(start, end, source);
    } else if (shouldSaveHistory && !hasValidRefs) {
      console.warn("[REGION_CHANGE] ❌ Cannot save history - refs not initialized");
    } else {
      
    }

    // Update refs AFTER potential history save
    state.startRef.current = start;
    state.endRef.current = end;
    state.setDisplayStart(start.toFixed(2));
    state.setDisplayEnd(end.toFixed(2));

  };

  const { saveRegionToHistory, handleUndo, handleRedo } = useRegionHistory(state);
  const { handleSubmit, forceUpdateWaveform, handleReset, setRegionStart, setRegionEnd } = useAudioHandlers(state, saveRegionToHistory, handleRegionChange);
  const { handleFadeInDurationChange, handleFadeOutDurationChange, handleSpeedChange, handlePitchChange } = useAudioEffects(state, forceUpdateWaveform);

  // Use extracted hooks
  useKeyboardShortcuts(state, handleUndo, handleRedo, setRegionStart, setRegionEnd);
  useProgressAnimation(state);

  // Kiểm tra trạng thái backend khi component được tải
useEffect(() => {
  const checkServerStatus = async () => {
    const { status, error } = await audioService.checkServerStatus();
    state.setServerStatus(status);
    if (error) {
      state.setError(error);
    } else {
      state.setError(null);
    }
  };

  checkServerStatus();
}, []);

  // Debug useEffect để kiểm tra state.waveformRef khi component được khởi tạo
  useEffect(() => {
    if (state.waveformRef.current) {
      // Thêm timeout để đảm bảo WaveSurfer đã được khởi tạo đầy đủ
      setTimeout(() => {
        
        const methods = Object.keys(state.waveformRef.current || {});


        // Kiểm tra WaveSurfer instance
        if (state.waveformRef.current.getWavesurferInstance) {
          const ws = state.waveformRef.current.getWavesurferInstance();

        }

        // Kiểm tra Region
        if (state.waveformRef.current.getRegion) {
          const region = state.waveformRef.current.getRegion();

        }
      }, 500); // 500ms timeout
    }
  }, [state.file]);

  useEffect(() => {
    return () => {


      // Cancel any pending retries
      if (window.pitchRetryOnNextToggle) {
        window.pitchRetryOnNextToggle = null;
      }


    };
  }, []);

  // Update can undo/redo states
  useEffect(() => {
    state.setCanUndo(state.undoHistory.length > 0);
    state.setCanRedo(state.redoHistory.length > 0);
  }, [state.undoHistory.length, state.redoHistory.length]);

  useEffect(() => {
    // Only log significant history changes for debugging
    if (state.undoHistory.length > 10 || state.redoHistory.length > 5) {
     
    }
  }, [
    state.undoHistory.length,
    state.redoHistory.length,
    state.canUndo,
    state.canRedo,
  ]);

  // Tự động set share link khi có state.downloadUrl
  useEffect(() => {
    if (state.downloadUrl) {
      
      state.setShareLink(state.downloadUrl);
      state.setShowShareSection(true);

      // Generate QR code for direct download using QRCode library
      generateQRCode(state.downloadUrl, state);

      // Generate QR code for share link (backup method using API)
      if (!state.shareQrCode) {
        const shareQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
          state.downloadUrl
        )}`;
        state.setShareQrCode(shareQrUrl);

      }
    }
  }, [state.downloadUrl]);

  const renderVolumeOptions = () => {
    if (state.volumeProfile === "custom") {
      return (
        <div className="space-y-4">
          {/* Hiển thị các thanh custom chỉ khi không có fade nào được bật */}
          {!(state.fadeIn || state.fadeOut) && (
            <>
              {/* Thêm thanh kéo Fade In Duration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 flex justify-between">
                  <span>Fade In Duration:</span>{" "}
                  <span className="text-blue-600">{state.fadeInDuration}s</span>
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="10"
                  step="0.1"
                  value={state.fadeInDuration}
                  onChange={(e) => {
                    // ✅ PERFORMANCE FIX: Skip intensive updates in delete mode
                    const isDeleteMode = state.removeMode;
                    if (isDeleteMode) {
                      console.log("[FADE_IN_CONTROL] Delete mode - skipping intensive updates");
                      handleFadeInDurationChange(parseFloat(e.target.value));
                      return;
                    }
                    
                    // Sử dụng handleFadeInDurationChange để đảm bảo tính nhất quán
                    handleFadeInDurationChange(parseFloat(e.target.value));
                  }}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>

              {/* Thêm thanh kéo Fade Out Duration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 flex justify-between">
                  <span>Fade Out Duration:</span>{" "}
                  <span className="text-blue-600">
                    {state.fadeOutDuration}s
                  </span>
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="10"
                  step="0.1"
                  value={state.fadeOutDuration}
                  onChange={(e) => {
                    // ✅ PERFORMANCE FIX: Skip intensive updates in delete mode
                    const isDeleteMode = state.removeMode;
                    if (isDeleteMode) {
                      console.log("[FADE_OUT_CONTROL] Delete mode - skipping intensive updates");
                      handleFadeOutDurationChange(parseFloat(e.target.value));
                      return;
                    }
                    
                    // Sử dụng handleFadeOutDurationChange để đảm bảo tính nhất quán
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
                      {state.customVolume[key].toFixed(1)}x
                    </span>
                  </label>
                  <input
                    type="range"
                    min="0.0"
                    max="1.0"
                    step="0.1"
                    value={state.customVolume[key]}
                    onChange={(e) => {
                      const newValue = parseFloat(e.target.value);
                      const newCustomVolume = {
                        ...state.customVolume,
                        [key]: newValue,
                      };

                      state.setCustomVolume(newCustomVolume);

                      // ✅ PERFORMANCE FIX: Skip intensive updates in delete mode
                      const isDeleteMode = state.removeMode;
                      if (isDeleteMode) {
                        console.log("[CUSTOM_VOLUME_CONTROL] Delete mode - skipping intensive updates");
                        return;
                      }

                      // OPTIMIZED: Throttled update instead of immediate
                      if (state.waveformRef.current) {
                        const currentPos =
                          state.waveformRef.current
                            .getWavesurferInstance?.()
                            ?.getCurrentTime() || 0;

                        // Single update call
                        if (state.waveformRef.current.updateVolume) {
                          state.waveformRef.current.updateVolume(
                            currentPos,
                            true,
                            true
                          );
                        }
                      }

                      // OPTIMIZED: Debounced force update
                      clearTimeout(window.customVolumeUpdateTimeout);
                      window.customVolumeUpdateTimeout = setTimeout(() => {
                        if (state.waveformRef.current) {
                          forceUpdateWaveform();
                        }
                      }, 150); // Debounce 150ms
                    }}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
              ))}
            </>
          )}
          {/* Hiển thị thanh điều chỉnh state.volume và thông báo khi có fade được bật */}
          {(state.fadeIn || state.fadeOut) && (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 flex justify-between">
                  <span>state.Volume:</span>{" "}
                  <span className="text-blue-600">
                    {Math.min(1.0, state.volume).toFixed(1)}x
                  </span>
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.1"
                  value={Math.min(1.0, state.volume)}
                  onChange={(e) => {
                    const newVolume = Math.min(1.0, parseFloat(e.target.value));
                    state.setVolume(newVolume);
                    
                    // ✅ PERFORMANCE FIX: Skip intensive updates in delete mode
                    const isDeleteMode = state.removeMode;
                    if (isDeleteMode) {
                      console.log("[VOLUME_CONTROL] Delete mode - skipping intensive updates");
                      return;
                    }
                    
                    // Cập nhật UI ngay lập tức
                    if (state.waveformRef.current) {
                      if (
                        typeof state.waveformRef.current.updateVolume ===
                        "function"
                      ) {
                        state.waveformRef.current.updateVolume(
                          null,
                          true,
                          true
                        );
                      }
                    }
                    setTimeout(forceUpdateWaveform, 10);
                  }}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>{" "}
              <div className="text-sm text-blue-600 mt-2 bg-blue-50 p-2 rounded-md border border-blue-100">
                {state.fadeIn && state.fadeOut
                  ? "Chế độ Fade In & Out (2s) đang được bật"
                  : state.fadeIn
                  ? "Chế độ Fade In (2s) đang được bật"
                  : "Chế độ Fade Out (2s) đang được bật"}
                . Các tùy chọn state.Volume Profile đã bị vô hiệu hóa.
              </div>
            </>
          )}
        </div>
      );
    }
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 flex justify-between">
          <span>state.Volume:</span>{" "}
          <span className="text-blue-600">
            {Math.min(1.0, state.volume).toFixed(1)}x
          </span>
        </label>
        <input
          type="range"
          min="0.1"
          max="1.0"
          step="0.1"
          value={Math.min(1.0, state.volume)}
          onChange={(e) => {
            const newVolume = Math.min(1.0, parseFloat(e.target.value));
            state.setVolume(newVolume);
            
            // ✅ PERFORMANCE FIX: Skip intensive updates in delete mode
            const isDeleteMode = state.removeMode;
            if (isDeleteMode) {
              console.log("[VOLUME_CONTROL_SIMPLE] Delete mode - skipping intensive updates");
              return;
            }
            
            // Cập nhật UI ngay lập tức
            if (state.waveformRef.current) {
              if (
                typeof state.waveformRef.current.updateVolume === "function"
              ) {
                state.waveformRef.current.updateVolume(null, true, true);
              }
            }
            setTimeout(forceUpdateWaveform, 10);
          }}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
      </div>
    );
  };

  // Wrapper functions for utils
  const handleCopyShareLink = (e) => copyShareLink(e, state);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 flex flex-col">
      {/* Header */}
      <SharedHeader />

      {/* Main Content với padding tốt hơn cho mobile */}
      <main className="flex-1 py-6 sm:py-8">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          {!state.file ? (
            <div>
              {/* Hero Section với File Upload - Better mobile spacing */}
              <div className="flex items-center justify-center py-12 sm:py-16">
                <FileUpload
                  file={state.file}
                  setFile={state.setFile}
                  isDragging={state.isDragging}
                  setIsDragging={state.setIsDragging}
                  fileInputRef={state.fileInputRef}
                  serverStatus={state.serverStatus}
                  error={state.error}
                />
              </div>

              {/* Features Section */}
              <FeaturesSection />
            </div>
          ) : (
            <div className="py-4 sm:py-8">
              <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6 w-full max-w-4xl mx-auto">
                {/* File Info Header - Enhanced mobile layout */}
                <div className="flex items-center justify-between bg-white/90 backdrop-blur-sm p-4 sm:p-4 rounded-xl shadow-lg border border-white/20 mx-3 sm:mx-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                      <FileAudio className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-base sm:text-lg font-semibold text-slate-800 truncate">
                        {state.file.name}
                      </h2>
                      <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-slate-600">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          Audio
                        </span>
                        {state.file.size && (
                          <span>{formatFileSize(state.file.size)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Main Controls Panel - Enhanced mobile spacing */}
                <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 p-4 sm:p-6 mx-3 sm:mx-0">
                  {/* Audio Buttons Panel - Các buttons chức năng + Speed/Pitch panels */}
                  <AudioButtonsPanel
                    fadeIn={state.fadeIn}
                    setFadeIn={state.setFadeIn}
                    fadeOut={state.fadeOut}
                    setFadeOut={state.setFadeOut}
                    showSpeedControl={state.showSpeedControl}
                    setShowSpeedControl={state.setShowSpeedControl}
                    showPitchControl={state.showPitchControl}
                    setShowPitchControl={state.setShowPitchControl}
                    showFadeInControl={state.showFadeInControl}
                    setShowFadeInControl={state.setShowFadeInControl}
                    showFadeOutControl={state.showFadeOutControl}
                    setShowFadeOutControl={state.setShowFadeOutControl}
                    removeMode={state.removeMode}
                    setRemoveMode={state.setRemoveMode}
                    setVolumeProfile={state.setVolumeProfile}
                    setActiveIcons={state.setActiveIcons}
                    playbackSpeed={state.playbackSpeed}
                    setPlaybackSpeed={state.setPlaybackSpeed}
                    pitchShift={state.pitchShift}
                    setPitchShift={state.setPitchShift}
                    fadeInDuration={state.fadeInDuration}
                    setFadeInDuration={state.setFadeInDuration}
                    fadeOutDuration={state.fadeOutDuration}
                    setFadeOutDuration={state.setFadeOutDuration}
                    isLoading={state.isLoading}
                    handleSpeedChange={handleSpeedChange}
                    handlePitchChange={handlePitchChange}
                    handleFadeInDurationChange={handleFadeInDurationChange}
                    handleFadeOutDurationChange={handleFadeOutDurationChange}
                  />

                  {/* ✅ 2. WAVEFORM SECTION - Enhanced mobile container */}
                  <div className="mb-4 sm:mb-6 -mx-2 sm:mx-0">
                    <WaveformSelector
                      ref={state.waveformRef}
                      audioFile={state.file}
                      onRegionChange={(start, end, shouldSave, source) =>
                        handleRegionChange(start, end, shouldSave, source)
                      }
                      saveRegionToHistory={saveRegionToHistory}
                      fade={state.fadeIn || state.fadeOut}
                      fadeIn={state.fadeIn}
                      fadeOut={state.fadeOut}
                      volumeProfile={state.volumeProfile}
                      volume={state.volume}
                      customVolume={state.customVolume}
                      normalizeAudio={state.normalizeAudio}
                      onTimeUpdate={state.setCurrentPlayPosition}
                      theme="light"
                      fadeInDuration={state.fadeInDuration}
                      fadeOutDuration={state.fadeOutDuration}
                      onPlayStateChange={state.setIsPlaying}
                      loop={state.loopPlayback}
                      removeMode={state.removeMode}
                    />
                  </div>

                  {/* ✅ 3. PLAYBACK CONTROLS SECTION - Enhanced mobile layout */}
                  <PlaybackControls
                    waveformRef={state.waveformRef}
                    isPlaying={state.isPlaying}
                    loopPlayback={state.loopPlayback}
                    setLoopPlayback={state.setLoopPlayback}
                    canUndo={state.canUndo}
                    canRedo={state.canRedo}
                    undoHistory={state.undoHistory}
                    redoHistory={state.redoHistory}
                    handleUndo={handleUndo}
                    handleRedo={handleRedo}
                    setRegionStart={setRegionStart}
                    setRegionEnd={setRegionEnd}
                  />
                </div>

                {/* Volume Profile Panel - Enhanced mobile container */}
                <div className="mx-3 sm:mx-0">
                  <VolumeProfilePanel
                    volume={state.volume}
                    setVolume={state.setVolume}
                    fadeIn={state.fadeIn}
                    fadeOut={state.fadeOut}
                    volumeProfile={state.volumeProfile}
                    setVolumeProfile={state.setVolumeProfile}
                    customVolume={state.customVolume}
                    setCustomVolume={state.setCustomVolume}
                    fadeInDuration={state.fadeInDuration}
                    setFadeInDuration={state.setFadeInDuration}
                    fadeOutDuration={state.fadeOutDuration}
                    setFadeOutDuration={state.setFadeOutDuration}
                    handleFadeInDurationChange={handleFadeInDurationChange}
                    handleFadeOutDurationChange={handleFadeOutDurationChange}
                    forceUpdateWaveform={forceUpdateWaveform}
                    waveformRef={state.waveformRef}
                  />
                </div>

                {/* Audio Settings Panel - Enhanced mobile container */}
                <div className="mx-3 sm:mx-0">
                  <AudioSettings
                    normalizeAudio={state.normalizeAudio}
                    setNormalizeAudio={state.setNormalizeAudio}
                    outputFormat={state.outputFormat}
                    setOutputFormat={state.setOutputFormat}
                  />
                </div>

                {/* Processing and Results - Enhanced mobile container */}
                <div className="mx-3 sm:mx-0">
                  <ProcessingAndResults
                    isLoading={state.isLoading}
                    smoothProgress={state.smoothProgress}
                    downloadUrl={state.downloadUrl}
                    outputFormat={state.outputFormat}
                    showQrCode={state.showQrCode}
                    qrCodeDataUrl={state.qrCodeDataUrl}
                    shareLink={state.shareLink}
                    isCopied={state.isCopied}
                    handleSubmit={handleSubmit}
                    handleReset={handleReset}
                    copyShareLink={handleCopyShareLink}
                  />
                </div>

              </form>
            </div>
          )}
        </div>
      </main>

      {/* Footer với spacing tốt hơn */}
      <SharedFooter />
    </div>
  );
}
