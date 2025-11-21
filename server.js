import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import morgan from "morgan";
import db from "./config/db.js";
import path from "path";
import multer from "multer";
import cloudinary from "./utils/cloudinary.js";

/* ✅ ROUTES */
import emrRoutes from "./routes/emrRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import doctorRoutes from "./routes/doctorRoutes.js";
import appointmentRoutes from "./routes/appointmentRoutes.js";
import patientRoutes from "./routes/patientRoutes.js";
import doctorAvailabilityRoutes from "./routes/doctorAvailabilityRoutes.js";
import videoRoutes from "./routes/videoRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(morgan("dev"));

/* =========================
 ✅ THESE ROUTES MUST COME BEFORE BODY PARSER
========================= */
app.use("/api/emr", emrRoutes);
app.use("/emr", emrRoutes);

/* ✅ THIS IS THE CRITICAL FIX */
app.use("/api/profile", profileRoutes); // ⬅️ moved BEFORE express.json

/* =========================
 ✅ NOW enable JSON for other routes
========================= */
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));

/* =========================
   DB CHECK
========================= */
(async () => {
  try {
    await db.getConnection();
    console.log("✅ MySQL Connected Successfully!");
  } catch (error) {
    console.error("❌ MySQL Connection Failed:", error.message);
    process.exit(1);
  }
})();

/* =========================
   ROOT
========================= */
app.get("/", (req, res) => {
  res.status(200).json({ success: true, message: "Server running" });
});

/* =========================
   OTHER ROUTES (SAFE WITH JSON)
========================= */
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/patients", patientRoutes);
app.use("/doctor_availability", doctorAvailabilityRoutes);
app.use("/api/video", videoRoutes);
app.use("/api/payment", paymentRoutes);

/* =========================
   DEFAULT UPLOAD
========================= */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/general"),
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname),
});

const upload = multer({ storage });

app.post("/api/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No file" });
  }

  const result = await cloudinary.uploader.upload(req.file.path, {
    folder: "predcare",
  });

  res.json({ success: true, url: result.secure_url });
});

/* =========================
   STATIC
========================= */
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

/* =========================
   ERROR
========================= */
app.use((err, req, res, next) => {
  console.error("❌ Global Error:", err.stack);
  res.status(500).json({ success: false, message: err.message });
});

/* =========================
   START
========================= */
app.listen(5000, () => {
  console.log("✅ Server running on port 5000");
});
