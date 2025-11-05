import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { checkProfile, getProfile, createProfile } from "../controllers/profileController.js";

const router = express.Router();

router.get("/check-profile", protect, checkProfile);
router.get("/me", protect, getProfile);
router.post("/create", protect, createProfile);

export default router;
