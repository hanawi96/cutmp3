console.log("🟩 File mp3.js ĐÃ ĐƯỢC LOAD");
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const ffmpegPath = require("ffmpeg-static");
const ffprobePath = require("@ffprobe-installer/ffprobe").path;
const ffmpeg = require("fluent-ffmpeg");
// SAU KHI KHAI BÁO ffmpeg THÌ MỚI SET PATH
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);




const router = express.Router();

// Cấu hình storage cho uploaded files
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, "../uploads");
    if (!fs.existsSync(dir)){
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'audio-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // ✅ INCREASED: 100MB to support lossless formats
  },
  fileFilter: (req, file, cb) => {
    console.log('[MULTER] File filter check:', {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype
    });
    
    // ✅ EXPANDED: Support multiple audio formats with browser variants
    const supportedMimeTypes = [
      // MP3 formats
      "audio/mpeg", "audio/mp3",
      // WAV formats  
      "audio/wav", "audio/wave", "audio/x-wav",
      // M4A/MP4 formats - including browser variants
      "audio/mp4", "audio/m4a", "audio/x-m4a", "audio/mp4a-latm",
      // AAC format
      "audio/aac", "audio/x-aac",
      // OGG format
      "audio/ogg", "audio/x-ogg",
      // FLAC format
      "audio/flac", "audio/x-flac",
      // WMA format
      "audio/x-ms-wma", "audio/wma",
      // Additional common variants
      "audio/webm", "audio/3gp", "audio/amr"
    ];
    
    const normalizedMimeType = file.mimetype.toLowerCase();
    const isSupported = supportedMimeTypes.includes(normalizedMimeType);
    
    console.log('[MULTER] MIME type check:', {
      original: file.mimetype,
      normalized: normalizedMimeType,
      isSupported: isSupported
    });
    
    if (isSupported) {

      cb(null, true);
    } else {
      console.error('[MULTER] ❌ File rejected, unsupported mimetype:', normalizedMimeType);
      console.error('[MULTER] Supported formats:', supportedMimeTypes);
      cb(new Error(`Unsupported audio format. Got: ${file.mimetype}. Supported formats: MP3, WAV, M4A, AAC, OGG, FLAC, WMA`), false);
    }
  }
});

// Middleware để log requests
function requestLogger(req, res, next) {




  next();
}

// Middleware xử lý lỗi Multer - PHẢI ĐẶT SAU upload.single()
function multerErrorHandler(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    console.error('[MULTER ERROR] MulterError:', err.code, err.message);
    
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({ 
          error: 'File too large', 
          details: 'Maximum file size is 100MB (50MB for compressed audio, 100MB for lossless formats like WAV/FLAC)'
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({ 
          error: 'Unexpected file field', 
          details: 'File field name must be "audio"'
        });
      default:
        return res.status(400).json({ 
          error: 'File upload error', 
          details: err.message
        });
    }
  } else if (err) {
    console.error('[UPLOAD ERROR] General error:', err.message);
    console.error('[UPLOAD ERROR] Error type:', err.constructor.name);
    
    // ✅ ENHANCED: Better error handling for file format errors
    if (err.message.includes('Unsupported audio format')) {
      return res.status(400).json({ 
        error: 'Unsupported file format', 
        details: err.message,
        supportedFormats: ['MP3', 'WAV', 'M4A', 'AAC', 'OGG', 'FLAC', 'WMA']
      });
    }
    
    return res.status(400).json({ 
      error: 'File upload error', 
      details: err.message
    });
  }
  
  next();
}

