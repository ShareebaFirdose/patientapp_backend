import db from "../config/db.js";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import axios from "axios";
import dotenv from "dotenv";


dotenv.config();

/* ============================================================
   EMAIL TRANSPORTER SETUP
============================================================ */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { 
    user: process.env.EMAIL_USER, 
    pass: process.env.EMAIL_PASS 
  },
});

/* ============================================================
   GENERATE 6-DIGIT OTP
============================================================ */
const generateOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

/* ============================================================
   SEND OTP USING PINNACLE SMS (Signup / Login / Forgot)
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

    const response = await axios.post(process.env.PINNACLE_BASE_URL, payload, {
      headers: { "Content-Type": "application/json" },
    });

    if (!response.data || response.data.status.code !== "200") {
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
   📧 SEND WELCOME EMAIL AFTER SIGNUP
============================================================ */
const sendWelcomeEmail = async (name, email) => {
  try {
    const welcomeHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: #ffffff; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #007AFF; margin: 0;">PRED CARE</h1>
            <p style="color: #666; font-size: 14px; margin-top: 5px;">Your Health, Our Priority</p>
          </div>

          <!-- Welcome Message -->
          <div style="margin-bottom: 30px;">
            <h2 style="color: #333; margin-bottom: 15px;">Welcome ${name}! 🎉</h2>
            <p style="color: #666; line-height: 1.6; font-size: 15px;">
              Thank you for signing up with PRED CARE. We're excited to have you on board!
            </p>
            <p style="color: #666; line-height: 1.6; font-size: 15px;">
              Your account has been successfully created and verified. You can now access all our healthcare services.
            </p>
          </div>

          <!-- Features Section -->
          <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
            <h3 style="color: #333; margin-top: 0; margin-bottom: 15px; font-size: 16px;">What You Can Do:</h3>
            <ul style="color: #666; line-height: 1.8; padding-left: 20px; margin: 0;">
              <li>Book appointments with top doctors</li>
              <li>Video consultations from anywhere</li>
              <li>Access your medical records</li>
              <li>Get appointment reminders</li>
              <li>Manage your health history</li>
            </ul>
          </div>

          <!-- CTA Button -->
          <div style="text-align: center; margin: 30px 0;">
            <a href="#" style="display: inline-block; background-color: #007AFF; color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
              Get Started
            </a>
          </div>

          <!-- Support Section -->
          <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 20px;">
            <p style="color: #999; font-size: 13px; line-height: 1.6; margin: 0;">
              Need help? Contact our support team at <a href="mailto:support@predcare.com" style="color: #007AFF; text-decoration: none;">support@predcare.com</a>
            </p>
          </div>

          <!-- Footer -->
          <div style="text-align: center; margin-top: 25px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #999; font-size: 12px; margin: 5px 0;">
              © 2025 PRED CARE. All rights reserved.
            </p>
            <p style="color: #999; font-size: 12px; margin: 5px 0;">
              This email was sent to ${email}
            </p>
          </div>

        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"PRED CARE" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Welcome to PRED CARE - Account Verified Successfully! 🎉",
      html: welcomeHtml,
    });

    console.log("✅ Welcome email sent to:", email);
    return true;
  } catch (error) {
    console.log("❌ Welcome Email Error:", error.message);
    return false;
  }
};

