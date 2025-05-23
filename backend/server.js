const express = require("express");
const cors = require("cors");
const mp3Routes = require("./routes/mp3");

const app = express();

// Cấu hình CORS để chấp nhận nhiều origin
app.use(cors({
  origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
  methods: ["GET", "POST"],
  credentials: true
}));
app.use(express.json());
app.use("/api", mp3Routes);
app.use("/output", express.static("output"));

// Thêm endpoint kiểm tra server status
app.get("/status", (req, res) => {
  res.json({ status: "ok", message: "Server is running" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
});