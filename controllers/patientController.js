import db from "../config/db.js";

// ✅ GET /api/patients/by-user/:user_id
export const getPatientByUser = async (req, res) => {
  try {
    const { user_id } = req.params;
    if (!user_id)
      return res
        .status(400)
        .json({ success: false, message: "user_id is required" });

    const [rows] = await db.query(
      "SELECT * FROM patients WHERE user_id = ? LIMIT 1",
      [user_id]
    );

    if (!rows.length) {
      return res.status(200).json({
        success: true,
        patient: null,
        message: "No patient record found for this user",
      });
    }

    return res.status(200).json({
      success: true,
      patient: rows[0],
      message: "Patient found successfully",
    });
  } catch (err) {
    console.error("getPatientByUser error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

// ✅ POST /api/patients/register
export const registerPatient = async (req, res) => {
  try {
    const {
      user_id,
      phone,
      address,
      street_address,
      city,
      state,
      postal_code,
      country,
      date_of_birth = null,
      gender = null,
      profile_image = null,
      medical_history = null,
    } = req.body;

    if (!user_id)
      return res
        .status(400)
        .json({ success: false, message: "user_id is required" });

    // Check if already exists
    const [existing] = await db.query(
      "SELECT id FROM patients WHERE user_id = ? LIMIT 1",
      [user_id]
    );
    if (existing.length) {
      return res.status(200).json({
        success: true,
        message: "Patient already exists",
        patient: { id: existing[0].id, user_id },
      });
    }

    const [result] = await db.query(
      `INSERT INTO patients 
      (user_id, status, address, street_address, city, state, postal_code, country, phone,
       date_of_birth, gender, profile_image, medical_history, created_at, updated_at)
      VALUES (?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
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
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Patient registered successfully",
      patient: { id: result.insertId, user_id },
    });
  } catch (err) {
    console.error("registerPatient error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};