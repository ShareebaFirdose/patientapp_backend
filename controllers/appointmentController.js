import db from "../config/db.js";
import nodemailer from "nodemailer";

/* ============================================================
   1. BOOK APPOINTMENT (Pending until payment is done)
============================================================ */
export const bookAppointment = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      doctor_id,
      clinic_id,
      appointment_date,
      appointment_time,
      consultation_type,
      fee,
      symptoms
    } = req.body;

    if (!doctor_id || !appointment_date || !appointment_time) {
      return res.status(400).json({
        success: false,
        message: "doctor_id, appointment_date & appointment_time required",
      });
    }

    const sql = `
      INSERT INTO appointments (
        user_id, doctor_id, clinic_id, appointment_date, appointment_time,
        consultation_type, fee, symptoms, payment_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `;

    await db.query(sql, [
      userId,
      doctor_id,
      clinic_id || null,
      appointment_date,
      appointment_time,
      consultation_type || "General",
      fee || 0,
      symptoms || null,
    ]);

    return res.status(201).json({
      success: true,
      message: "Appointment created as pending",
    });
  } catch (error) {
    console.error("❌ bookAppointment Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create appointment",
      error: error.message,
    });
  }
};

/* ============================================================
   2. SAVE APPOINTMENT AFTER PAYMENT (Called from verifyPayment)
============================================================ */
export const savePaidAppointment = async (appointmentData) => {
  try {
    const {
      doctorId,
      clinicId,
      patientId,
      patientName,
      patientEmail,
      appointmentDate,
      appointmentTime,
      consultationType,
      amount,
      paymentId,
    } = appointmentData;

    const sql = `
      INSERT INTO appointments (
        doctor_id, clinic_id, user_id,
        patient_name, patient_email,
        appointment_date, appointment_time,
        consultation_type, fee,
        payment_status, transaction_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', ?)
    `;

    await db.query(sql, [
      doctorId,
      clinicId,
      patientId || null,
      patientName,
      patientEmail,
      appointmentDate,
      appointmentTime,
      consultationType,
      amount,
      paymentId,
    ]);

  } catch (error) {
    console.log("❌ savePaidAppointment Error:", error);
  }
};

/* ============================================================
   3. SEND EMAIL NOTIFICATION
============================================================ */
export const sendAppointmentEmail = async (toEmails, subject, html) => {
  try {
    const transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: toEmails,
      subject,
      html,
    });
  } catch (error) {
    console.log("❌ Email Error:", error);
  }
};

/* ============================================================
   4. GET APPOINTMENTS FOR USER (All appointments)
============================================================ */
export const getAppointmentsByUser = async (req, res) => {
  try {
    const userId = req.user.id;

    const sql = `
      SELECT 
        a.id,
        a.appointment_date,
        a.appointment_time,
        a.consultation_type,
        a.fee,
        a.payment_status,
        a.transaction_id,
        d.id AS doctor_id,
        d.specialization,
        u.name AS doctor_name,
        u.email AS doctor_email,
        u.phone_number AS doctor_phone
      FROM appointments a
      JOIN doctors d ON a.doctor_id = d.id
      JOIN users u ON d.user_id = u.id
      WHERE a.user_id = ?
      ORDER BY a.appointment_date DESC, a.appointment_time DESC
    `;

    const [rows] = await db.query(sql, [userId]);

    return res.status(200).json({
      success: true,
      appointments: rows,
    });
  } catch (error) {
    console.error("❌ getAppointmentsByUser Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch appointments",
      error: error.message,
    });
  }
};

/* ============================================================
   5. GET UPCOMING APPOINTMENTS (Dashboard)
============================================================ */
export const getUpcomingAppointments = async (req, res) => {
  try {
    const userId = req.user.id;

    const sql = `
      SELECT 
        a.id,
        a.appointment_date,
        a.appointment_time,
        a.consultation_type,
        a.fee,
        a.payment_status,
        a.transaction_id,
        d.id AS doctor_id,
        d.specialization,
        u.name AS doctor_name,
        u.email AS doctor_email
      FROM appointments a
      JOIN doctors d ON a.doctor_id = d.id
      JOIN users u ON d.user_id = u.id
      WHERE a.user_id = ?
        AND a.appointment_date >= CURDATE()
        AND a.payment_status = 'paid'
      ORDER BY a.appointment_date ASC, a.appointment_time ASC
    `;

    const [rows] = await db.query(sql, [userId]);

    return res.status(200).json({
      success: true,
      appointments: rows,
    });
  } catch (error) {
    console.error("❌ getUpcomingAppointments Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch upcoming appointments",
      error: error.message,
    });
  }
};
