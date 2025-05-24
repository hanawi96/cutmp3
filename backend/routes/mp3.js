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

// Middleware xử lý lỗi Multer
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

// === MAIN ROUTE ===
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

    // Validate fade durations
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

    const duration = endTime - startTime;
    console.log('[VALIDATION] ✅ Fade durations validated:', { 
      fadeInDuration, 
      fadeOutDuration, 
      fileDuration: duration,
      fadeInPercent: ((fadeInDuration / duration) * 100).toFixed(1) + '%',
      fadeOutPercent: ((fadeOutDuration / duration) * 100).toFixed(1) + '%'
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

    // Setup output
    const outputDir = path.join(__dirname, "../output");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputFilename = `cut_${Date.now()}.${outputFormat}`;
    const outputPath = path.join(outputDir, outputFilename);

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
      volume
    });

    // Add normalization
    if (normalizeAudio) {
      filters.push("loudnorm=I=-16:TP=-1.5:LRA=11");
    }

    console.log('[FILTERS] Final filters:', filters);

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

// === HELPER FUNCTIONS ===
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

// === MODERN AUDIO PROCESSING ===
function addVolumeProfileFilter(filters, profile, volume, duration, customVolume, fadeIn = false, fadeOut = false) {
  console.log('[MODERN AUDIO] Using advanced audio processing techniques');
  console.log('[MODERN AUDIO] Profile:', profile, 'Duration:', duration, 'seconds');
  console.log('[MODERN AUDIO] Custom volume data:', customVolume);
  
  try {
    if (profile === "uniform") {
      const volumeFilter = `volume=${volume.toFixed(2)}`;
      filters.unshift(volumeFilter);
      console.log('[MODERN AUDIO] ✅ Uniform volume filter:', volumeFilter);
      
    } else if (profile === "custom") {
      const start = Math.max(0.001, Math.min(3.0, customVolume.start));
      const middle = Math.max(0.001, Math.min(3.0, customVolume.middle));  
      const end = Math.max(0.001, Math.min(3.0, customVolume.end));
      
      console.log('[MODERN AUDIO] 🎯 ADVANCED SEGMENTATION:');
      console.log('[MODERN AUDIO] - Start volume:', start + 'x');
      console.log('[MODERN AUDIO] - Middle volume:', middle + 'x');
      console.log('[MODERN AUDIO] - End volume:', end + 'x');
      
      const totalVol = volume;
      const startVol = (start * totalVol).toFixed(4);
      const middleVol = (middle * totalVol).toFixed(4);
      const endVol = (end * totalVol).toFixed(4);
      
      if (Math.abs(parseFloat(middleVol)) < 0.01) {
        // === SPECIAL CASE: NEAR-SILENCE HANDLING ===
        console.log('[MODERN AUDIO] 🔇 NEAR-SILENCE DETECTED - Using Single Comprehensive Filter');
        
        const phase1 = (duration * 0.3).toFixed(3);
        const phase2 = (duration * 0.45).toFixed(3);
        const phase3 = (duration * 0.55).toFixed(3);
        const phase4 = (duration * 0.7).toFixed(3);
        
        const transitionVol = (parseFloat(startVol) * 0.1).toFixed(4);
        
        const expression = `if(lt(t,${phase1}),${startVol},if(lt(t,${phase2}),${transitionVol},if(lt(t,${phase3}),0.001,if(lt(t,${phase4}),${transitionVol},${endVol}))))`;
        
        const volumeFilter = `volume='${expression}'`;
        filters.unshift(volumeFilter);
        
        console.log('[MODERN AUDIO] ✅ Single comprehensive near-silence filter');
        console.log('[MODERN AUDIO] ✅ Expression:', expression);
        
      } else {
        // === COMPLETELY REWRITTEN: SAFE STEP PROCESSING ===
        console.log('[MODERN AUDIO] 🔧 Building safe step-based volume curve...');
        
        // Always use safe 5-step approach to avoid parentheses complexity
        const stepCount = 5; // Reduced to ensure simplicity
        const steps = [];
        
        for (let i = 0; i < stepCount; i++) {
          const timePoint = (duration * i / (stepCount - 1)).toFixed(3);
          let volumeAtPoint;
          
          const progress = i / (stepCount - 1);
          if (progress <= 0.5) {
            const localProgress = progress * 2;
            volumeAtPoint = parseFloat(startVol) + (parseFloat(middleVol) - parseFloat(startVol)) * localProgress;
          } else {
            const localProgress = (progress - 0.5) * 2;
            volumeAtPoint = parseFloat(middleVol) + (parseFloat(endVol) - parseFloat(middleVol)) * localProgress;
          }
          
          steps.push({
            time: timePoint,
            volume: volumeAtPoint.toFixed(4)
          });
        }
        
        console.log('[MODERN AUDIO] 🔧 Generated', stepCount, 'steps:', steps.map(s => `t=${s.time}:v=${s.volume}`).join(', '));
        
        // === NEW: MANUAL EXPRESSION BUILDING WITH EXPLICIT PARENTHESES CONTROL ===
        let expression = '';
        
        // Build expression step by step với explicit control
        if (stepCount === 5) {
          // For 5 steps: 4 if conditions + 1 final value = 4 opening parentheses
          expression = `if(lt(t,${steps[1].time}),${steps[0].volume},if(lt(t,${steps[2].time}),${steps[1].volume},if(lt(t,${steps[3].time}),${steps[2].volume},if(lt(t,${steps[4].time}),${steps[3].volume},${steps[4].volume}))))`;
        }
        
        // === MANDATORY PARENTHESES VALIDATION ===
        const openCount = (expression.match(/\(/g) || []).length;
        const closeCount = (expression.match(/\)/g) || []).length;
        
        console.log('[MODERN AUDIO] 🔍 PRE-VALIDATION:');
        console.log('[MODERN AUDIO] 🔍 Expression:', expression);
        console.log('[MODERN AUDIO] 🔍 Open parentheses:', openCount);
        console.log('[MODERN AUDIO] 🔍 Close parentheses:', closeCount);
        console.log('[MODERN AUDIO] 🔍 Length:', expression.length, 'chars');
        
        if (openCount !== closeCount) {
          console.error('[MODERN AUDIO] ❌ CRITICAL: Pre-validation failed - parentheses mismatch!');
          console.error('[MODERN AUDIO] ❌ Using emergency 3-step fallback');
          
          // Emergency fallback: ultra-simple 3-step
          const t1 = (duration * 0.33).toFixed(2);
          const t2 = (duration * 0.67).toFixed(2);
          const emergencyExpression = `if(lt(t,${t1}),${startVol},if(lt(t,${t2}),${middleVol},${endVol}))`;
          
          // Double-check emergency expression
          const emergencyOpen = (emergencyExpression.match(/\(/g) || []).length;
          const emergencyClose = (emergencyExpression.match(/\)/g) || []).length;
          
          if (emergencyOpen === emergencyClose) {
            const volumeFilter = `volume='${emergencyExpression}'`;
            filters.unshift(volumeFilter);
            console.log('[MODERN AUDIO] ✅ Emergency 3-step filter applied:', emergencyExpression);
          } else {
            // Last resort: uniform volume
            const uniformFilter = `volume=${totalVol.toFixed(2)}`;
            filters.unshift(uniformFilter);
            console.log('[MODERN AUDIO] ⚠️ Last resort: uniform volume applied');
          }
          
        } else if (expression.length > 200) {
          console.log('[MODERN AUDIO] ⚠️ Expression too long, using simplified approach');
          
          // Simplified 3-step
          const t1 = (duration * 0.33).toFixed(2);
          const t2 = (duration * 0.67).toFixed(2);
          const simpleExpression = `if(lt(t,${t1}),${startVol},if(lt(t,${t2}),${middleVol},${endVol}))`;
          
          const volumeFilter = `volume='${simpleExpression}'`;
          filters.unshift(volumeFilter);
          
          console.log('[MODERN AUDIO] ✅ 3-step simplified filter:', simpleExpression);
        } else {
          const volumeFilter = `volume='${expression}'`;
          filters.unshift(volumeFilter);
          
          console.log('[MODERN AUDIO] ✅ 5-step curve generated successfully');
          console.log('[MODERN AUDIO] ✅ Expression length:', expression.length, 'characters');
          console.log('[MODERN AUDIO] ✅ Parentheses balanced:', openCount + '=' + closeCount);
        }
      }
      
    } else {
      const volumeFilter = `volume=${volume.toFixed(2)}`;
      filters.unshift(volumeFilter);
      console.log('[MODERN AUDIO] ✅ Base volume for', profile, 'profile:', volumeFilter);
    }
    
  } catch (error) {
    console.error('[MODERN AUDIO ERROR]', error.message);
    console.log('[MODERN AUDIO] 🔄 Falling back to ultra-safe approach');
    
    if (profile === "custom") {
      // Ultra-safe fallback
      const start = Math.max(0.001, Math.min(3.0, customVolume.start));
      const middle = Math.max(0.001, Math.min(3.0, customVolume.middle));
      const end = Math.max(0.001, Math.min(3.0, customVolume.end));
      
      const startVol = (start * volume).toFixed(3);
      const middleVol = (middle * volume).toFixed(3);
      const endVol = (end * volume).toFixed(3);
      
      const t1 = (duration * 0.3).toFixed(2);
      const t2 = (duration * 0.7).toFixed(2);
      
      const expression = `if(lt(t,${t1}),${startVol},if(lt(t,${t2}),${middleVol},${endVol}))`;
      const volumeFilter = `volume='${expression}'`;
      filters.unshift(volumeFilter);
      
      console.log('[MODERN AUDIO] ⚠️ Ultra-safe fallback 3-segment:', expression);
    } else {
      const fallbackVolume = `volume=${volume.toFixed(2)}`;
      filters.unshift(fallbackVolume);
    }
  }
}