// === ĐÚNG THỨ TỰ MIDDLEWARE ===
router.post("/cut-mp3", requestLogger, upload.single("audio"), multerErrorHandler, async (req, res) => {
  console.log('='.repeat(50));
  console.log('🎵 NEW MP3 CUT REQUEST STARTED');
  console.log('='.repeat(50));

  console.log('[CUT-MP3] File uploaded:', req.file ? {
    fieldname: req.file.fieldname,
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    path: req.file.path
  } : 'NO FILE');
  
  const inputPath = req.file?.path;
  
  try {
    if (!req.file) {
      console.error('[ERROR] No audio file uploaded');
      return res.status(400).json({ 
        error: "No audio file uploaded",
        details: "Please select an MP3 file to upload"
      });
    }

    if (!fs.existsSync(inputPath)) {
      console.error('[ERROR] Uploaded file does not exist:', inputPath);
      return res.status(400).json({ 
        error: 'Uploaded file does not exist', 
        details: inputPath
      });
    }



    // Extract parameters
    const startTime = parseFloat(req.body?.start);
    const endTime = parseFloat(req.body?.end);
    const rawVolume = req.body?.volume;
    const volume = parseFloat(typeof rawVolume === "string" ? rawVolume.replace(",", ".") : rawVolume);
    const fadeIn = req.body?.fadeIn === "true";
    const fadeOut = req.body?.fadeOut === "true";
    const volumeProfile = req.body?.volumeProfile || "uniform";
    const normalizeAudio = req.body?.normalizeAudio === "true";
    
    // CRITICAL: Ensure outputFormat is properly extracted and validated
    const requestedFormat = req.body?.outputFormat || "mp3";
    const outputFormat = requestedFormat.toLowerCase().trim();
    
    const fadeInDuration = parseFloat(req.body?.fadeInDuration || "3");
    const fadeOutDuration = parseFloat(req.body?.fadeOutDuration || "3");
    const playbackSpeed = parseFloat(req.body?.speed || "1.0");

    // === DEBUG: LOG ALL FORM DATA ===
    console.log('[DEBUG] Raw form data received:');
    console.log('  - start:', req.body?.start, '(type:', typeof req.body?.start, ')');
    console.log('  - end:', req.body?.end, '(type:', typeof req.body?.end, ')');
    console.log('  - volume:', req.body?.volume, '(type:', typeof req.body?.volume, ')');
    console.log('  - volumeProfile:', req.body?.volumeProfile, '(type:', typeof req.body?.volumeProfile, ')');
    console.log('  - fadeIn:', req.body?.fadeIn, '(type:', typeof req.body?.fadeIn, ')');
    console.log('  - fadeOut:', req.body?.fadeOut, '(type:', typeof req.body?.fadeOut, ')');
    console.log('  - outputFormat:', req.body?.outputFormat, '(type:', typeof req.body?.outputFormat, ')');
    console.log('  - normalizeAudio:', req.body?.normalizeAudio, '(type:', typeof req.body?.normalizeAudio, ')');
    console.log('  - fadeInDuration:', req.body?.fadeInDuration, '(type:', typeof req.body?.fadeInDuration, ')');
    console.log('  - fadeOutDuration:', req.body?.fadeOutDuration, '(type:', typeof req.body?.fadeOutDuration, ')');
    console.log('  - speed:', req.body?.speed, '(type:', typeof req.body?.speed, ')');

    // ENHANCED: Log format processing
    console.log('[DEBUG] All req.body keys:', Object.keys(req.body || {}));
    console.log('[DEBUG] Full req.body:', req.body);

    console.log('[PARAMS] Parsed:', { 
      startTime, endTime, volume, fadeIn, fadeOut, volumeProfile, 
      normalizeAudio, outputFormat, fadeInDuration, fadeOutDuration, playbackSpeed 
    });

    // Validate output format
    const supportedFormats = ['mp3', 'm4a', 'm4r', 'wav', 'aac', 'ogg'];
    if (!supportedFormats.includes(outputFormat)) {
      cleanupFile(inputPath);
      console.error('[FORMAT ERROR] Unsupported format:', outputFormat);
      return res.status(400).json({ 
        error: "Unsupported output format",
        supported: supportedFormats,
        received: outputFormat
      });
    }



    // === VALIDATE SPEED PARAMETER ===





    if (isNaN(playbackSpeed) || playbackSpeed < 0.25 || playbackSpeed > 4.0) {
      cleanupFile(inputPath);
      console.error('[SPEED ERROR] Invalid speed value:', playbackSpeed);
      return res.status(400).json({ 
        error: "Speed must be between 0.25 and 4.0",
        received: playbackSpeed
      });
    }



    // === DEBUG CHI TIẾT CHO FADE DURATION ===










    // Validate parameters
    if (isNaN(startTime) || startTime < 0) {
      cleanupFile(inputPath);
      return res.status(400).json({ error: "Invalid start time" });
    }
    
    if (isNaN(endTime) || endTime <= startTime) {
      cleanupFile(inputPath);
      return res.status(400).json({ error: "Invalid end time" });
    }
    
    if (isNaN(volume) || volume < 0.1 || volume > 3.0) {
      cleanupFile(inputPath);
      return res.status(400).json({ error: "Volume must be between 0.1 and 3.0" });
    }

    // Validate fade durations nếu được bật
    if ((fadeIn || volumeProfile === "fadeIn") && 
    (isNaN(fadeInDuration) || fadeInDuration < 0.1 || fadeInDuration > 30)) {
    cleanupFile(inputPath);
    return res.status(400).json({ 
    error: "Fade In duration must be between 0.1 and 30 seconds",
    received: fadeInDuration
    });
    }

    if ((fadeOut || volumeProfile === "fadeOut") && 
    (isNaN(fadeOutDuration) || fadeOutDuration < 0.1 || fadeOutDuration > 30)) {
    cleanupFile(inputPath);
    return res.status(400).json({ 
    error: "Fade Out duration must be between 0.1 and 30 seconds", 
    received: fadeOutDuration
    });
    }

    console.log('[VALIDATION] ✅ Fade durations validated:', { 
    fadeInDuration, 
    fadeOutDuration, 
    fileDuration: endTime - startTime,
    fadeInPercent: ((fadeInDuration / (endTime - startTime)) * 100).toFixed(1) + '%',
    fadeOutPercent: ((fadeOutDuration / (endTime - startTime)) * 100).toFixed(1) + '%'
    });

    // Parse custom volume
    let customVolume = { start: 1.0, middle: 1.0, end: 1.0 };
    if (volumeProfile === "custom" && req.body?.customVolume) {
      try {
        const parsed = JSON.parse(req.body.customVolume);
        if (
          typeof parsed.start === "number" &&
          typeof parsed.middle === "number" &&
          typeof parsed.end === "number" &&
          parsed.start >= 0 && parsed.start <= 3 &&
          parsed.middle >= 0 && parsed.middle <= 3 &&
          parsed.end >= 0 && parsed.end <= 3
        ) {
          customVolume = parsed;
        }
      } catch (e) {
        cleanupFile(inputPath);
        return res.status(400).json({ error: "Invalid custom volume data" });
      }
    }

    // Setup output with CORRECT extension
    const outputDir = path.join(__dirname, "../output");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // CRITICAL: Create filename with correct extension
    const outputFilename = `cut_${Date.now()}.${outputFormat}`;
    const outputPath = path.join(outputDir, outputFilename);
    const duration = endTime - startTime;






    // Build filters
    const filters = [];

    // Add volume profile filter
    addVolumeProfileFilter(filters, volumeProfile, volume, duration, customVolume, fadeIn, fadeOut);

    // Add fade effects
    addFadeEffects(filters, {
      fadeIn,
      fadeOut,
      fadeInDuration,
      fadeOutDuration,
      duration,
      volumeProfile,
      volume
    });

    // Add speed effects

    addSpeedFilters(filters, playbackSpeed);

    // Add normalization
    if (normalizeAudio) {
      filters.push("loudnorm=I=-16:TP=-1.5:LRA=11");
    }



    // === THÊM VALIDATION CHI TIẾT CHO FILTERS ===

    for (let i = 0; i < filters.length; i++) {
      const filter = filters[i];

      
      // Check for common syntax issues
      if (filter.includes("'") && !filter.match(/^[a-zA-Z]+='.+'$/)) {
        console.error(`[FILTER ERROR] Potential syntax issue in filter ${i}:`, filter);
      }
    }

    // Process audio with ALL parameters including outputFormat
    processAudio({
      inputPath,
      outputPath,
      startTime,
      duration,
      filters,
      outputFormat,
      res,
      outputFilename,
      volumeProfile,
      volume,
      customVolume,
      normalizeAudio,
      playbackSpeed
    });

  } catch (error) {
    console.error("[ERROR] Uncaught error:", error);
    console.error("[ERROR] Stack:", error.stack);
    cleanupFile(inputPath);
    
    if (!res.headersSent) {
      res.status(500).json({ 
        error: "Internal server error", 
        details: error.message
      });
    }
    console.log('='.repeat(50));
    console.log('❌ MP3 CUT REQUEST FAILED - UNCAUGHT ERROR');
    console.log(`🔥 Error: ${error.message}`);
    console.log('='.repeat(50));
  }
});

