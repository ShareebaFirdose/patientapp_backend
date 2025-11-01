import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import db from "../config/db.js";
import { generateOtp } from "../utils/otpGenerator.js";
import { sendOTPEmail } from "../utils/emailService.js"; // ✅ corrected import

export const signup = async (req, res) => {
  try {
    const { name, email, phone_number, password } = req.body;

    const [existingUser] = await db.query(
      "SELECT * FROM users WHERE email = ? OR phone_number = ?",
      [email, phone_number]
    );
    if (existingUser.length > 0)
      return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOtp();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // valid for 5 mins

    await db.query(
      "INSERT INTO users (name, email, phone_number, password, otp, otp_expiry) VALUES (?, ?, ?, ?, ?, ?)",
      [name, email, phone_number, hashedPassword, otp, otpExpiry]
    );

    // ✅ send OTP via email
    await sendOTPEmail(email, otp);

    res.status(201).json({ message: "User registered successfully, OTP sent" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const login = async (req, res) => {
  try {
    const { emailOrPhone } = req.body;
    const [user] = await db.query(
      "SELECT * FROM users WHERE email = ? OR phone_number = ?",
      [emailOrPhone, emailOrPhone]
    );

    if (user.length === 0)
      return res.status(400).json({ message: "User not found" });

    const otp = generateOtp();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

    await db.query("UPDATE users SET otp = ?, otp_expiry = ? WHERE id = ?", [
      otp,
      otpExpiry,
      user[0].id,
    ]);

    // ✅ send OTP via email
    await sendOTPEmail(user[0].email, otp);

    res.status(200).json({ message: "OTP sent successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const { emailOrPhone, otp } = req.body;

    const [user] = await db.query(
      "SELECT * FROM users WHERE (email = ? OR phone_number = ?) AND otp = ?",
      [emailOrPhone, emailOrPhone, otp]
    );

    if (user.length === 0)
      return res.status(400).json({ message: "Invalid OTP or user" });

    const currentTime = new Date();
    if (new Date(user[0].otp_expiry) < currentTime) {
      return res.status(400).json({ message: "OTP expired" });
    }

    // ✅ clear otp after success
    await db.query("UPDATE users SET otp = NULL, otp_expiry = NULL WHERE id = ?", [
      user[0].id,
    ]);

    // ✅ generate jwt
    const token = jwt.sign(
      {
        id: user[0].id,
        email: user[0].email,
        phone_number: user[0].phone_number,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.status(200).json({
      message: "OTP verified successfully",
      token,
      user: {
        id: user[0].id,
        name: user[0].name,
        email: user[0].email,
        phone_number: user[0].phone_number,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
