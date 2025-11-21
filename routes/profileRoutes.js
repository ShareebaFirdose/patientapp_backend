import express from "express";
import multer from "multer";
import path from "path";
import { authenticateJWT } from "../middleware/authMiddleware.js";
import {
  checkProfile,
  getProfile,
  createProfile,
} from "../controllers/profileController.js";

const router = express.Router();

// ✅ Enhanced Multer Configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  // Accept images only
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed!"), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: fileFilter,
});

// ✅ Debug Middleware (temporary - remove in production)
const debugMiddleware = (req, res, next) => {
  console.log("🔍 Request headers:", req.headers);
  console.log("🔍 Content-Type:", req.headers["content-type"]);
  next();
};

// ✅ Routes
router.get("/check-profile", authenticateJWT, checkProfile);
router.get("/me", authenticateJWT, getProfile);

// Add debug middleware before upload
router.post(
  "/create",
  authenticateJWT,
  debugMiddleware,
  upload.single("profile_picture"),
  (req, res, next) => {
    console.log("📥 After Multer - req.body:", req.body);
    console.log("📁 After Multer - req.file:", req.file);
    next();
  },
  createProfile
);

export default router;