import { useState, useRef, useEffect } from 'react';

/**
 * Hook quản lý tất cả state và refs của Waveform
 */
export const useWaveformState = (initialProps) => {
  const {
    removeMode = false,
    volume = 1.0,
    fadeInDuration = 3,
    fadeOutDuration = 3,
    fade = false,
    fadeIn = false,
    fadeOut = false,
    volumeProfile = "uniform",
    customVolume = { start: 1.0, middle: 1.0, end: 1.0 }
  } = initialProps;



  // ✅ States - copy từ WaveformSelector.jsx (dòng 45-70)
  const [isDeleteMode, setIsDeleteMode] = useState(removeMode);
  const [deletePreview, setDeletePreview] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentVolumeDisplay, setCurrentVolumeDisplay] = useState(volume);
  const [loading, setLoading] = useState(true);
  const [fadeInDurationState, setFadeInDurationState] = useState(fadeInDuration);
  const [fadeOutDurationState, setFadeOutDurationState] = useState(fadeOutDuration);
  const [displayRegionStart, setDisplayRegionStart] = useState("0.00");
  const [displayRegionEnd, setDisplayRegionEnd] = useState("0.00");
  const [currentPosition, setCurrentPosition] = useState(0);
  const [regionStartTime, setRegionStartTime] = useState(0);
  const [regionEndTime, setRegionEndTime] = useState(0);



  // ✅ Refs - copy từ WaveformSelector.jsx (dòng 85-140)
  const waveformRef = useRef(null);
  const overlayRef = useRef(null);
  const dimOverlayRef = useRef(null);
  const waveformDimOverlayRef = useRef(null);
  const wavesurferRef = useRef(null);
  const regionRef = useRef(null);
  const regionsPluginRef = useRef(null);
  const animationFrameRef = useRef(null);
  const lastPositionRef = useRef(0);
  const currentVolumeRef = useRef(volume);
  const drawTimerRef = useRef(null);
  const currentProfileRef = useRef(volumeProfile);
  const fadeEnabledRef = useRef(fade);
  const fadeTimeRef = useRef(2);
  const intendedVolumeRef = useRef(volume);
  const isDrawingOverlayRef = useRef(false);
  const throttledDrawRef = useRef(null);
  const customVolumeRef = useRef(customVolume);
  const fadeInDurationRef = useRef(fadeInDuration);
  const fadeOutDurationRef = useRef(fadeOutDuration);
  const lastRegionStartRef = useRef(0);
  const lastRegionEndRef = useRef(0);
  const throttledFunctionsRef = useRef({});
  const clickSourceRef = useRef(null);
  const removeModeRef = useRef(removeMode);
  const isClickUpdatingEndRef = useRef(false);
  const isDragUpdatingEndRef = useRef(false);
  const lastDragEndTimeRef = useRef(null);
  const isRealtimeDragSeekingRef = useRef(false);
  const lastRealtimeSeekTimeRef = useRef(null);
  const realtimeSeekThrottleRef = useRef(null);
  const positionSynchronizer = useRef(null);
  const lastDrawPositionRef = useRef(0);
  const syncPositionRef = useRef(0);
  const lastSyncTimeRef = useRef(0);
  const isSyncingRef = useRef(false);
  const fadeInRef = useRef(fadeIn);
  const fadeOutRef = useRef(fadeOut);
  const regionChangeSourceRef = useRef(null);
  const justUpdatedEndByClickRef = useRef(false);
  const endUpdateTimeoutRef = useRef(null);
  const lastClickEndTimeRef = useRef(null);
  const dragStartRegionRef = useRef(null);
  const overlayAnimationFrameRef = useRef(null);
  const lastDrawTimeRef = useRef(0);
  const isRegionUpdatingRef = useRef(false);
  const regionUpdateTimeoutRef = useRef(null);
  const currentPositionRef = useRef(0);
  const isDraggingRef = useRef(false);
  const isEndingPlaybackRef = useRef(false);
  const isDraggingRegionRef = useRef(false);
  const lastVolumeDrawRef = useRef(0);



  // ✅ CRITICAL: Sync refs with props changes
  useEffect(() => {
    removeModeRef.current = removeMode;
    console.log("[WAVEFORM_STATE] removeModeRef synced to:", removeMode);
  }, [removeMode]);

  useEffect(() => {
    fadeInRef.current = fadeIn;
  }, [fadeIn]);

  useEffect(() => {
    fadeOutRef.current = fadeOut;
  }, [fadeOut]);

  useEffect(() => {
    currentVolumeRef.current = volume;
  }, [volume]);

  useEffect(() => {
    customVolumeRef.current = customVolume;
  }, [customVolume]);



  return {
    // States
    state: {
      isDeleteMode,
      deletePreview,
      isPlaying,
      currentTime,
      duration,
      currentVolumeDisplay,
      loading,
      fadeInDurationState,
      fadeOutDurationState,
      displayRegionStart,
      displayRegionEnd,
      currentPosition,
      regionStartTime,
      regionEndTime
    },
    
    // State setters
    setters: {
      setIsDeleteMode,
      setDeletePreview,
      setIsPlaying,
      setCurrentTime,
      setDuration,
      setCurrentVolumeDisplay,
      setLoading,
      setFadeInDurationState,
      setFadeOutDurationState,
      setDisplayRegionStart,
      setDisplayRegionEnd,
      setCurrentPosition,
      setRegionStartTime,
      setRegionEndTime
    },
    
    // All refs
    refs: {
      waveformRef,
      overlayRef,
      dimOverlayRef,
      waveformDimOverlayRef,
      wavesurferRef,
      regionRef,
      regionsPluginRef,
      animationFrameRef,
      lastPositionRef,
      currentVolumeRef,
      drawTimerRef,
      currentProfileRef,
      fadeEnabledRef,
      fadeTimeRef,
      intendedVolumeRef,
      isDrawingOverlayRef,
      throttledDrawRef,
      customVolumeRef,
      fadeInDurationRef,
      fadeOutDurationRef,
      lastRegionStartRef,
      lastRegionEndRef,
      throttledFunctionsRef,
      clickSourceRef,
      removeModeRef,
      isClickUpdatingEndRef,
      isDragUpdatingEndRef,
      lastDragEndTimeRef,
      isRealtimeDragSeekingRef,
      lastRealtimeSeekTimeRef,
      realtimeSeekThrottleRef,
      positionSynchronizer,
      lastDrawPositionRef,
      syncPositionRef,
      lastSyncTimeRef,
      isSyncingRef,
      fadeInRef,
      fadeOutRef,
      regionChangeSourceRef,
      justUpdatedEndByClickRef,
      endUpdateTimeoutRef,
      lastClickEndTimeRef,
      dragStartRegionRef,
      overlayAnimationFrameRef,
      lastDrawTimeRef,
      isRegionUpdatingRef,
      regionUpdateTimeoutRef,
      currentPositionRef,
      isDraggingRef,
      isEndingPlaybackRef,
      isDraggingRegionRef,
      lastVolumeDrawRef
    }
  };
}; 