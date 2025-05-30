console.log("🟩 File mp3.js ĐÃ ĐƯỢC LOAD");
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const ffprobePath = require("@ffprobe-installer/ffprobe").path;
const ffmpeg = require("fluent-ffmpeg");
// SAU KHI KHAI BÁO ffmpeg THÌ MỚI SET PATH
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

console.log("✅ FFmpeg path:", ffmpegPath);
console.log("✅ FFprobe path:", ffprobePath);

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
      console.log('[MULTER] ✅ File accepted:', normalizedMimeType);
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
  console.log('\n=== NEW REQUEST ===');
  console.log('[REQUEST] Method:', req.method, 'URL:', req.url);
  console.log('[REQUEST] Content-Type:', req.get('Content-Type'));
  console.log('[REQUEST] Content-Length:', req.get('Content-Length'));
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
  console.log('[CUT-MP3] Request processing started');
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

    console.log('[INFO] File validated, size:', fs.statSync(inputPath).size, 'bytes');

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

    // ENHANCED: Log format processing
    console.log('[FORMAT] Raw outputFormat from request:', req.body?.outputFormat);
    console.log('[FORMAT] Processed outputFormat:', outputFormat);
    console.log('[FORMAT] Supported formats:', ['mp3', 'm4a', 'm4r', 'wav', 'aac', 'ogg']);

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

    console.log('[FORMAT] ✅ Format validated:', outputFormat);

    // === VALIDATE SPEED PARAMETER ===
    console.log('[SPEED] Raw speed from request:', req.body?.speed);
    console.log('[SPEED] Parsed speed value:', playbackSpeed);
    console.log('[SPEED] Speed type:', typeof playbackSpeed);
    console.log('[SPEED] isNaN(playbackSpeed):', isNaN(playbackSpeed));

    if (isNaN(playbackSpeed) || playbackSpeed < 0.25 || playbackSpeed > 4.0) {
      cleanupFile(inputPath);
      console.error('[SPEED ERROR] Invalid speed value:', playbackSpeed);
      return res.status(400).json({ 
        error: "Speed must be between 0.25 and 4.0",
        received: playbackSpeed
      });
    }

    console.log('[SPEED] ✅ Speed validated:', playbackSpeed + 'x');

    // === DEBUG CHI TIẾT CHO FADE DURATION ===
    console.log('[DEBUG FADE DURATION] Raw request body fade values:');
    console.log('[DEBUG FADE DURATION] - req.body.fadeInDuration (raw):', req.body?.fadeInDuration);
    console.log('[DEBUG FADE DURATION] - req.body.fadeOutDuration (raw):', req.body?.fadeOutDuration);
    console.log('[DEBUG FADE DURATION] - Type of fadeInDuration raw:', typeof req.body?.fadeInDuration);
    console.log('[DEBUG FADE DURATION] - Type of fadeOutDuration raw:', typeof req.body?.fadeOutDuration);
    console.log('[DEBUG FADE DURATION] - Parsed fadeInDuration:', fadeInDuration);
    console.log('[DEBUG FADE DURATION] - Parsed fadeOutDuration:', fadeOutDuration);
    console.log('[DEBUG FADE DURATION] - isNaN(fadeInDuration):', isNaN(fadeInDuration));
    console.log('[DEBUG FADE DURATION] - isNaN(fadeOutDuration):', isNaN(fadeOutDuration));

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
    if ((fadeIn || volumeProfile === "fadeIn" || volumeProfile === "fadeInOut") && 
    (isNaN(fadeInDuration) || fadeInDuration < 0.1 || fadeInDuration > 30)) {
    cleanupFile(inputPath);
    return res.status(400).json({ 
    error: "Fade In duration must be between 0.1 and 30 seconds",
    received: fadeInDuration
    });
    }

    if ((fadeOut || volumeProfile === "fadeOut" || volumeProfile === "fadeInOut") && 
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

    console.log('[PROCESSING] Duration:', duration, 'seconds');
    console.log('[PROCESSING] Output filename:', outputFilename);
    console.log('[PROCESSING] Output path:', outputPath);
    console.log('[PROCESSING] Expected file extension:', outputFormat);

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
    console.log('[PROCESSING] Adding speed filters...');
    addSpeedFilters(filters, playbackSpeed);

    // Add normalization
    if (normalizeAudio) {
      filters.push("loudnorm=I=-16:TP=-1.5:LRA=11");
    }

    console.log('[FILTERS] Final filters with speed:', filters);

    // === THÊM VALIDATION CHI TIẾT CHO FILTERS ===
    console.log('[FILTER SYNTAX CHECK] Validating each filter...');
    for (let i = 0; i < filters.length; i++) {
      const filter = filters[i];
      console.log(`[FILTER ${i}] "${filter}"`);
      
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
  }
});

