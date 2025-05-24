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
    fileSize: 50 * 1024 * 1024 // 50MB
  },
  fileFilter: (req, file, cb) => {
    console.log('[MULTER] File filter check:', {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype
    });
    
    if (file.mimetype === "audio/mpeg" || file.mimetype === "audio/mp3") {
      console.log('[MULTER] File accepted:', file.mimetype);
      cb(null, true);
    } else {
      console.error('[MULTER] File rejected, invalid mimetype:', file.mimetype);
      cb(new Error(`Only MP3 files are allowed. Got: ${file.mimetype}`), false);
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
          details: 'Maximum file size is 50MB'
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
    const outputFormat = req.body?.outputFormat || "mp3";
    const fadeInDuration = parseFloat(req.body?.fadeInDuration || "3");
    const fadeOutDuration = parseFloat(req.body?.fadeOutDuration || "3");

    console.log('[PARAMS] Parsed:', { 
      startTime, endTime, volume, fadeIn, fadeOut, volumeProfile, 
      normalizeAudio, outputFormat, fadeInDuration, fadeOutDuration 
    });

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

    if (!["uniform", "fadeIn", "fadeOut", "fadeInOut", "custom"].includes(volumeProfile)) {
      cleanupFile(inputPath);
      return res.status(400).json({ error: "Invalid volume profile" });
    }

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

    // Setup output
    const outputDir = path.join(__dirname, "../output");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputFilename = `cut_${Date.now()}.${outputFormat}`;
    const outputPath = path.join(outputDir, outputFilename);
    const duration = endTime - startTime;

    console.log('[PROCESSING] Duration:', duration, 'seconds');

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
      volume // SỬA LỖI: Thêm volume parameter
    });

    // Add normalization
    if (normalizeAudio) {
      filters.push("loudnorm=I=-16:TP=-1.5:LRA=11");
    }

    console.log('[FILTERS] Final filters:', filters);

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

    // Process audio
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
      normalizeAudio
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
  try {
    // Luôn thêm volume filter cơ bản
    let volumeFilter;
    if (profile === "uniform") {
      volumeFilter = `volume=${volume.toFixed(2)}`;
    } else if (profile === "custom") {
      const start = Math.max(0.1, Math.min(3.0, customVolume.start));
      const middle = Math.max(0.1, Math.min(3.0, customVolume.middle));
      const end = Math.max(0.1, Math.min(3.0, customVolume.end));
      const averageVolume = ((start + middle + end) / 3) * volume;
      volumeFilter = `volume=${averageVolume.toFixed(2)}`;
    } else {
      // Cho các profile fade, vẫn thêm volume cơ bản
      volumeFilter = `volume=${volume.toFixed(2)}`;
    }
    
    // Thêm volume filter vào đầu mảng để đảm bảo nó được áp dụng trước fade
    filters.unshift(volumeFilter);
    console.log('[VOLUME] Added base volume filter:', volumeFilter);
    
  } catch (error) {
    console.error('[VOLUME ERROR]', error.message);
  }
}

// === GIẢI PHÁP CUỐI CÙNG: SIMPLE FADE EFFECTS ===
function addFadeEffects(filters, options) {
  const { fadeIn, fadeOut, fadeInDuration, fadeOutDuration, duration, volumeProfile, volume } = options;
  
  console.log('[FADE] ================== FADE EFFECTS DEBUG ==================');
  console.log('[FADE] Received options:', { fadeIn, fadeOut, fadeInDuration, fadeOutDuration, volumeProfile, duration, volume });
  console.log('[FADE] fadeInDuration type:', typeof fadeInDuration, 'value:', fadeInDuration);
  console.log('[FADE] fadeOutDuration type:', typeof fadeOutDuration, 'value:', fadeOutDuration);

  try {
    // Thêm fade filters sau volume filter
    const shouldApplyFadeIn = (["fadeIn", "fadeInOut"].includes(volumeProfile) || fadeIn === true);
    const shouldApplyFadeOut = (["fadeOut", "fadeInOut"].includes(volumeProfile) || fadeOut === true);
    
    if (shouldApplyFadeIn) {
      // Đảm bảo fadeInDuration hợp lệ
      const validFadeInDuration = isNaN(fadeInDuration) ? 3 : Math.max(0.1, Math.min(fadeInDuration, duration));
      const fadeInFilter = `afade=t=in:st=0:d=${validFadeInDuration}`;
      filters.push(fadeInFilter);
      console.log('[FADE] ✅ FADE IN FILTER ADDED!');
      console.log('[FADE] ✅ fadeInDuration used:', validFadeInDuration);
      console.log('[FADE] ✅ Filter string:', fadeInFilter);
    }
    
    if (shouldApplyFadeOut) {
      // Đảm bảo fadeOutDuration hợp lệ
      const validFadeOutDuration = isNaN(fadeOutDuration) ? 3 : Math.max(0.1, Math.min(fadeOutDuration, duration));
      const startFadeOut = Math.max(0, duration - validFadeOutDuration);
      const fadeOutFilter = `afade=t=out:st=${startFadeOut}:d=${validFadeOutDuration}`;
      filters.push(fadeOutFilter);
      console.log('[FADE] ✅ FADE OUT FILTER ADDED!');
      console.log('[FADE] ✅ fadeOutDuration used:', validFadeOutDuration);
      console.log('[FADE] ✅ Filter string:', fadeOutFilter);
    }
    
    if (!shouldApplyFadeIn && !shouldApplyFadeOut) {
      console.log('[FADE] ❌ No fadeIn/fadeOut enabled, no afade filter added.');
      console.log('[FADE] ❌ Debug: fadeIn =', fadeIn, ', fadeOut =', fadeOut, ', volumeProfile =', volumeProfile);
    }
    
    console.log('[FADE] =====================================');
  } catch (error) {
    console.error('[FADE ERROR]', error.message);
  }
}

