// Cấu hình API URL và các thông số khác
const config = {
  API_URL: process.env.REACT_APP_API_URL || 'http://localhost:5000',
  
  // Thêm các cấu hình khác nếu cần
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
};

export default config; 