import db from "../config/db.js";
import jwt from "jsonwebtoken";
import { createTransport } from "nodemailer";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

/* ============================================================
   EMAIL TRANSPORTER SETUP
============================================================ */
const transporter = createTransport({
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
   NORMALIZE PHONE NUMBER - Always add 91 prefix
============================================================ */
const normalizePhoneNumber = (phone) => {
  if (!phone) return null;
  
  // Remove all non-digit characters
  let cleaned = phone.toString().replace(/\D/g, '');
  
  // If it's 10 digits, add 91 prefix
  if (cleaned.length === 10 && !cleaned.startsWith('91')) {
    cleaned = '91' + cleaned;
  }
  
  // If it already has 91 and is 12 digits, return as is
  if (cleaned.startsWith('91') && cleaned.length === 12) {
    console.log(`📱 Normalized phone: ${phone} → ${cleaned}`);
    return cleaned;
  }
  
  console.log(`📱 Normalized phone: ${phone} → ${cleaned}`);
  return cleaned;
};

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
   HELPER: GET PHONE NUMBER ID FROM PINBOT API
============================================================ */
const getPhoneNumberId = async (businessNumber, apiKey) => {
  try {
    console.log("🔍 Fetching phone_number_id for:", businessNumber);
    
    const response = await axios.get(
      'https://partnersv1.pinbot.ai/v3/getuserdetails',
      {
        headers: {
          'apikey': apiKey,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log("📋 User Details Response:", JSON.stringify(response.data, null, 2));

    if (response.data && response.data.data && response.data.data.length > 0) {
      // Try multiple matching strategies
      const phoneData = response.data.data.find(item => {
        const wanumber = item.wanumber || '';
        const cleanWanumber = wanumber.replace(/\D/g, '');
        const cleanBusinessNumber = businessNumber.toString().replace(/\D/g, '');
        
        return (
          wanumber === businessNumber ||
          wanumber === `+${businessNumber}` ||
          wanumber === `91${businessNumber}` ||
          wanumber === `+91${businessNumber}` ||
          cleanWanumber === cleanBusinessNumber ||
          cleanWanumber.endsWith(cleanBusinessNumber) ||
          cleanBusinessNumber.endsWith(cleanWanumber)
        );
      });
      
      if (phoneData) {
        console.log("✅ Found phone_number_id:", phoneData.phone_number_id);
        console.log("✅ Matching wanumber:", phoneData.wanumber);
        return phoneData.phone_number_id;
      } else {
        console.log("❌ No matching phone number found");
        console.log("Available numbers:", response.data.data.map(d => d.wanumber).join(', '));
      }
    }
    
    console.log("❌ Could not find phone_number_id for:", businessNumber);
    return null;
  } catch (error) {
    console.error("❌ Error fetching phone_number_id:", error.message);
    if (error.response) {
      console.error("Response data:", error.response.data);
    }
    return null;
  }
};

/* ============================================================
   📱 SEND WHATSAPP NOTIFICATION - USING PINBOT API
============================================================ */
let cachedPhoneNumberId = null;

export const sendWhatsAppNotification = async (phone, templateType, data) => {
  try {
    const WHATSAPP_API_KEY = process.env.WHATSAPP_API_KEY;
    const WHATSAPP_BUSINESS_NUMBER = process.env.WHATSAPP_BUSINESS_NUMBER;
    const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!WHATSAPP_API_KEY || !WHATSAPP_BUSINESS_NUMBER) {
      console.log("⚠️ WhatsApp not configured - skipping notification");
      return false;
    }

    // ✅ Format phone number correctly
    let formattedPhone = phone.toString().replace(/\D/g, '');
    
    if (!formattedPhone.startsWith('91') && formattedPhone.length === 10) {
      formattedPhone = '91' + formattedPhone;
    }

    console.log(`📱 Preparing WhatsApp template for: ${formattedPhone}`);

    let PHONE_NUMBER_ID = cachedPhoneNumberId || WHATSAPP_PHONE_NUMBER_ID;
    
    if (!PHONE_NUMBER_ID) {
      console.log("🔍 Fetching phone_number_id from API...");
      PHONE_NUMBER_ID = await getPhoneNumberId(WHATSAPP_BUSINESS_NUMBER, WHATSAPP_API_KEY);
      
      if (PHONE_NUMBER_ID) {
        cachedPhoneNumberId = PHONE_NUMBER_ID;
        console.log("✅ Cached phone_number_id:", PHONE_NUMBER_ID);
      } else {
        console.log("❌ Could not retrieve phone_number_id");
        return false;
      }
    }

    let payload;
    let url = `https://partnersv1.pinbot.ai/v3/${PHONE_NUMBER_ID}/messages`;

    if (templateType === "login_otp") {
      payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: formattedPhone,
        type: "template",
        template: {
          name: "login_otp",
          language: { code: "en" },
          components: [
            {
              type: "body",
              parameters: [{ type: "text", text: data.otp || "000000" }]
            },
            {
              type: "button",
              sub_type: "url",
              index: "0",
              parameters: [{ type: "text", text: data.otp || "000000" }]
            }
          ]
        }
      };
    } 
    else if (templateType === "welcome_patient") {
      payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: formattedPhone,
        type: "template",
        template: {
          name: "welcome_patient",
          language: { code: "en" },
          components: [
            {
              type: "button",
              sub_type: "url",
              index: "0",
              parameters: [{ type: "text", text: data.buttonUrl || "welcome" }]
            }
          ]
        }
      };
    }
    else {
      console.log("⚠️ Unknown template type:", templateType);
      return false;
    }

    console.log("📤 WhatsApp API URL:", url);
    console.log("📤 WhatsApp Payload:", JSON.stringify(payload, null, 2));

    const response = await axios.post(url, payload, {
      headers: {
        "Content-Type": "application/json",
        "apikey": WHATSAPP_API_KEY,
      },
      timeout: 15000
    });

    console.log("📨 WhatsApp API Response:", JSON.stringify(response.data, null, 2));
    
    if (response.data && response.data.messages && response.data.messages.length > 0) {
      console.log("✅ WhatsApp sent successfully to:", formattedPhone);
      console.log("✅ Message ID:", response.data.messages[0].id);
      return true;
    } else {
      console.log("⚠️ WhatsApp sent but uncertain status:", response.data);
      return true;
    }

  } catch (error) {
    console.error("❌ WhatsApp Error Details:");
    console.error("- Message:", error.message);
    
    if (error.response) {
      console.error("- Status Code:", error.response.status);
      console.error("- Response Data:", JSON.stringify(error.response.data, null, 2));
      console.error("- Response Headers:", error.response.headers);
      
      if (error.response.data?.error?.code === 131008) {
        console.error("\n💡 FIX: Template requires button parameter");
        console.error("   Make sure to pass buttonUrl in the data object");
      }
    }
    
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
   SIGNUP – SEND OTP (Email + SMS + WhatsApp) - FIXED VERSION
============================================================ */
export const signupRequestOtp = async (req, res) => {
  try {
    let { name, email, phone_number } = req.body;

    // ✅ Normalize phone number
    phone_number = normalizePhoneNumber(phone_number);
    
    if (!phone_number) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid phone number format" 
      });
    }

    console.log(`✅ Normalized phone for signup: ${phone_number}`);

    const [exist] = await db.query(
      "SELECT id FROM users WHERE email=? OR phone_number=?",
      [email, phone_number]
    );
  
    if (exist.length > 0)
      return res.json({ 
        success: false, 
        message: "User already exists" 
      });

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Insert user with normalized phone number
    await db.query(
      `INSERT INTO users (name, email, phone_number, otp, otp_expiry, status)
       VALUES (?, ?, ?, ?, ?, 'inactive')`,
      [name, email, phone_number, otp, expiresAt]
    );

    // ✅ Track which channels succeeded
    const channels = [];

    // ✅ Send OTP via Email (critical channel)
    try {
      const emailSent = await sendEmailOtp(email, otp, "Your Signup OTP");
      if (emailSent) {
        console.log("✅ Email OTP sent");
        channels.push("Email");
      } else {
        console.log("⚠️ Email OTP failed");
      }
    } catch (error) {
      console.log("⚠️ Email OTP error:", error.message);
    }
    
    // ✅ Send OTP via SMS (don't block on failure)
    try {
      const smsSent = await sendOtpSms(phone_number, otp, "signup");
      if (smsSent) {
        console.log("✅ SMS OTP sent");
        channels.push("SMS");
      } else {
        console.log("⚠️ SMS OTP failed");
      }
    } catch (error) {
      console.log("⚠️ SMS OTP error:", error.message);
    }

    // ✅ Send OTP via WhatsApp (don't block on failure)
    try {
      const whatsappSent = await sendWhatsAppNotification(phone_number, "login_otp", { 
        otp: otp 
      });
      if (whatsappSent) {
        console.log("✅ WhatsApp OTP sent");
        channels.push("WhatsApp");
      } else {
        console.log("⚠️ WhatsApp OTP failed");
      }
    } catch (error) {
      console.log("⚠️ WhatsApp OTP error:", error.message);
    }

    // ✅ Return success if at least one channel worked
    if (channels.length > 0) {
      return res.json({
        success: true,
        message: `Signup OTP sent successfully via ${channels.join(', ')}`,
        channels: channels
      });
    }

    // ❌ Only fail if all channels failed
    return res.status(500).json({
      success: false,
      message: "Failed to send OTP. Please try again or contact support.",
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
   SIGNUP – VERIFY OTP
============================================================ */
export const signupVerifyOtp = async (req, res) => {
  try {
    let { email, phone_number, otp } = req.body;

    // ✅ Normalize phone number for lookup
    phone_number = normalizePhoneNumber(phone_number);

    const [rows] = await db.query(
      "SELECT * FROM users WHERE email=? AND phone_number=? LIMIT 1",
      [email, phone_number]
    );

    if (rows.length === 0)
      return res.status(400).json({ success: false, message: "User not found" });

    const user = rows[0];

    if (user.status === "active")
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

    const [rows] = await db.query("SELECT id, phone_number FROM users WHERE email=?", [email]);

    if (rows.length === 0)
      return res.status(400).json({ success: false, message: "Email not registered" });

    const otp = generateOtp();

    await db.query(
      "UPDATE users SET otp=?, otp_expiry=DATE_ADD(NOW(), INTERVAL 10 MINUTE) WHERE email=?",
      [otp, email]
    );

    // ✅ Track which channels succeeded
    const channels = [];

    // ✅ Send OTP via Email
    try {
      const emailSent = await sendEmailOtp(email, otp, "Your Login OTP");
      if (emailSent) {
        console.log("✅ Email OTP sent");
        channels.push("Email");
      } else {
        console.log("⚠️ Email OTP failed");
      }
    } catch (error) {
      console.log("⚠️ Email OTP error:", error.message);
    }

    // ✅ Send OTP via WhatsApp if phone exists
    if (rows[0].phone_number) {
      try {
        const whatsappSent = await sendWhatsAppNotification(rows[0].phone_number, "login_otp", { 
          otp: otp 
        });
        if (whatsappSent) {
          console.log("✅ WhatsApp OTP sent");
          channels.push("WhatsApp");
        } else {
          console.log("⚠️ WhatsApp OTP failed");
        }
      } catch (error) {
        console.log("⚠️ WhatsApp OTP error:", error.message);
      }
    }

    // ✅ Return success if at least one channel worked
    if (channels.length > 0) {
      return res.json({ 
        success: true, 
        message: `Login OTP sent successfully via ${channels.join(' and ')}`,
        channels: channels
      });
    }

    // ❌ Only fail if all channels failed
    return res.status(500).json({
      success: false,
      message: "Failed to send OTP. Please try again.",
    });

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
   MOBILE LOGIN OTP - FIXED VERSION
============================================================ */
export const requestMobileOtp = async (req, res) => {
  try {
    let { phone_number } = req.body;

    // ✅ Normalize phone number
    phone_number = normalizePhoneNumber(phone_number);
    
    if (!phone_number) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid phone number format" 
      });
    }

    console.log(`✅ Normalized phone for login: ${phone_number}`);

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

    // ✅ Track which channels succeeded
    let smsSuccess = false;
    let whatsappSuccess = false;
    const channels = [];

    // ✅ Try SMS (don't block on failure)
    try {
      smsSuccess = await sendOtpSms(phone_number, otp, "login");
      if (smsSuccess) {
        console.log("✅ SMS OTP sent successfully");
        channels.push("SMS");
      } else {
        console.log("⚠️ SMS OTP failed");
      }
    } catch (error) {
      console.log("⚠️ SMS OTP error:", error.message);
    }

    // ✅ Try WhatsApp (don't block on failure)
    try {
      whatsappSuccess = await sendWhatsAppNotification(phone_number, "login_otp", { 
        otp: otp 
      });
      if (whatsappSuccess) {
        console.log("✅ WhatsApp OTP sent successfully");
        channels.push("WhatsApp");
      } else {
        console.log("⚠️ WhatsApp OTP failed");
      }
    } catch (error) {
      console.log("⚠️ WhatsApp OTP error:", error.message);
    }

    // ✅ Return success if at least one channel worked
    if (smsSuccess || whatsappSuccess) {
      return res.json({ 
        success: true, 
        message: `OTP sent successfully via ${channels.join(' and ')}`,
        channels: channels
      });
    }

    // ❌ Only fail if both channels failed
    return res.status(500).json({
      success: false,
      message: "Failed to send OTP via SMS and WhatsApp. Please try again or contact support.",
      technicalDetails: "Both SMS and WhatsApp delivery failed"
    });

  } catch (err) {
    console.error("Mobile OTP Error:", err);
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
    let { phone_number, otp } = req.body;

    // ✅ Normalize phone number
    phone_number = normalizePhoneNumber(phone_number);

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