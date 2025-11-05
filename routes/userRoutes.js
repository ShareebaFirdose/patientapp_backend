import express from "express";
import multer from "multer";
import { createOrUpdateUserProfile } from "../controllers/userController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post("/profile", protect, upload.single("profile_picture"), createOrUpdateUserProfile);

export default router;