function addFadeEffects(filters, options) {
  const { fadeIn, fadeOut, fadeInDuration, fadeOutDuration, duration, volumeProfile, volume } = options;
  
  console.log('[MODERN FADE] ================== COMPREHENSIVE FADE PROCESSING ==================');
  console.log('[MODERN FADE] Input analysis:', { 
    fadeIn, fadeOut, fadeInDuration, fadeOutDuration, volumeProfile, duration,
    fadeInType: typeof fadeIn, fadeOutType: typeof fadeOut 
  });

  try {
      // === FIX 1: VOLUME PROFILE BASED FADES ===
      if (volumeProfile === "fadeIn") {
          const fadeInFilter = `afade=t=in:st=0:d=${duration.toFixed(3)}`;
          filters.push(fadeInFilter);
          console.log('[MODERN FADE] 🎯 PROFILE fadeIn: Full duration fade');
          console.log('[MODERN FADE] ✅ Filter:', fadeInFilter);
          return;
      }
      
      if (volumeProfile === "fadeOut") {
          const fadeOutFilter = `afade=t=out:st=0:d=${duration.toFixed(3)}`;
          filters.push(fadeOutFilter);
          console.log('[MODERN FADE] 🎯 PROFILE fadeOut: Full duration fade');
          console.log('[MODERN FADE] ✅ Filter:', fadeOutFilter);
          return;
      }
      
      if (volumeProfile === "fadeInOut") {
          let userFadeInDuration = Math.max(0.1, Math.min(fadeInDuration, duration * 0.4));
          let userFadeOutDuration = Math.max(0.1, Math.min(fadeOutDuration, duration * 0.4));
          
          // Ensure no overlap
          const totalFadeDuration = userFadeInDuration + userFadeOutDuration;
          if (totalFadeDuration > duration * 0.8) {
              const scale = (duration * 0.8) / totalFadeDuration;
              userFadeInDuration *= scale;
              userFadeOutDuration *= scale;
              console.log('[MODERN FADE] ⚠️ Scaled fade durations to prevent overlap');
          }
          
          const fadeInFilter = `afade=t=in:st=0:d=${userFadeInDuration.toFixed(3)}`;
          const fadeOutStartTime = Math.max(userFadeInDuration + 0.1, duration - userFadeOutDuration);
          const fadeOutFilter = `afade=t=out:st=${fadeOutStartTime.toFixed(3)}:d=${userFadeOutDuration.toFixed(3)}`;
          
          filters.push(fadeInFilter);
          filters.push(fadeOutFilter);
          
          console.log('[MODERN FADE] 🎯 PROFILE fadeInOut:');
          console.log('[MODERN FADE] ✅ FadeIn: 0s → ' + userFadeInDuration.toFixed(3) + 's');
          console.log('[MODERN FADE] ✅ FadeOut: ' + fadeOutStartTime.toFixed(3) + 's → ' + duration.toFixed(3) + 's');
          console.log('[MODERN FADE] ✅ Gap between fades:', (fadeOutStartTime - userFadeInDuration).toFixed(3) + 's');
          return;
      }
      
      // === FIX 2: CUSTOM PROFILE EXPLICIT FADE CONTROL ===
      if (volumeProfile === "custom") {
          console.log('[MODERN FADE] 🎯 CUSTOM PROFILE - Analyzing explicit fade requests');
          
          let appliedFades = [];
          
          // === FIX 2A: EXPLICIT BOOLEAN CHECK FOR FADEIN ===
          if (fadeIn === true) {
              let userFadeInDuration = Math.max(0.1, Math.min(fadeInDuration || 3, duration * 0.4));
              const fadeInFilter = `afade=t=in:st=0:d=${userFadeInDuration.toFixed(3)}`;
              filters.push(fadeInFilter);
              appliedFades.push('fadeIn');
              
              console.log('[MODERN FADE] ✅ EXPLICIT fadeIn applied: 0s → ' + userFadeInDuration.toFixed(3) + 's');
          }
          
          // === FIX 2B: EXPLICIT BOOLEAN CHECK FOR FADEOUT ===
          if (fadeOut === true) {
              let userFadeOutDuration = Math.max(0.1, Math.min(fadeOutDuration || 3, duration * 0.4));
              const fadeOutStartTime = Math.max(0, duration - userFadeOutDuration);
              const fadeOutFilter = `afade=t=out:st=${fadeOutStartTime.toFixed(3)}:d=${userFadeOutDuration.toFixed(3)}`;
              filters.push(fadeOutFilter);
              appliedFades.push('fadeOut');
              
              console.log('[MODERN FADE] ✅ EXPLICIT fadeOut applied: ' + fadeOutStartTime.toFixed(3) + 's → ' + duration.toFixed(3) + 's');
          }
          
          if (appliedFades.length === 0) {
              console.log('[MODERN FADE] ✅ ZERO-FADE CUSTOM: Pure volume curve, no fade effects');
          } else {
              console.log('[MODERN FADE] ✅ Applied fades for custom profile:', appliedFades.join(' + '));
          }
          
          return;
      }
      
      // === FIX 3: UNIFORM PROFILE WITH EXPLICIT FADE FLAGS ===
      if (fadeIn === true || fadeOut === true) {
          console.log('[MODERN FADE] 🎯 UNIFORM PROFILE with explicit fade flags');
          
          if (fadeIn === true) {
              let userFadeInDuration = Math.max(0.1, Math.min(fadeInDuration || 3, duration * 0.3));
              const fadeInFilter = `afade=t=in:st=0:d=${userFadeInDuration.toFixed(3)}`;
              filters.push(fadeInFilter);
              
              console.log('[MODERN FADE] ✅ Uniform + fadeIn: 0s → ' + userFadeInDuration.toFixed(3) + 's');
          }
          
          if (fadeOut === true) {
              let userFadeOutDuration = Math.max(0.1, Math.min(fadeOutDuration || 3, duration * 0.3));
              const fadeOutStartTime = Math.max(0, duration - userFadeOutDuration);
              const fadeOutFilter = `afade=t=out:st=${fadeOutStartTime.toFixed(3)}:d=${userFadeOutDuration.toFixed(3)}`;
              filters.push(fadeOutFilter);
              
              console.log('[MODERN FADE] ✅ Uniform + fadeOut: ' + fadeOutStartTime.toFixed(3) + 's → ' + duration.toFixed(3) + 's');
          }
          
          return;
      }
      
      // === FIX 4: NO FADE APPLIED ===
      console.log('[MODERN FADE] ✅ NO FADE EFFECTS: All fade flags are false');
      console.log('[MODERN FADE] ✅ Pure audio processing without fade artifacts');
      
  } catch (error) {
      console.error('[MODERN FADE ERROR]', error.message);
      console.error('[MODERN FADE ERROR] Stack:', error.stack);
      console.log('[MODERN FADE] 🔄 SAFE FALLBACK: No fade effects applied');
  }
  
  console.log('[MODERN FADE] =======================================================');
}

