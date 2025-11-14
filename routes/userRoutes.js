import express from "express";
import { authenticateJWT } from "../middleware/authMiddleware.js";
import db from "../config/db.js";

const router = express.Router();

// ✅ Get logged-in user info
router.get("/me", authenticateJWT, async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, name, email, phone_number FROM users WHERE id = ?",
      [req.user.id]
    );

    if (!rows.length)
      return res.status(404).json({ success: false, message: "User not found" });

    return res.json({ success: true, user: rows[0] });
  } catch (err) {
    console.error("User fetch error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