// === ADD SPEED FILTER FUNCTION ===
function addSpeedFilters(filters, speed) {
  console.log('[SPEED] ================== SPEED FILTER LOGIC ==================');
  console.log('[SPEED] Input speed:', speed);
  
  if (speed === 1.0) {
    console.log('[SPEED] Speed is 1.0x - no speed filter needed');
    return;
  }
  
  try {
    // FFmpeg atempo filter có giới hạn 0.5-2.0
    // Nếu speed ngoài giới hạn này, cần chain nhiều atempo filters
    
    if (speed >= 0.5 && speed <= 2.0) {
      // Trường hợp đơn giản: 1 atempo filter
      const speedFilter = `atempo=${speed.toFixed(3)}`;
      filters.push(speedFilter);
      console.log('[SPEED] ✅ Single atempo filter applied:', speedFilter);
      
    } else if (speed > 2.0 && speed <= 4.0) {
      // Tốc độ > 2.0: chain 2 atempo filters
      const factor1 = 2.0;
      const factor2 = speed / 2.0;
      
      const speedFilter1 = `atempo=${factor1.toFixed(3)}`;
      const speedFilter2 = `atempo=${factor2.toFixed(3)}`;
      
      filters.push(speedFilter1);
      filters.push(speedFilter2);
      
      console.log('[SPEED] ✅ Chained atempo filters for high speed:');
      console.log('[SPEED] - Filter 1:', speedFilter1);
      console.log('[SPEED] - Filter 2:', speedFilter2);
      console.log('[SPEED] - Total speed:', (factor1 * factor2).toFixed(3) + 'x');
      
    } else if (speed < 0.5 && speed >= 0.25) {
      // Tốc độ < 0.5: chain 2 atempo filters
      const factor1 = 0.5;
      const factor2 = speed / 0.5;
      
      const speedFilter1 = `atempo=${factor1.toFixed(3)}`;
      const speedFilter2 = `atempo=${factor2.toFixed(3)}`;
      
      filters.push(speedFilter1);
      filters.push(speedFilter2);
      
      console.log('[SPEED] ✅ Chained atempo filters for low speed:');
      console.log('[SPEED] - Filter 1:', speedFilter1);
      console.log('[SPEED] - Filter 2:', speedFilter2);
      console.log('[SPEED] - Total speed:', (factor1 * factor2).toFixed(3) + 'x');
      
    } else {
      console.error('[SPEED] Speed value outside supported range:', speed);
      throw new Error(`Speed ${speed} is outside supported range (0.25-4.0)`);
    }
    
  } catch (error) {
    console.error('[SPEED ERROR]', error.message);
    throw error;
  }
  
  console.log('[SPEED] =======================================================');
}

// Helper functions
function cleanupFile(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      console.log('[CLEANUP] Deleted:', filePath);
    } catch (error) {
      console.error("[CLEANUP ERROR]", error.message);
    }
  }
}

