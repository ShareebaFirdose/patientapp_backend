// routes/authRoutes.js
import express from "express";
import {
  signupUser,
  verifyOtp,
  requestLoginOtp,
  verifyLoginOtp,
  requestMobileOtp,
  verifyMobileOtp,
} from "../controllers/authController.js";

const router = express.Router();

router.post("/signup", signupUser);
router.post("/verify-otp", verifyOtp);
router.post("/request-login-otp", requestLoginOtp);
router.post("/verify-login-otp", verifyLoginOtp);
router.post("/request-mobile-otp", requestMobileOtp);
router.post("/verify-mobile-otp", verifyMobileOtp);

export default router;
