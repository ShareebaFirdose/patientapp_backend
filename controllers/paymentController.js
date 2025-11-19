// controllers/paymentController.js
import Razorpay from "razorpay";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import nodemailer from "nodemailer";
import db from "../config/db.js";
import dotenv from "dotenv";
dotenv.config();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ---------------- TIME HELPERS ----------------
const toTimeString = (timeStr) => {
  if (!timeStr) return null;
  const s = String(timeStr).trim();
  const ampmMatch = s.match(/(AM|PM)$/i);
  if (ampmMatch) {
    const parts = s.replace(/(AM|PM)$/i, "").trim().split(/[:\s]+/);
    let hh = parseInt(parts[0] || "0", 10);
    let mm = parseInt(parts[1] || "0", 10) || 0;
    const ap = ampmMatch[0].toUpperCase();
    if (ap === "PM" && hh !== 12) hh += 12;
    if (ap === "AM" && hh === 12) hh = 0;
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`;
  } else {
    const parts = s.split(":");
    const hh = String(parseInt(parts[0] || "0", 10)).padStart(2, "0");
    const mm = String(parseInt(parts[1] || "0", 10)).padStart(2, "0");
    return `${hh}:${mm}:00`;
  }
};

const addMinutes = (timeStr, minutes) => {
  if (!timeStr) return null;
  const [hh, mm] = timeStr.split(":").map((t) => parseInt(t, 10));
  const date = new Date(2000, 0, 1, hh, mm, 0);
  date.setMinutes(date.getMinutes() + Number(minutes || 15));
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:00`;
};

const formatDateForEmail = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

// ---------------- EMAIL TEMPLATES ----------------
const buildDoctorEmailHtml = ({
  doctorName,
  patientName,
  patientEmail,
  patientPhone,
  clinicName,
  date,
  time,
  type,
  appointment_id,
  reason,
}) => {
  return `
  <div style="font-family:Arial; color:#fff; background:#121212; padding:24px;">
    <h1 style="color:#fff;">PRED CARE</h1>
    <p>Hi ${doctorName},</p>
    <p>A new appointment has been booked.</p>

    <h3 style="color:#9bd1ff;">Patient Information:</h3>
    <ul>
      <li><strong>Name:</strong> ${patientName}</li>
      <li><strong>Email:</strong> ${patientEmail}</li>
      <li><strong>Phone:</strong> ${patientPhone}</li>
    </ul>

    <h3 style="color:#9bd1ff;">Appointment Details:</h3>
    <ul>
      <li><strong>Clinic:</strong> ${clinicName}</li>
      <li><strong>Date:</strong> ${formatDateForEmail(date)}</li>
      <li><strong>Time:</strong> ${time}</li>
      <li><strong>Type:</strong> ${type}</li>
      <li><strong>Appointment ID:</strong> ${appointment_id}</li>
      <li><strong>Reason:</strong> ${reason || "N/A"}</li>
    </ul>
  </div>`;
};

const buildPatientEmailHtml = ({
  patientName,
  doctorName,
  specialization,
  clinicName,
  date,
  time,
  type,
  fee,
  appointment_id,
  transaction_id,
}) => {
  return `
  <div style="font-family:Arial; color:#000; padding:24px;">
    <h1>PRED CARE</h1>
    <p>Hi ${patientName}, your appointment is confirmed.</p>

    <ul>
      <li><strong>Doctor:</strong> Dr. ${doctorName} (${specialization})</li>
      <li><strong>Clinic:</strong> ${clinicName}</li>
      <li><strong>Date:</strong> ${formatDateForEmail(date)}</li>
      <li><strong>Time:</strong> ${time}</li>
      <li><strong>Type:</strong> ${type}</li>
      <li><strong>Fee Paid:</strong> ₹${fee}</li>
      <li><strong>Payment ID:</strong> ${transaction_id}</li>
      <li><strong>Appointment ID:</strong> ${appointment_id}</li>
    </ul>
  </div>`;
};

// ---------------- CREATE ORDER ----------------
export const createOrder = async (req, res) => {
  try {
    const { amount, currency } = req.body;

    if (!amount)
      return res.status(400).json({ success: false, message: "amount required" });

    const order = await razorpay.orders.create({
      amount: Number(amount),
      currency: currency || "INR",
      receipt: uuidv4(),
    });

    return res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ---------------- VERIFY PAYMENT + SAVE APPOINTMENT ----------------
export const verifyPayment = async (req, res) => {
  try {
    const payload = req.body;

    // validate Razorpay fields
    const required = [
      "razorpay_order_id",
      "razorpay_payment_id",
      "razorpay_signature",
    ];
    for (const r of required) {
      if (!payload[r])
        return res.status(400).json({ success: false, message: `${r} missing` });
    }

    // signature verification
    const generated_signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${payload.razorpay_order_id}|${payload.razorpay_payment_id}`)
      .digest("hex");

    if (generated_signature !== payload.razorpay_signature) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid signature" });
    }

    // required appointment info
    const mustHave = [
      "doctor_id",
      "patient_id",
      "patient_name",
      "patient_email",
      "appointment_date",
      "appointment_slot_time",
      "appointment_fee",
    ];
    for (const m of mustHave) {
      if (!payload[m])
        return res.status(400).json({ success: false, message: `${m} missing` });
    }

    // SELECT availability
    const [availRows] = await db.query(
      `SELECT * FROM doctor_availability 
       WHERE doctor_id = ? AND status = 1 
       LIMIT 1`,
      [payload.doctor_id]
    );

    const availabilityRow = availRows?.[0];
    const clinic_id = availabilityRow?.clinic_id || payload.clinic_id || null;

    const start_time = toTimeString(payload.appointment_slot_time);
    const end_time = addMinutes(start_time, availabilityRow?.slot_duration || 15);

    // check first or follow-up visit
    const [prev] = await db.query(
      `SELECT id FROM appointments WHERE patient_id = ? AND doctor_id = ? LIMIT 1`,
      [payload.patient_id, payload.doctor_id]
    );

    const appointment_type = prev.length ? "follow_up" : "first_visit";

    // new appointment id
    const [maxRow] = await db.query(
      `SELECT IFNULL(MAX(id),0) AS maxId FROM appointments`
    );
    const nextSeq = maxRow[0].maxId + 1;
    const appointment_id = `APPT-${String(nextSeq).padStart(5, "0")}`;

    // meeting id
    let meeting_id = uuidv4();
    let token = uuidv4();

    // INSERT appointment
    const insertObj = {
      appointment_id,
      patient_id: payload.patient_id,
      patient_name: payload.patient_name,
      patient_email: payload.patient_email,
      doctor_id: payload.doctor_id,
      clinic_id,
      appointment_date: payload.appointment_date,
      appointment_slot_time: payload.appointment_slot_time,
      start_time,
      end_time,
      appointment_fee: payload.appointment_fee,
      fee_type: payload.fee_type || "",
      consultation_type: payload.consultation_type || "",
      appointment_type,
      appointment_status: "pending",
      payment_status: "paid",
      transaction_id: payload.razorpay_payment_id,
      meeting_id,
      token,
      reason: payload.reason || "",
      symptoms: payload.symptoms || "",
      medications: payload.medications || "",
    };

    const cols = Object.keys(insertObj);
    const placeholders = cols.map(() => "?").join(",");
    const values = cols.map((c) => insertObj[c]);

    await db.query(
      `INSERT INTO appointments (${cols.join(",")}) VALUES (${placeholders})`,
      values
    );

    // SEND EMAILS (non-blocking)
    const [doc] = await db.query(
      `SELECT name, email FROM users WHERE id = ?`,
      [payload.doctor_id]
    );

    const doctorName = doc?.[0]?.name || "Doctor";
    const doctorEmail = doc?.[0]?.email;

    const doctorHtml = buildDoctorEmailHtml({
      doctorName,
      patientName: payload.patient_name,
      patientEmail: payload.patient_email,
      patientPhone: payload.patient_phone,
      clinicName: "Clinic",
      date: payload.appointment_date,
      time: payload.appointment_slot_time,
      type: payload.consultation_type,
      appointment_id,
      reason: payload.reason,
    });

    transporter.sendMail(
      {
        from: process.env.EMAIL_FROM,
        to: doctorEmail,
        subject: `New Appointment - ${appointment_id}`,
        html: doctorHtml,
      },
      () => {}
    );

    // patient email
    const patientHtml = buildPatientEmailHtml({
      patientName: payload.patient_name,
      doctorName,
      specialization: "",
      clinicName: "Clinic",
      date: payload.appointment_date,
      time: payload.appointment_slot_time,
      type: payload.consultation_type,
      fee: payload.appointment_fee,
      appointment_id,
      transaction_id: payload.razorpay_payment_id,
    });

    transporter.sendMail(
      {
        from: process.env.EMAIL_FROM,
        to: payload.patient_email,
        subject: `Appointment Confirmed - ${appointment_id}`,
        html: patientHtml,
      },
      () => {}
    );

    // ---------------- FINAL FIXED RESPONSE ----------------
    return res.json({
      success: true,
      data: {
        appointment_id,
        appointment_date: payload.appointment_date,
        appointment_slot_time: payload.appointment_slot_time,
        appointment_fee: payload.appointment_fee,
        patient_name: payload.patient_name,
        doctor_id: payload.doctor_id,
      },
    });
  } catch (err) {
    console.error("verifyPayment error:", err);
    return res.status(400).json({
      success: false,
      message: "Failed to verify/save appointment",
      error: err.message,
    });
  }
};
