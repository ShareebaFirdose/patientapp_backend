import db from "../config/db.js";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

/* ============================================================
   Generate OTP
============================================================ */
const generateOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

/* ============================================================
   LOGIN USER
============================================================ */
export const loginUser = async (req, res) => {
  try {
    const { email, phone_number } = req.body;

    const [rows] = await db.query(
      "SELECT id, email, phone_number FROM users WHERE email = ? OR phone_number = ? LIMIT 1",
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
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/* ============================================================
   REGISTER USER
============================================================ */
export const registerUser = async (req, res) => {
  try {
    const { name, email, phone_number, password } = req.body;

    const [exists] = await db.query(
      "SELECT id FROM users WHERE email = ? OR phone_number = ?",
      [email, phone_number]
    );

    if (exists.length > 0)
      return res.status(400).json({
        success: false,
        message: "User already exists",
      });

    await db.query(
      "INSERT INTO users (name, email, phone_number, password, status) VALUES (?, ?, ?, ?, 'active')",
      [name, email, phone_number, password]
    );

    return res.json({ success: true, message: "User registered successfully" });
  } catch (err) {
    console.error("registerUser Error:", err.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/* ============================================================
   SEND EMAIL OTP
============================================================ */
export const requestLoginOtp = async (req, res) => {
  try {
    const { email } = req.body;

    const [rows] = await db.query("SELECT id FROM users WHERE email = ?", [
      email,
    ]);

    if (rows.length === 0)
      return res.status(400).json({
        success: false,
        message: "Email not registered",
      });

    const userId = rows[0].id;
    const otp = generateOtp();

    await db.query(
      "UPDATE users SET otp = ?, otp_expiry = DATE_ADD(NOW(), INTERVAL 10 MINUTE) WHERE id = ?",
      [otp, userId]
    );

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your Login OTP",
      text: `Your OTP is ${otp}. Valid for 10 minutes.`,
    });

    return res.json({ success: true, message: "OTP sent to email" });
  } catch (err) {
    console.error("requestLoginOtp Error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to send email OTP",
    });
  }
};

/* ============================================================
   VERIFY EMAIL OTP
============================================================ */
export const verifyLoginOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const [rows] = await db.query(
      "SELECT id, otp AS dbOtp, otp_expiry FROM users WHERE email = ?",
      [email]
    );

    if (rows.length === 0)
      return res.status(400).json({ success: false, message: "Email not found" });

    const user = rows[0];

    // Debug logs
    console.log("Entered OTP:", otp);
    console.log("DB OTP:", user.dbOtp);

    if (!user.dbOtp)
      return res.status(400).json({ success: false, message: "OTP not generated" });

    // Safe comparison
    if (String(otp).trim() !== String(user.dbOtp).trim()) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    if (new Date() > new Date(user.otp_expiry)) {
      return res.status(400).json({ success: false, message: "OTP expired" });
    }

    await db.query("UPDATE users SET otp = NULL, otp_expiry = NULL WHERE id = ?", [
      user.id,
    ]);

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    return res.json({ success: true, message: "Login successful", token });
  } catch (err) {
    console.error("verifyLoginOtp ERROR:", err.message);
    return res.status(500).json({ success: false, message: "OTP verification failed" });
  }
};

/* ============================================================
   SEND MOBILE OTP (Pinnacle JSON API)
============================================================ */
export const requestMobileOtp = async (req, res) => {
  try {
    const { phone_number } = req.body;

    const [rows] = await db.query(
      "SELECT id FROM users WHERE phone_number = ?",
      [phone_number]
    );

    if (rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Mobile number not registered",
      });
    }

    const userId = rows[0].id;
    const otp = generateOtp();

    await db.query(
      "UPDATE users SET otp = ?, otp_expiry = DATE_ADD(NOW(), INTERVAL 10 MINUTE) WHERE id = ?",
      [otp, userId]
    );

    // Correct Pinnacle JSON template
    const smsPayload = {
      version: "1.0",
      accesskey: process.env.PINNACLE_API_KEY,
      encrypt: "0",
      messages: [
        {
          dest: [phone_number],
          msg: `Your PRED APP login OTP is ${otp}. Do not share this code with anyone. This code is valid for 10 minutes. - PRED CR`,
          type: "PM",
          header: process.env.PINNACLE_SENDER_ID,
          app_country: "1",
          country_cd: "91",
          dlt_entity_id: process.env.PINNACLE_DLT_ENTITY_ID,
          dlt_template_id: process.env.PINNACLE_DLT_TEMPLATE_ID,
        },
      ],
    };

    console.log("📤 Sending SMS Payload:", smsPayload);

    try {
      const response = await axios.post(
        process.env.PINNACLE_BASE_URL,
        smsPayload,
        { headers: { "Content-Type": "application/json" } }
      );

      console.log("📥 SMS Gateway Response:", response.data);
    } catch (smsError) {
      console.log("❌ SMS Gateway Error:", smsError.response?.data || smsError.message);
    }

    return res.json({ success: true, message: "OTP sent to mobile" });
  } catch (err) {
    console.error("requestMobileOtp Error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to send mobile OTP",
    });
  }
};

/* ============================================================
   VERIFY MOBILE OTP
============================================================ */
export const verifyMobileOtp = async (req, res) => {
  try {
    const { phone_number, otp } = req.body;

    const [rows] = await db.query(
      "SELECT id, otp AS dbOtp, otp_expiry FROM users WHERE phone_number = ?",
      [phone_number]
    );

    if (rows.length === 0)
      return res.status(400).json({
        success: false,
        message: "Mobile number not found",
      });

    const user = rows[0];

    console.log("Entered OTP:", otp);
    console.log("DB OTP:", user.dbOtp);

    if (!user.dbOtp)
      return res.status(400).json({ success: false, message: "OTP not generated" });

    if (String(otp).trim() !== String(user.dbOtp).trim()) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    if (new Date() > new Date(user.otp_expiry)) {
      return res.status(400).json({ success: false, message: "OTP expired" });
    }

    await db.query("UPDATE users SET otp = NULL, otp_expiry = NULL WHERE id = ?", [
      user.id,
    ]);

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    return res.json({ success: true, message: "Login successful", token });
  } catch (err) {
    console.error("verifyMobileOtp ERROR:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "OTP verification failed" });
  }
};

/* ============================================================
   GET LOGGED IN USER
============================================================ */
export const getLoggedInUser = async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await db.query(
      "SELECT id, name, email, phone_number FROM users WHERE id = ?",
      [userId]
    );

    return res.json({ success: true, user: rows[0] });
  } catch (err) {
    console.error("getLoggedInUser Error:", err.message);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};
