import db from "../config/db.js";
import cloudinary from "../utils/cloudinary.js";
import fs from "fs";
import { sendWhatsAppNotification } from "./authController.js";
import { createTransport } from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

// Email transporter
const transporter = createTransport({
  service: "gmail",
  auth: { 
    user: process.env.EMAIL_USER, 
    pass: process.env.EMAIL_PASS 
  },
});

// Send welcome email
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
              Thank you for completing your profile with PRED CARE. We're excited to have you on board!
            </p>
            <p style="color: #666; line-height: 1.6; font-size: 15px;">
              Your account is now fully set up. You can now access all our healthcare services.
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
      subject: "Welcome to PRED CARE - Profile Completed Successfully! 🎉",
      html: welcomeHtml,
    });

    console.log("✅ Welcome email sent to:", email);
    return true;
  } catch (error) {
    console.log("❌ Welcome Email Error:", error.message);
    return false;
  }
};

// ✅ Check if profile exists (checking patients table)
export const checkProfile = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id FROM patients WHERE user_id = ? LIMIT 1",
      [req.user.id]
    );

    return res.json({
      success: true,
      exists: rows.length > 0,
    });
  } catch (error) {
    console.error("Profile check error:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Error checking profile" 
    });
  }
};

// ✅ Create or update profile in PATIENTS table
export const createProfile = async (req, res) => {
  try {
    // 🔥 Access body fields correctly with multipart/form-data
    console.log("🔥 Raw req.body:", req.body);
    console.log("🖼 Raw req.file:", req.file);

    let gender = req.body?.gender;
    let date_of_birth = req.body?.date_of_birth;
    let alternate_phone = req.body?.alternate_phone;
    
    // ✅ Extract address fields
    let address = req.body?.address;
    let street_address = req.body?.street_address || req.body?.streetAddress;
    let city = req.body?.city;
    let state = req.body?.state;
    let postal_code = req.body?.postal_code || req.body?.postalCode;
    let country = req.body?.country;
    
    let profile_picture = null;
    
    const userId = req.user.id;

    console.log("🔥 Received profile data:", { 
      gender, 
      date_of_birth, 
      alternate_phone,
      address,
      street_address,
      city,
      state,
      postal_code,
      country,
      userId 
    });

    // ✅ Validation
    if (!gender || !date_of_birth || !address || !street_address || !city || !state || !postal_code || !country) {
      const missing = [];
      if (!gender) missing.push('gender');
      if (!date_of_birth) missing.push('date_of_birth');
      if (!address) missing.push('address');
      if (!street_address) missing.push('street_address');
      if (!city) missing.push('city');
      if (!state) missing.push('state');
      if (!postal_code) missing.push('postal_code');
      if (!country) missing.push('country');
      
      console.log("❌ Missing required fields:", missing);
      
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missing.join(', ')}`,
        missing_fields: missing
      });
    }

    // ✅ Convert DOB into MySQL-safe format
    let formattedDOB;
    try {
      formattedDOB = new Date(date_of_birth).toISOString().split("T")[0];
      console.log("📅 Formatted DOB:", formattedDOB);
    } catch (dateErr) {
      console.error("Date conversion error:", dateErr);
      return res.status(400).json({
        success: false,
        message: "Invalid date format",
      });
    }

    // ✅ Handle image upload (optional)
    if (req.file) {
      try {
        console.log("📸 Uploading image to Cloudinary...");
        const uploadResult = await cloudinary.uploader.upload(req.file.path, {
          folder: "predcare_profiles",
          resource_type: "image",
        });
        profile_picture = uploadResult.secure_url;
        console.log("✅ Image uploaded:", profile_picture);

        fs.unlinkSync(req.file.path);
      } catch (uploadErr) {
        console.error("❌ Cloudinary Upload Error:", uploadErr);
        profile_picture = null;
      }
    }

    // ✅ Check if this is first-time profile creation
    let isFirstTimeProfile = false;
    const [existingPatient] = await db.query(
      "SELECT id FROM patients WHERE user_id = ?",
      [userId]
    );
    
    if (existingPatient.length === 0) {
      isFirstTimeProfile = true;
    }

    // ✅ Save profile to PATIENTS table
    try {
      console.log("💾 Attempting to save profile for user:", userId);
      
      if (existingPatient.length > 0) {
        // Update existing patient profile
        console.log("🔄 Updating existing patient profile...");
        
        let updateFields = [
          "gender = ?", 
          "date_of_birth = ?",
          "address = ?",
          "street_address = ?",
          "city = ?",
          "state = ?",
          "postal_code = ?",
          "country = ?"
        ];
        let updateValues = [
          gender, 
          formattedDOB,
          address,
          street_address,
          city,
          state,
          postal_code,
          country
        ];
        
        if (alternate_phone !== undefined && alternate_phone !== null && alternate_phone !== "") {
          updateFields.push("phone = ?");
          updateValues.push(alternate_phone);
        }
        
        if (profile_picture) {
          updateFields.push("profile_image = ?");
          updateValues.push(profile_picture);
        }
        
        updateValues.push(userId);
        
        const updateQuery = `UPDATE patients SET ${updateFields.join(", ")} WHERE user_id = ?`;
        
        console.log("🔍 Update query:", updateQuery);
        console.log("🔍 Update values:", updateValues);
        
        const [result] = await db.query(updateQuery, updateValues);
        console.log("✅ Database update result:", result);
        
      } else {
        // Insert new patient profile
        console.log("➕ Inserting new patient profile...");
        
        await db.query(
          `INSERT INTO patients (
            user_id, gender, date_of_birth, phone, profile_image, 
            address, street_address, city, state, postal_code, country, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
          [
            userId, 
            gender, 
            formattedDOB, 
            alternate_phone || null, 
            profile_picture || null,
            address,
            street_address,
            city,
            state,
            postal_code,
            country
          ]
        );
      }

      console.log("✅ Profile saved successfully");

      // 🎉 SEND WELCOME NOTIFICATIONS ONLY ON FIRST-TIME PROFILE CREATION
      if (isFirstTimeProfile) {
        console.log("🎉 First-time profile creation detected - sending welcome notifications...");
        
        // Get user details for welcome messages
        const [userRows] = await db.query(
          "SELECT name, email, phone_number FROM users WHERE id = ?",
          [userId]
        );
        
        if (userRows.length > 0) {
          const user = userRows[0];
          
          // ✅ Format phone number properly for WhatsApp
          let formattedPhone = user.phone_number.toString().replace(/\D/g, '');
          
          // Debug: Check original format
          console.log("📞 Original phone from DB:", user.phone_number);
          console.log("📏 Phone length:", formattedPhone.length);
          
          if (!formattedPhone.startsWith('91') && formattedPhone.length === 10) {
            formattedPhone = '91' + formattedPhone;
          }
          
          console.log("📱 Sending welcome to phone:", formattedPhone);
          
          // Send welcome email (non-blocking)
          sendWelcomeEmail(user.name, user.email)
            .then(() => console.log("✅ Welcome email sent"))
            .catch(err => console.error("❌ Welcome email failed:", err.message));
          
          // ✅ FIXED: Send welcome WhatsApp with button parameter
          // The welcome_patient template has a URL button that needs a dynamic parameter
          sendWhatsAppNotification(formattedPhone, "welcome_patient", {
            name: user.name,
            buttonUrl: "get-started" // Dynamic URL suffix for the button
          })
            .then((success) => {
              if (success) {
                console.log("✅ WhatsApp welcome message sent successfully");
              } else {
                console.log("⚠️ WhatsApp welcome message failed to send");
              }
            })
            .catch(err => {
              console.error("❌ WhatsApp error:", err.message);
            });
          
          console.log("✅ Welcome notifications queued");
        }
      } else {
        console.log("ℹ️ Profile update - skipping welcome notifications");
      }

      return res.json({
        success: true,
        message: "Profile saved successfully",
        profile: {
          user_id: userId,
          gender,
          date_of_birth: formattedDOB,
          alternate_phone: alternate_phone || null,
          profile_picture: profile_picture || null,
          address,
          street_address,
          city,
          state,
          postal_code,
          country
        },
      });

    } catch (dbErr) {
      console.error("❌ Database Error:", dbErr);
      return res.status(500).json({
        success: false,
        message: "Database error while saving profile",
        error: dbErr.sqlMessage || dbErr.message,
      });
    }

  } catch (error) {
    console.error("❌ General Error while saving profile:", error);
    return res.status(500).json({
      success: false,
      message: "Error saving profile",
      error: error.message,
    });
  }
};

// ✅ Get profile details from PATIENTS table
export const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await db.query(
      `SELECT 
        users.name, 
        users.email, 
        users.phone_number,
        patients.gender, 
        patients.date_of_birth, 
        patients.phone as alternate_phone,
        patients.profile_image as profile_picture,
        patients.address,
        patients.street_address,
        patients.city,
        patients.state,
        patients.postal_code,
        patients.country
       FROM users
       LEFT JOIN patients ON users.id = patients.user_id
       WHERE users.id = ?`,
      [userId]
    );

    if (!rows.length) {
      return res.status(404).json({ 
        success: false, 
        message: "Profile not found" 
      });
    }

    if (rows[0].date_of_birth) {
      rows[0].date_of_birth = new Date(rows[0].date_of_birth)
        .toISOString()
        .split("T")[0];
    }

    return res.json({ 
      success: true, 
      data: rows[0] 
    });

  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Unable to fetch profile" 
    });
  }
};