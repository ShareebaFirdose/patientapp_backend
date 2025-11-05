import db from "../config/db.js";
import { v4 as uuidv4 } from "uuid";

// ✅ Book a new appointment
export const bookAppointment = async (req, res) => {
  try {
    const {
      patient_id,
      doctor_id,
      clinic_id,
      consultation_type,
      appointment_date,
      appointment_slot_time,
      start_time,
      end_time,
      appointment_fee,
      fee_type,
      appointment_type,
      payment_type,
      reason,
    } = req.body;

    // ✅ Validate required fields
    if (
      !patient_id ||
      !doctor_id ||
      !consultation_type ||
      !appointment_date ||
      !appointment_slot_time ||
      !fee_type
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    const appointment_id = `APT-${uuidv4().slice(0, 8)}`;

    const sql = `
      INSERT INTO appointments (
        appointment_id, patient_id, doctor_id, clinic_id, consultation_type,
        appointment_date, appointment_slot_time, start_time, end_time,
        appointment_fee, fee_type, appointment_type, appointment_status,
        payment_type, reason, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, NOW(), NOW())
    `;

    await db.query(sql, [
      appointment_id,
      patient_id,
      doctor_id,
      clinic_id || null,
      consultation_type,
      appointment_date,
      appointment_slot_time,
      start_time || null,
      end_time || null,
      appointment_fee || 0,
      fee_type,
      appointment_type || "first_visit",
      payment_type || "cash",
      reason || null,
    ]);

    res.status(201).json({
      success: true,
      message: "Appointment booked successfully",
      data: { appointment_id },
    });
  } catch (error) {
    console.error("❌ Appointment Booking Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// ✅ Get appointments by patient_id
export const getAppointmentsByPatient = async (req, res) => {
  try {
    const { patient_id } = req.params;

    const sql = `
      SELECT 
        a.*, 
        u.name AS doctor_name, 
        d.specialization 
      FROM appointments a
      JOIN doctors d ON a.doctor_id = d.id
      JOIN users u ON d.user_id = u.id
      WHERE a.patient_id = ?
      ORDER BY a.created_at DESC
    `;

    const [rows] = await db.query(sql, [patient_id]);

    res.status(200).json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error("❌ Fetch Appointments Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};
