import db from "../config/db.js";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

/* ============================================================
   GENERATE 6-DIGIT OTP
============================================================ */
const generateOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

/* ============================================================
   SEND OTP USING PINNACLE (Signup / Login / Forgot)
============================================================ */
const sendOtpSms = async (phone, otp, type = "login") => {
  try {
    let templateId = "";

    if (type === "signup") {
      templateId = process.env.PINNACLE_SIGNUP_TEMPLATE_ID;
    } else if (type === "forgot") {
      templateId = process.env.PINNACLE_FORGOT_TEMPLATE_ID;
    } else {
      templateId = process.env.PINNACLE_LOGIN_TEMPLATE_ID;
    }

    const msg = `Your PRED APP login OTP is ${otp}. Do not share this code with anyone. This code is valid for 10 minutes. - PRED CR`;

    const payload = {
      version: "1.0",
      accesskey: process.env.PINNACLE_API_KEY,
      messages: [
        {
          dest: [phone],
          msg,
          type: "PM",
          header: process.env.PINNACLE_SENDER_ID,
          app_country: "1",
          country_cd: "91",
          dlt_entity_id: process.env.PINNACLE_DLT_ENTITY_ID,
          dlt_template_id: templateId,
        },
      ],
    };

    console.log("📤 SMS Payload:", payload);

    const response = await axios.post(process.env.PINNACLE_BASE_URL, payload, {
      headers: { "Content-Type": "application/json" },
    });

    console.log("📥 SMS Response:", response.data);

    if (!response.data || response.data.status.code !== "200") {
      console.log("❌ SMS Delivery Failed:", response.data);
      return false;
    }

    return true;
  } catch (error) {
    console.log("❌ Pinnacle SMS Error:", error.message);
    return false;
  }
};

/* ============================================================
   SEND EMAIL OTP
============================================================ */
const sendEmailOtp = async (email, otp, subject) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject,
      text: `Your OTP is ${otp}. Valid for 10 minutes.`,
    });

    return true;
  } catch (error) {
    console.log("❌ Email OTP Error:", error.message);
    return false;
  }
};

