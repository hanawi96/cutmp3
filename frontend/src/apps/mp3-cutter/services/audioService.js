// Use environment variable instead of config file
const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

export const audioService = {
  // Check Server Status
  checkServerStatus: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/status`);
      if (response.ok) {
        return { status: "online", error: null };
      } else {
        return { status: "error", error: "Backend server is not responding correctly" };
      }
    } catch (err) {
      console.error("Cannot connect to backend:", err);
      return { status: "offline", error: "Cannot connect to backend server" };
    }
  },

  // Process Audio with Streaming
  processAudio: async (formData, onProgress, onStatus) => {
    try {


      const response = await fetch(`${API_BASE_URL}/api/cut-mp3`, {
        method: "POST",
        body: formData,
      });


      if (!response.ok) {
        // Enhanced error handling
        let errorData;
        let errorMessage = `Server error: ${response.status} ${response.statusText}`;

        try {
          const responseText = await response.text();


          if (responseText) {
            try {
              errorData = JSON.parse(responseText);


              // Build detailed error message
              if (errorData.error) {
                errorMessage = errorData.error;

                if (errorData.details) {
                  errorMessage += `: ${errorData.details}`;
                }

                if (errorData.supportedFormats) {
                  errorMessage += `. Supported formats: ${errorData.supportedFormats.join(", ")}`;
                }

                // Specific handling for file format errors
                if (errorData.error.includes("Unsupported") || errorMessage.includes("MP3 files are allowed")) {
                  errorMessage = `❌ File format not supported. Please convert to a supported format: MP3, WAV, M4A, AAC, OGG, FLAC, or WMA.`;
                }
              }
            } catch (parseError) {
              console.error("[AUDIO_SERVICE] Error parsing response JSON:", parseError);
              errorMessage = `Server error (${response.status}): ${responseText}`;
            }
          }
        } catch (textError) {
          console.error("[AUDIO_SERVICE] Error reading response text:", textError);
          errorMessage = `Network error: ${response.status} ${response.statusText}`;
        }

        console.error("[AUDIO_SERVICE] Final error message:", errorMessage);
        throw new Error(errorMessage);
      }

      // Handle streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalResult = null;
      let hasReached100 = false;

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.trim()) {
              try {
                const data = JSON.parse(line);

                if (data.progress !== undefined) {

                  onProgress?.(data.progress);

                  if (data.progress >= 100) {
                    hasReached100 = true;
                  }
                }

                if (data.status) {
                  onStatus?.(data.status);
                }

                if (data.status === "completed" && data.filename && hasReached100) {
                  finalResult = data;
                } else if (data.status === "completed" && data.filename && !hasReached100) {
                  finalResult = data;
                }

                if (data.status === "error") {
                  console.error("[AUDIO_SERVICE] Error received from server:", data);
                  throw new Error(data.error || data.details || "Processing failed");
                }
              } catch (parseError) {
                console.error("[AUDIO_SERVICE] Error parsing JSON:", parseError, "Line:", line);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      // Return final result
      if (finalResult && finalResult.filename && hasReached100) {
        return {
          success: true,
          filename: finalResult.filename,
          downloadUrl: `${API_BASE_URL}/output/${finalResult.filename}`,
        };
      } else {
        console.error("[AUDIO_SERVICE] Missing requirements - finalResult:", !!finalResult, "hasReached100:", hasReached100);
        throw new Error("Processing completed but final result not properly received");
      }
    } catch (error) {
      console.error("[AUDIO_SERVICE] Error processing audio:", error);
      throw error;
    }
  },

  // Validate Audio File
  validateAudioFile: (file) => {
    const supportedFormats = [
      "audio/mpeg", "audio/mp3", "audio/wav", "audio/wave", "audio/x-wav",
      "audio/mp4", "audio/m4a", "audio/x-m4a", "audio/mp4a-latm",
      "audio/aac", "audio/x-aac", "audio/ogg", "audio/x-ogg",
      "audio/flac", "audio/x-flac", "audio/x-ms-wma", "audio/wma",
      "audio/webm", "audio/3gp", "audio/amr"
    ];

    const getMaxSizeForFormat = (fileType) => {
      const losslessFormats = [
        "audio/wav", "audio/wave", "audio/x-wav",
        "audio/flac", "audio/x-flac"
      ];
      const isLossless = losslessFormats.includes(fileType.toLowerCase());
      return isLossless ? 100 * 1024 * 1024 : 50 * 1024 * 1024;
    };

    if (!file) {
      return { valid: false, error: "No file provided" };
    }

    const normalizedType = file.type.toLowerCase();
    const isValidType = supportedFormats.includes(normalizedType);
    const maxSize = getMaxSizeForFormat(normalizedType);
    const isValidSize = file.size <= maxSize;

    if (!isValidType) {
      return {
        valid: false,
        error: "Invalid file type. Please upload MP3, WAV, M4A, AAC, OGG, FLAC, or WMA."
      };
    }

    if (!isValidSize) {
      const formatFileSize = (bytes) => {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const sizes = ["Bytes", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
      };

      const isLossless = [
        "audio/wav", "audio/wave", "audio/x-wav",
        "audio/flac", "audio/x-flac"
      ].includes(normalizedType);
      const formatType = isLossless ? "lossless" : "compressed";

      return {
        valid: false,
        error: `File is too large (${formatFileSize(file.size)}). Maximum size for ${formatType} audio is ${formatFileSize(maxSize)}.`
      };
    }

    return { valid: true, error: null };
  },

  // Prepare Form Data
  prepareFormData: (file, parameters) => {
    const formData = new FormData();
    formData.append("audio", file);

    Object.keys(parameters).forEach((key) => {
      if (parameters[key] !== undefined) {
        if (typeof parameters[key] === "object") {
          formData.append(key, JSON.stringify(parameters[key]));
        } else {
          formData.append(key, parameters[key]);
        }
      }
    });

    return formData;
  },

  // Log Form Data for debugging
  logFormData: (formData, file) => {

    for (let [key, value] of formData.entries()) {
      if (key === "audio") {

      } else {

      }
    }
  }
};