function validateFilters(filters) {
  console.log('[VALIDATION] Checking filters:', filters);
  console.log('[VALIDATION] Using simple filter validation for compatibility');
  
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
    
    // === SIMPLE VALIDATION CHỈ CHO BASIC FILTERS ===
    if (f.startsWith('volume=')) {
      console.log(`[VALIDATION] Filter ${i} is simple volume filter`);
      
      // Extract volume value
      const volumeValue = f.split('=')[1];
      const numValue = parseFloat(volumeValue);
      
      if (isNaN(numValue)) {
        console.error(`[VALIDATION ERROR] Invalid volume value in filter ${i}:`, volumeValue);
        throw new Error(`Invalid volume value: ${volumeValue}`);
      }
      
      if (numValue < 0 || numValue > 5) {
        console.warn(`[VALIDATION WARNING] Volume value outside normal range in filter ${i}:`, numValue);
      }
      
      console.log(`[VALIDATION] Simple volume filter ${i} validated: ${numValue}`);
    } 
    else if (f.includes("volume='")) {
      // Complex expression detected - should not happen in compatibility mode
      console.error(`[VALIDATION ERROR] Complex volume expression detected in filter ${i}:`, f);
      throw new Error(`Complex volume expression not supported in compatibility mode: "${f}"`);
    }    else if (f.startsWith('afade=')) {
      console.log(`[VALIDATION] Filter ${i} is afade filter - validated`);
      
      // Validate afade syntax
      if (f.includes('t=in') || f.includes('t=out')) {
        console.log(`[VALIDATION] afade filter ${i} has valid fade type`);
      } else {
        console.warn(`[VALIDATION WARNING] afade filter ${i} missing fade type:`, f);
      }
    }
    else if (f.startsWith('loudnorm')) {
      console.log(`[VALIDATION] Filter ${i} is loudnorm filter - validated`);
    }
    else {
      console.warn(`[VALIDATION WARNING] Unknown filter type in filter ${i}:`, f);
    }
  }
  
  console.log('[VALIDATION] All filters validated successfully, count:', filters.length);
}

function processAudio(options) {
  const {
    inputPath, outputPath, startTime, duration, filters, outputFormat,
    res, outputFilename, volumeProfile, volume, customVolume, normalizeAudio
  } = options;
  
  try {
      validateFilters(filters);
      console.log('[FFMPEG] Starting processing with CORRECT ORDER: trim first, then apply filters');
      console.log('[FFMPEG] Input:', inputPath);
      console.log('[FFMPEG] Output:', outputPath);
      console.log('[FFMPEG] Trim: start =', startTime, 'duration =', duration);
      console.log('[FFMPEG] Filters:', filters);

    // Build FFmpeg command with correct filter order
    const ffmpegCommand = ffmpeg()
      .input(inputPath)
      .inputOptions([])
      .outputOptions([])
      .on("start", (cmd) => {
        console.log("[FFMPEG] Command:", cmd);
      })
      .on("progress", (progress) => {
        console.log(`[FFMPEG] Progress: ${progress.percent ? progress.percent.toFixed(1) + '%' : 'N/A'}`);
      })
      .on("end", () => {
        try {
          cleanupFile(inputPath);
          if (!fs.existsSync(outputPath)) {
            throw new Error("Output file was not created");
          }
          console.log('[SUCCESS] File created:', outputPath);
          ffmpeg.ffprobe(outputPath, (err, metadata) => {
            if (err) {
              console.error("[FFPROBE ERROR]", err);
              const fileStats = fs.statSync(outputPath);
              return res.json({
                filename: outputFilename,
                size: formatFileSize(fileStats.size),
                duration: formatTime(duration),
                bitrate: 192,
                volumeProfile,
                appliedVolume: volume,
                customVolume: volumeProfile === "custom" ? customVolume : null
              });
            }
            res.json({
              filename: outputFilename,
              size: formatFileSize(metadata.format.size),
              duration: formatTime(metadata.format.duration),
              bitrate: Math.round(metadata.format.bit_rate / 1000),
              volumeProfile,
              appliedVolume: volume,
              customVolume: volumeProfile === "custom" ? customVolume : null
            });
          });
        } catch (error) {
          console.error("[END ERROR]", error);
          if (!res.headersSent) {
            res.status(500).json({ error: "Error after processing", details: error.message });
          }
        }
      })
      .on("error", (err) => {
        console.error("[FFMPEG ERROR] Message:", err.message);
        console.error("[FFMPEG ERROR] Stack:", err.stack);
        console.error("[FFMPEG ERROR] Command that failed:", err.cmd || 'N/A');
        cleanupFile(inputPath);
        if (!res.headersSent) {
          res.status(500).json({ 
            error: "Error processing audio",
            details: err.message,
            filters: filters,
            volumeProfile: volumeProfile
          });
        }
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
      .outputOptions("-map_metadata", "-1")
      .audioCodec("libmp3lame")
      .audioBitrate(192)
      .audioChannels(2)
      .outputOptions("-metadata", `title=MP3 Cut (${formatTime(duration)})`)
      .outputOptions("-metadata", "artist=MP3 Cutter Tool");

    // Run the command
    ffmpegCommand.output(outputPath).run();
  } catch (error) {
    console.error("[PROCESS ERROR]", error);
    cleanupFile(inputPath);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: "Error setting up audio processing",
        details: error.message 
      });
    }
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

module.exports = router;