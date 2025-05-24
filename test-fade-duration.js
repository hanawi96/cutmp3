// Test script to verify fadeInDuration handling
const FormData = require('form-data');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const fs = require('fs');
const path = require('path');

async function testFadeDuration() {
  console.log('🧪 Testing fadeInDuration parameter...');
    // Use one of the existing output files as test input
  const testFilePath = path.join(__dirname, 'backend/output/cut_1748072868709.mp3');
  
  if (!fs.existsSync(testFilePath)) {
    console.error('❌ Test file not found:', testFilePath);
    return;
  }
  
  const formData = new FormData();
  formData.append('audio', fs.createReadStream(testFilePath));
  formData.append('start', '2');
  formData.append('end', '10'); 
  formData.append('volume', '1.0');
  formData.append('volumeProfile', 'uniform');
  formData.append('fadeIn', 'true');
  formData.append('fadeOut', 'false');
  formData.append('fadeInDuration', '3.5'); // Test with 3.5 seconds (less than clip duration)
  formData.append('fadeOutDuration', '3');
  formData.append('normalizeAudio', 'false');
  formData.append('outputFormat', 'mp3');
  formData.append('customVolume', JSON.stringify({ start: 1.0, middle: 1.0, end: 1.0 }));
  
  console.log('📤 Sending request with fadeInDuration: 3.5 seconds');
  
  try {
    const response = await fetch('http://localhost:5000/api/cut-mp3', {
      method: 'POST',
      body: formData
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Request successful:', result);
    } else {
      const error = await response.text();
      console.error('❌ Request failed:', error);
    }
  } catch (err) {
    console.error('❌ Network error:', err.message);
  }
}

testFadeDuration();