// === ADD SPEED FILTER FUNCTION ===
function addSpeedFilters(filters, speed) {


  
  if (speed === 1.0) {

    return;
  }
  
  try {
    // FFmpeg atempo filter có giới hạn 0.5-2.0
    // Nếu speed ngoài giới hạn này, cần chain nhiều atempo filters
    
    if (speed >= 0.5 && speed <= 2.0) {
      // Trường hợp đơn giản: 1 atempo filter
      const speedFilter = `atempo=${speed.toFixed(3)}`;
      filters.push(speedFilter);

      
    } else if (speed > 2.0 && speed <= 4.0) {
      // Tốc độ > 2.0: chain 2 atempo filters
      const factor1 = 2.0;
      const factor2 = speed / 2.0;
      
      const speedFilter1 = `atempo=${factor1.toFixed(3)}`;
      const speedFilter2 = `atempo=${factor2.toFixed(3)}`;
      
      filters.push(speedFilter1);
      filters.push(speedFilter2);
      




      
    } else if (speed < 0.5 && speed >= 0.25) {
      // Tốc độ < 0.5: chain 2 atempo filters
      const factor1 = 0.5;
      const factor2 = speed / 0.5;
      
      const speedFilter1 = `atempo=${factor1.toFixed(3)}`;
      const speedFilter2 = `atempo=${factor2.toFixed(3)}`;
      
      filters.push(speedFilter1);
      filters.push(speedFilter2);
      




      
    } else {
      console.error('[SPEED] Speed value outside supported range:', speed);
      throw new Error(`Speed ${speed} is outside supported range (0.25-4.0)`);
    }
    
  } catch (error) {
    console.error('[SPEED ERROR]', error.message);
    throw error;
  }
  

}

