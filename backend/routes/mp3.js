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
    // Đảm bảo thư mục uploads tồn tại
    const dir = path.join(__dirname, "../uploads");
    if (!fs.existsSync(dir)){
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    // Tạo tên file duy nhất dựa trên timestamp
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
    // Chỉ chấp nhận file mp3
    if (file.mimetype === "audio/mpeg") {
      cb(null, true);
    } else {
      cb(new Error("Only MP3 files are allowed"), false);
    }
  }
});

// --- BỔ SUNG: Middleware bắt lỗi Multer ---
function multerErrorHandler(err, req, res, next) {
  if (err) {
    console.error('[MULTER ERROR]', err);
    return res.status(400).json({ error: 'Multer error', details: err.message });
  }
  next();
}

// --- Đăng ký middleware này trước route cut-mp3 ---
router.post("/cut-mp3", multerErrorHandler, upload.single("audio"), async (req, res) => {
  // --- BỔ SUNG LOG ĐẦU VÀO ---
  console.log('[CUT-MP3] New request');
  console.log('[HEADERS]', req.headers);
  console.log('[BODY]', req.body);
  console.log('[FILE]', req.file);
  console.log("hihih");
  
  const inputPath = req.file?.path;
  try {
    if (!req.file) {
      console.error('[ERROR] No audio file uploaded');
      return res.status(400).json({ error: "No audio file uploaded" });
    }

    // Log trạng thái file input
    if (!fs.existsSync(inputPath)) {
      console.error('[ERROR] Uploaded file does not exist:', inputPath);
      return res.status(400).json({ error: 'Uploaded file does not exist', details: inputPath });
    }
    console.log('[INFO] Uploaded file exists:', inputPath, fs.statSync(inputPath));

    // Extract parameters with validation
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

    // Log tham số đầu vào
    console.log('[PARAMS]', { startTime, endTime, volume, fadeIn, fadeOut, volumeProfile, normalizeAudio, outputFormat, fadeInDuration, fadeOutDuration });

    // Validate parameters
    if (
      isNaN(startTime) ||
      isNaN(endTime) ||
      isNaN(volume) ||
      endTime <= startTime ||
      volume < 0.1 ||
      volume > 3.0 ||
      startTime < 0
    ) {
      cleanupFile(inputPath);
      console.error('[ERROR] Invalid parameters', { startTime, endTime, volume });
      return res.status(400).json({ 
        error: "Invalid parameters",
        details: {
          startTime: isNaN(startTime) ? "Must be a number" : startTime < 0 ? "Must be positive" : null,
          endTime: isNaN(endTime) ? "Must be a number" : null,
          endBeforeStart: endTime <= startTime ? "End time must be greater than start time" : null,
          volume: isNaN(volume) ? "Must be a number" : (volume < 0.1 || volume > 3.0) ? "Must be between 0.1 and 3.0" : null
        }
      });
    }

    // Validate volume profile
    if (!["uniform", "fadeIn", "fadeOut", "fadeInOut", "custom"].includes(volumeProfile)) {
      cleanupFile(inputPath);
      console.error('[ERROR] Invalid volume profile:', volumeProfile);
      return res.status(400).json({ error: "Invalid volume profile" });
    }

    // Validate custom volume
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
        } else {
          throw new Error("Invalid custom volume values");
        }
      } catch (e) {
        cleanupFile(inputPath);
        console.error('[ERROR] Invalid custom volume data:', req.body.customVolume);
        return res.status(400).json({ error: "Invalid custom volume data" });
      }
    }

    // Ensure output directory exists
    const outputDir = path.join(__dirname, "../output");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Create unique output filename
    const outputFilename = `cut_${Date.now()}.${outputFormat}`;
    const outputPath = path.join(outputDir, outputFilename);

    const duration = endTime - startTime;
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
      volumeProfile
    });

    // Add normalization if requested
    if (normalizeAudio) {
      filters.push("loudnorm=I=-16:TP=-1.5:LRA=11");
    }

    // Log filter cuối cùng
    console.log('[FILTERS]', filters);

    // Log trạng thái thư mục output
    console.log('[INFO] Output dir exists:', fs.existsSync(outputDir), outputDir);

    // Process the audio
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
      customVolume
    });

  } catch (error) {
    console.error("[ERROR] Uncaught error:", error);
    cleanupFile(inputPath);
    res.status(500).json({ 
      error: "Internal server error", 
      details: error.message 
    });
  }
});

