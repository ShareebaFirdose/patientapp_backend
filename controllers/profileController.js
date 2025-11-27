import db from "../config/db.js";
import cloudinary from "../utils/cloudinary.js";
import fs from "fs";

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
    console.log("📎 Raw req.file:", req.file);
    console.log("🔍 All body keys:", Object.keys(req.body));

    let gender = req.body?.gender;
    let date_of_birth = req.body?.date_of_birth;
    let alternate_phone = req.body?.alternate_phone;
    
    // ✅ Extract address fields - check both naming conventions
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

    // ✅ Updated Validation - include address fields
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

    // ✅ Convert DOB into MySQL-safe format (YYYY-MM-DD)
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

        // Delete local file after upload
        fs.unlinkSync(req.file.path);
      } catch (uploadErr) {
        console.error("❌ Cloudinary Upload Error:", uploadErr);
        // Continue without image rather than failing completely
        profile_picture = null;
      }
    }

    // ✅ Save profile to PATIENTS table
    try {
      console.log("💾 Attempting to save profile for user:", userId);
      
      // First, check if patient profile already exists
      const [existingPatient] = await db.query(
        "SELECT id FROM patients WHERE user_id = ?",
        [userId]
      );

      if (existingPatient.length > 0) {
        // Update existing patient profile
        console.log("🔄 Updating existing patient profile...");
        
        // Build dynamic update query based on available fields
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
        
        updateValues.push(userId); // Add userId for WHERE clause
        
        const updateQuery = `UPDATE patients SET ${updateFields.join(", ")} WHERE user_id = ?`;
        
        console.log("📝 Update query:", updateQuery);
        console.log("📝 Update values:", updateValues);
        
        await db.query(updateQuery, updateValues);
        
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

    // Join users and patients tables
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

    // ✅ Format date for consistent frontend display
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