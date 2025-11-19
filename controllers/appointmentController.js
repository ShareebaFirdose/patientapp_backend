// controllers/appointmentController.js
import db from "../config/db.js";

// Extract correct user ID from token (supports id or userId)
const getUserId = (req) => {
  return req.user?.id || req.user?.userId || null;
};

/* -------------------------------------------------------------
    UPCOMING APPOINTMENTS
------------------------------------------------------------- */
export const getUpcomingAppointments = async (req, res) => {
  try {
    const patientId = getUserId(req);

    if (!patientId) return res.json({ success: true, appointments: [] });

    const [rows] = await db.query(
      `SELECT a.*,
              u.name AS doctor_name,
              d.specialization AS doctor_specialization,
              d.profile_image AS doctor_image
       FROM appointments a
       LEFT JOIN users u ON u.id = a.doctor_id
       LEFT JOIN doctors d ON d.user_id = a.doctor_id
       WHERE a.patient_id = ?
         AND a.appointment_date >= CURDATE()
       ORDER BY a.appointment_date ASC, a.start_time ASC`,
      [patientId]
    );

    return res.json({ success: true, appointments: rows ?? [] });
  } catch (err) {
    console.error("getUpcomingAppointments error:", err);
    return res.status(500).json({ success: false });
  }
};

/* -------------------------------------------------------------
    PAST APPOINTMENTS
------------------------------------------------------------- */
export const getPastAppointments = async (req, res) => {
  try {
    const patientId = getUserId(req);

    if (!patientId) return res.json({ success: true, appointments: [] });

    const [rows] = await db.query(
      `SELECT a.*,
              u.name AS doctor_name,
              d.specialization AS doctor_specialization,
              d.profile_image AS doctor_image
       FROM appointments a
       LEFT JOIN users u ON u.id = a.doctor_id
       LEFT JOIN doctors d ON d.user_id = a.doctor_id
       WHERE a.patient_id = ?
         AND a.appointment_date < CURDATE()
       ORDER BY a.appointment_date DESC, a.start_time DESC`,
      [patientId]
    );

    return res.json({ success: true, appointments: rows ?? [] });
  } catch (err) {
    console.error("getPastAppointments error:", err);
    return res.status(500).json({ success: false });
  }
};

/* -------------------------------------------------------------
    ALL APPOINTMENTS FOR LOGGED-IN USER
------------------------------------------------------------- */
export const getAllMyAppointments = async (req, res) => {
  try {
    const patientId = getUserId(req);

    if (!patientId) return res.json({ success: true, data: [] });

    const [rows] = await db.query(
      `SELECT a.*,
              u.name AS doctor_name,
              d.specialization AS doctor_specialization,
              d.profile_image AS doctor_image
       FROM appointments a
       LEFT JOIN users u ON u.id = a.doctor_id
       LEFT JOIN doctors d ON d.user_id = a.doctor_id
       WHERE a.patient_id = ?
       ORDER BY a.appointment_date DESC, a.start_time DESC`,
      [patientId]
    );

    return res.json({ success: true, data: rows ?? [] });
  } catch (err) {
    console.error("getAllMyAppointments error:", err);
    return res.status(500).json({ success: false });
  }
};

/* -------------------------------------------------------------
    GET APPOINTMENT BY ID
------------------------------------------------------------- */
export const getAppointmentById = async (req, res) => {
  try {
    const id = req.params.id;

    const [rows] = await db.query(
      `SELECT a.*, 
              u.name AS doctor_name,
              d.specialization AS doctor_specialization,
              d.profile_image AS doctor_image
       FROM appointments a
       LEFT JOIN users u ON u.id = a.doctor_id
       LEFT JOIN doctors d ON d.user_id = a.doctor_id
       WHERE a.id = ? LIMIT 1`,
      [id]
    );

    if (!rows.length)
      return res.status(404).json({ success: false, message: "Not found" });

    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("getAppointmentById error:", err);
    return res.status(500).json({ success: false });
  }
};
