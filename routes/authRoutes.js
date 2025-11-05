import express from "express";
import {
  signupUser,
  verifyOtp,
  requestLoginOtp,
  verifyLoginOtp,
} from "../controllers/authController.js";

const router = express.Router();

router.post("/signup", signupUser);
router.post("/verify-otp", verifyOtp);
router.post("/request-login-otp", requestLoginOtp);
router.post("/verify-login-otp", verifyLoginOtp);

export default router;
