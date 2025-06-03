const ffmpegPath = require('ffmpeg-static');
const { exec } = require('child_process');

console.log('📁 FFmpeg path:', ffmpegPath);

exec(`"${ffmpegPath}" -version`, (err, stdout) => {
  if (err) {
    console.error('❌ FFmpeg lỗi:', err.message);
    return;
  }

  console.log('✅ FFmpeg hoạt động!');
  console.log(stdout.split('\n')[0]); // In ra dòng chứa phiên bản
});