// === GIẢI PHÁP CUỐI CÙNG: SỬ DỤNG SIMPLE VOLUME FILTERS ===
function addVolumeProfileFilter(filters, profile, volume, duration, customVolume, fadeIn = false, fadeOut = false) {
  console.log('[VOLUME] Processing profile:', profile, 'fadeIn:', fadeIn, 'fadeOut:', fadeOut);
  console.log('[VOLUME] Custom volume data:', customVolume);
  
  try {
    if (profile === "uniform") {
      // Volume đồng đều
      const volumeFilter = `volume=${volume.toFixed(2)}`;
      filters.unshift(volumeFilter);
      console.log('[VOLUME] ✅ Uniform volume filter:', volumeFilter);
      
    } else if (profile === "custom") {
      // === CUSTOM VOLUME CURVE - SỬ DỤNG APPROACH AN TOÀN HỚN ===
      const start = Math.max(0.1, Math.min(3.0, customVolume.start));
      const middle = Math.max(0.1, Math.min(3.0, customVolume.middle));
      const end = Math.max(0.1, Math.min(3.0, customVolume.end));
      
      console.log('[VOLUME] 🎯 CUSTOM VOLUME CURVE:');
      console.log('[VOLUME] - Start volume:', start + 'x');
      console.log('[VOLUME] - Middle volume:', middle + 'x');
      console.log('[VOLUME] - End volume:', end + 'x');
      console.log('[VOLUME] - Base multiplier:', volume + 'x');
      
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
      
      console.log('[VOLUME] ✅ Custom volume expression created');
      console.log('[VOLUME] ✅ Midpoint:', midpoint, 'seconds');
      console.log('[VOLUME] ✅ Volume progression:', startVol, '→', middleVol, '→', endVol);
      console.log('[VOLUME] ✅ Expression length:', expression.length, 'characters');
      console.log('[VOLUME] ✅ Filter validation-ready');
      
    } else {
      // Các profile fade khác
      const volumeFilter = `volume=${volume.toFixed(2)}`;
      filters.unshift(volumeFilter);
      console.log('[VOLUME] ✅ Base volume for', profile, 'profile:', volumeFilter);
    }
    
  } catch (error) {
    console.error('[VOLUME ERROR]', error.message);
    console.error('[VOLUME ERROR] Falling back to simple volume');
    
    // Fallback: simple volume nếu có lỗi
    const fallbackVolume = `volume=${volume.toFixed(2)}`;
    filters.unshift(fallbackVolume);
    console.log('[VOLUME] ⚠️ Fallback volume filter:', fallbackVolume);
  }
}

