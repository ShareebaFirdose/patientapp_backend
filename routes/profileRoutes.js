import express from "express";
import multer from "multer";
import { protect } from "../middleware/authMiddleware.js";
import { checkProfile, getProfile, createProfile } from "../controllers/profileController.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" }); // temporary local folder before Cloudinary upload

router.get("/check-profile", protect, checkProfile);
router.get("/me", protect, getProfile);
router.post("/create", protect, upload.single("profile_picture"), createProfile); // ✅ allows file upload

export default router;
