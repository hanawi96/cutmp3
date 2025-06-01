import { useState, useRef, useCallback } from 'react';

export const useAudioState = () => {
  // ========== FILE STATES ==========
  const [file, setFile] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [serverStatus, setServerStatus] = useState(null);

  // ========== AUDIO SETTINGS ==========
  const [volume, setVolume] = useState(1.0);
  const [fadeIn, setFadeIn] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [volumeProfile, setVolumeProfile] = useState("uniform");
  const [customVolume, setCustomVolume] = useState({
    start: 1.0,
    middle: 1.0,
    end: 1.0,
  });
  const [normalizeAudio, setNormalizeAudio] = useState(false);
  const [outputFormat, setOutputFormat] = useState("mp3");
  const [fadeInDuration, setFadeInDuration] = useState(3);
  const [fadeOutDuration, setFadeOutDuration] = useState(3);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [pitchShift, setPitchShift] = useState(0);

  // ========== UI STATES ==========
  const [isDragging, setIsDragging] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loopPlayback, setLoopPlayback] = useState(false);
  const [removeMode, setRemoveMode] = useState(false);
  const [showSpeedControl, setShowSpeedControl] = useState(false);
  const [showPitchControl, setShowPitchControl] = useState(false);
  const [activeIcons, setActiveIcons] = useState({
    fadeIn: false,
    fadeOut: false,
    speed: false,
    remove: false,
    pitch: false,
  });

  // ========== PROGRESS STATES ==========
  const [progress, setProgress] = useState(0);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStatus, setProcessingStatus] = useState("");
  const [smoothProgress, setSmoothProgress] = useState(0);

  // ========== SHARE & DOWNLOAD STATES ==========
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [showQrCode, setShowQrCode] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [shareQrCode, setShareQrCode] = useState("");
  const [showShareSection, setShowShareSection] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // ========== REGION & PLAYBACK STATES ==========
  const [displayStart, setDisplayStart] = useState(0);
  const [displayEnd, setDisplayEnd] = useState(0);
  const [currentPlayPosition, setCurrentPlayPosition] = useState(0);

  // ========== UNDO/REDO STATES ==========
  const [undoHistory, setUndoHistory] = useState([]);
  const [redoHistory, setRedoHistory] = useState([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [previousRegion, setPreviousRegion] = useState(null);

  // ========== REFS ==========
  const fileInputRef = useRef(null);
  const audioContextRef = useRef(null);
  const soundTouchRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const gainNodeRef = useRef(null);
  const scriptNodeRef = useRef(null);
  const startRef = useRef(0);
  const endRef = useRef(0);
  const waveformRef = useRef(null);
  const progressAnimationRef = useRef(null);

  // ========== RETURN ALL STATES ==========
  return {
    // File states
    file,
    setFile,
    downloadUrl,
    setDownloadUrl,
    isLoading,
    setIsLoading,
    error,
    setError,
    serverStatus,
    setServerStatus,

    // Audio settings
    volume,
    setVolume,
    fadeIn,
    setFadeIn,
    fadeOut,
    setFadeOut,
    volumeProfile,
    setVolumeProfile,
    customVolume,
    setCustomVolume,
    normalizeAudio,
    setNormalizeAudio,
    outputFormat,
    setOutputFormat,
    fadeInDuration,
    setFadeInDuration,
    fadeOutDuration,
    setFadeOutDuration,
    playbackSpeed,
    setPlaybackSpeed,
    pitchShift,
    setPitchShift,

    // UI states
    isDragging,
    setIsDragging,
    isPlaying,
    setIsPlaying,
    loopPlayback,
    setLoopPlayback,
    removeMode,
    setRemoveMode,
    showSpeedControl,
    setShowSpeedControl,
    showPitchControl,
    setShowPitchControl,
    activeIcons,
    setActiveIcons,

    // Progress states
    progress,
    setProgress,
    processingProgress,
    setProcessingProgress,
    processingStatus,
    setProcessingStatus,
    smoothProgress,
    setSmoothProgress,

    // Share & download states
    qrCodeDataUrl,
    setQrCodeDataUrl,
    showQrCode,
    setShowQrCode,
    shareLink,
    setShareLink,
    shareQrCode,
    setShareQrCode,
    showShareSection,
    setShowShareSection,
    isCopied,
    setIsCopied,

    // Region & playback states
    displayStart,
    setDisplayStart,
    displayEnd,
    setDisplayEnd,
    currentPlayPosition,
    setCurrentPlayPosition,

    // Undo/redo states
    undoHistory,
    setUndoHistory,
    redoHistory,
    setRedoHistory,
    canUndo,
    setCanUndo,
    canRedo,
    setCanRedo,
    previousRegion,
    setPreviousRegion,

    // Refs
    fileInputRef,
    audioContextRef,
    soundTouchRef,
    sourceNodeRef,
    gainNodeRef,
    scriptNodeRef,
    startRef,
    endRef,
    waveformRef,
    progressAnimationRef,
  };
};