// Helper functions
function cleanupFile(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);

    } catch (error) {
      console.error("[CLEANUP ERROR]", error.message);
    }
  }
}

// === GIẢI PHÁP CUỐI CÙNG: SỬ DỤNG SIMPLE VOLUME FILTERS ===
function addVolumeProfileFilter(filters, profile, volume, duration, customVolume, fadeIn = false, fadeOut = false) {
  console.log('[VOLUME_PROFILE_FILTER] Processing profile:', profile, 'volume:', volume, 'duration:', duration);
  
  try {
    if (profile === "uniform") {
      // Volume đồng đều
      const volumeFilter = `volume=${volume.toFixed(2)}`;
      filters.unshift(volumeFilter);
      console.log('[VOLUME_PROFILE_FILTER] Applied uniform volume:', volumeFilter);
      
    } else if (profile === "custom") {
      // === CUSTOM VOLUME CURVE - SỬ DỤNG APPROACH AN TOÀN HỞN ===
      const start = Math.max(0.0, Math.min(3.0, customVolume.start));
      const middle = Math.max(0.0, Math.min(3.0, customVolume.middle));
      const end = Math.max(0.0, Math.min(3.0, customVolume.end));
      
      // Tạo volume expression với validation-safe format
      const totalVol = volume;
      const midpoint = duration / 2;
      
      const startVol = (start * totalVol).toFixed(3);
      const middleVol = (middle * totalVol).toFixed(3);
      const endVol = (end * totalVol).toFixed(3);
      
      // Sử dụng format đơn giản hơn để tránh validation issues
      // Linear interpolation với 2 phần: start->middle, middle->end
      const midStr = midpoint.toFixed(6);
      const durStr = duration.toFixed(6);
      
      // Expression đơn giản hơn
      const expression = `if(lt(t,${midStr}),${startVol}+(${middleVol}-${startVol})*(t/${midStr}),${middleVol}+(${endVol}-${middleVol})*((t-${midStr})/${midStr}))`;
      
      const volumeFilter = `volume='${expression}'`;
      filters.unshift(volumeFilter);
      console.log('[VOLUME_PROFILE_FILTER] Applied custom volume:', volumeFilter);
      
    } else if (profile === "bell") {
      // ✅ FIXED: Bell curve using afade filters - more reliable than volume expressions
      console.log('[VOLUME_PROFILE_FILTER] Applying bell curve with volume:', volume, 'duration:', duration);
      
      // Bell curve using fade in + fade out to create bell shape
      // More reliable than complex volume expressions
      const fadeTime = Math.min(duration / 3, 5); // Max 5 seconds fade each way
      
      // Apply base volume first
      if (volume !== 1.0) {
        const volumeFilter = `volume=${volume.toFixed(2)}`;
        filters.unshift(volumeFilter);
        console.log('[VOLUME_PROFILE_FILTER] Applied base volume:', volumeFilter);
      }
      
      // Add fade effects to create bell shape (fade in + fade out)
      const fadeInFilter = `afade=t=in:st=0:d=${fadeTime.toFixed(3)}`;
      const fadeOutFilter = `afade=t=out:st=${(duration - fadeTime).toFixed(3)}:d=${fadeTime.toFixed(3)}`;
      
      filters.push(fadeInFilter);
      filters.push(fadeOutFilter);
      
      console.log('[VOLUME_PROFILE_FILTER] Applied bell fade filters:', [fadeInFilter, fadeOutFilter]);
      
    } else if (profile === "valley") {
      // ✅ FINAL: Valley using EXACT SAME STRUCTURE as bell but with reduced volume
      console.log('[VOLUME_PROFILE_FILTER] Applying valley curve with volume:', volume, 'duration:', duration);
      
      // Valley: Use bell's exact structure but with reduced base volume
      const fadeTime = Math.min(duration / 3, 5); // Same as bell: Max 5 seconds fade each way
      const valleyBaseVolume = volume * 0.3; // 30% of original for valley effect
      
      // Apply reduced base volume FIRST (this ensures no silence)
      const volumeFilter = `volume=${valleyBaseVolume.toFixed(2)}`;
      filters.unshift(volumeFilter);
      console.log('[VOLUME_PROFILE_FILTER] Applied valley base volume:', volumeFilter);
      
      // Apply EXACT SAME fade structure as bell
      // This creates: low→high→low (valley effect with the reduced base)
      const fadeInFilter = `afade=t=in:st=0:d=${fadeTime.toFixed(3)}`;
      const fadeOutFilter = `afade=t=out:st=${(duration - fadeTime).toFixed(3)}:d=${fadeTime.toFixed(3)}`;
      
      filters.push(fadeInFilter);
      filters.push(fadeOutFilter);
      
      console.log('[VOLUME_PROFILE_FILTER] Applied valley fade filters (SAME AS BELL):', [fadeInFilter, fadeOutFilter]);
      console.log('[VOLUME_PROFILE_FILTER] Valley effect: ' + (valleyBaseVolume*100).toFixed(0) + '%→100%→' + (valleyBaseVolume*100).toFixed(0) + '% (base volume ensures no silence)');
      
    } else {
      // Các profile fade khác
      const volumeFilter = `volume=${volume.toFixed(2)}`;
      filters.unshift(volumeFilter);
      console.log('[VOLUME_PROFILE_FILTER] Applied default volume:', volumeFilter);
    }
    
  } catch (error) {
    console.error('[VOLUME_PROFILE_FILTER] Error:', error.message);
    console.error('[VOLUME_PROFILE_FILTER] Falling back to simple volume');
    
    // Fallback: simple volume nếu có lỗi
    const fallbackVolume = `volume=${volume.toFixed(2)}`;
    filters.unshift(fallbackVolume);
    console.log('[VOLUME_PROFILE_FILTER] Applied fallback volume:', fallbackVolume);
  }
}

