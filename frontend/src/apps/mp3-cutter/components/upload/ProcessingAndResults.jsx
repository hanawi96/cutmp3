import React from 'react';
import { RefreshCw, Scissors, Download } from 'lucide-react';

export default function ProcessingAndResults({
  // Processing states
  isLoading,
  smoothProgress,
  
  // Download states
  downloadUrl,
  outputFormat,
  showQrCode,
  qrCodeDataUrl,
  shareLink,
  isCopied,
  
  // Callback functions
  handleSubmit,
  handleReset,
  copyShareLink,
}) {

  return (
    <div className="space-y-6">
      {/* ========== PROCESSING SECTION ========== */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          {/* Reset Settings Button */}
          <button
            type="button"
            onClick={handleReset}
            className="py-2 px-4 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors flex items-center justify-center"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Reset Settings
          </button>

          {/* Cut & Download Button */}
          <button
            type="submit"
            disabled={isLoading}
            onClick={handleSubmit}
            className={`py-2 px-4 bg-blue-600 text-white rounded-lg transition-colors flex items-center justify-center flex-1 relative overflow-hidden ${
              isLoading
                ? "opacity-90 cursor-not-allowed"
                : "hover:bg-blue-700"
            }`}
          >
            {/* Ultra smooth progress bar background */}
            {isLoading && (
              <div
                className="absolute inset-0 bg-blue-400"
                style={{
                  width: `${smoothProgress}%`,
                  transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)", // Custom smooth easing
                  transform: "translateZ(0)", // Hardware acceleration
                  willChange: "width", // Optimize for width changes
                }}
              />
            )}

            {/* Subtle glow effect for progress bar */}
            {isLoading && smoothProgress > 0 && (
              <div
                className="absolute inset-0 bg-gradient-to-r from-blue-300 to-blue-500 opacity-60"
                style={{
                  width: `${smoothProgress}%`,
                  transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  transform: "translateZ(0)",
                  filter: "blur(1px)",
                }}
              />
            )}

            {/* Button content */}
            <div className="relative z-10 flex items-center">
              {isLoading ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5 mr-2"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    style={{ animationDuration: "1.5s" }} // Slower, smoother spin
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span
                    className="font-medium"
                    style={{
                      transition: "all 0.2s ease-out",
                      transform: "translateZ(0)",
                    }}
                  >
                    {smoothProgress > 0
                      ? `Progress ${smoothProgress}%`
                      : "Processing..."}
                  </span>
                </>
              ) : (
                <>
                  <Scissors className="w-5 h-5 mr-2" />
                  Cut & Download
                </>
              )}
            </div>
          </button>
        </div>
      </div>

      {/* ========== DOWNLOAD RESULTS SECTION ========== */}
      {downloadUrl && (
        <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-xl shadow-lg border border-green-200 p-6 text-center max-w-full overflow-hidden">
          {/* Success Icon */}
          <div className="flex items-center justify-center mb-4">
            <div className="bg-green-100 rounded-full p-3">
              <svg className="w-8 h-8 text-green-600" viewBox="0 0 24 24" fill="none">
                <path
                  d="M7 13L10 16L17 9"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              </svg>
            </div>
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">
          Processing Complete!
          </h3>
          <p className="text-gray-600 mb-6">
            Your audio file has been successfully processed and is ready for download.
          </p>

          {/* Main download options */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-6">
            {/* Direct Download */}
            <div className="flex flex-col items-center min-w-0 flex-shrink-0">
              <a
                href={downloadUrl}
                download
                className="inline-flex items-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors mb-2 font-medium whitespace-nowrap shadow-md"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Download className="w-5 h-5 mr-2 flex-shrink-0" />
                Download {outputFormat.toUpperCase()}
              </a>
              <span className="text-sm text-gray-500 text-center">
                Direct download to this device
              </span>
            </div>

            {/* QR Code for direct downloa */}
            {showQrCode && qrCodeDataUrl && (
              <>
                <div className="hidden sm:block w-px h-32 bg-gray-300 flex-shrink-0"></div>
                <div className="sm:hidden w-full h-px bg-gray-300 my-2"></div>

                <div className="flex flex-col items-center min-w-0 flex-shrink-0">
                  <div className="bg-white p-4 rounded-xl border-2 border-gray-200 shadow-lg mb-3">
                    <img
                      src={qrCodeDataUrl}
                      alt="QR Code for direct download"
                      className="w-32 h-32 block"
                      style={{ imageRendering: "pixelated" }}
                    />
                  </div>
                  <div className="text-center">
                    <span className="text-sm text-gray-700 font-medium block mb-1">
                      📱 Scan QR Code
                    </span>
                    <span className="text-xs text-gray-500">
                      Download on mobile device
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Share Link Section */}
          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center justify-center mb-4">
              <svg
                className="w-5 h-5 text-blue-600 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
                />
              </svg>
              <h3 className="text-lg font-semibold text-gray-800">
                Share with Others
              </h3>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex items-center gap-2 sm:gap-4">
                {/* Share link input với button copy */}
                <div
                  className="flex-1 flex items-stretch min-w-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="text"
                    value={shareLink || "Generating share link..."}
                    readOnly
                    placeholder="Share link will appear here..."
                    className="flex-1 min-w-0 px-3 py-2.5 border border-gray-300 rounded-l-md bg-white text-sm font-mono text-gray-700 focus:outline-none focus:ring-0 focus:border-gray-300 border-r-0 truncate"
                    style={{
                      borderTopRightRadius: 0,
                      borderBottomRightRadius: 0,
                      outline: "none",
                      boxShadow: "none",
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      console.log("[ProcessingAndResults] Copy button clicked");
                      copyShareLink(e);
                    }}
                    disabled={!shareLink}
                    className={`px-3 sm:px-4 py-2.5 rounded-r-md border transition-colors flex items-center font-medium whitespace-nowrap focus:outline-none focus:ring-0 flex-shrink-0 ${
                      isCopied
                        ? "bg-green-500 text-white border-green-500"
                        : !shareLink
                        ? "bg-gray-300 text-gray-500 cursor-not-allowed border-gray-300"
                        : "bg-blue-600 text-white hover:bg-blue-700 border-blue-600 hover:border-blue-700"
                    }`}
                    style={{
                      borderTopLeftRadius: 0,
                      borderBottomLeftRadius: 0,
                      outline: "none",
                      boxShadow: "none",
                    }}
                  >
                    {isCopied ? (
                      <>
                        <svg
                          className="w-4 h-4 mr-2"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Copied
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-4 h-4 mr-2"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                        Copy
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Help section - Simplified */}
          <div className="mt-6 bg-blue-50 rounded-lg border border-blue-200 p-4">
            <div className="flex items-center justify-center mb-3">
              <svg
                className="w-4 h-4 mr-2 text-blue-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
              <h3 className="font-medium text-blue-900">
                Download & Share Ready
              </h3>
            </div>
            <p className="text-center text-sm text-blue-700">
              Use the download button above for direct download, or copy the share link to send to others.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}