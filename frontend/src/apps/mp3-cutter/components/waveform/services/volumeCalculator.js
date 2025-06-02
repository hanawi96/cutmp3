/**
 * Tính toán volume dựa trên position và profile
 * @param {number} relPos - Relative position (0-1)
 * @param {string} profile - Volume profile type
 * @param {object} volumeRefs - Object chứa các volume settings
 * @returns {number} - Calculated volume (0-1)
 */
export const calculateVolumeForProfile = (relPos, profile, volumeRefs = {}) => {
  // CRITICAL: Validate input parameters first
  if (typeof relPos !== 'number' || isNaN(relPos) || !isFinite(relPos)) {
    console.warn('[calculateVolumeForProfile] Invalid relPos:', relPos, 'defaulting to 0');
    relPos = 0;
  }
  
  // Clamp relPos to valid range
  relPos = Math.max(0, Math.min(1, relPos));
  
  const intendedVolume = Math.min(1.0, volumeRefs.intendedVolume || 1.0);
  const currentCustomVolume = {
    start: Math.min(1.0, volumeRefs.customVolume?.start || 1.0),
    middle: Math.min(1.0, volumeRefs.customVolume?.middle || 1.0),
    end: Math.min(1.0, volumeRefs.customVolume?.end || 1.0),
  };
  
  // Validate intendedVolume
  if (!isFinite(intendedVolume) || isNaN(intendedVolume)) {
    console.error('[calculateVolumeForProfile] Invalid intendedVolume:', intendedVolume);
    return 1.0;
  }
  
  // Check fade states
  const isFadeEnabled = volumeRefs.fadeEnabled || false;
  const isFadeIn = volumeRefs.fadeIn || false;
  const isFadeOut = volumeRefs.fadeOut || false;
  
  // Calculate base volume from profile
  let baseVolume = intendedVolume;
  
  try {
    switch (profile) {
      case "uniform":
        baseVolume = intendedVolume;
        break;
        
      case "custom": {
        if (relPos <= 0.5) {
          const t = relPos * 2;
          baseVolume = intendedVolume * (currentCustomVolume.start + (currentCustomVolume.middle - currentCustomVolume.start) * t);
        } else {
          const t = (relPos - 0.5) * 2;
          baseVolume = intendedVolume * (currentCustomVolume.middle + (currentCustomVolume.end - currentCustomVolume.middle) * t);
        }
        
        // Apply fade in/out duration for custom profile
        const regionDuration = volumeRefs.regionDuration || 0;
        const fadeInDur = volumeRefs.fadeInDuration || 3;
        const fadeOutDur = volumeRefs.fadeOutDuration || 3;
        
        if (regionDuration > 0 && isFinite(regionDuration)) {
          const posInRegion = relPos * regionDuration;
          const timeToEnd = regionDuration - posInRegion;
          
          let fadeMultiplier = 1.0;
          
          if (posInRegion < fadeInDur && isFinite(fadeInDur) && fadeInDur > 0) {
            const fadeInMultiplier = Math.max(0, Math.min(1, posInRegion / fadeInDur));
            fadeMultiplier *= fadeInMultiplier;
          }
          
          if (timeToEnd < fadeOutDur && isFinite(fadeOutDur) && fadeOutDur > 0) {
            const fadeOutMultiplier = Math.max(0, Math.min(1, timeToEnd / fadeOutDur));
            fadeMultiplier *= fadeOutMultiplier;
          }
          
          baseVolume *= fadeMultiplier;
        }
        break;
      }
      
      case "fadeIn": {
        const safeRelPos = Math.max(0, Math.min(1, relPos));
        const MIN_AUDIBLE_VOLUME = 0.02;
        const fadeRange = intendedVolume - MIN_AUDIBLE_VOLUME;
        baseVolume = MIN_AUDIBLE_VOLUME + (fadeRange * safeRelPos);
        baseVolume = Math.min(baseVolume, intendedVolume);
        break;
      }
      
      case "fadeOut": {
        baseVolume = intendedVolume * (1 - relPos);
        break;
      }
      
      case "bell":
        baseVolume = Math.sin(relPos * Math.PI);
        break;
      
      case "valley":
        baseVolume = 1 - Math.sin(relPos * Math.PI);
        break;
      
      case "exponential_in":
        baseVolume = Math.pow(relPos, 2);
        break;
      
      case "exponential_out":
        baseVolume = Math.pow(1 - relPos, 2);
        break;
      
      // Other cases remain same...
      default: {
        baseVolume = intendedVolume;
        break;
      }
    }
  } catch (error) {
    console.error('[calculateVolumeForProfile] Error in profile calculation:', error);
    baseVolume = intendedVolume;
  }
  
  // Apply additional fade effects if enabled
  let finalVolume = baseVolume;
  
  if (isFadeEnabled && (isFadeIn || isFadeOut)) {
    const regionDuration = volumeRefs.regionDuration || 0;
    
    if (regionDuration > 0 && isFinite(regionDuration)) {
      const posInRegion = relPos * regionDuration;
      const timeToEnd = regionDuration - posInRegion;
      
      // Use actual fade durations from volumeRefs instead of hardcoded values
      const fadeInDur = volumeRefs.fadeInDuration || 2.0;
      const fadeOutDur = volumeRefs.fadeOutDuration || 3.0;
      
      if (isFadeIn && posInRegion < fadeInDur && fadeInDur > 0) {
        const fadeInMultiplier = Math.max(0, Math.min(1, posInRegion / fadeInDur));
        finalVolume *= fadeInMultiplier;
      }
      
      if (isFadeOut && timeToEnd < fadeOutDur && fadeOutDur > 0) {
        const fadeOutMultiplier = Math.max(0, Math.min(1, timeToEnd / fadeOutDur));
        finalVolume *= fadeOutMultiplier;
      }
    }
  }
  
  // CRITICAL: Final validation before return
  const result = Math.max(0, Math.min(1, finalVolume));
  
  if (!isFinite(result) || isNaN(result)) {
    console.error('[calculateVolumeForProfile] CRITICAL: Invalid final result:', result, 'returning safe fallback');
    return 1.0;
  }
  
  return result;
}; 