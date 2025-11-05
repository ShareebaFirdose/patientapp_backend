import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { createOrUpdateProfile, upload } from "../controllers/profileController.js";
import db from "../config/db.js";

const router = express.Router();

// ✅ Create or update user profile
router.post("/setup", protect, upload.single("profile_picture"), createOrUpdateProfile);

// ✅ Fetch logged-in user's full info (including profile if available)
router.get("/user-info", protect, async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await db.query(
      `SELECT 
          u.name,
          u.email,
          u.phone_number,
          p.gender,
          p.date_of_birth,
          p.profile_picture
       FROM users u
       LEFT JOIN user_profiles p ON u.id = p.user_id
       WHERE u.id = ?`,
      [userId]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.status(200).json({
      success: true,
      data: rows[0],
    });
  } catch (error) {
    console.error("❌ Fetch user info error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ✅ Check if profile exists for logged-in user
router.get("/check-profile", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const [rows] = await db.query(
      "SELECT id FROM user_profiles WHERE user_id = ?",
      [userId]
    );

    if (rows.length > 0) {
      return res.status(200).json({ success: true, exists: true });
    } else {
      return res.status(200).json({ success: true, exists: false });
    }
  } catch (error) {
    console.error("❌ Profile check error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
