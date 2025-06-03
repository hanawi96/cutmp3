import React from "react";
import { Music, Upload } from "lucide-react";

// Helper: format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

export default function FileUpload({
  file,
  setFile,
  isDragging,
  setIsDragging,
  fileInputRef,
  serverStatus,
  error
}) {
  

  // Validate file
  const validateFile = (file) => {
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

      return false;
    }
    const normalizedType = file.type.toLowerCase();
    const isValidType = supportedFormats.includes(normalizedType);
    const maxSize = getMaxSizeForFormat(normalizedType);
    const isValidSize = file.size <= maxSize;

    if (!isValidType) {
      alert("❌ Invalid file type. Please upload MP3, WAV, M4A, AAC, OGG, FLAC, or WMA.");
      return false;
    }
    if (!isValidSize) {
      const isLossless = [
        "audio/wav", "audio/wave", "audio/x-wav",
        "audio/flac", "audio/x-flac"
      ].includes(normalizedType);
      const formatType = isLossless ? "lossless" : "compressed";
      alert(
        `❌ File is too large (${formatFileSize(file.size)}). ` +
        `Maximum size for ${formatType} audio is ${formatFileSize(maxSize)}.`
      );
      return false;
    }
    return true;
  };

  // Drag & Drop handlers
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (validateFile(droppedFile)) {
        setFile(droppedFile);
      }
    }
  };
  const handleAreaClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="w-full max-w-3xl space-y-4 sm:space-y-6">
      <header className="text-center px-4 sm:px-0">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">
          🎧 Audio Cutter
        </h1>
        <p className="text-gray-600 text-sm sm:text-base">
          Easily trim and customize your audio files.
        </p>
        {serverStatus && (
          <div
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-2 
            ${
              serverStatus === "online"
                ? "bg-green-100 text-green-800"
                : serverStatus === "error"
                ? "bg-yellow-100 text-yellow-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full mr-1.5 
              ${
                serverStatus === "online"
                  ? "bg-green-500"
                  : serverStatus === "error"
                  ? "bg-yellow-500"
                  : "bg-red-500"
              }`}
            ></span>
            {serverStatus === "online"
              ? "Server Connected"
              : serverStatus === "error"
              ? "Server Error"
              : "Server Offline"}
          </div>
        )}
      </header>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mx-4 sm:mx-0">
          <p className="font-medium text-sm sm:text-base">Error: {error}</p>
        </div>
      )}
      <div
        className={`bg-white rounded-lg shadow-md p-6 sm:p-10 flex flex-col items-center justify-center min-h-[280px] sm:min-h-[300px] border-2 mx-4 sm:mx-0 ${
          isDragging
            ? "border-blue-500 bg-blue-50 border-dashed"
            : "border-dashed border-blue-100"
        } transition-all duration-200 ease-in-out cursor-pointer touch-manipulation`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleAreaClick}
      >
        <Music
          className={`w-12 h-12 sm:w-16 sm:h-16 ${
            isDragging ? "text-blue-600" : "text-blue-500"
          } mb-4 transition-colors duration-200`}
        />
        <h2 className="text-lg sm:text-xl font-semibold text-gray-700 mb-2 text-center">
          Upload Audio File
        </h2>
        <p className="text-gray-500 mb-6 text-center text-sm sm:text-base px-4">
          {isDragging
            ? "Drop your audio file here"
            : "Drag and drop your audio file here or click to browse"}
        </p>
        <label
          className={`inline-flex items-center px-6 py-3 sm:px-6 sm:py-3 text-sm sm:text-base ${
            isDragging ? "bg-blue-700" : "bg-blue-600"
          } text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-all duration-200 touch-manipulation hover:scale-105`}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/mpeg,audio/mp3,audio/wav,audio/wave,audio/x-wav,audio/mp4,audio/m4a,audio/x-m4a,audio/mp4a-latm,audio/aac,audio/x-aac,audio/ogg,audio/x-ogg,audio/flac,audio/x-flac,audio/x-ms-wma,audio/wma,audio/webm,audio/3gp,audio/amr"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f && validateFile(f)) {
                setFile(f);
              }
            }}
          />
          <Upload className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
          Browse Files
        </label>
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-500 mb-1">
            Supported formats: MP3, WAV, M4A, AAC, OGG, FLAC, WMA
          </p>
          <p className="text-xs text-gray-400">
            Max size: 50MB (compressed) / 100MB (lossless)
          </p>
        </div>
      </div>
    </div>
  );
}


export { formatFileSize };