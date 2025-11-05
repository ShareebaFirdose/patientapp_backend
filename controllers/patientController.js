// controllers/patientController.js
import db from "../config/db.js";

// GET /api/patients/by-user/:user_id
export const getPatientByUser = async (req, res) => {
  try {
    const { user_id } = req.params;
    const [rows] = await db.query(
      "SELECT * FROM patients WHERE user_id = ? LIMIT 1",
      [user_id]
    );
    if (!rows.length) {
      return res.status(200).json({ success: true, data: null });
    }
    return res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("getPatientByUser error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// POST /api/patients/register
export const registerPatient = async (req, res) => {
  try {
    const {
      user_id,
      phone,
      date_of_birth, // YYYY-MM-DD
      gender,        // 'male' | 'female' | 'other' | 'prefer_not_to_say'
      address,
      street_address,
      city,
      state,
      postal_code,
      country,
      profile_image = null,
      medical_history = null,
    } = req.body;

    if (!user_id) {
      return res.status(400).json({ success: false, message: "user_id is required" });
    }

    // if exists, return existing
    const [exists] = await db.query(
      "SELECT id FROM patients WHERE user_id = ? LIMIT 1",
      [user_id]
    );
    if (exists.length) {
      return res.status(200).json({
        success: true,
        message: "Patient already exists",
        patient: { id: exists[0].id, user_id },
      });
    }

    const sql = `
      INSERT INTO patients
      (user_id, status, address, street_address, city, state, postal_code, country, phone,
       date_of_birth, gender, profile_image, medical_history, created_at, updated_at)
      VALUES (?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;
    const [result] = await db.query(sql, [
      user_id,
      address || null,
      street_address || null,
      city || null,
      state || null,
      postal_code || null,
      country || null,
      phone || null,
      date_of_birth || null,
      gender || null,
      profile_image,
      medical_history,
    ]);

    return res.status(201).json({
      success: true,
      message: "Patient registered",
      patient: { id: result.insertId, user_id },
    });
  } catch (err) {
    console.error("registerPatient error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
