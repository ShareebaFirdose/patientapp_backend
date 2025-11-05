import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import db from "../config/db.js";

const router = express.Router();

// ✅ Get logged-in user info
router.get("/me", protect, async (req, res) => {
  const [rows] = await db.query(
    "SELECT id, name, email, phone_number FROM users WHERE id = ?",
    [req.user.id]
  );

  if (!rows.length) return res.status(404).json({ message: "User not found" });

  res.json({ success: true, user: rows[0] });
});

export default router;
