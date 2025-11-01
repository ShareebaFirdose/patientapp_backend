import express from "express";
import { authenticateUser } from "../middleware/auth.js";
import { getUserProfile } from "../controllers/userController.js";

const router = express.Router();

// ✅ Protected route
router.get("/profile", authenticateUser, getUserProfile);

export default router;