/* ============================================================
   LOGIN USER (Normal Login)
============================================================ */
export const loginUser = async (req, res) => {
  try {
    const { email, phone_number } = req.body;

    const [rows] = await db.query(
      "SELECT id, name, email, phone_number, status FROM users WHERE email = ? OR phone_number = ? LIMIT 1",
      [email, phone_number]
    );

    if (rows.length === 0)
      return res.status(400).json({ success: false, message: "User not found" });

    const user = rows[0];

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    return res.json({
      success: true,
      message: "Login successful",
      token,
      user,
    });
  } catch (err) {
    console.error("loginUser Error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

/* ============================================================
   SIGNUP – SEND OTP (Email + SMS)
============================================================ */
export const signupRequestOtp = async (req, res) => {
  try {
    const { name, email, phone_number } = req.body;

    const [exist] = await db.query(
      "SELECT id FROM users WHERE email=? OR phone_number=?",
      [email, phone_number]
    );

    if (exist.length > 0)
      return res.json({ success: false, message: "User already exists" });

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await db.query(
      `INSERT INTO users (name, email, phone_number, otp, otp_expiry, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [name, email, phone_number, otp, expiresAt]
    );

    await sendEmailOtp(email, otp, "Your Signup OTP");
    await sendOtpSms(phone_number, otp, "signup");

    return res.json({
      success: true,
      message: "Signup OTP sent successfully",
    });
  } catch (err) {
    console.log("Signup OTP Error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to send signup OTP",
    });
  }
};

/* ============================================================
   SIGNUP – VERIFY OTP
============================================================ */
export const signupVerifyOtp = async (req, res) => {
  try {
    const { email, phone_number, otp } = req.body;

    const [rows] = await db.query(
      "SELECT * FROM users WHERE email=? AND phone_number=? LIMIT 1",
      [email, phone_number]
    );

    if (rows.length === 0)
      return res.status(400).json({ success: false, message: "User not found" });

    const user = rows[0];

    if (user.status !== "pending")
      return res.status(400).json({ success: false, message: "Already verified" });

    if (otp !== user.otp)
      return res.status(400).json({ success: false, message: "Invalid OTP" });

    if (new Date() > user.otp_expiry)
      return res.status(400).json({ success: false, message: "OTP expired" });

    await db.query(
      "UPDATE users SET otp=NULL, otp_expiry=NULL, status='active' WHERE id=?",
      [user.id]
    );

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    return res.json({
      success: true,
      message: "Signup verified successfully",
      token,
    });
  } catch (err) {
    console.log("signupVerifyOtp Error:", err.message);
    return res.status(500).json({ success: false, message: "Verification failed" });
  }
};

/* ============================================================
   LOGIN – SEND EMAIL OTP
============================================================ */
export const requestLoginOtp = async (req, res) => {
  try {
    const { email } = req.body;

    const [rows] = await db.query("SELECT id FROM users WHERE email=?", [email]);

    if (rows.length === 0)
      return res.status(400).json({ success: false, message: "Email not registered" });

    const otp = generateOtp();

    await db.query(
      "UPDATE users SET otp=?, otp_expiry=DATE_ADD(NOW(), INTERVAL 10 MINUTE) WHERE email=?",
      [otp, email]
    );

    await sendEmailOtp(email, otp, "Your Login OTP");

    return res.json({ success: true, message: "Login OTP sent to email" });
  } catch (err) {
    console.log("requestLoginOtp Error:", err.message);
    return res.status(500).json({ success: false, message: "Failed to send OTP" });
  }
};

/* ============================================================
   LOGIN – VERIFY EMAIL OTP
============================================================ */
export const verifyLoginOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const [rows] = await db.query(
      "SELECT * FROM users WHERE email=? LIMIT 1",
      [email]
    );

    if (rows.length === 0)
      return res.status(400).json({ success: false, message: "Email not found" });

    const user = rows[0];

    if (otp !== user.otp)
      return res.status(400).json({ success: false, message: "Invalid OTP" });

    if (new Date() > user.otp_expiry)
      return res.status(400).json({ success: false, message: "OTP expired" });

    await db.query(
      "UPDATE users SET otp=NULL, otp_expiry=NULL WHERE id=?",
      [user.id]
    );

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    return res.json({
      success: true,
      message: "Login successful",
      token,
      user,
    });
  } catch (err) {
    console.log("verifyLoginOtp Error:", err.message);
    return res.status(500).json({
      success: false,
      message: "OTP verification failed",
    });
  }
};

/* ============================================================
   LOGIN – SEND MOBILE OTP
============================================================ */
export const requestMobileOtp = async (req, res) => {
  try {
    const { phone_number } = req.body;

    const [rows] = await db.query(
      "SELECT id FROM users WHERE phone_number=?",
      [phone_number]
    );

    if (rows.length === 0)
      return res.status(400).json({ success: false, message: "Mobile not registered" });

    const otp = generateOtp();

    await db.query(
      "UPDATE users SET otp=?, otp_expiry=DATE_ADD(NOW(), INTERVAL 10 MINUTE) WHERE phone_number=?",
      [otp, phone_number]
    );

    const sent = await sendOtpSms(phone_number, otp, "login");

    if (!sent)
      return res.status(500).json({
        success: false,
        message: "Failed to send OTP. Check DLT template",
      });

    return res.json({ success: true, message: "Mobile OTP sent" });
  } catch (err) {
    console.error("requestMobileOtp Error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to send mobile OTP",
    });
  }
};

/* ============================================================
   LOGIN – VERIFY MOBILE OTP
============================================================ */
export const verifyMobileOtp = async (req, res) => {
  try {
    const { phone_number, otp } = req.body;

    const [rows] = await db.query(
      "SELECT * FROM users WHERE phone_number=? LIMIT 1",
      [phone_number]
    );

    if (rows.length === 0)
      return res.json({ success: false, message: "Mobile not found" });

    const user = rows[0];

    if (otp !== user.otp)
      return res.json({ success: false, message: "Invalid OTP" });

    if (new Date() > user.otp_expiry)
      return res.json({ success: false, message: "OTP expired" });

    await db.query(
      "UPDATE users SET otp=NULL, otp_expiry=NULL WHERE id=?",
      [user.id]
    );

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    return res.json({
      success: true,
      message: "Login successful",
      token,
      user,
    });
  } catch (err) {
    console.error("verifyMobileOtp Error:", err.message);
    return res.status(500).json({
      success: false,
      message: "OTP verification failed",
    });
  }
};

/* ============================================================
   GET LOGGED-IN USER
============================================================ */
export const getLoggedInUser = async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await db.query(
      "SELECT id, name, email, phone_number, status FROM users WHERE id=?",
      [userId]
    );

    return res.json({ success: true, user: rows[0] });
  } catch (err) {
    console.error("getLoggedInUser Error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch user data",
    });
  }
};
