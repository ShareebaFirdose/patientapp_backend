// controllers/authController.js
import db from "../config/db.js";
import nodemailer from "nodemailer";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

/**
 * Notes:
 * - This file supports:
 *   - Email signup + verify (existing)
 *   - Email login OTP (existing)
 *   - Mobile OTP request + verify (new, uses Pinnacle)
 *
 * - PINNACLE config read from env:
 *   PINNACLE_BASE_URL, PINNACLE_ACCESS_KEY, PINNACLE_HEADER, PINNACLE_COUNTRY_CD
 */

const PIN_BASE = process.env.PINNACLE_BASE_URL;
const ACCESS_KEY = process.env.PINNACLE_ACCESS_KEY;
const HEADER = process.env.PINNACLE_HEADER || "PREDCA";
const COUNTRY_CD = process.env.PINNACLE_COUNTRY_CD || "91";
const OTP_EXP_MIN = parseInt(process.env.OTP_EXPIRY_MINUTES || "5", 10);
const JWT_SECRET = process.env.JWT_SECRET || "changeme";

function generateOtp() {
  // 6 digit OTP
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendPinnacleSms(phone, message) {
  if (!PIN_BASE || !ACCESS_KEY) {
    throw new Error("Pinnacle not configured. Set PINNACLE_BASE_URL and PINNACLE_ACCESS_KEY in .env");
  }

  const payload = {
    version: "1.0",
    accesskey: ACCESS_KEY,
    encrypt: "0",
    messages: [
      {
        dest: [phone],
        msg: message,
        header: HEADER,
        type: "PM",
        app_country: "1",
        country_cd: COUNTRY_CD
      }
    ]
  };

  const resp = await axios.post(PIN_BASE, payload, {
    headers: { "Content-Type": "application/json" },
    timeout: 15000
  });

  return resp.data;
}

/* ---------------------------
   Signup (email) - existing
   --------------------------- */
export const signupUser = async (req, res) => {
  const { name, email, phone_number, password } = req.body;

  try {
    const [existing] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
    if (existing.length > 0)
      return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOtp();
    const otpExpiry = new Date(Date.now() + OTP_EXP_MIN * 60 * 1000);

    await db.query(
      "INSERT INTO users (name, email, phone_number, password, otp, otp_expiry, status) VALUES (?, ?, ?, ?, ?, ?, 'active')",
      [name, email, phone_number, hashedPassword, otp, otpExpiry]
    );

    // send email OTP
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "PredCare Registration OTP",
      text: `Your OTP for registration is: ${otp}. It will expire in ${OTP_EXP_MIN} minutes.`
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: "OTP sent successfully to email", email });
  } catch (error) {
    console.error("Signup Error:", error);
    res.status(500).json({ message: "Signup failed", error: error?.message });
  }
};

/* ---------------------------
   Verify Signup OTP (email) - existing
   --------------------------- */
export const verifyOtp = async (req, res) => {
  const { email, otp } = req.body;

  try {
    const [user] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
    if (user.length === 0)
      return res.status(400).json({ message: "User not found" });

    const u = user[0];
    if (!u.otp || u.otp !== otp) return res.status(400).json({ message: "Invalid OTP" });

    // expiry check if otp_expiry exists
    if (u.otp_expiry && new Date(u.otp_expiry) < new Date()) return res.status(400).json({ message: "OTP expired" });

    await db.query("UPDATE users SET otp = NULL, otp_expiry = NULL, is_verified = 1 WHERE email = ?", [email]);

    res.status(200).json({ message: "Signup successful!" });
  } catch (error) {
    console.error("OTP Verification Error:", error);
    res.status(500).json({ message: "OTP verification failed", error: error?.message });
  }
};

/* ---------------------------
   Send OTP for Login (email) - existing
   --------------------------- */
export const requestLoginOtp = async (req, res) => {
  const { email } = req.body;

  try {
    const [rows] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
    if (rows.length === 0) return res.status(400).json({ message: "User not found" });

    const user = rows[0];
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_EXP_MIN * 60 * 1000);

    // store on users table (since you already have otp and otp_expiry)
    await db.query("UPDATE users SET otp = ?, otp_expiry = ? WHERE id = ?", [otp, expiresAt, user.id]);

    // send via email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "PredCare Login OTP",
      text: `Your login OTP is: ${otp}. It will expire in ${OTP_EXP_MIN} minutes.`
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: "Login OTP sent successfully", email });
  } catch (error) {
    console.error("Request Login OTP Error:", error);
    res.status(500).json({ message: "Failed to send login OTP", error: error?.message });
  }
};

/* ---------------------------
   Verify Login OTP (email) - existing
   --------------------------- */
