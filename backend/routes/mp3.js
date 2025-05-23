console.log("🟩 File mp3.js ĐÃ ĐƯỢC LOAD");
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const ffmpeg = require("fluent-ffmpeg");

ffmpeg.setFfmpegPath(ffmpegPath);
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

router.post("/cut-mp3", upload.single("audio"), (req, res) => {
  const inputPath = req.file?.path;
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No audio file uploaded" });
    }

    // Extract parameters with validation
    const startTime = parseFloat(req.body?.start);
    const endTime = parseFloat(req.body?.end);
    const rawVolume = req.body?.volume;
    const volume = parseFloat(typeof rawVolume === "string" ? rawVolume.replace(",", ".") : rawVolume);
    const fade = req.body?.fade === "true";
    const volumeProfile = req.body?.volumeProfile || "uniform";
    const normalizeAudio = req.body?.normalizeAudio === "true";
    const outputFormat = req.body?.outputFormat || "mp3";
    const fadeInDuration = parseFloat(req.body?.fadeInDuration || "3");
    const fadeOutDuration = parseFloat(req.body?.fadeOutDuration || "3");

    let customVolume = { start: 1.0, middle: 1.0, end: 1.0 };

    if (
      isNaN(startTime) ||
      isNaN(endTime) ||
      isNaN(volume) ||
      endTime <= startTime ||
      volume < 0.1 ||
      volume > 3.0
    ) {
      fs.unlinkSync(inputPath);
      return res.status(400).json({ 
        error: "Invalid parameters",
        details: {
          startTime: isNaN(startTime) ? "Must be a number" : null,
          endTime: isNaN(endTime) ? "Must be a number" : null,
          endBeforeStart: endTime <= startTime ? "End time must be greater than start time" : null,
          volume: isNaN(volume) ? "Must be a number" : (volume < 0.1 || volume > 3.0) ? "Must be between 0.1 and 3.0" : null
        }
      });
    }

    if (!["uniform", "fadeIn", "fadeOut", "fadeInOut", "custom"].includes(volumeProfile)) {
      fs.unlinkSync(inputPath);
      return res.status(400).json({ error: "Invalid volume profile" });
    }

    if (volumeProfile === "custom" && req.body?.customVolume) {
      try {
        const parsed = JSON.parse(req.body.customVolume);
        if (
          typeof parsed.start === "number" &&
          typeof parsed.middle === "number" &&
          typeof parsed.end === "number"
        ) {
          customVolume = parsed;
        } else {
          throw new Error("customVolume không hợp lệ.");
        }
      } catch (e) {
        fs.unlinkSync(inputPath);
        return res.status(400).json({ error: "Invalid custom volume data" });
      }
    }

    // Ensure output directory exists
    const outputDir = path.join(__dirname, "../output");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Create unique output filename based on format
    const outputFilename = `cut_${Date.now()}.${outputFormat}`;
    const outputPath = path.join(outputDir, outputFilename);

    const duration = endTime - startTime;
    const filters = [];

    // Xử lý volume profile
    switch (volumeProfile) {
      case "uniform":
        filters.push(`volume=${volume.toFixed(2)}`);
        break;
      case "fadeIn":
        // Chỉ điều chỉnh âm lượng theo profile, không áp dụng fade
        filters.push(`volume='${volume.toFixed(2)}*(t/${duration})'`);
        break;
      case "fadeOut":
        // Chỉ điều chỉnh âm lượng theo profile, không áp dụng fade
        filters.push(`volume='${volume.toFixed(2)}*(1-(t/${duration}))'`);
        break;
      case "fadeInOut":
        // Nếu là fadeInOut, chỉ điều chỉnh âm lượng, fade sẽ được xử lý riêng
        const half = duration / 2;
        filters.push(`volume='${volume.toFixed(2)}*(if(lte(t,${half}),(t/${half}),(1-(t-${half})/${half})))'`);
        break;
      case "custom":
        // Với custom, sử dụng các điểm âm lượng tùy chỉnh
        filters.push(
          `volume='if(lt(t,${duration / 2}),` +
          `${customVolume.start.toFixed(2)}+(${customVolume.middle.toFixed(2)}-${customVolume.start.toFixed(2)})*(t/${duration / 2}),` +
          `${customVolume.middle.toFixed(2)}+(${customVolume.end.toFixed(2)}-${customVolume.middle.toFixed(2)})*(t-${duration / 2})/${duration / 2})'`
        );
        break;
    }

    // Xử lý hiệu ứng fade (độc lập với volume profile)
    // Lưu ý: fade ảnh hưởng đến envelope của âm thanh, không phải volume
    if (fade) {
      // Xử lý fade in/out 2s chuẩn
      if (duration >= 4) {
        // Nếu đoạn audio đủ dài, sử dụng 2s cho cả fade in và fade out
        filters.push("afade=t=in:st=0:d=2:curve=sine");
        filters.push(`afade=t=out:st=${duration - 2}:d=2:curve=sine`);
      } else if (duration >= 1) {
        // Nếu đoạn audio ngắn hơn, điều chỉnh thời gian fade phù hợp
        const fd = Math.min(0.5, duration / 4);
        filters.push(`afade=t=in:st=0:d=${fd}:curve=sine`);
        filters.push(`afade=t=out:st=${duration - fd}:d=${fd}:curve=sine`);
      } else {
        // Đoạn quá ngắn không thể áp dụng fade
        fs.unlinkSync(inputPath);
        return res.status(400).json({ error: "Audio clip too short to apply fade effect." });
      }
    } else if (volumeProfile === "fadeInOut" && !fade) {
      // Nếu chọn profile fadeInOut nhưng không bật option fade riêng, áp dụng fade dựa trên tham số
      // Đây là trường hợp custom fade trong UI
      const fadeDurationIn = Math.min(fadeInDuration, duration / 2);
      const fadeDurationOut = Math.min(fadeOutDuration, duration / 2);
      
      // Đảm bảo tổng thời gian fade không vượt quá tổng thời gian audio
      if (fadeDurationIn + fadeDurationOut <= duration) {
        console.log(`Adding custom fade: in=${fadeDurationIn}s, out=${fadeDurationOut}s`);
        filters.push(`afade=t=in:st=0:d=${fadeDurationIn}:curve=sine`);
        filters.push(`afade=t=out:st=${duration - fadeDurationOut}:d=${fadeDurationOut}:curve=sine`);
      } else {
        // Nếu tổng thời gian fade vượt quá thời lượng, điều chỉnh lại tham số
        const adjustedDuration = duration / 2;
        console.log(`Adjusting fade durations to fit audio length: in=${adjustedDuration}s, out=${adjustedDuration}s`);
        filters.push(`afade=t=in:st=0:d=${adjustedDuration}:curve=sine`);
        filters.push(`afade=t=out:st=${duration - adjustedDuration}:d=${adjustedDuration}:curve=sine`);
      }
    }

    // Normalize audio nếu được yêu cầu (luôn áp dụng cuối cùng)
    if (normalizeAudio) {
      // Sử dụng loudnorm filter của FFmpeg với các tham số chuẩn
      // I: Integrated loudness target (-16 LUFS là chuẩn cho streaming)
      // TP: True peak target (-1.5 dBTP là chuẩn cho streaming)
      // LRA: Loudness range target (11 LU là chuẩn cho streaming)
      filters.push("loudnorm=I=-16:TP=-1.5:LRA=11");
    }

    // In ra đầy đủ thông tin để debug
    console.log(`Processing file: ${inputPath}`);
    console.log(`Output: ${outputPath} (${outputFormat})`);
    console.log(`Parameters: Start=${startTime}, End=${endTime}, Duration=${duration}s, Volume=${volume}, Profile=${volumeProfile}`);
    console.log(`Fade: ${fade}, FadeInDuration: ${fadeInDuration}s, FadeOutDuration: ${fadeOutDuration}s`);
    console.log(`Normalize: ${normalizeAudio}`);
    console.log(`Filters: ${filters.join(", ")}`);

    try {
      // Tạo ffmpeg command với các thiết lập tốt nhất cho hiệu suất
      const ffmpegCommand = ffmpeg(inputPath)
        .setStartTime(startTime)
        .setDuration(duration)
        // Thêm các options để tối ưu hóa xử lý
        .addOptions(['-threads', '0'])  // Sử dụng đa luồng
        .addOptions(['-max_muxing_queue_size', '9999']) // Ngăn lỗi muxing queue
        .outputOptions("-af", filters.join(","))
        .outputOptions("-vn", "-sn") // Bỏ video và subtitle
        .outputOptions("-map_metadata", "-1") // Bỏ metadata không cần thiết
        .audioCodec("libmp3lame")
        .audioBitrate(192)
        .audioChannels(2)
        .outputOptions("-metadata", `title=MP3 Cut (${formatTime(duration)})`)
        .outputOptions("-metadata", "artist=MP3 Cutter Tool")
        .outputOptions("-metadata", `comment=volumeProfile=${volumeProfile},normalize=${normalizeAudio}`)
        .on("start", (cmd) => {
          console.log("FFmpeg command:", cmd);
        })
        .on("progress", (progress) => {
          console.log(`Processing: ${progress.percent ? progress.percent.toFixed(1) + '%' : 'N/A'}`);
        })
        .on("end", () => {
          try {
            // Clean up the input file
            if (fs.existsSync(inputPath)) {
              fs.unlinkSync(inputPath);
            }
            
            // Get output file metadata
            ffmpeg.ffprobe(outputPath, (err, outMetadata) => {
              try {
                if (err) {
                  console.log("Could not read output metadata:", err.message);
                  return res.json({ filename: outputFilename });
                }

                // Send detailed response with metadata
                res.json({
                  filename: outputFilename,
                  size: formatFileSize(outMetadata.format.size),
                  duration: formatTime(outMetadata.format.duration),
                  bitrate: Math.round(outMetadata.format.bit_rate / 1000),
                  volumeProfile,
                  appliedVolume: volume,
                  customVolume: volumeProfile === "custom" ? customVolume : null,
                });
              } catch (probeError) {
                console.error("Error handling probe results:", probeError);
                res.json({ filename: outputFilename });
              }
            });
          } catch (endError) {
            console.error("Error in end handler:", endError);
            if (!res.headersSent) {
              res.json({ filename: outputFilename });
            }
          }
        })
        .on("error", (err) => {
          console.error("❌ FFmpeg error:", err.message);
          
          // Clean up the input file
          try {
            if (fs.existsSync(inputPath)) {
              fs.unlinkSync(inputPath);
            }
          } catch (unlinkError) {
            console.error("Error deleting input file:", unlinkError);
          }
          
          // Kiểm tra xem response đã được gửi chưa
          if (!res.headersSent) {
            // Send detailed error to client
            res.status(500).json({ 
              error: "Error processing audio",
              details: err.message
            });
          }
        });

      // Set output format and run the command
      ffmpegCommand.output(outputPath).run();
    } catch (ffmpegError) {
      console.error("Error creating FFmpeg command:", ffmpegError);
      
      // Clean up the input file
      try {
        if (fs.existsSync(inputPath)) {
          fs.unlinkSync(inputPath);
        }
      } catch (unlinkError) {
        console.error("Error deleting input file:", unlinkError);
      }
      
      if (!res.headersSent) {
        res.status(500).json({ 
          error: "Error setting up audio processing",
          details: ffmpegError.message 
        });
      }
    }
  } catch (error) {
    console.error("Uncaught error:", error);
    
    // Clean up input file if it exists
    if (inputPath && fs.existsSync(inputPath)) {
      fs.unlinkSync(inputPath);
    }
    
    res.status(500).json({ 
      error: "Internal server error", 
      details: error.message 
    });
  }
});

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