// === GIẢI PHÁP CUỐI CÙNG: SIMPLE FADE EFFECTS ===
function addFadeEffects(filters, options) {
  const { fadeIn, fadeOut, fadeInDuration, fadeOutDuration, duration, volumeProfile, volume } = options;
  
  // ✅ SKIP FADE PROCESSING FOR BELL AND VALLEY (they handle their own fades)
  if (volumeProfile === "bell" || volumeProfile === "valley") {
    console.log('[FADE_EFFECTS] Skipping fade processing for profile:', volumeProfile);
    return;
  }

  try {
      // === PRIORITY 1: FADE FLAGS (CHECKBOX 2S) - HIGHEST PRIORITY ===
      const shouldApplyFadeInFlag = fadeIn === true;
      const shouldApplyFadeOutFlag = fadeOut === true;
      
      if (shouldApplyFadeInFlag || shouldApplyFadeOutFlag) {

          
          if (shouldApplyFadeInFlag) {
              const forcedFadeInDuration = 2.0; // Always 2 seconds for checkbox
              let actualFadeInDuration = Math.min(forcedFadeInDuration, Math.max(0.5, duration - 0.5));
              
              const fadeInFilter = `afade=t=in:st=0:d=${actualFadeInDuration}`;
              filters.push(fadeInFilter);
              

          }
          
          if (shouldApplyFadeOutFlag) {
              const forcedFadeOutDuration = 2.0; // Always 2 seconds for checkbox
              let actualFadeOutDuration = Math.min(forcedFadeOutDuration, Math.max(0.5, duration - 0.5));
              
              const startFadeOut = Math.max(0, duration - actualFadeOutDuration);
              const fadeOutFilter = `afade=t=out:st=${startFadeOut}:d=${actualFadeOutDuration}`;
              filters.push(fadeOutFilter);
              

          }
          
          return; // CRITICAL: Exit immediately, ignore all volume profile settings
      }
      
      // === PRIORITY 2: VOLUME PROFILE SETTINGS (ONLY IF NO FADE FLAGS) ===
      
      if (volumeProfile === "fadeIn") {
          const fadeInFilter = `afade=t=in:st=0:d=${duration}`;
          filters.push(fadeInFilter);
          

          return;
      }
      
      if (volumeProfile === "fadeOut") {
          const fadeOutFilter = `afade=t=out:st=0:d=${duration}`;
          filters.push(fadeOutFilter);
          

          return;
      }
      
      // CRITICAL FIX: Chỉ áp dụng fade trong custom profile khi có explicit user request
      if (volumeProfile === "custom") {

          
          // Add custom volume profile through separate function
          // No fade effects here unless explicitly requested by user
      }
      


      
  } catch (error) {
      console.error('[FADE ERROR]', error.message);
      console.error('[FADE ERROR] Stack:', error.stack);
  }
}

