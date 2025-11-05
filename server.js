import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import bodyParser from "body-parser";
import morgan from "morgan";
import db from "./config/db.js";
import cloudinary from "./utils/cloudinary.js";
import multer from "multer";
import path from "path";

// ✅ Import routes
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import doctorRoutes from "./routes/doctorRoutes.js";
import appointmentRoutes from "./routes/appointmentRoutes.js"; // ✅ New Appointment Feature

// ✅ Load environment variables
dotenv.config();

// ✅ Initialize Express
const app = express();

// ✅ Middleware stack
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(morgan("dev")); // Logs API requests in console

// ✅ Multer file upload config
const storage = multer.diskStorage({
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

// ✅ Test root route
app.get("/", (req, res) => {
  res.status(200).send({
    success: true,
    message: "🚀 PredCare Backend is running successfully!",
    environment: process.env.NODE_ENV || "development",
    time: new Date().toLocaleString(),
  });
});

// ✅ MySQL connection check (async-safe)
(async () => {
  try {
    await db.getConnection();
    console.log("✅ MySQL Connected Successfully!");
  } catch (err) {
    console.error("❌ Database connection failed:", err.message);
    process.exit(1); // Stop app if DB fails
  }
})();

// ✅ API Routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/appointments", appointmentRoutes);

// ✅ File upload route
app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "predcare_profiles",
      resource_type: "image",
    });

    res.status(200).json({
      success: true,
      message: "✅ File uploaded successfully!",
      url: result.secure_url,
      public_id: result.public_id,
    });
  } catch (error) {
    console.error("❌ Cloudinary upload error:", error);
    res.status(500).json({ success: false, message: "File upload failed", error: error.message });
  }
});

// ✅ Static assets (for uploaded files if needed)
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// ✅ Catch-all 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.originalUrl}`,
  });
});

// ✅ Global error handler
app.use((err, req, res, next) => {
  console.error("❌ Global Error:", err.stack);
  res.status(500).json({
    success: false,
    message: "Internal Server Error",
    error: err.message,
  });
});

// ✅ Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running → http://localhost:${PORT}`);
});
