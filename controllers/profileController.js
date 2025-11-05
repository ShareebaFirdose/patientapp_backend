import db from "../config/db.js";

// ✅ Check if profile exists
export const checkProfile = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id FROM user_profiles WHERE user_id = ? LIMIT 1",
      [req.user.id]
    );

    return res.json({
      success: true,
      exists: rows.length > 0,
    });
  } catch (error) {
    console.error("Profile check error:", error);
    return res.status(500).json({ success: false, message: "Error checking profile" });
  }
};

// ✅ Create or update profile (final version)
export const createProfile = async (req, res) => {
  try {
    const { gender, date_of_birth, alternate_phone } = req.body;
    const profile_picture = req.body.profile_picture || null;

    if (!gender || !date_of_birth) {
      return res.status(400).json({
        success: false,
        message: "Gender and Date of Birth are required",
      });
    }

    const userId = req.user.id;

    await db.query(
      `INSERT INTO user_profiles (user_id, gender, date_of_birth, alternate_phone, profile_picture)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
       gender = VALUES(gender),
       date_of_birth = VALUES(date_of_birth),
       alternate_phone = VALUES(alternate_phone),
       profile_picture = COALESCE(VALUES(profile_picture), profile_picture)`,
      [userId, gender, date_of_birth, alternate_phone, profile_picture]
    );

    return res.json({
      success: true,
      message: "Profile saved successfully",
    });

  } catch (error) {
    console.error("SQL Error while saving profile:", error);
    return res.status(500).json({
      success: false,
      message: "Error saving profile",
      error: error.sqlMessage || error.message
    });
  }
};

// ✅ Get profile details
export const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await db.query(
      `SELECT users.name, users.email, users.phone_number, 
              user_profiles.gender, user_profiles.date_of_birth, 
              user_profiles.alternate_phone, user_profiles.profile_picture
       FROM users
       LEFT JOIN user_profiles ON users.id = user_profiles.user_id
       WHERE users.id = ?`,
      [userId]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Profile not found" });
    }

    return res.json({ success: true, data: rows[0] });

  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ success: false, message: "Unable to fetch profile" });
  }
};
