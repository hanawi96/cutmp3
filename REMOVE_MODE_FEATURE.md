# 🗑️ Remove Mode Feature - Xóa Vùng Chọn

## 📋 Tổng Quan

Tính năng **Remove Mode** (Chế độ Xóa Vùng) cho phép người dùng **loại bỏ** một đoạn audio cụ thể thay vì cắt và giữ lại đoạn đó.

## 🔄 Sự Khác Biệt

### 🎯 Normal Mode (Chế độ Thường)
- **Giữ lại** phần audio từ `start` đến `end`
- **Loại bỏ** phần trước `start` và sau `end`
- Kết quả: File audio chỉ chứa đoạn đã chọn

### 🗑️ Remove Mode (Chế độ Xóa)
- **Loại bỏ** phần audio từ `start` đến `end`
- **Giữ lại** phần trước `start` và sau `end`
- Kết quả: File audio chứa toàn bộ except đoạn đã chọn

## 🛠️ Cách Sử Dụng

### Frontend
1. Chọn vùng audio cần xóa bằng cách kéo handles
2. Bấm nút **"Remove"** để bật Remove Mode
3. Khi Remove Mode được bật:
   - Nút "Remove" chuyển màu xanh dương
   - Waveform overlay hiển thị vùng sẽ bị xóa (màu xám)
   - Các hiệu ứng fade sẽ bị tắt tự động
4. Bấm **"Cut & Download"** để xử lý

### Backend Processing
- Backend nhận parameter `removeMode: true/false`
- Nếu `removeMode = true`:
  - Tạo 2 segments: trước và sau vùng xóa
  - Sử dụng FFmpeg complex filter để concatenate
  - Áp dụng filters (volume, fade, etc.) lên kết quả concatenated
- Nếu `removeMode = false`:
  - Xử lý bình thường (cắt từ start đến end)

## 🔧 Implementation Details

### Frontend Changes
1. **`useAudioHandlers.js`**: Thêm `removeMode` vào FormData
2. **UI Visual**: Overlay xám hiển thị vùng sẽ bị xóa
3. **Controls**: Nút Remove toggle và auto-disable fade effects

### Backend Changes
1. **Parameter Extraction**: `const removeMode = req.body?.removeMode === "true"`
2. **Duration Calculation**: 
   - Normal: `duration = endTime - startTime`
   - Remove: `duration = totalDuration - (endTime - startTime)`
3. **FFmpeg Processing**:
   ```javascript
   // Remove Mode - Complex Filter
   [0:a]atrim=0:${startTime},asetpts=PTS-STARTPTS[seg1]
   [0:a]atrim=${endTime},asetpts=PTS-STARTPTS[seg2]
   [seg1][seg2]concat=n=2:v=0:a=1[concatenated]
   [concatenated]${filters}[output]
   ```
4. **File Naming**: `removed_timestamp.format` vs `cut_timestamp.format`

## 📁 File Structure

```
frontend/src/apps/mp3-cutter/
├── hooks/useAudioHandlers.js          # ✅ Added removeMode to FormData
├── components/controls/AudioButtonsPanel.jsx  # Remove button UI
└── components/waveform/
    ├── WaveformSelector.jsx           # Remove mode state management
    └── services/canvasRenderer.js     # Visual overlay for delete mode

backend/routes/
└── mp3.js                            # ✅ Added removeMode processing logic
```

## 🎵 Audio Processing Logic

### Normal Mode Flow
```
Input Audio: [====AAAABBBBCCCC====]
Selection:        AAAA-BBBB
Result:           [AAAABBBB]
```

### Remove Mode Flow
```
Input Audio: [====AAAABBBBCCCC====]
Selection:        AAAA-BBBB  (to be removed)
Result:      [====AAAA    CCCC====] → [====AAAACCCC====]
```

## 🧪 Testing

### Test Cases
1. **Remove from Beginning**: Select 0-10s, remove → Keep 10s-end
2. **Remove from Middle**: Select 30-60s, remove → Keep 0-30s + 60s-end  
3. **Remove from End**: Select 120s-end, remove → Keep 0-120s
4. **Remove with Filters**: Volume, fade effects applied to result
5. **Different Formats**: MP3, M4A, WAV, etc.

### Expected Results
- ✅ Seamless audio without gaps
- ✅ Filters applied correctly
- ✅ Proper file metadata
- ✅ Correct duration calculation

## 🐛 Error Handling

- **Invalid Regions**: Fallback to normal mode
- **File Processing Errors**: Clear temp files
- **FFmpeg Errors**: Detailed error messages
- **Edge Cases**: Single segment handling

## 📝 Notes

- Remove Mode tự động tắt fade effects để tránh xung đột
- Temporary files được tạo và cleanup automatically
- Progress tracking riêng biệt cho delete mode
- File naming khác biệt để phân biệt output 