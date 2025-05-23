# Script chạy backend và frontend cho MP3 Cutter
# Đặt file này trong thư mục gốc của dự án (allinone-tools)

Write-Host "Đang khởi động MP3 Cutter..." -ForegroundColor Yellow

# Tạo thư mục uploads và output trong backend nếu chưa tồn tại
$backendDir = Join-Path -Path $PSScriptRoot -ChildPath "backend"
$uploadsDir = Join-Path -Path $backendDir -ChildPath "uploads"
$outputDir = Join-Path -Path $backendDir -ChildPath "output"

if (-not (Test-Path -Path $uploadsDir)) {
    New-Item -Path $uploadsDir -ItemType Directory -Force
    Write-Host "Đã tạo thư mục uploads" -ForegroundColor Green
}

if (-not (Test-Path -Path $outputDir)) {
    New-Item -Path $outputDir -ItemType Directory -Force
    Write-Host "Đã tạo thư mục output" -ForegroundColor Green
}

# Kiểm tra xem port 5000 đã được sử dụng chưa
function Test-PortInUse {
    param (
        [int]$Port
    )
    
    try {
        $tcpClient = New-Object System.Net.Sockets.TcpClient
        $tcpClient.Connect("localhost", $Port)
        $tcpClient.Close()
        return $true
    } catch {
        return $false
    }
}

# Kiểm tra và thông báo nếu port 5000 đã được sử dụng
if (Test-PortInUse -Port 5000) {
    Write-Host "CẢNH BÁO: Port 5000 đã được sử dụng." -ForegroundColor Yellow
    Write-Host "Backend sẽ tự động tìm port khác (5001, 5002, ...)." -ForegroundColor Yellow
    Write-Host "Frontend cũng sẽ tự động tìm đúng port mà backend đang chạy." -ForegroundColor Yellow
}

# Khởi động backend trong một cửa sổ mới
Write-Host "Đang khởi động backend server..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit -Command `"cd '$backendDir'; npm start`""

# Đợi một chút để backend khởi động
Start-Sleep -Seconds 5

# Khởi động frontend trong một cửa sổ mới
Write-Host "Đang khởi động frontend server..." -ForegroundColor Cyan
$frontendDir = Join-Path -Path $PSScriptRoot -ChildPath "frontend"
Start-Process powershell -ArgumentList "-NoExit -Command `"cd '$frontendDir'; npm start`""

Write-Host "Các server đã được khởi động!" -ForegroundColor Green
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Magenta
Write-Host "Backend: http://localhost:5000 (hoặc port khác nếu 5000 đã được sử dụng)" -ForegroundColor Magenta
Write-Host "Nhấn Ctrl+C để dừng script này, đóng các cửa sổ PowerShell khác để dừng servers" -ForegroundColor Yellow

# Giữ script chạy cho đến khi người dùng nhấn Ctrl+C
try {
    while ($true) {
        Start-Sleep -Seconds 1
    }
} finally {
    Write-Host "Đã dừng script!" -ForegroundColor Red
} 