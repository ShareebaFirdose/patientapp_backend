import express from "express";
import dotenv from "dotenv";
import cors from "cors";
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
import appointmentRoutes from "./routes/appointmentRoutes.js";
import patientRoutes from "./routes/patientRoutes.js";
import doctorAvailabilityRoutes from "./routes/doctorAvailabilityRoutes.js";
import videoRoutes from "./routes/videoRoutes.js";


// ✅ ✅ NEW Razorpay route
import paymentRoutes from "./routes/paymentRoutes.js"; // 👈 Add this line

// ✅ Load environment variables
dotenv.config();

// ✅ Initialize Express app
const app = express();

// ✅ Core Middlewares
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// ✅ Multer storage configuration (for uploads)
const storage = multer.diskStorage({
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

// ✅ Root test route
app.get("/", (req, res) => {
  res.status(200).send({
    success: true,
    message: "🚀 PredCare Backend is running successfully!",
    environment: process.env.NODE_ENV || "development",
    time: new Date().toLocaleString(),
  });
});

// ✅ MySQL connection check
(async () => {
  try {
    await db.getConnection();
    console.log("✅ MySQL Connected Successfully!");
  } catch (err) {
    console.error("❌ Database connection failed:", err.message);
    process.exit(1);
  }
})();

// ✅ API Routes

app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/doctor_availability", doctorAvailabilityRoutes);
app.use("/api/video", videoRoutes);


// ✅ ✅ Add Payment Route (important!)
app.use("/api/payment", paymentRoutes); // 👈 Now registered correctly

// ✅ Cloudinary test route
app.get("/api/test-cloudinary", async (req, res) => {
  try {
    const result = await cloudinary.api.ping();
    res.status(200).json({
      success: true,
      message: "✅ Cloudinary connected successfully!",
      result,
    });
  } catch (error) {
    console.error("❌ Cloudinary Test Error:", error);
    res.status(500).json({
      success: false,
      message: "Cloudinary connection failed",
      error: error.message,
    });
  }
});

// ✅ File Upload Route (Uploads to Cloudinary)
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
    console.error("❌ Cloudinary Upload Error:", error);
    res.status(500).json({
      success: false,
      message: "File upload failed",
      error: error.message,
    });
  }
});

// ✅ Serve static uploads folder
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// ✅ 404 Route Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `❌ Route not found: ${req.originalUrl}`,
  });
});

// ✅ Global Error Handler
app.use((err, req, res, next) => {
  console.error("❌ Global Error:", err.stack);
  res.status(500).json({
    success: false,
    message: "Internal Server Error",
    error: err.message,
  });
});

// ✅ Start Express Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running → http://localhost:${PORT}`);
});
