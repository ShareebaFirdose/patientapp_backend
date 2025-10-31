import db from "../config/db.js";
import { sendOTPEmail } from "../utils/emailService.js"; // optional, if using nodemailer

// Generate a random 6-digit OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// Signup controller
export const signup = (req, res) => {
  const { name, email, mobile, password } = req.body;

  if (!name || !email || !mobile || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  const otp = generateOTP();
  const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry

  db.query(
    "INSERT INTO users (name, email, mobile, password, otp, otp_expiry) VALUES (?, ?, ?, ?, ?, ?)",
    [name, email, mobile, password, otp, otpExpiry],
    (err) => {
      if (err) {
        console.error("Signup error:", err);
        return res.status(500).json({ message: "Signup failed", error: err.message });
      }

      console.log(`User registered: ${email}, OTP: ${otp}`);
      res.json({ message: "Signup successful, OTP sent to email", otp });
    }
  );
};

// Login controller
export const login = (req, res) => {
  const { emailOrMobile } = req.body;
  if (!emailOrMobile)
    return res.status(400).json({ message: "Email or Mobile required" });

  db.query(
    "SELECT * FROM users WHERE email = ? OR mobile = ?",
    [emailOrMobile, emailOrMobile],
    (err, result) => {
      if (err) return res.status(500).json({ message: "Database error" });
      if (!result.length)
        return res.status(404).json({ message: "User not found" });

      const otp = generateOTP();
      const expiry = new Date(Date.now() + 5 * 60 * 1000);

      db.query(
        "UPDATE users SET otp = ?, otp_expiry = ? WHERE id = ?",
        [otp, expiry, result[0].id],
        (err) => {
          if (err) return res.status(500).json({ message: "OTP update failed" });
          console.log(`OTP sent: ${otp} for ${emailOrMobile}`);
          res.json({ message: "OTP sent successfully", otp });
        }
      );
    }
  );
};

// Verify OTP controller
export const verifyOtp = (req, res) => {
  const { emailOrMobile, otp } = req.body;

  db.query(
    "SELECT * FROM users WHERE (email = ? OR mobile = ?) AND otp = ?",
    [emailOrMobile, emailOrMobile, otp],
    (err, result) => {
      if (err) return res.status(500).json({ message: "Database error" });
      if (!result.length) return res.status(400).json({ message: "Invalid OTP" });

      res.json({ message: "OTP verified successfully" });
    }
  );
};
