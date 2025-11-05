import db from "../config/db.js";
import cloudinary from "cloudinary";
import multer from "multer";

// ✅ Configure Cloudinary
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ✅ Multer memory storage
const storage = multer.memoryStorage();
export const upload = multer({ storage });

// ✅ Helper: Upload to Cloudinary using buffer
const uploadToCloudinary = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.v2.uploader.upload_stream(
      { folder: "predcare_profiles" },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.end(fileBuffer);
  });
};

export const createOrUpdateProfile = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized user" });

    const {
      full_name,
      first_name,
      last_name,
      alternate_phone,
      gender,
      date_of_birth,
      language_preferences,
      timezone = "Asia/Kolkata",
    } = req.body;

    if (!full_name || !first_name || !last_name || !gender || !date_of_birth) {
      return res.status(400).json({
        success: false,
        message: "All required fields are missing",
      });
    }

    // ✅ Upload profile picture if provided
    let profile_picture = null;
    if (req.file) {
      const uploaded = await uploadToCloudinary(req.file.buffer);
      profile_picture = uploaded.secure_url;
    }

    const languagePrefJSON = language_preferences
      ? JSON.stringify([language_preferences])
      : JSON.stringify([]);

    // ✅ Check if profile exists
    const [existingProfile] = await db.query(
      "SELECT * FROM user_profiles WHERE user_id = ?",
      [userId]
    );

    if (existingProfile.length > 0) {
      await db.query(
        `UPDATE user_profiles
         SET full_name=?, first_name=?, last_name=?, alternate_phone=?, gender=?, date_of_birth=?, 
             profile_picture=?, language_preferences=?, timezone=?, updated_at=NOW()
         WHERE user_id=?`,
        [
          full_name,
          first_name,
          last_name,
          alternate_phone,
          gender,
          date_of_birth,
          profile_picture || existingProfile[0].profile_picture, // 
          languagePrefJSON,
          timezone,
          userId,
        ]
      );

      return res
        .status(200)
        .json({ success: true, message: "Profile updated successfully" });
    } else {
      await db.query(
        `INSERT INTO user_profiles 
         (user_id, full_name, first_name, last_name, alternate_phone, gender, date_of_birth,
          profile_picture, language_preferences, timezone, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          userId,
          full_name,
          first_name,
          last_name,
          alternate_phone,
          gender,
          date_of_birth,
          profile_picture,
          languagePrefJSON,
          timezone,
        ]
      );

      return res
        .status(201)
        .json({ success: true, message: "Profile created successfully" });
    }
  } catch (error) {
    console.error("❌ Profile Save Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error while saving profile",
    });
  }
};
