import express from "express";
import db from "../config/db.js";

const router = express.Router();

/**
 * @route   GET /api/doctors/search
 * @desc    Search doctors or clinics by name/specialization
 * @access  Public
 */
router.get("/search", async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Please enter a search term",
      });
    }

    const sql = `
      SELECT 
        d.id AS doctor_id,
        u.name AS doctor_name,
        d.specialization,
        d.qualifications,
        d.experience_years,
        d.bio,
        d.profile_image,
        c.name AS clinic_name,
        c.city,
        c.state,
        c.country,
        dc.in_person_fee,
        dc.video_fee,
        dc.home_visit_fee
      FROM doctors d
      JOIN doctor_clinic dc ON d.id = dc.doctor_id
      JOIN clinics c ON c.id = dc.clinic_id
      JOIN users u ON u.id = d.user_id
      WHERE (
        d.specialization LIKE ? 
        OR c.name LIKE ? 
        OR u.name LIKE ?
      )
      AND d.status = 'active'
      AND dc.approval_status = 'approved'
    `;

    const [rows] = await db.query(sql, [
      `%${query}%`,
      `%${query}%`,
      `%${query}%`,
    ]);

    if (!rows.length) {
      return res.status(200).json({
        success: true,
        message: "No doctors found",
        data: [],
      });
    }

    res.status(200).json({
      success: true,
      message: "Doctors fetched successfully",
      data: rows,
    });
  } catch (error) {
    console.error("❌ Search Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
});

/**
 * @route   GET /api/doctors/:id
 * @desc    Get doctor details by doctor ID
 * @access  Public
 */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const sql = `
      SELECT 
        d.id AS doctor_id,
        u.name AS doctor_name,
        d.specialization,
        d.qualifications,
        d.experience_years,
        d.bio,
        d.profile_image,
        c.name AS clinic_name,
        c.city,
        c.state,
        c.country,
        dc.in_person_fee,
        dc.video_fee,
        dc.home_visit_fee
      FROM doctors d
      JOIN doctor_clinic dc ON d.id = dc.doctor_id
      JOIN clinics c ON c.id = dc.clinic_id
      JOIN users u ON u.id = d.user_id
      WHERE d.id = ?
      AND d.status = 'active'
      AND dc.approval_status = 'approved'
      LIMIT 1
    `;

    const [rows] = await db.query(sql, [id]);

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Doctor details fetched successfully",
      data: rows[0],
    });
  } catch (error) {
    console.error("❌ Fetch doctor details error:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
});

export default router;