// === GIẢI PHÁP CUỐI CÙNG: SIMPLE FADE EFFECTS ===
function addFadeEffects(filters, options) {
  const { fadeIn, fadeOut, fadeInDuration, fadeOutDuration, duration, volumeProfile, volume } = options;
  
  console.log('[FADE] ================== PRIORITY FADE LOGIC ==================');
  console.log('[FADE] Input options:', { fadeIn, fadeOut, fadeInDuration, fadeOutDuration, volumeProfile, duration, volume });
  console.log('[FADE] fadeIn flag (boolean):', fadeIn, typeof fadeIn);
  console.log('[FADE] fadeOut flag (boolean):', fadeOut, typeof fadeOut);
  console.log('[FADE] fadeInDuration (number):', fadeInDuration, typeof fadeInDuration);
  console.log('[FADE] fadeOutDuration (number):', fadeOutDuration, typeof fadeOutDuration);

  try {
      // === PRIORITY 1: FADE FLAGS (CHECKBOX 2S) - HIGHEST PRIORITY ===
      const shouldApplyFadeInFlag = fadeIn === true;
      const shouldApplyFadeOutFlag = fadeOut === true;
      
      console.log('[FADE] 🚨 CHECKING FADE FLAGS:');
      console.log('[FADE] shouldApplyFadeInFlag:', shouldApplyFadeInFlag);
      console.log('[FADE] shouldApplyFadeOutFlag:', shouldApplyFadeOutFlag);
      
      if (shouldApplyFadeInFlag || shouldApplyFadeOutFlag) {
          console.log('[FADE] 🚨 PRIORITY 1: FADE FLAGS DETECTED - OVERRIDING ALL VOLUME PROFILES');
          
          if (shouldApplyFadeInFlag) {
              const forcedFadeInDuration = 2.0; // Always 2 seconds for checkbox
              let actualFadeInDuration = Math.min(forcedFadeInDuration, Math.max(0.5, duration - 0.5));
              
              const fadeInFilter = `afade=t=in:st=0:d=${actualFadeInDuration}`;
              filters.push(fadeInFilter);
              
              console.log('[FADE] ✅ PRIORITY FLAG FadeIn: FORCED 2s duration');
              console.log('[FADE] ✅ Applied duration:', actualFadeInDuration, 'seconds');
              console.log('[FADE] ✅ Filter string:', fadeInFilter);
          }
          
          if (shouldApplyFadeOutFlag) {
              const forcedFadeOutDuration = 2.0; // Always 2 seconds for checkbox
              let actualFadeOutDuration = Math.min(forcedFadeOutDuration, Math.max(0.5, duration - 0.5));
              
              const startFadeOut = Math.max(0, duration - actualFadeOutDuration);
              const fadeOutFilter = `afade=t=out:st=${startFadeOut}:d=${actualFadeOutDuration}`;
              filters.push(fadeOutFilter);
              
              console.log('[FADE] ✅ PRIORITY FLAG FadeOut: FORCED 2s duration');
              console.log('[FADE] ✅ Applied duration:', actualFadeOutDuration, 'seconds');
              console.log('[FADE] ✅ Filter string:', fadeOutFilter);
          }
          
          console.log('[FADE] 🎯 FADE FLAGS PROCESSED - IGNORING ALL OTHER SETTINGS');
          console.log('[FADE] =======================================================');
          return; // CRITICAL: Exit immediately, ignore all volume profile settings
      }
      
      console.log('[FADE] ℹ️ No fade flags detected, processing volume profile settings...');
      
      // === PRIORITY 2: VOLUME PROFILE SETTINGS (ONLY IF NO FADE FLAGS) ===
      
      if (volumeProfile === "fadeIn") {
          const fadeInFilter = `afade=t=in:st=0:d=${duration}`;
          filters.push(fadeInFilter);
          
          console.log('[FADE] 🎯 VOLUME PROFILE: fadeIn');
          console.log('[FADE] ✅ Fade trong TOÀN BỘ duration:', duration, 'seconds');
          console.log('[FADE] ✅ Filter string:', fadeInFilter);
          return;
      }
      
      if (volumeProfile === "fadeOut") {
          const fadeOutFilter = `afade=t=out:st=0:d=${duration}`;
          filters.push(fadeOutFilter);
          
          console.log('[FADE] 🎯 VOLUME PROFILE: fadeOut');
          console.log('[FADE] ✅ Filter string:', fadeOutFilter);
          return;
      }
      
      if (volumeProfile === "fadeInOut") {
          let userFadeInDuration = isNaN(fadeInDuration) ? 3 : Math.max(0.1, fadeInDuration);
          let userFadeOutDuration = isNaN(fadeOutDuration) ? 3 : Math.max(0.1, fadeOutDuration);
          
          if (userFadeInDuration >= duration) userFadeInDuration = Math.max(0.5, duration - 0.5);
          if (userFadeOutDuration >= duration) userFadeOutDuration = Math.max(0.5, duration - 0.5);
          
          const fadeInFilter = `afade=t=in:st=0:d=${userFadeInDuration}`;
          const startFadeOut = Math.max(0, duration - userFadeOutDuration);
          const fadeOutFilter = `afade=t=out:st=${startFadeOut}:d=${userFadeOutDuration}`;
          
          filters.push(fadeInFilter);
          filters.push(fadeOutFilter);
          
          console.log('[FADE] 🎯 VOLUME PROFILE: fadeInOut');
          console.log('[FADE] ✅ FadeIn filter:', fadeInFilter);
          console.log('[FADE] ✅ FadeOut filter:', fadeOutFilter);
          return;
      }
      
      // CRITICAL FIX: Chỉ áp dụng fade trong custom profile khi có explicit user request
      if (volumeProfile === "custom") {
          console.log('[FADE] 🎯 VOLUME PROFILE: custom');
          console.log('[FADE] ✅ Custom volume curve được xử lý bởi addVolumeProfileFilter()');
          
          // IMPORTANT: Không tự động áp dụng fade dựa trên duration values
          // Chỉ áp dụng khi có explicit request từ user (không phải từ toggle off)
          console.log('[FADE] ✅ Custom profile: Chỉ custom volume curve, KHÔNG tự động fade');
          return;
      }
      
      console.log('[FADE] 🎯 VOLUME PROFILE: uniform - no fade effects applied');
      console.log('[FADE] =======================================================');
      
  } catch (error) {
      console.error('[FADE ERROR]', error.message);
      console.error('[FADE ERROR] Stack:', error.stack);
  }
}

