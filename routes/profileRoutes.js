import express from "express";
import multer from "multer";
import { authenticateJWT } from "../middleware/authMiddleware.js";
import {
  checkProfile,
  getProfile,
  createProfile,
} from "../controllers/profileController.js";

const router = express.Router();

// ✅ Multer for image upload (temporary local before Cloudinary)
const upload = multer({ dest: "uploads/" });

// ✅ Routes
router.get("/check-profile", authenticateJWT, checkProfile);
router.get("/me", authenticateJWT, getProfile);
router.post("/create", authenticateJWT, upload.single("profile_picture"), createProfile);

export default router;