// Helper functions
function cleanupFile(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (error) {
      console.error("Error cleaning up file:", error);
    }
  }
}

function addVolumeProfileFilter(filters, profile, volume, duration, customVolume, fadeIn = false, fadeOut = false) {
  // Nếu có fade hoặc profile là fadeIn/fadeOut/fadeInOut thì chỉ thêm filter volume đơn giản
  if (fadeIn || fadeOut || ["fadeIn", "fadeOut", "fadeInOut"].includes(profile)) {
    filters.push(`volume=${volume.toFixed(2)}`);
    return;
  }
  if (profile === "custom") {
    // Custom volume không kết hợp fade, chỉ áp dụng khi không có fade
    const customFilter =
      `volume='if(lt(t,${duration / 2}),` +
      `${customVolume.start.toFixed(2)}+(${customVolume.middle.toFixed(2)}-${customVolume.start.toFixed(2)})*(t/${duration / 2}),` +
      `${customVolume.middle.toFixed(2)}+(${customVolume.end.toFixed(2)}-${customVolume.middle.toFixed(2)})*(t-${duration / 2})/${duration / 2})'`;
    filters.push(customFilter);
    return;
  }
  // Các profile còn lại
  switch (profile) {
    case "uniform":
      filters.push(`volume=${volume.toFixed(2)}`);
      break;
  }
}

function addFadeEffects(filters, options) {
  const {
    fadeIn,
    fadeOut,
    fadeInDuration,
    fadeOutDuration,
    duration,
    volumeProfile
  } = options;

  // Xử lý fadeInOut: luôn thêm cả fadeIn và fadeOut nếu profile là fadeInOut
  if (volumeProfile === "fadeInOut" && !fadeIn && !fadeOut) {
    const fadeDurationIn = Math.min(fadeInDuration, duration / 2);
    const fadeDurationOut = Math.min(fadeOutDuration, duration / 2);
    if (fadeDurationIn > 0) {
      filters.push(`afade=t=in:st=0:d=${fadeDurationIn}:curve=sine`);
    }
    if (fadeDurationOut > 0) {
      filters.push(`afade=t=out:st=${duration - fadeDurationOut}:d=${fadeDurationOut}:curve=sine`);
    }
    return;
  }
  // Xử lý fadeIn/fadeOut thông thường
  if (fadeIn) {
    const d = duration >= 4 ? 2 : Math.min(0.5, duration / 4);
    filters.push(`afade=t=in:st=0:d=${d}:curve=sine`);
  }
  if (fadeOut) {
    const d = duration >= 4 ? 2 : Math.min(0.5, duration / 4);
    filters.push(`afade=t=out:st=${duration - d}:d=${d}:curve=sine`);
  }
}

function logProcessingDetails(details) {
  console.log("Processing details:", {
    input: details.inputPath,
    output: `${details.outputPath} (${details.outputFormat})`,
    parameters: {
      start: details.startTime,
      end: details.endTime,
      duration: `${details.duration}s`,
      volume: details.volume,
      profile: details.volumeProfile
    },
    fade: {
      in: details.fadeIn,
      out: details.fadeOut,
      inDuration: `${details.fadeInDuration}s`,
      outDuration: `${details.fadeOutDuration}s`
    },
    normalize: details.normalizeAudio,
    filters: details.filters.join(", ")
  });
}

// --- BỔ SUNG: Kiểm tra filter rỗng trước khi chạy FFmpeg ---
function validateFilters(filters) {
  console.log('[FILTER VALIDATION] Checking filters:', filters);
  
  if (!Array.isArray(filters) || filters.length === 0) {
    console.error('[FILTER ERROR] No filters provided');
    throw new Error("No audio filter is set. Please check your parameters.");
  }
  
  for (let i = 0; i < filters.length; i++) {
    const f = filters[i];
    if (typeof f !== 'string' || !f.trim()) {
      console.error(`[FILTER ERROR] Invalid filter at index ${i}:`, f);
      throw new Error("Invalid filter detected: " + f);
    }
  }
  
  console.log('[FILTER VALIDATION] All filters are valid');
}

