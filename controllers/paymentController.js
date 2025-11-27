import Razorpay from "razorpay";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import nodemailer from "nodemailer";
import axios from "axios";
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

/* ============================================================
   📱 SEND WHATSAPP NOTIFICATION - FIXED VERSION
============================================================ */
const sendWhatsAppNotification = async (phone, type, data) => {
  try {
    const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL;
    const WHATSAPP_API_KEY = process.env.WHATSAPP_API_KEY;
    const WHATSAPP_SENDER = process.env.WHATSAPP_SENDER;

    // Skip if WhatsApp is not configured
    if (!WHATSAPP_API_URL || !WHATSAPP_API_KEY || !WHATSAPP_SENDER) {
      console.log("⚠️  WhatsApp not configured - skipping notification");
      return false;
    }

    // ✅ Format phone number correctly (add 91 prefix if not present)
    let formattedPhone = phone.toString().replace(/\D/g, ''); // Remove non-digits
    
    if (!formattedPhone.startsWith('91') && formattedPhone.length === 10) {
      formattedPhone = '91' + formattedPhone;
    }

    console.log(`📱 Preparing WhatsApp for: ${formattedPhone} (Type: ${type})`);

    let message = "";

    if (type === "appointment_patient") {
      message = `✅ *Appointment Confirmed*\n\nHi ${
        data.patientName
      },\n\n*Appointment Details:*\n━━━━━━━━━━━━━━━━━\n📋 ID: ${
        data.appointment_id
      }\n👨‍⚕️ Doctor: Dr. ${
        data.doctor_name
      }\n📅 Date: ${
        data.appointment_date
      }\n🕐 Time: ${
        data.appointment_slot_time
      }\n💊 Type: ${
        data.consultation_type
      }\n💰 Fee: ₹${
        data.appointment_fee
      }\n💳 Transaction: ${
        data.transaction_id
      }\n\nThank you for choosing PRED CARE!\n\n- PRED CARE Team`;
    } else if (type === "appointment_doctor") {
      message = `🔔 *New Appointment Booked*\n\nDr. ${
        data.doctor_name
      },\n\n*Patient Details:*\n━━━━━━━━━━━━━━━━━\n👤 Name: ${
        data.patientName
      }\n📧 Email: ${
        data.patientEmail
      }\n📱 Phone: ${
        data.patientPhone
      }\n\n*Appointment:*\n📅 ${
        data.appointment_date
      }\n🕐 ${
        data.appointment_slot_time
      }\n💊 ${
        data.consultation_type
      }\n📋 ID: ${
        data.appointment_id
      }\n${
        data.reason
          ? `\n📝 Reason: ${data.reason}`
          : ""
      }\n\n- PRED CARE`;
    }

    // ✅ Pinbot API payload structure
    const payload = {
      phone: formattedPhone,
      message: message,
      sender: WHATSAPP_SENDER,
    };

    console.log("📤 WhatsApp Payload:", JSON.stringify(payload, null, 2));

    const response = await axios.post(
      WHATSAPP_API_URL,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${WHATSAPP_API_KEY}`,
        },
        timeout: 10000 // 10 second timeout
      }
    );

    console.log("📨 WhatsApp API Response:", JSON.stringify(response.data, null, 2));
    console.log("✅ WhatsApp sent successfully to:", formattedPhone);
    return true;

  } catch (error) {
    console.error("❌ WhatsApp Error Details:");
    console.error("- Type:", type);
    console.error("- Message:", error.message);
    
    if (error.response) {
      console.error("- Status Code:", error.response.status);
      console.error("- Response Data:", JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error("- No response received from server");
    }
    
    if (error.code === 'ECONNABORTED') {
      console.error("- Request timed out after 10 seconds");
    }
    
    return false;
  }
};

// ---------------- DATE FORMAT ----------------
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
    <p>Hi Dr. ${doctorName},</p>
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
      <li><strong>Doctor:</strong> Dr. ${doctorName} ${
    specialization ? `(${specialization})` : ""
  }</li>
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
      return res
        .status(400)
        .json({ success: false, message: "amount required" });

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

    const required = [
      "razorpay_order_id",
      "razorpay_payment_id",
      "razorpay_signature",
      "doctor_id",
      "patient_id",
      "patient_name",
      "patient_email",
      "appointment_date",
      "appointment_slot_time",
      "appointment_fee",
      "start_time",
      "end_time",
    ];

    for (const field of required) {
      if (!payload[field]) {
        return res.status(400).json({
          success: false,
          message: `${field} is missing`,
        });
      }
    }

    // ✅ Verify signature
    const generated_signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${payload.razorpay_order_id}|${payload.razorpay_payment_id}`)
      .digest("hex");

    if (generated_signature !== payload.razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Invalid signature",
      });
    }

    // ✅ Convert multi slots to string
    const slotString = Array.isArray(payload.appointment_slot_time)
      ? payload.appointment_slot_time.join(", ")
      : payload.appointment_slot_time;

    // ✅ Get clinic ID
    const [availRows] = await db.query(
      `SELECT clinic_id FROM doctor_availability 
       WHERE doctor_id = ? AND status = 1 LIMIT 1`,
      [payload.doctor_id]
    );

    const clinic_id = availRows?.[0]?.clinic_id || payload.clinic_id || null;

    // ✅ First or follow-up visit
    const [prev] = await db.query(
      `SELECT id FROM appointments 
       WHERE patient_id = ? AND doctor_id = ? LIMIT 1`,
      [payload.patient_id, payload.doctor_id]
    );

    const appointment_type = prev.length ? "follow_up" : "first_visit";

    // ✅ New appointment id
    const [maxRow] = await db.query(
      `SELECT IFNULL(MAX(id),0) AS maxId FROM appointments`
    );

    const nextSeq = maxRow[0].maxId + 1;
    const appointment_id = `APPT-${String(nextSeq).padStart(5, "0")}`;

    const meeting_id = uuidv4();
    const token = uuidv4();

    // ✅ FINAL INSERT
    const insertQuery = `
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
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `;

    const insertValues = [
      appointment_id,
      payload.patient_id,
      payload.patient_name,
      payload.patient_email,
      payload.doctor_id,
      clinic_id,
      payload.appointment_date,
      slotString,
      payload.start_time,
      payload.end_time,
      payload.appointment_fee,
      payload.fee_type || "",
      payload.consultation_type || "",
      appointment_type,
      "pending",
      "paid",
      payload.razorpay_payment_id,
      meeting_id,
      token,
      payload.reason || "",
      payload.symptoms || "",
      payload.medications || "",
    ];

    await db.query(insertQuery, insertValues);

    console.log("✅ Appointment saved with ID:", appointment_id);

    // ✅ GET DOCTOR INFO
    const [doc] = await db.query(
      `SELECT name, email, phone_number FROM users WHERE id = ?`,
      [payload.doctor_id]
    );

    const doctorName = doc?.[0]?.name || "Doctor";
    const doctorEmail = doc?.[0]?.email;
    const doctorPhone = doc?.[0]?.phone_number;

    console.log("📧 Sending notifications...");

    // ✅ SEND EMAIL TO DOCTOR
    const doctorHtml = buildDoctorEmailHtml({
      doctorName,
      patientName: payload.patient_name,
      patientEmail: payload.patient_email,
      patientPhone: payload.patient_phone || "N/A",
      clinicName: "Clinic",
      date: payload.appointment_date,
      time: slotString,
      type: payload.consultation_type,
      appointment_id,
      reason: payload.reason,
    });

    if (doctorEmail) {
      transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to: doctorEmail,
        subject: `New Appointment - ${appointment_id}`,
        html: doctorHtml,
      }).then(() => {
        console.log("✅ Doctor email sent to:", doctorEmail);
      }).catch(err => {
        console.error("❌ Doctor email failed:", err.message);
      });
    }

    // ✅ SEND WHATSAPP TO DOCTOR
    if (doctorPhone) {
      console.log("📱 Attempting WhatsApp to doctor:", doctorPhone);
      sendWhatsAppNotification(doctorPhone, "appointment_doctor", {
        doctor_name: doctorName,
        patientName: payload.patient_name,
        patientEmail: payload.patient_email,
        patientPhone: payload.patient_phone || "N/A",
        appointment_date: formatDateForEmail(payload.appointment_date),
        appointment_slot_time: slotString,
        consultation_type: payload.consultation_type,
        appointment_id,
        reason: payload.reason,
      }).catch(err => {
        console.error("❌ Doctor WhatsApp failed:", err.message);
      });
    }

    // ✅ SEND EMAIL TO PATIENT
    const patientHtml = buildPatientEmailHtml({
      patientName: payload.patient_name,
      doctorName,
      specialization: "",
      clinicName: "Clinic",
      date: payload.appointment_date,
      time: slotString,
      type: payload.consultation_type,
      fee: payload.appointment_fee,
      appointment_id,
      transaction_id: payload.razorpay_payment_id,
    });

    transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: payload.patient_email,
      subject: `Appointment Confirmed - ${appointment_id}`,
      html: patientHtml,
    }).then(() => {
      console.log("✅ Patient email sent to:", payload.patient_email);
    }).catch(err => {
      console.error("❌ Patient email failed:", err.message);
    });

    // ✅ SEND WHATSAPP TO PATIENT
    if (payload.patient_phone) {
      console.log("📱 Attempting WhatsApp to patient:", payload.patient_phone);
      sendWhatsAppNotification(payload.patient_phone, "appointment_patient", {
        patientName: payload.patient_name,
        doctor_name: doctorName,
        appointment_id,
        appointment_date: formatDateForEmail(payload.appointment_date),
        appointment_slot_time: slotString,
        consultation_type: payload.consultation_type,
        appointment_fee: payload.appointment_fee,
        transaction_id: payload.razorpay_payment_id,
      }).catch(err => {
        console.error("❌ Patient WhatsApp failed:", err.message);
      });
    }

    return res.json({
      success: true,
      data: {
        appointment_id,
        appointment_date: payload.appointment_date,
        appointment_slot_time: slotString,
        appointment_fee: payload.appointment_fee,
        patient_name: payload.patient_name,
        doctor_id: payload.doctor_id,
        doctor_name: doctorName,
        consultation_type: payload.consultation_type,
        transaction_id: payload.razorpay_payment_id,
      },
    });
  } catch (err) {
    console.error("❌ verifyPayment error:", err);
    return res.status(400).json({
      success: false,
      message: "Failed to verify/save appointment",
      error: err.message,
    });
  }
};