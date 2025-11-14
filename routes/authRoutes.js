import express from "express";
import {
  loginUser,
  registerUser,
  requestLoginOtp,
  verifyLoginOtp,
  requestMobileOtp,
  verifyMobileOtp,
  getLoggedInUser
} from "../controllers/authController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/login", loginUser);
router.post("/register", registerUser);

router.post("/request-login-otp", requestLoginOtp);
router.post("/verify-login-otp", verifyLoginOtp);

router.post("/request-mobile-otp", requestMobileOtp);
router.post("/verify-mobile-otp", verifyMobileOtp);

router.get("/me", authMiddleware, getLoggedInUser);

export default router;