/* ============================================================
   📱 SEND WHATSAPP NOTIFICATION
   You'll need to provide your WhatsApp API credentials
============================================================ */
const sendWhatsAppNotification = async (phone, type, data) => {
  try {
    // Replace with your actual WhatsApp API endpoint and credentials
    const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || "YOUR_WHATSAPP_API_ENDPOINT";
    const WHATSAPP_API_KEY = process.env.WHATSAPP_API_KEY || "YOUR_API_KEY";
    const WHATSAPP_SENDER = process.env.WHATSAPP_SENDER || "YOUR_SENDER_NUMBER";

    // Skip if WhatsApp is not configured
    if (WHATSAPP_API_URL === "YOUR_WHATSAPP_API_ENDPOINT") {
      console.log("⚠️  WhatsApp not configured - skipping notification");
      return false;
    }

    let message = "";

    if (type === "signup_welcome") {
      message = `🎉 *Welcome to PRED CARE!*\n\nHi ${data.name},\n\nThank you for signing up! Your account has been successfully verified.\n\n✅ You can now:\n• Book appointments\n• Video consultations\n• Access medical records\n\nNeed help? Contact support@predcare.com\n\n- PRED CARE Team`;
    } else if (type === "appointment_booked") {
      message = `✅ *Appointment Confirmed*\n\nHi ${data.patientName},\n\n*Appointment ID:* ${data.appointment_id}\n*Doctor:* Dr. ${data.doctor_name}\n*Date:* ${data.appointment_date}\n*Time:* ${data.appointment_slot_time}\n*Type:* ${data.consultation_type}\n*Fee:* ₹${data.appointment_fee}\n\n*Transaction ID:* ${data.transaction_id}\n\nSee you soon!\n- PRED CARE`;
    } else if (type === "otp") {
      message = `Your PRED CARE OTP is: *${data.otp}*\n\nValid for 10 minutes. Do not share with anyone.\n\n- PRED CARE`;
    }

    // Example API call structure - adjust based on your WhatsApp provider
    const response = await axios.post(
      WHATSAPP_API_URL,
      {
        phone: phone,
        message: message,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${WHATSAPP_API_KEY}`,
        },
      }
    );

    console.log("✅ WhatsApp sent to:", phone);
    return true;
  } catch (error) {
    console.log("❌ WhatsApp Error:", error.message);
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
    return res.status(500).json({ success: false, message: "Internal server error" });
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

    // Insert user with 'inactive' status
    await db.query(
      `INSERT INTO users (name, email, phone_number, otp, otp_expiry, status)
       VALUES (?, ?, ?, ?, ?, 'inactive')`,
      [name, email, phone_number, otp, expiresAt]
    );

    // Send OTP via Email and SMS
    await sendEmailOtp(email, otp, "Your Signup OTP");
    await sendOtpSms(phone_number, otp, "signup");

    // Optional: Send OTP via WhatsApp
    sendWhatsAppNotification(phone_number, "otp", { otp }).catch(err => 
      console.log("WhatsApp OTP skipped:", err.message)
    );

    return res.json({
      success: true,
      message: "Signup OTP sent successfully",
    });
  } catch (err) {
    console.error("Signup OTP Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to send signup OTP",
    });
  }
};

/* ============================================================
   SIGNUP – VERIFY OTP + SEND WELCOME NOTIFICATIONS
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

    // user should be inactive before verifying
    if (user.status === "active")
      return res.status(400).json({ success: false, message: "Already verified" });

    if (otp !== user.otp)
      return res.status(400).json({ success: false, message: "Invalid OTP" });

    if (new Date() > user.otp_expiry)
      return res.status(400).json({ success: false, message: "OTP expired" });

    // Update user status to active
    await db.query(
      "UPDATE users SET otp=NULL, otp_expiry=NULL, status='active' WHERE id=?",
      [user.id]
    );

    // 🎉 SEND WELCOME NOTIFICATIONS (non-blocking)
    sendWelcomeEmail(user.name, user.email).catch(err => 
      console.error("Welcome email failed:", err)
    );
    
    sendWhatsAppNotification(user.phone_number, "signup_welcome", {
      name: user.name,
    }).catch(err => 
      console.log("WhatsApp welcome skipped:", err.message)
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
    console.error("Signup Verify Error:", err);
    return res.status(500).json({ success: false, message: "Verification failed" });
  }
};

/* ============================================================
   EMAIL LOGIN OTP
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
    return res.status(500).json({ success: false, message: "Failed to send OTP" });
  }
};

/* ============================================================
   VERIFY EMAIL LOGIN OTP
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
    return res.status(500).json({
      success: false,
      message: "OTP verification failed",
    });
  }
};

/* ============================================================
   MOBILE LOGIN OTP
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
    return res.status(500).json({
      success: false,
      message: "Failed to send mobile OTP",
    });
  }
};

/* ============================================================
   VERIFY MOBILE LOGIN OTP
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
    return res.status(500).json({
      success: false,
      message: "Failed to fetch user data",
    });
  }
};

/* ============================================================
   EXPORT WHATSAPP FUNCTION FOR USE IN OTHER CONTROLLERS
============================================================ */
export { sendWhatsAppNotification };