export const verifyLoginOtp = async (req, res) => {
  const { email, otp } = req.body;

  try {
    const [rows] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
    if (rows.length === 0) return res.status(400).json({ message: "User not found" });

    const user = rows[0];

    if (!user.otp || user.otp !== otp) return res.status(400).json({ message: "Invalid OTP" });

    if (user.otp_expiry && new Date(user.otp_expiry) < new Date()) return res.status(400).json({ message: "OTP expired" });

    // clear otp and update last login
    await db.query("UPDATE users SET otp = NULL, otp_expiry = NULL, last_login_at = NOW(), is_verified = 1 WHERE id = ?", [user.id]);

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "7d" });

    res.status(200).json({
      message: "Login successful via OTP",
      token,
      user: { id: user.id, name: user.name, email: user.email, phone_number: user.phone_number }
    });
  } catch (error) {
    console.error("Verify Login OTP Error:", error);
    res.status(500).json({ message: "OTP verification failed", error: error?.message });
  }
};

/* ---------------------------
   REQUEST MOBILE OTP (new)
   This uses Pinnacle to send SMS and stores OTP in users table.
   --------------------------- */
export const requestMobileOtp = async (req, res) => {
  try {
    let { phone_number } = req.body;
    if (!phone_number) return res.status(400).json({ message: "Phone number required" });

    // normalize: remove spaces and leading '+'
    phone_number = phone_number.toString().replace(/\s+/g, "").replace(/^\+/, "");

    const otp = generateOtp();
    const otpExpiry = new Date(Date.now() + OTP_EXP_MIN * 60 * 1000);

    // check if user exists; if exists update otp, else create a minimal user entry
    const [existing] = await db.query("SELECT * FROM users WHERE phone_number = ?", [phone_number]);
    if (existing.length > 0) {
      await db.query("UPDATE users SET otp = ?, otp_expiry = ? WHERE phone_number = ?", [otp, otpExpiry, phone_number]);
    } else {
      // create minimal row - you may want to collect name later on signup flow
      await db.query("INSERT INTO users (phone_number, otp, otp_expiry, status) VALUES (?, ?, ?, 'active')", [phone_number, otp, otpExpiry]);
    }

    // create SMS text (DLT template compliance: ensure your message template is approved)
    const smsText = `Your PredCare OTP is ${otp}. It expires in ${OTP_EXP_MIN} minutes.`;

    // send via Pinnacle
    const pinnResp = await sendPinnacleSms(phone_number, smsText);

    // check success - adjust per Pinnacle PDF response shape
    const statusCode = pinnResp?.status?.code;
    if (statusCode === "200" || Number(statusCode) === 200) {
      return res.json({ success: true, message: "OTP sent successfully", pinnacle: pinnResp });
    } else {
      // Pinnacle returned error - still keep OTP in DB for testing, but report error
      console.error("Pinnacle Error Response:", pinnResp);
      return res.status(500).json({ success: false, message: "SMS gateway error", detail: pinnResp });
    }
  } catch (err) {
    console.error("requestMobileOtp error", err?.response?.data || err?.message || err);
    res.status(500).json({ message: "Error sending mobile OTP", error: err?.message || err });
  }
};

/* ---------------------------
   VERIFY MOBILE OTP (new)
   - verifies against users. If user exists returns token
   - if user exists only with phone (no other details), still returns token with id
   --------------------------- */
export const verifyMobileOtp = async (req, res) => {
  try {
    let { phone_number, otp } = req.body;
    if (!phone_number || !otp) return res.status(400).json({ message: "Phone number and OTP required" });

    phone_number = phone_number.toString().replace(/\s+/g, "").replace(/^\+/, "");

    const [rows] = await db.query("SELECT * FROM users WHERE phone_number = ?", [phone_number]);
    if (rows.length === 0) return res.status(400).json({ message: "User not found" });

    const user = rows[0];

    if (!user.otp || user.otp !== otp) return res.status(400).json({ message: "Invalid OTP" });

    if (user.otp_expiry && new Date(user.otp_expiry) < new Date()) return res.status(400).json({ message: "OTP expired" });

    // mark verified, clear otp and set last_login
    await db.query("UPDATE users SET is_verified = 1, otp = NULL, otp_expiry = NULL, last_login_at = NOW() WHERE id = ?", [user.id]);

    const token = jwt.sign({ id: user.id, phone_number: user.phone_number }, JWT_SECRET, { expiresIn: "7d" });

    // return token and user (sanitized)
    const safeUser = { id: user.id, name: user.name, email: user.email, phone_number: user.phone_number };
    return res.json({ success: true, message: "OTP verified", token, user: safeUser });
  } catch (err) {
    console.error("verifyMobileOtp error", err);
    res.status(500).json({ message: "Error verifying mobile OTP", error: err?.message || err });
  }
};