function validateFilters(filters) {


  
  if (!Array.isArray(filters) || filters.length === 0) {
    console.error('[VALIDATION ERROR] No filters provided');
    throw new Error("No audio filter is set");
  }
  
  for (let i = 0; i < filters.length; i++) {
    const f = filters[i];

    
    if (typeof f !== 'string' || !f.trim()) {
      console.error('[VALIDATION ERROR] Invalid filter at index', i, ':', f);
      throw new Error("Invalid filter detected: " + f);
    }
    
    // === ENHANCED VALIDATION VỚI CUSTOM VOLUME SUPPORT ===
    if (f.startsWith('volume=')) {

      
      // Extract volume value (phần sau dấu =)
      const volumeValue = f.split('=')[1];
      
      // Kiểm tra nếu là simple number
      if (!volumeValue.includes("'") && !volumeValue.includes('(')) {
        // Simple volume filter (e.g., volume=1.50)
        const numValue = parseFloat(volumeValue);
        
        if (isNaN(numValue)) {
          console.error(`[VALIDATION ERROR] Invalid simple volume value in filter ${i}:`, volumeValue);
          throw new Error(`Invalid volume value: ${volumeValue}`);
        }
        
        if (numValue < 0 || numValue > 5) {
          console.warn(`[VALIDATION WARNING] Volume value outside normal range in filter ${i}:`, numValue);
        }
        

      } 
      else if (volumeValue.startsWith("'") && volumeValue.endsWith("'")) {
        // Complex volume expression (e.g., volume='if(lt(t,10),1.0,2.0)')
        const expression = volumeValue.slice(1, -1); // Remove quotes
        
        // Basic validation cho expression
        if (expression.length === 0) {
          console.error(`[VALIDATION ERROR] Empty volume expression in filter ${i}`);
          throw new Error(`Empty volume expression in filter ${i}`);
        }
        
        // Kiểm tra có các function cơ bản
        const hasValidFunctions = /\b(if|lt|gt|eq|ne|and|or|not|t)\b/.test(expression);
        const hasInvalidChars = /[;<>&|`$]/.test(expression); // Ngăn injection
        
        if (hasInvalidChars) {
          console.error(`[VALIDATION ERROR] Potentially dangerous characters in volume expression:`, expression);
          throw new Error(`Invalid characters in volume expression`);
        }
        
        if (!hasValidFunctions && !expression.match(/^[\d\.\+\-\*\/\(\)\s]+$/)) {
          console.warn(`[VALIDATION WARNING] Complex volume expression may not be valid:`, expression);
          // Không throw error, chỉ warning vì có thể là expression hợp lệ khác
        }
        


      }
      else {
        console.error(`[VALIDATION ERROR] Unrecognized volume filter format in filter ${i}:`, volumeValue);
        throw new Error(`Unrecognized volume filter format: ${volumeValue}`);
      }
    }
    else if (f.startsWith('afade=')) {

      
      // Validate afade syntax
      if (f.includes('t=in') || f.includes('t=out')) {

      } else {
        console.warn(`[VALIDATION WARNING] afade filter ${i} missing fade type:`, f);
      }
    }
    else if (f.startsWith('loudnorm')) {

}
else if (f.startsWith('atempo=')) {

  
  const tempoValue = f.split('=')[1];
  const numValue = parseFloat(tempoValue);
  
  if (isNaN(numValue) || numValue < 0.5 || numValue > 2.0) {
    console.error(`[VALIDATION ERROR] Invalid atempo value in filter ${i}:`, tempoValue);
    throw new Error(`Invalid atempo value: ${tempoValue}. Must be between 0.5 and 2.0`);
  }
  

}
else {
  console.warn(`[VALIDATION WARNING] Unknown filter type in filter ${i}:`, f);
  // Không throw error cho unknown filters, có thể là valid FFmpeg filters khác
}
  }
  

}

function processAudio(options) {
  const {
    inputPath, outputPath, startTime, duration, filters, outputFormat,
    res, outputFilename, volumeProfile, volume, customVolume, normalizeAudio, playbackSpeed
  } = options;
  
  try {
    console.log('[PROCESS_AUDIO] Starting with filters:', filters);
    validateFilters(filters);
    console.log('[PROCESS_AUDIO] ✅ Filters validated successfully');

    // Set response headers for streaming
    if (!res.headersSent) {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });

    }

    let lastProgressSent = 0; // Track last progress sent

    // Build FFmpeg command with correct filter order
    const ffmpegCommand = ffmpeg()
      .input(inputPath)
      .inputOptions([])
      .outputOptions([])
      .on("start", (cmd) => {
        console.log('[FFMPEG] Command started:', cmd);
        
        // Send initial progress
        const initialProgress = JSON.stringify({ 
          progress: 0, 
          status: 'started',
          message: 'Processing started...' 
        }) + '\n';
        
        res.write(initialProgress);
        lastProgressSent = 0;
      })
      .on("progress", (progress) => {
        let percent = Math.round(progress.percent || 0);
        // Ensure progress doesn't exceed 95% during processing
        percent = Math.min(percent, 95);
        
        // Only send if progress increased significantly (to avoid spam)
        if (percent > lastProgressSent) {
          lastProgressSent = percent;
          
          // Send progress updates to client
          if (res.writable) {
            try {
              const progressData = JSON.stringify({ 
                progress: percent, 
                status: 'processing',
                message: `Processing... ${percent}%` 
              }) + '\n';
              
              res.write(progressData);
              // Only log progress at significant milestones (every 25%)
              if (percent % 25 === 0 || percent >= 95) {

              }
            } catch (writeError) {
              console.error("[FFMPEG] Error writing progress:", writeError);
            }
          }
        }
      })
      .on("end", () => {
        try {

          
          // CRITICAL: Send 100% progress before final response
          if (res.writable) {
            const completionProgress = JSON.stringify({ 
              progress: 100, 
              status: 'processing',
              message: 'Processing... 100%' 
            }) + '\n';
            
            res.write(completionProgress);

          }
          
          cleanupFile(inputPath);
          
          if (!fs.existsSync(outputPath)) {
            console.error('[FFMPEG] Output file was not created');
            const errorResponse = JSON.stringify({
              progress: -1,
              status: 'error',
              error: 'Output file was not created'
            }) + '\n';
            res.end(errorResponse);
            console.log('='.repeat(50));
            console.log('❌ MP3 CUT REQUEST FAILED - NO OUTPUT FILE');
            console.log('='.repeat(50));
            return;
          }

          
          // Add small delay to ensure 100% progress is processed by frontend
          setTimeout(() => {
            ffmpeg.ffprobe(outputPath, (err, metadata) => {
              let finalResponse;
              
              if (err) {
                console.error("[FFPROBE ERROR]", err);
                const fileStats = fs.statSync(outputPath);
                
                finalResponse = JSON.stringify({
                  progress: 100,
                  status: 'completed',
                  filename: outputFilename,
                  size: formatFileSize(fileStats.size),
                  duration: formatTime(duration),
                  bitrate: 'N/A',
                  volumeProfile,
                  appliedVolume: volume,
                  customVolume: volumeProfile === "custom" ? customVolume : null,
                  playbackSpeed: playbackSpeed || 1.0,
                  outputFormat: outputFormat
                }) + '\n';
                
              } else {

                
                finalResponse = JSON.stringify({
                  progress: 100,
                  status: 'completed',
                  filename: outputFilename,
                  size: formatFileSize(metadata.format.size),
                  duration: formatTime(metadata.format.duration),
                  bitrate: Math.round(metadata.format.bit_rate / 1000),
                  volumeProfile,
                  appliedVolume: volume,
                  customVolume: volumeProfile === "custom" ? customVolume : null,
                  playbackSpeed: playbackSpeed || 1.0,
                  outputFormat: outputFormat
                }) + '\n';
              }
              

              res.end(finalResponse);
              console.log('='.repeat(50));
              console.log('✅ MP3 CUT REQUEST COMPLETED SUCCESSFULLY');
              console.log(`📁 Output: ${outputFilename}`);
              console.log('='.repeat(50));

            });
          }, 300); // 300ms delay to ensure smooth progress animation
          
        } catch (error) {
          console.error("[END ERROR]", error);
          const errorResponse = JSON.stringify({ 
            progress: -1,
            status: 'error', 
            error: "Error after processing", 
            details: error.message 
          }) + '\n';
          res.end(errorResponse);
          console.log('='.repeat(50));
          console.log('❌ MP3 CUT REQUEST FAILED - END ERROR');
          console.log('='.repeat(50));
        }
      })
      .on("error", (err) => {
        console.error("[FFMPEG ERROR] Message:", err.message);
        console.error("[FFMPEG ERROR] Stack:", err.stack);
        console.error("[FFMPEG ERROR] Command that failed:", err.cmd || 'N/A');
        console.error("[FFMPEG ERROR] Applied filters were:", filters);
        
        cleanupFile(inputPath);
        
        const errorResponse = JSON.stringify({ 
          progress: -1,
          status: 'error',
          error: "Error processing audio",
          details: err.message,
          filters: filters,
          volumeProfile: volumeProfile,
          outputFormat: outputFormat
        }) + '\n';
        

        res.end(errorResponse);
        console.log('='.repeat(50));
        console.log('❌ MP3 CUT REQUEST FAILED - FFMPEG ERROR');
        console.log(`🔥 Error: ${err.message}`);
        console.log('='.repeat(50));
      });

    // Apply options in the correct order: FIRST trim, THEN apply filters
    ffmpegCommand
      // First trim the audio (input options for seeking)
      .inputOptions(`-ss ${startTime}`)
      .inputOptions(`-t ${duration}`)
      // Then apply audio filters to the trimmed segment
      .audioFilters(filters)
      // Set output options
      .outputOptions("-vn", "-sn")
      .outputOptions("-map_metadata", "-1");

    console.log('[FFMPEG] About to apply filters:', filters);

    // ===== FORMAT-SPECIFIC CODEC AND OPTIONS =====

    
    switch (outputFormat.toLowerCase()) {
      case 'mp3':

        ffmpegCommand
          .audioCodec("libmp3lame")
          .audioBitrate(192)
          .audioChannels(2)
          .outputOptions("-metadata", `title=MP3 Cut (${formatTime(duration)})`)
          .outputOptions("-metadata", "artist=MP3 Cutter Tool");
        break;
        
      case 'm4a':

        ffmpegCommand
          .audioCodec("aac")
          .audioBitrate(128)
          .audioChannels(2)
          .outputOptions("-f", "mp4")
          .outputOptions("-metadata", `title=M4A Cut (${formatTime(duration)})`)
          .outputOptions("-metadata", "artist=MP3 Cutter Tool");
        break;
        
      case 'm4r':

        ffmpegCommand
          .audioCodec("aac")
          .audioBitrate(128)
          .audioChannels(2)
          .outputOptions("-f", "mp4")
          .outputOptions("-metadata", `title=Ringtone (${formatTime(duration)})`)
          .outputOptions("-metadata", "artist=MP3 Cutter Tool");
        break;
        
      case 'wav':

        ffmpegCommand
          .audioCodec("pcm_s16le")
          .audioChannels(2)
          .outputOptions("-f", "wav")
          .outputOptions("-metadata", `title=WAV Cut (${formatTime(duration)})`)
          .outputOptions("-metadata", "artist=MP3 Cutter Tool");
        break;
        
      case 'aac':

        ffmpegCommand
          .audioCodec("aac")
          .audioBitrate(128)
          .audioChannels(2)
          .outputOptions("-f", "adts")
          .outputOptions("-metadata", `title=AAC Cut (${formatTime(duration)})`)
          .outputOptions("-metadata", "artist=MP3 Cutter Tool");
        break;
        
      case 'ogg':

        ffmpegCommand
          .audioCodec("libvorbis")
          .audioBitrate(128)
          .audioChannels(2)
          .outputOptions("-f", "ogg")
          .outputOptions("-metadata", `title=OGG Cut (${formatTime(duration)})`)
          .outputOptions("-metadata", "artist=MP3 Cutter Tool");
        break;
        
      default:

        ffmpegCommand
          .audioCodec("libmp3lame")
          .audioBitrate(192)
          .audioChannels(2)
          .outputOptions("-metadata", `title=Audio Cut (${formatTime(duration)})`)
          .outputOptions("-metadata", "artist=MP3 Cutter Tool");
        break;
    }

    console.log('[FFMPEG] About to run command with output path:', outputPath);

    // Run the command
    ffmpegCommand.output(outputPath).run();
    
  } catch (error) {
    console.error("[PROCESS ERROR]", error);
    cleanupFile(inputPath);
    
    const errorResponse = JSON.stringify({ 
      progress: -1,
      status: 'error',
      error: "Error setting up audio processing",
      details: error.message,
      outputFormat: outputFormat
    }) + '\n';
    

    res.end(errorResponse);
  }
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  else if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// API tạo share link


// API lấy thông tin share link (không download)
router.get("/share-info/:shareId", (req, res) => {

  
  try {
    const { shareId } = req.params;
    const shareData = shareLinks.get(shareId);
    
    if (!shareData) {
      return res.status(404).json({ 
        error: "Share link not found" 
      });
    }
    
    // Kiểm tra hết hạn
    if (new Date() > shareData.expiresAt) {
      shareLinks.delete(shareId);
      return res.status(410).json({ 
        error: "Share link has expired" 
      });
    }
    
    res.json({
      filename: shareData.filename,
      createdAt: shareData.createdAt,
      expiresAt: shareData.expiresAt,
      downloadCount: shareData.downloadCount,
      isValid: true
    });
    
  } catch (error) {
    console.error('[SHARE-INFO] Error:', error);
    res.status(500).json({ 
      error: "Failed to get share info",
      details: error.message 
    });
  }
});

module.exports = router;