function validateFadeFilters(filters) {
  console.log('[FADE VALIDATION] Analyzing fade filters...');
  
  const fadeFilters = filters.filter(f => f.includes('afade='));
  
  if (fadeFilters.length === 0) {
    console.log('[FADE VALIDATION] ✅ No fade filters detected');
    return;
  }
  
  console.log('[FADE VALIDATION] Found', fadeFilters.length, 'fade filter(s)');
  
  for (let i = 0; i < fadeFilters.length; i++) {
    const filter = fadeFilters[i];
    console.log(`[FADE VALIDATION] Filter ${i}: ${filter}`);
    
    // Parse fade filter components
    const fadeType = filter.includes('t=in') ? 'fadeIn' : filter.includes('t=out') ? 'fadeOut' : 'unknown';
    const startMatch = filter.match(/st=([0-9.]+)/);
    const durationMatch = filter.match(/d=([0-9.]+)/);
    
    if (startMatch && durationMatch) {
      const startTime = parseFloat(startMatch[1]);
      const duration = parseFloat(durationMatch[1]);
      
      console.log(`[FADE VALIDATION] ✅ ${fadeType}: start=${startTime}s, duration=${duration}s, end=${(startTime + duration).toFixed(3)}s`);
      
      // Validation checks
      if (startTime < 0) {
        console.error(`[FADE VALIDATION] ❌ Invalid start time: ${startTime}`);
        throw new Error(`Invalid fade start time: ${startTime}`);
      }
      
      if (duration <= 0 || duration > 60) {
        console.error(`[FADE VALIDATION] ❌ Invalid duration: ${duration}`);
        throw new Error(`Invalid fade duration: ${duration}`);
      }
      
    } else {
      console.error(`[FADE VALIDATION] ❌ Could not parse fade filter: ${filter}`);
      throw new Error(`Invalid fade filter format: ${filter}`);
    }
  }
  
  // Check for overlapping fades
  if (fadeFilters.length === 2) {
    const fadeInFilter = fadeFilters.find(f => f.includes('t=in'));
    const fadeOutFilter = fadeFilters.find(f => f.includes('t=out'));
    
    if (fadeInFilter && fadeOutFilter) {
      const fadeInDuration = parseFloat(fadeInFilter.match(/d=([0-9.]+)/)[1]);
      const fadeOutStart = parseFloat(fadeOutFilter.match(/st=([0-9.]+)/)[1]);
      
      if (fadeInDuration > fadeOutStart) {
        console.warn(`[FADE VALIDATION] ⚠️ Potential fade overlap: fadeIn ends at ${fadeInDuration}s, fadeOut starts at ${fadeOutStart}s`);
      } else {
        console.log(`[FADE VALIDATION] ✅ No fade overlap: gap of ${(fadeOutStart - fadeInDuration).toFixed(3)}s`);
      }
    }
  }
  
  console.log('[FADE VALIDATION] ✅ All fade filters validated');
}