// --- Sửa processAudio ---
function processAudio(options) {
  const {
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
    customVolume
  } = options;

  try {
    // Kiểm tra file input tồn tại
    if (!inputPath || !fs.existsSync(inputPath)) {
      console.error('[ERROR] Input file does not exist:', inputPath);
      throw new Error("Input file does not exist: " + inputPath);
    }
    // Kiểm tra filter
    validateFilters(filters);

    // Log trạng thái trước khi chạy FFmpeg
    console.log('[INFO] Input file:', inputPath, fs.statSync(inputPath));
    console.log('[INFO] Output file (expected):', outputPath);
    console.log('[INFO] Filters:', filters);
    console.log('[INFO] Start:', startTime, 'End:', startTime + duration, 'Duration:', duration);
    console.log('[INFO] Volume profile:', volumeProfile, 'Volume:', volume, 'CustomVolume:', customVolume);

      const ffmpegCommand = ffmpeg(inputPath)
        .setStartTime(startTime)
        .setDuration(duration)
      .addOptions(['-threads', '0'])
      .addOptions(['-max_muxing_queue_size', '9999'])
        .outputOptions("-af", filters.join(","))
      .outputOptions("-vn", "-sn")
      .outputOptions("-map_metadata", "-1")
        .audioCodec("libmp3lame")
        .audioBitrate(192)
        .audioChannels(2)
        .outputOptions("-metadata", `title=MP3 Cut (${formatTime(duration)})`)
        .outputOptions("-metadata", "artist=MP3 Cutter Tool")
      .outputOptions("-metadata", `comment=volumeProfile=${volumeProfile},normalize=${options.normalizeAudio}`)
        .on("start", (cmd) => {
        console.log("[FFMPEG START] Command:", cmd);
        })
        .on("progress", (progress) => {
        console.log(`[FFMPEG PROGRESS] ${progress.percent ? progress.percent.toFixed(1) + '%' : 'N/A'}`);
        })
        .on("end", () => {
          try {
          cleanupFile(inputPath);
          // --- BỔ SUNG: Kiểm tra file output tồn tại ---
          if (!fs.existsSync(outputPath)) {
            console.error('[ERROR] Output file was not created:', outputPath);
            throw new Error("Output file was not created: " + outputPath);
          }
          console.log('[SUCCESS] Output file created:', outputPath, fs.statSync(outputPath));
          
          ffmpeg.ffprobe(outputPath, (err, metadata) => {
            if (err) {
              console.error("[ERROR] Reading output metadata:", err);
              
              // Fallback: Send response without metadata
              const fileStats = fs.statSync(outputPath);
              return res.json({
                filename: outputFilename,
                size: formatFileSize(fileStats.size),
                duration: formatTime(duration),
                bitrate: 192,
                volumeProfile,
                appliedVolume: volume,
                customVolume: volumeProfile === "custom" ? customVolume : null,
                note: "Metadata reading failed, using fallback values"
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
          console.error("[ERROR] In end handler:", error);
            if (!res.headersSent) {
            res.status(500).json({ error: "Error after processing", details: error.message });
          }
          }
        })
        .on("error", (err) => {
        console.error("[FFMPEG ERROR]", err.message, err);
        console.error("[FFMPEG ERROR STACK]", err.stack);
        cleanupFile(inputPath);
          if (!res.headersSent) {
            res.status(500).json({ 
              error: "Error processing audio",
            details: err.message || err,
            filters: filters,
            command: "Check server logs for full FFmpeg command"
            });
          }
        });

      ffmpegCommand.output(outputPath).run();
  } catch (error) {
    console.error("[ERROR] Creating FFmpeg command or validating input:", error);
    console.error("[ERROR STACK]", error.stack);
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