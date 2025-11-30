// ===================== prescriptionController.js (FULL FIXED) =====================
import db from "../config/db.js";

/* -------------------------------------------------------------
    Helper: Extract User ID from token
------------------------------------------------------------- */
function getUserId(req) {
  return req.user?.id || req.user?.userId || null;
}

/* -------------------------------------------------------------
    GET ALL PRESCRIPTIONS FOR LOGGED-IN PATIENT
------------------------------------------------------------- */
export const getMyPrescriptions = async (req, res) => {
  try {
    const patientId = getUserId(req);

    if (!patientId) {
      return res.json({ success: true, data: [] });
    }

    const [rows] = await db.query(
      `
      SELECT 
        dp.*,
        u.name AS doctor_name,
        d.specialization,
        a.appointment_date,
        a.start_time AS appointment_time
      FROM doctor_prescriptions dp
      LEFT JOIN users u ON dp.doctor_id = u.id
      LEFT JOIN doctors d ON dp.doctor_id = d.user_id
      LEFT JOIN appointments a ON dp.appointment_id = a.id
      WHERE dp.patient_id = ?
        AND dp.status = 'completed'
      ORDER BY dp.consultation_date DESC, dp.created_at DESC
      `,
      [patientId]
    );

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("❌ getMyPrescriptions error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch prescriptions",
      error: err.message,
    });
  }
};

/* -------------------------------------------------------------
    GET PRESCRIPTION BY ID  (FIXED)
------------------------------------------------------------- */
export const getPrescriptionById = async (req, res) => {
  try {
    const prescriptionId = req.params.id;
    const userId = getUserId(req);

    if (!prescriptionId) {
      return res.status(400).json({
        success: false,
        message: "Prescription ID is required",
      });
    }

    const [rows] = await db.query(
      `
      SELECT 
        dp.*,
        u.name AS doctor_name,
        d.specialization,
        a.appointment_date,
        a.start_time AS appointment_time
      FROM doctor_prescriptions dp
      LEFT JOIN users u ON dp.doctor_id = u.id
      LEFT JOIN doctors d ON dp.doctor_id = d.user_id
      LEFT JOIN appointments a ON dp.appointment_id = a.id
      WHERE dp.id = ?
        AND (dp.patient_id = ? OR dp.doctor_id = ?)
      LIMIT 1
      `,
      [prescriptionId, userId, userId]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Prescription not found",
      });
    }

    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("❌ getPrescriptionById error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch prescription",
      error: err.message,
    });
  }
};

/* -------------------------------------------------------------
    GET PRESCRIPTIONS FOR AN APPOINTMENT
------------------------------------------------------------- */
export const getPrescriptionsByAppointment = async (req, res) => {
  try {
    const appointmentId = req.params.appointmentId;
    const userId = getUserId(req);

    if (!appointmentId) {
      return res.status(400).json({
        success: false,
        message: "Appointment ID is required",
      });
    }

    const [allow] = await db.query(
      `
      SELECT id FROM appointments
      WHERE id = ?
        AND (patient_id = ? OR doctor_id = ?)
      LIMIT 1
      `,
      [appointmentId, userId, userId]
    );

    if (!allow.length) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this appointment",
      });
    }

    const [rows] = await db.query(
      `
      SELECT 
        dp.*,
        u.name AS doctor_name,
        d.specialization
      FROM doctor_prescriptions dp
      LEFT JOIN users u ON dp.doctor_id = u.id
      LEFT JOIN doctors d ON dp.doctor_id = d.user_id
      WHERE dp.appointment_id = ?
      ORDER BY dp.created_at DESC
      `,
      [appointmentId]
    );

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("❌ getPrescriptionsByAppointment error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch prescriptions",
      error: err.message,
    });
  }
};

/* -------------------------------------------------------------
    GET RECENT PRESCRIPTIONS (Dashboard)
------------------------------------------------------------- */
export const getRecentPrescriptions = async (req, res) => {
  try {
    const patientId = getUserId(req);
    const limit = parseInt(req.query.limit) || 5;

    if (!patientId) {
      return res.json({ success: true, data: [] });
    }

    const [rows] = await db.query(
      `
      SELECT 
        dp.*,
        u.name AS doctor_name,
        d.specialization,
        a.appointment_date
      FROM doctor_prescriptions dp
      LEFT JOIN users u ON dp.doctor_id = u.id
      LEFT JOIN doctors d ON dp.doctor_id = d.user_id
      LEFT JOIN appointments a ON dp.appointment_id = a.id
      WHERE dp.patient_id = ?
        AND dp.status = 'completed'
      ORDER BY dp.consultation_date DESC, dp.created_at DESC
      LIMIT ?
      `,
      [patientId, limit]
    );

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("❌ getRecentPrescriptions error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch recent prescriptions",
      error: err.message,
    });
  }
};

/* -------------------------------------------------------------
    DOWNLOAD PRESCRIPTION PDF  (FULL FIX)
------------------------------------------------------------- */
export const downloadPrescriptionPDF = async (req, res) => {
  try {
    const prescriptionId = req.params.id;
    const userId = getUserId(req);

    if (!prescriptionId) {
      return res.status(400).json({
        success: false,
        message: "Prescription ID is required",
      });
    }

    const [rows] = await db.query(
      `
      SELECT pdf_path
      FROM doctor_prescriptions
      WHERE id = ?
        AND (patient_id = ? OR doctor_id = ?)
      LIMIT 1
      `,
      [prescriptionId, userId, userId]
    );

    if (!rows.length || !rows[0].pdf_path) {
      return res.status(404).json({
        success: false,
        message: "PDF not available",
      });
    }

    const pdf = rows[0].pdf_path;

    // FIX: Always return absolute URL
    const fullURL =
      pdf.startsWith("http")
        ? pdf
        : `${process.env.BASE_URL || "http://localhost:5000"}/${pdf}`;

    return res.json({
      success: true,
      pdf_path: fullURL,
    });
  } catch (err) {
    console.error("❌ downloadPrescriptionPDF error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to download prescription PDF",
      error: err.message,
    });
  }
};

/* -------------------------------------------------------------
    EXPORT
------------------------------------------------------------- */
export default {
  getMyPrescriptions,
  getPrescriptionById,
  getPrescriptionsByAppointment,
  getRecentPrescriptions,
  downloadPrescriptionPDF,
};

// ===================== END OF FILE =====================
