// ===================== COMPLETE paymentController.js - FIXED =====================
import Razorpay from "razorpay";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import nodemailer from "nodemailer";
import axios from "axios";
import db from "../config/db.js";
import dotenv from "dotenv";
import { generateInvoicePDF, generateInvoiceNumber } from "../utils/invoiceGenerator.js";
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
   📱 SEND WHATSAPP NOTIFICATION
============================================================ */
const sendWhatsAppNotification = async (phone, type, data) => {
  try {
    const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL;
    const WHATSAPP_API_KEY = process.env.WHATSAPP_API_KEY;
    const WHATSAPP_SENDER = process.env.WHATSAPP_SENDER;

    if (!WHATSAPP_API_URL || !WHATSAPP_API_KEY || !WHATSAPP_SENDER) {
      console.log("⚠️  WhatsApp not configured - skipping notification");
      return false;
    }

    let formattedPhone = phone.toString().replace(/\D/g, '');
    
    if (!formattedPhone.startsWith('91') && formattedPhone.length === 10) {
      formattedPhone = '91' + formattedPhone;
    }

    console.log(`📱 Preparing WhatsApp for: ${formattedPhone} (Type: ${type})`);

    let message = "";

    if (type === "appointment_patient") {
      message = `✅ *Appointment Confirmed*\n\nHi ${data.patientName},\n\n*Appointment Details:*\n━━━━━━━━━━━━━━━━━━\n📋 ID: ${data.appointment_id}\n👨‍⚕️ Doctor: Dr. ${data.doctor_name}\n📅 Date: ${data.appointment_date}\n🕐 Time: ${data.appointment_slot_time}\n💊 Type: ${data.consultation_type}\n💰 Fee: ₹${data.appointment_fee}\n💳 Transaction: ${data.transaction_id}\n📄 Invoice: ${data.invoice_number}\n\nYour invoice has been sent to your email.\n\nThank you for choosing PRED CARE!\n\n- PRED CARE Team`;
    } else if (type === "appointment_doctor") {
      message = `🔔 *New Appointment Booked*\n\nDr. ${data.doctor_name},\n\n*Patient Details:*\n━━━━━━━━━━━━━━━━━━\n👤 Name: ${data.patientName}\n📧 Email: ${data.patientEmail}\n📱 Phone: ${data.patientPhone}\n\n*Appointment:*\n📅 ${data.appointment_date}\n🕐 ${data.appointment_slot_time}\n💊 ${data.consultation_type}\n📋 ID: ${data.appointment_id}\n${data.reason ? `\n📝 Reason: ${data.reason}` : ""}\n\n- PRED CARE`;
    }

    const payload = {
      phone: formattedPhone,
      message: message,
      sender: WHATSAPP_SENDER,
    };

    const response = await axios.post(WHATSAPP_API_URL, payload, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${WHATSAPP_API_KEY}`,
      },
      timeout: 10000
    });

    console.log("✅ WhatsApp sent successfully to:", formattedPhone);
    return true;

  } catch (error) {
    console.error("❌ WhatsApp Error:", error.message);
    return false;
  }
};

/* ============================================================
   📧 SEND INVOICE EMAIL TO PATIENT
============================================================ */
const sendInvoiceEmail = async (patientEmail, patientName, invoicePath, appointmentData) => {
  try {
    const emailHtml = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%); padding: 40px 30px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 700;">PRED CARE</h1>
        </div>

        <!-- Content -->
        <div style="padding: 40px 30px;">
          <h2 style="color: #0F172A; font-size: 24px; margin: 0 0 20px 0;">Payment Confirmation & Invoice</h2>
          
          <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
            Dear <strong style="color: #0F172A;">${patientName}</strong>,
          </p>

          <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
            Thank you for booking your appointment with PRED CARE. Your payment has been successfully processed, and your appointment is confirmed!
          </p>

          <!-- Appointment Summary Card -->
          <div style="background: #F8FAFC; border-left: 4px solid #3B82F6; border-radius: 8px; padding: 20px; margin: 0 0 25px 0;">
            <h3 style="color: #0F172A; font-size: 16px; margin: 0 0 15px 0; font-weight: 600;">Appointment Summary</h3>
            
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #64748B; font-size: 14px; width: 40%;">Appointment ID:</td>
                <td style="padding: 8px 0; color: #0F172A; font-size: 14px; font-weight: 600;">${appointmentData.appointment_id}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748B; font-size: 14px;">Doctor:</td>
                <td style="padding: 8px 0; color: #0F172A; font-size: 14px; font-weight: 600;">Dr. ${appointmentData.doctor_name}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748B; font-size: 14px;">Date:</td>
                <td style="padding: 8px 0; color: #0F172A; font-size: 14px; font-weight: 600;">${formatDateForEmail(appointmentData.appointment_date)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748B; font-size: 14px;">Time:</td>
                <td style="padding: 8px 0; color: #0F172A; font-size: 14px; font-weight: 600;">${appointmentData.appointment_slot_time}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748B; font-size: 14px;">Type:</td>
                <td style="padding: 8px 0; color: #0F172A; font-size: 14px; font-weight: 600;">${appointmentData.consultation_type}</td>
              </tr>
            </table>
          </div>

          <!-- Payment Details Card -->
          <div style="background: #ECFDF5; border-left: 4px solid #10B981; border-radius: 8px; padding: 20px; margin: 0 0 25px 0;">
            <h3 style="color: #0F172A; font-size: 16px; margin: 0 0 15px 0; font-weight: 600;">Payment Details</h3>
            
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #64748B; font-size: 14px; width: 40%;">Amount Paid:</td>
                <td style="padding: 8px 0; color: #10B981; font-size: 18px; font-weight: 700;">₹${appointmentData.appointment_fee}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748B; font-size: 14px;">Transaction ID:</td>
                <td style="padding: 8px 0; color: #0F172A; font-size: 14px; font-family: monospace;">${appointmentData.transaction_id}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748B; font-size: 14px;">Invoice Number:</td>
                <td style="padding: 8px 0; color: #0F172A; font-size: 14px; font-family: monospace;">${appointmentData.invoice_number}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748B; font-size: 14px;">Payment Status:</td>
                <td style="padding: 8px 0;">
                  <span style="background: #10B981; color: #ffffff; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">PAID</span>
                </td>
              </tr>
            </table>
          </div>

          <!-- Invoice Attachment Notice -->
          <div style="background: #FEF3C7; border: 1px solid #FDE047; border-radius: 8px; padding: 15px; margin: 0 0 25px 0;">
            <p style="color: #854D0E; font-size: 14px; margin: 0; line-height: 1.5;">
              🔎 <strong>Invoice attached:</strong> Your detailed invoice is attached to this email as a PDF document.
            </p>
          </div>

          <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 15px 0;">
            If you have any questions or need to reschedule, please contact us at 
            <a href="mailto:support@predcare.com" style="color: #3B82F6; text-decoration: none;">support@predcare.com</a>
          </p>

          <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0;">
            Best regards,<br>
            <strong style="color: #0F172A;">The PRED CARE Team</strong>
          </p>
        </div>

        <!-- Footer -->
        <div style="background: #F8FAFC; padding: 25px 30px; text-align: center; border-top: 1px solid #E2E8F0;">
          <p style="color: #94A3B8; font-size: 12px; margin: 0 0 10px 0;">
            © 2024 PRED CARE. All rights reserved.
          </p>
          <p style="color: #94A3B8; font-size: 12px; margin: 0;">
            This is an automated message. Please do not reply to this email.
          </p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"PRED CARE" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: patientEmail,
      subject: `Payment Confirmation & Invoice - ${appointmentData.appointment_id}`,
      html: emailHtml,
      attachments: [
        {
          filename: `Invoice_${appointmentData.invoice_number}.pdf`,
          path: invoicePath,
        },
      ],
    });

    console.log("✅ Invoice email sent to:", patientEmail);
    return true;
  } catch (error) {
    console.error("❌ Invoice email failed:", error.message);
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

// ---------------- DOCTOR EMAIL TEMPLATE ----------------
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

    // 🔥 FIX: Get the actual doctors.id from user_id
    console.log(`🔍 Looking up doctor.id for user_id: ${payload.doctor_id}`);
    
    const [doctorRows] = await db.query(
      "SELECT id, user_id FROM doctors WHERE user_id = ?",
      [payload.doctor_id]
    );

    if (!doctorRows || doctorRows.length === 0) {
      console.error(`❌ No doctor found with user_id: ${payload.doctor_id}`);
      return res.status(400).json({
        success: false,
        message: `Doctor not found with user_id: ${payload.doctor_id}`,
      });
    }

    const actualDoctorId = doctorRows[0].id; // This is the doctors.id (19)
    console.log(`✅ Found doctor.id: ${actualDoctorId} for user_id: ${payload.doctor_id}`);

    // ✅ Convert multi slots to string
    const slotString = Array.isArray(payload.appointment_slot_time)
      ? payload.appointment_slot_time.join(", ")
      : payload.appointment_slot_time;

    // ✅ Get clinic ID - using actualDoctorId
    const [availRows] = await db.query(
      `SELECT clinic_id FROM doctor_availability 
       WHERE doctor_id = ? AND status = 1 LIMIT 1`,
      [actualDoctorId] // 🔥 FIXED: Use actualDoctorId
    );

    const clinic_id = availRows?.[0]?.clinic_id || payload.clinic_id || null;

    // ✅ First or follow-up visit - using actualDoctorId
    const [prev] = await db.query(
      `SELECT id FROM appointments 
       WHERE patient_id = ? AND doctor_id = ? LIMIT 1`,
      [payload.patient_id, actualDoctorId] // 🔥 FIXED: Use actualDoctorId
    );

    const appointment_type = prev.length ? "follow_up" : "first_visit";

    // ✅ New appointment id
    const [maxRow] = await db.query(
      `SELECT IFNULL(MAX(id),0) AS maxId FROM appointments`
    );

    const nextSeq = maxRow[0].maxId + 1;
    const appointment_id = `APPT-${String(nextSeq).padStart(5, "0")}`;

    // ✅ Generate invoice number
    const invoice_number = generateInvoiceNumber();

    const meeting_id = uuidv4();
    const token = uuidv4();

    // ✅ FINAL INSERT - using actualDoctorId
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
        invoice_number,
        meeting_id,
        token,
        reason,
        symptoms,
        medications
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `;

    const insertValues = [
      appointment_id,
      payload.patient_id,
      payload.patient_name,
      payload.patient_email,
      actualDoctorId, // 🔥 FIXED: Use actualDoctorId instead of payload.doctor_id
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
      invoice_number,
      meeting_id,
      token,
      payload.reason || "",
      payload.symptoms || "",
      payload.medications || "",
    ];

    await db.query(insertQuery, insertValues);

    console.log("✅ Appointment saved with ID:", appointment_id);

    // ✅ GET DOCTOR INFO - still use payload.doctor_id for users table
    const [doc] = await db.query(
      `SELECT name, email, phone_number FROM users WHERE id = ?`,
      [payload.doctor_id] // This is user_id, correct for users table
    );

    const doctorName = doc?.[0]?.name || "Doctor";
    const doctorEmail = doc?.[0]?.email;
    const doctorPhone = doc?.[0]?.phone_number;

    // ✅ GENERATE INVOICE PDF
    console.log("📄 Generating invoice PDF...");
    let invoicePath;
    try {
      invoicePath = await generateInvoicePDF({
        appointment_id,
        invoice_number,
        invoice_date: new Date().toISOString(),
        patient_name: payload.patient_name,
        patient_email: payload.patient_email,
        patient_phone: payload.patient_phone || "N/A",
        doctor_name: doctorName,
        specialization: "",
        clinic_name: "PRED CARE Clinic",
        clinic_address: "Healthcare Center",
        appointment_date: payload.appointment_date,
        appointment_slot_time: slotString,
        consultation_type: payload.consultation_type,
        appointment_fee: payload.appointment_fee,
        tax_amount: 0,
        total_amount: payload.appointment_fee,
        transaction_id: payload.razorpay_payment_id,
        payment_method: "Razorpay",
      });
      console.log("✅ Invoice PDF generated:", invoicePath);
    } catch (pdfError) {
      console.error("❌ Invoice PDF generation failed:", pdfError.message);
    }

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

    // ✅ SEND INVOICE EMAIL TO PATIENT
    if (invoicePath) {
      await sendInvoiceEmail(
        payload.patient_email,
        payload.patient_name,
        invoicePath,
        {
          appointment_id,
          invoice_number,
          doctor_name: doctorName,
          appointment_date: payload.appointment_date,
          appointment_slot_time: slotString,
          consultation_type: payload.consultation_type,
          appointment_fee: payload.appointment_fee,
          transaction_id: payload.razorpay_payment_id,
        }
      );
    }

    // ✅ SEND WHATSAPP TO PATIENT (with invoice info)
    if (payload.patient_phone) {
      console.log("📱 Attempting WhatsApp to patient:", payload.patient_phone);
      sendWhatsAppNotification(payload.patient_phone, "appointment_patient", {
        patientName: payload.patient_name,
        doctor_name: doctorName,
        appointment_id,
        invoice_number,
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
        invoice_number,
        appointment_date: payload.appointment_date,
        appointment_slot_time: slotString,
        appointment_fee: payload.appointment_fee,
        patient_name: payload.patient_name,
        doctor_id: actualDoctorId, // 🔥 Return the actual doctor.id
        doctor_user_id: payload.doctor_id, // Also return user_id for reference
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

export default {
  createOrder,
  verifyPayment,
};