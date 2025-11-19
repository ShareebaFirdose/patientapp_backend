import express from "express";
import {
  loginUser,
  signupRequestOtp,
  signupVerifyOtp,
  requestLoginOtp,
  verifyLoginOtp,
  requestMobileOtp,
  verifyMobileOtp,
  getLoggedInUser,
} from "../controllers/authController.js";

import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

/* ---------------------------
   NORMAL LOGIN
---------------------------- */
router.post("/login", loginUser);

/* ---------------------------
   SIGNUP OTP
---------------------------- */
router.post("/signup-request-otp", signupRequestOtp);
router.post("/signup-verify-otp", signupVerifyOtp);

/* ---------------------------
   EMAIL LOGIN OTP
---------------------------- */
router.post("/request-login-otp", requestLoginOtp);
router.post("/verify-login-otp", verifyLoginOtp);

/* ---------------------------
   MOBILE LOGIN OTP
---------------------------- */
router.post("/request-mobile-otp", requestMobileOtp);
router.post("/verify-mobile-otp", verifyMobileOtp);

/* ---------------------------
   USER PROFILE
---------------------------- */
router.get("/me", authMiddleware, getLoggedInUser);

export default router;