function validateFilters(filters) {
  console.log('[VALIDATION] Checking filters:', filters);
  console.log('[VALIDATION] Using enhanced filter validation with custom volume support');
  
  if (!Array.isArray(filters) || filters.length === 0) {
    console.error('[VALIDATION ERROR] No filters provided');
    throw new Error("No audio filter is set");
  }
  
  for (let i = 0; i < filters.length; i++) {
    const f = filters[i];
    console.log(`[VALIDATION] Filter ${i}: "${f}"`);
    
    if (typeof f !== 'string' || !f.trim()) {
      console.error('[VALIDATION ERROR] Invalid filter at index', i, ':', f);
      throw new Error("Invalid filter detected: " + f);
    }
    
    // === ENHANCED VALIDATION VỚI CUSTOM VOLUME SUPPORT ===
    if (f.startsWith('volume=')) {
      console.log(`[VALIDATION] Filter ${i} is volume filter`);
      
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
        
        console.log(`[VALIDATION] ✅ Simple volume filter ${i} validated: ${numValue}`);
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
        
        console.log(`[VALIDATION] ✅ Complex volume expression filter ${i} validated`);
        console.log(`[VALIDATION] Expression preview:`, expression.substring(0, 50) + (expression.length > 50 ? '...' : ''));
      }
      else {
        console.error(`[VALIDATION ERROR] Unrecognized volume filter format in filter ${i}:`, volumeValue);
        throw new Error(`Unrecognized volume filter format: ${volumeValue}`);
      }
    }
    else if (f.startsWith('afade=')) {
      console.log(`[VALIDATION] Filter ${i} is afade filter`);
      
      // Validate afade syntax
      if (f.includes('t=in') || f.includes('t=out')) {
        console.log(`[VALIDATION] ✅ afade filter ${i} has valid fade type`);
      } else {
        console.warn(`[VALIDATION WARNING] afade filter ${i} missing fade type:`, f);
      }
    }
    else if (f.startsWith('loudnorm')) {
  console.log(`[VALIDATION] ✅ Filter ${i} is loudnorm filter - validated`);
}
else if (f.startsWith('atempo=')) {
  console.log(`[VALIDATION] Filter ${i} is atempo (speed) filter`);
  
  const tempoValue = f.split('=')[1];
  const numValue = parseFloat(tempoValue);
  
  if (isNaN(numValue) || numValue < 0.5 || numValue > 2.0) {
    console.error(`[VALIDATION ERROR] Invalid atempo value in filter ${i}:`, tempoValue);
    throw new Error(`Invalid atempo value: ${tempoValue}. Must be between 0.5 and 2.0`);
  }
  
  console.log(`[VALIDATION] ✅ atempo filter ${i} validated: ${numValue}x`);
}
else {
  console.warn(`[VALIDATION WARNING] Unknown filter type in filter ${i}:`, f);
  // Không throw error cho unknown filters, có thể là valid FFmpeg filters khác
}
  }
  
  console.log('[VALIDATION] ✅ All filters validated successfully, count:', filters.length);
}

