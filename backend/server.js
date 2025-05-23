const express = require("express");
const cors = require("cors");

console.log("🟦 Starting server...");

// Load routes
const mp3Routes = require("./routes/mp3");

const app = express();

// CORS configuration
app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://127.0.0.1:3000"
  ],
  methods: ["GET", "POST"],
  credentials: true
}));

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use("/api", mp3Routes);
app.use("/output", express.static("output"));

// Status endpoint
app.get("/status", (req, res) => {
  console.log("🟦 Status endpoint hit");
  res.json({ status: "ok", message: "Server is running" });
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({ message: "MP3 Cutter Backend Server" });
});

const PORT = process.env.PORT || 5000;

console.log("🟦 Attempting to start server...");

app.listen(PORT, () => {
  console.log(`✅ Server đang chạy tại http://localhost:${PORT}`);
  console.log(`✅ Server started successfully`);
}).on('error', (err) => {
  console.error('❌ Server error:', err);
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use!`);
  }
});