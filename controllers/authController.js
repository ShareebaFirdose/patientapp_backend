// controllers/authController.js
import db from "../config/db.js";
import nodemailer from "nodemailer";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

// ✅ Signup User
export const signupUser = async (req, res) => {
  const { name, email, phone_number, password } = req.body;

  try {
    const [existing] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
    if (existing.length > 0)
      return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await db.query(
      "INSERT INTO users (name, email, phone_number, password, otp) VALUES (?, ?, ?, ?, ?)",
      [name, email, phone_number, hashedPassword, otp]
    );

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "PredCare Registration OTP",
      text: `Your OTP for registration is: ${otp}`,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: "OTP sent successfully to email", email });
  } catch (error) {
    console.error("Signup Error:", error);
    res.status(500).json({ message: "Signup failed" });
  }
};

// ✅ Verify Signup OTP
export const verifyOtp = async (req, res) => {
  const { email, otp } = req.body;

  try {
    const [user] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
    if (user.length === 0)
      return res.status(400).json({ message: "User not found" });

    if (user[0].otp !== otp)
      return res.status(400).json({ message: "Invalid OTP" });

    await db.query("UPDATE users SET otp = NULL, is_verified = 1 WHERE email = ?", [email]);

    res.status(200).json({ message: "Signup successful!" });
  } catch (error) {
    console.error("OTP Verification Error:", error);
    res.status(500).json({ message: "OTP verification failed" });
  }
};

// ✅ Send OTP for Login
export const requestLoginOtp = async (req, res) => {
  const { email } = req.body;

  try {
    const [user] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
    if (user.length === 0)
      return res.status(400).json({ message: "User not found" });

    const phoneNumber = user[0].phone_number;

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await db.query(
      `INSERT INTO otp_verifications (phone_number, otp_code, purpose, device_id, expires_at, verified, created_at)
       VALUES (?, ?, 'login', ?, ?, 0, NOW())`,
      [phoneNumber, otp, user[0].id, expiresAt]
    );

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "PredCare Login OTP",
      text: `Your login OTP is: ${otp}\n\nIt will expire in 5 minutes.`,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: "Login OTP sent successfully", email });
  } catch (error) {
    console.error("Request Login OTP Error:", error);
    res.status(500).json({ message: "Failed to send login OTP" });
  }
};

// ✅ Verify Login OTP
export const verifyLoginOtp = async (req, res) => {
  const { email, otp } = req.body;

  try {
    const [user] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
    if (user.length === 0)
      return res.status(400).json({ message: "User not found" });

    const phoneNumber = user[0].phone_number;

    const [otpRecord] = await db.query(
      "SELECT * FROM otp_verifications WHERE phone_number = ? AND purpose = 'login' ORDER BY id DESC LIMIT 1",
      [phoneNumber]
    );

    if (otpRecord.length === 0)
      return res.status(400).json({ message: "OTP record not found" });

    if (otpRecord[0].otp_code !== otp)
      return res.status(400).json({ message: "Invalid OTP" });

    const now = new Date();
    const expiresAt = new Date(otpRecord[0].expires_at);
    if (expiresAt < now)
      return res.status(400).json({ message: "OTP expired" });

    await db.query(
      "UPDATE otp_verifications SET verified = 1, verified_at = NOW() WHERE id = ?",
      [otpRecord[0].id]
    );

    const token = jwt.sign({ id: user[0].id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.status(200).json({
      message: "Login successful via OTP",
      token,
      user: {
        id: user[0].id,
        name: user[0].name,
        email: user[0].email,
      },
    });
  } catch (error) {
    console.error("Verify Login OTP Error:", error);
    res.status(500).json({ message: "OTP verification failed" });
  }
};
