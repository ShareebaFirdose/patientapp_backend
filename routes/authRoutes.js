import express from "express";
import { signup, login, verifyOtp } from "../controllers/authController.js";

const router = express.Router();

// Signup
router.post("/signup", signup);

// Login
router.post("/login", login);

// Verify OTP
router.post("/verify-otp", verifyOtp);

export default router;