// === MODERN VALIDATION ===
function validateFilters(filters) {
  console.log('[MODERN VALIDATION] Advanced filter analysis...');
  
  if (!Array.isArray(filters) || filters.length === 0) {
    console.error('[VALIDATION ERROR] No filters provided');
    throw new Error("No audio filter is set");
  }
  
  // Check for multiple volume filters
  const volumeFilterCount = filters.filter(f => f.includes('volume=')).length;
  if (volumeFilterCount > 1) {
    console.error('[VALIDATION ERROR] Multiple volume filters detected:', volumeFilterCount);
    throw new Error("Multiple volume filters are not supported");
  }
  
  // Validate each filter
  for (let i = 0; i < filters.length; i++) {
    const filter = filters[i];
    console.log(`[MODERN VALIDATION] Filter ${i}: ${filter.substring(0, 50)}${filter.length > 50 ? '...' : ''}`);
    
    if (typeof filter !== 'string' || !filter.trim()) {
      console.error('[VALIDATION ERROR] Invalid filter at index', i, ':', filter);
      throw new Error("Invalid filter detected: " + filter);
    }
    
    // Volume filter validation với enhanced debugging
    if (filter.includes('volume=')) {
      const volumeValue = filter.split('=')[1];
      
      if (volumeValue.includes("'")) {
        const expression = volumeValue.slice(1, -1);
        
        // === ENHANCED PARENTHESES DEBUGGING ===
        console.log(`[MODERN VALIDATION] 🔍 DETAILED ANALYSIS FOR FILTER ${i}:`);
        console.log(`[MODERN VALIDATION] 🔍 Full filter: "${filter}"`);
        console.log(`[MODERN VALIDATION] 🔍 Volume value: "${volumeValue}"`);
        console.log(`[MODERN VALIDATION] 🔍 Expression: "${expression}"`);
        console.log(`[MODERN VALIDATION] 🔍 Expression length: ${expression.length} chars`);
        
        // Count parentheses với detailed analysis
        const openMatches = expression.match(/\(/g);
        const closeMatches = expression.match(/\)/g);
        const openCount = openMatches ? openMatches.length : 0;
        const closeCount = closeMatches ? closeMatches.length : 0;
        
        console.log(`[MODERN VALIDATION] 🔍 Open parentheses count: ${openCount}`);
        console.log(`[MODERN VALIDATION] 🔍 Close parentheses count: ${closeCount}`);
        
        if (openMatches) {
          console.log(`[MODERN VALIDATION] 🔍 Open positions:`, openMatches.map((match, idx) => expression.indexOf('(', idx)).slice(0, 10));
        }
        if (closeMatches) {
          console.log(`[MODERN VALIDATION] 🔍 Close positions:`, closeMatches.map((match, idx) => expression.indexOf(')', idx)).slice(0, 10));
        }
        
        if (openCount !== closeCount) {
          console.error(`[MODERN VALIDATION] ❌ CRITICAL PARENTHESES MISMATCH:`);
          console.error(`[MODERN VALIDATION] ❌ Expected: Equal counts`);
          console.error(`[MODERN VALIDATION] ❌ Actual: ${openCount} open vs ${closeCount} close`);
          console.error(`[MODERN VALIDATION] ❌ Difference: ${Math.abs(openCount - closeCount)}`);
          console.error(`[MODERN VALIDATION] ❌ Full expression: "${expression}"`);
          throw new Error(`Filter ${i} has unbalanced parentheses: ${openCount} open vs ${closeCount} close`);
        }
        
        console.log(`[MODERN VALIDATION] ✅ Complex volume expression validated: ${expression.length} chars, parentheses perfectly balanced`);
      } else {
        const numValue = parseFloat(volumeValue);
        if (isNaN(numValue) || numValue < 0) {
          throw new Error(`Filter ${i} has invalid volume value`);
        }
        console.log(`[MODERN VALIDATION] ✅ Simple volume validated: ${numValue}x`);
      }
    }
    
    if (filter.includes('afade=')) {
      console.log(`[MODERN VALIDATION] ✅ Fade filter detected`);
    }
    
    if (filter.includes('loudnorm')) {
      console.log(`[MODERN VALIDATION] ✅ Normalization filter validated`);
    }
  }
  
  // Call fade validation
  validateFadeFilters(filters);
  
  console.log('[MODERN VALIDATION] ✅ All filters passed comprehensive validation');
}


function processAudio(options) {
  const {
    inputPath, outputPath, startTime, duration, filters, outputFormat,
    res, outputFilename, volumeProfile, volume, customVolume, normalizeAudio
  } = options;
  
  try {
      validateFilters(filters); // Using the modern validation
      console.log('[FFMPEG] Starting processing with CORRECT ORDER: trim first, then apply filters');
      console.log('[FFMPEG] Input:', inputPath);
      console.log('[FFMPEG] Output:', outputPath);
      console.log('[FFMPEG] Trim: start =', startTime, 'duration =', duration);
      console.log('[FFMPEG] Filters:', filters);

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
      .inputOptions(`-ss ${startTime}`)
      .inputOptions(`-t ${duration}`)
      .audioFilters(filters)
      .outputOptions("-vn", "-sn")
      .outputOptions("-map_metadata", "-1")
      .audioCodec("libmp3lame")
      .audioBitrate(192)
      .audioChannels(2)
      .outputOptions("-metadata", `title=MP3 Cut (${formatTime(duration)})`)
      .outputOptions("-metadata", "artist=MP3 Cutter Tool");

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