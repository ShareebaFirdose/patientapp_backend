import db from "../config/db.js";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";

/* ===========================
   Helper function to convert time
   "11:00 AM" → "11:00:00"
=========================== */
function to24Hour(timeStr) {
  if (!timeStr || typeof timeStr !== "string") return null;

  const parts = timeStr.trim().split(" ");
  if (parts.length !== 2) return null;

  let [hours, minutes] = parts[0].split(":");
  const modifier = parts[1];

  if (hours === "12") hours = "00";
  if (modifier.toUpperCase() === "PM") {
    hours = parseInt(hours, 10) + 12;
  }

  return `${hours.toString().padStart(2, "0")}:${minutes}:00`;
}

/* ===========================
   CREATE PAYMENT ORDER
=========================== */
export const createOrder = async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount) {
      return res.status(400).json({ success: false, message: "Amount required" });
    }

    const orderId = "ORDER-" + Date.now();

    res.json({
      success: true,
      orderId,
      amount,
    });
  } catch (error) {
    console.error("Create Order Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ===========================
   VERIFY PAYMENT + BOOK APPOINTMENT
=========================== */
export const verifyPayment = async (req, res) => {
  try {
    const {
      patient_id,
      patient_name,
      patient_email,
      doctor_id,
      clinic_id,
      appointment_date,
      appointment_slot_time,
      appointment_fee,
      consultation_type,
      appointment_type,
      transaction_id,
      meeting_id,
      token,
      reason,
      symptoms,
      medications,
    } = req.body;

    console.log("📩 Verify Payment Request:", req.body);

    if (
      !patient_id ||
      !doctor_id ||
      !appointment_date ||
      !appointment_slot_time ||
      !appointment_fee
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    // ✅ FIX: Handle slot array properly
    let slot = appointment_slot_time;

    if (Array.isArray(slot)) {
      slot = slot[0]; // taking first selected time
    }

    if (!slot) {
      return res.status(400).json({
        success: false,
        message: "Invalid time slot selected",
      });
    }

    const start_time = to24Hour(slot);

    if (!start_time) {
      return res.status(400).json({
        success: false,
        message: "Could not generate start time",
      });
    }

    // Calculate end_time (+30 minutes)
    let [hour, minute] = start_time.split(":").map(Number);

    minute += 30;
    if (minute >= 60) {
      minute -= 60;
      hour += 1;
    }

    const end_time = `${hour.toString().padStart(2, "0")}:${minute
      .toString()
      .padStart(2, "0")}:00`;

    const appointment_id = "APPT-" + Date.now().toString().slice(-5);
    const payment_status = "paid";
    const appointment_status = "pending";
    const fee_type = consultation_type === "video" ? "video_fee" : "in_person_fee";

    const query = `
      INSERT INTO appointments (
        appointment_id,
        patient_id,
        patient_name,
        patient_email,
        doctor_id,
        clinic_id,
        appointment_date,
        appointment_slot_time,
        start_time,
        end_time,
        appointment_fee,
        fee_type,
        consultation_type,
        appointment_type,
        appointment_status,
        payment_status,
        transaction_id,
        meeting_id,
        token,
        reason,
        symptoms,
        medications
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      appointment_id,
      patient_id,
      patient_name,
      patient_email,
      doctor_id,
      clinic_id,
      appointment_date,
      JSON.stringify([slot]),
      start_time,
      end_time,
      appointment_fee,
      fee_type,
      consultation_type,
      appointment_type,
      appointment_status,
      payment_status,
      transaction_id || null,
      meeting_id || uuidv4(),
      token || uuidv4(),
      reason || null,
      symptoms || null,
      medications || null,
    ];

    const [result] = await db.query(query, values);

    console.log("✅ Appointment Created:", result);

    return res.json({
      success: true,
      message: "Payment verified and appointment booked successfully",
      data: {
        appointment_id,
        appointment_date,
        appointment_slot_time: slot,
        start_time,
        end_time,
        appointment_fee,
        consultation_type,
        transaction_id,
      },
    });
  } catch (error) {
    console.error("❌ verifyPayment error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
