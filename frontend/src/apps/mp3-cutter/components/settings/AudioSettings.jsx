import React from 'react';
import { Settings } from 'lucide-react';

export default function AudioSettings({
  // Audio settings
  normalizeAudio, setNormalizeAudio,
  outputFormat, setOutputFormat,
}) {

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">
        <Settings className="w-5 h-5 inline mr-2 text-blue-600" />
        Additional Options
      </h3>

      <div className="space-y-4">
        <div className="bg-gray-50 p-4 rounded-lg">
          {/* Normalize Audio Checkbox */}
          <label className="flex items-center p-2 hover:bg-gray-100 rounded-md cursor-pointer">
            <input
              type="checkbox"
              checked={normalizeAudio}
              onChange={(e) => setNormalizeAudio(e.target.checked)}
              className="h-4 w-4 text-blue-600 rounded accent-blue-600"
            />
            <span className="ml-2 text-sm text-gray-700">Normalize Audio</span>
            {normalizeAudio && (
              <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-800 text-xs font-medium rounded-full animate-pulse">
                ENABLED
              </span>
            )}
            <span className="ml-2 text-xs text-gray-500">
              (Adjusts audio to streaming standards: -16 LUFS, -1.5 dBTP)
            </span>
          </label>

          {/* Output Format Dropdown */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Output Format
            </label>
            <select
              value={outputFormat}
              onChange={(e) => setOutputFormat(e.target.value)}
              className="w-full py-2 px-3 bg-white border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="mp3">MP3</option>
              <option value="m4r">M4R</option>
              <option value="m4a">M4A</option>
              <option value="wav">WAV</option>
              <option value="aac">AAC</option>
              <option value="ogg">OGG</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}