function processAudio(options) {
  const {
    inputPath, outputPath, startTime, duration, filters, outputFormat,
    res, outputFilename, volumeProfile, volume, customVolume, normalizeAudio, playbackSpeed
  } = options;
  
  try {
    validateFilters(filters);
    console.log('[FFMPEG] Starting processing with CORRECT ORDER: trim first, then apply filters');
    console.log('[FFMPEG] Input:', inputPath);
    console.log('[FFMPEG] Output:', outputPath);
    console.log('[FFMPEG] Output Format:', outputFormat);
    console.log('[FFMPEG] Trim: start =', startTime, 'duration =', duration);
    console.log('[FFMPEG] Filters:', filters);

    // Set response headers for streaming
    if (!res.headersSent) {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });
      console.log('[FFMPEG] Response headers set for streaming');
    }

    let lastProgressSent = 0; // Track last progress sent

    // Build FFmpeg command with correct filter order
    const ffmpegCommand = ffmpeg()
      .input(inputPath)
      .inputOptions([])
      .outputOptions([])
      .on("start", (cmd) => {
        console.log("[FFMPEG] Command:", cmd);
        console.log("[FFMPEG] Processing started - sending initial progress...");
        
        // Send initial progress
        const initialProgress = JSON.stringify({ 
          progress: 0, 
          status: 'started',
          message: 'Processing started...' 
        }) + '\n';
        
        res.write(initialProgress);
        console.log("[FFMPEG] Initial progress sent:", initialProgress.trim());
        lastProgressSent = 0;
      })
      .on("progress", (progress) => {
        let percent = Math.round(progress.percent || 0);
        // Ensure progress doesn't exceed 95% during processing
        percent = Math.min(percent, 95);
        
        console.log(`[FFMPEG] Progress: ${percent}%`);
        
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
              console.log(`[FFMPEG] Progress update sent: ${percent}%`);
            } catch (writeError) {
              console.error("[FFMPEG] Error writing progress:", writeError);
            }
          }
        }
      })
      .on("end", () => {
        try {
          console.log('[FFMPEG] Processing completed, sending 100% progress...');
          
          // CRITICAL: Send 100% progress before final response
          if (res.writable) {
            const completionProgress = JSON.stringify({ 
              progress: 100, 
              status: 'processing',
              message: 'Processing... 100%' 
            }) + '\n';
            
            res.write(completionProgress);
            console.log('[FFMPEG] 100% progress sent');
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
            return;
          }
          
          console.log('[SUCCESS] File created:', outputPath);
          
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
                console.log('[FFPROBE] Metadata retrieved successfully');
                
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
              
              console.log('[SUCCESS] Sending final response:', finalResponse.trim());
              res.end(finalResponse);
              console.log('[SUCCESS] Response completed successfully');
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
        }
      })
      .on("error", (err) => {
        console.error("[FFMPEG ERROR] Message:", err.message);
        console.error("[FFMPEG ERROR] Stack:", err.stack);
        console.error("[FFMPEG ERROR] Command that failed:", err.cmd || 'N/A');
        
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
        
        console.log("[FFMPEG ERROR] Sending error response:", errorResponse.trim());
        res.end(errorResponse);
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

    // ===== FORMAT-SPECIFIC CODEC AND OPTIONS =====
    console.log('[FFMPEG] Configuring codec for format:', outputFormat);
    
    switch (outputFormat.toLowerCase()) {
      case 'mp3':
        console.log('[FFMPEG] Setting MP3 codec and options');
        ffmpegCommand
          .audioCodec("libmp3lame")
          .audioBitrate(192)
          .audioChannels(2)
          .outputOptions("-metadata", `title=MP3 Cut (${formatTime(duration)})`)
          .outputOptions("-metadata", "artist=MP3 Cutter Tool");
        break;
        
      case 'm4a':
        console.log('[FFMPEG] Setting M4A codec and options');
        ffmpegCommand
          .audioCodec("aac")
          .audioBitrate(128)
          .audioChannels(2)
          .outputOptions("-f", "mp4")
          .outputOptions("-metadata", `title=M4A Cut (${formatTime(duration)})`)
          .outputOptions("-metadata", "artist=MP3 Cutter Tool");
        break;
        
      case 'm4r':
        console.log('[FFMPEG] Setting M4R (iPhone Ringtone) codec and options');
        ffmpegCommand
          .audioCodec("aac")
          .audioBitrate(128)
          .audioChannels(2)
          .outputOptions("-f", "mp4")
          .outputOptions("-metadata", `title=Ringtone (${formatTime(duration)})`)
          .outputOptions("-metadata", "artist=MP3 Cutter Tool");
        break;
        
      case 'wav':
        console.log('[FFMPEG] Setting WAV codec and options');
        ffmpegCommand
          .audioCodec("pcm_s16le")
          .audioChannels(2)
          .outputOptions("-f", "wav")
          .outputOptions("-metadata", `title=WAV Cut (${formatTime(duration)})`)
          .outputOptions("-metadata", "artist=MP3 Cutter Tool");
        break;
        
      case 'aac':
        console.log('[FFMPEG] Setting AAC codec and options');
        ffmpegCommand
          .audioCodec("aac")
          .audioBitrate(128)
          .audioChannels(2)
          .outputOptions("-f", "adts")
          .outputOptions("-metadata", `title=AAC Cut (${formatTime(duration)})`)
          .outputOptions("-metadata", "artist=MP3 Cutter Tool");
        break;
        
      case 'ogg':
        console.log('[FFMPEG] Setting OGG codec and options');
        ffmpegCommand
          .audioCodec("libvorbis")
          .audioBitrate(128)
          .audioChannels(2)
          .outputOptions("-f", "ogg")
          .outputOptions("-metadata", `title=OGG Cut (${formatTime(duration)})`)
          .outputOptions("-metadata", "artist=MP3 Cutter Tool");
        break;
        
      default:
        console.log('[FFMPEG] Unknown format, defaulting to MP3');
        ffmpegCommand
          .audioCodec("libmp3lame")
          .audioBitrate(192)
          .audioChannels(2)
          .outputOptions("-metadata", `title=Audio Cut (${formatTime(duration)})`)
          .outputOptions("-metadata", "artist=MP3 Cutter Tool");
        break;
    }

    console.log('[FFMPEG] Codec configuration completed for:', outputFormat);

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
    
    console.log("[PROCESS ERROR] Sending error response:", errorResponse.trim());
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
  console.log('[SHARE-INFO] Request for shareId:', req.params.shareId);
  
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