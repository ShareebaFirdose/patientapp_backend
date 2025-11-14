import Razorpay from "razorpay";
import crypto from "crypto";
import nodemailer from "nodemailer";
import db from "../config/db.js";

// =======================================================================
//  CREATE ORDER
// =======================================================================
export const createOrder = async (req, res) => {
  try {
    const { amount } = req.body;

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: `order_${Date.now()}`,
    });

    res.json({
      success: true,
      orderId: order.id,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("Order error:", error);
    res.status(500).json({ success: false, message: "Order creation failed" });
  }
};

// =======================================================================
//  VERIFY PAYMENT + SAVE APPOINTMENT + SEND EMAILS
// =======================================================================
export const verifyPayment = async (req, res) => {
  try {
    const {
      orderId,
      paymentId,
      signature,
      doctor_id,
      clinic_id,
      patient_name,
      patient_email,
      appointment_date,
      appointment_slot_time,
      consultation_type,
      fee,
      reason,
      symptoms,
      medications,
    } = req.body;

    console.log("📧 Patient Email Received:", patient_email);
    console.log("📧 Doctor ID Received:", doctor_id);

    // Validate Razorpay signature
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(orderId + "|" + paymentId)
      .digest("hex");

    if (expectedSignature !== signature) {
      return res.status(400).json({ success: false, message: "Invalid signature" });
    }

    // TEMP FIX — use static doctor_id & patient_id
    const TEMP_DOCTOR_ID = 1; // MUST be a valid users.id
    const TEMP_PATIENT_ID = 1;

    const appointment_id = `APPT-${Date.now()}`;

    // ================================
    // INSERT APPOINTMENT
    // ================================
    await db.query(
      `
      INSERT INTO appointments
      (
        appointment_id,
        doctor_id,
        clinic_id,
        patient_id,
        patient_name,
        patient_email,
        appointment_date,
        appointment_slot_time,
        consultation_type,
        appointment_fee,
        reason,
        symptoms,
        medications,
        payment_status,
        transaction_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        appointment_id,
        TEMP_DOCTOR_ID,
        clinic_id,
        TEMP_PATIENT_ID,
        patient_name,
        patient_email,
        appointment_date,
        appointment_slot_time,
        consultation_type,
        fee,
        reason,
        symptoms,
        medications,
        "paid",
        paymentId,
      ]
    );

    // ================================
    //  FETCH REAL DOCTOR EMAIL
    // ================================
    const [doctorRows] = await db.query(
      "SELECT email FROM users WHERE id = ? LIMIT 1",
      [TEMP_DOCTOR_ID]
    );

    const doctorEmail =
      doctorRows.length > 0 ? doctorRows[0].email : "backupdoctor@gmail.com";

    console.log("📧 Doctor Email:", doctorEmail);

    // ================================
    //  EMAIL TRANSPORTER
    // ================================
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // ================================
    // SAFE fallback for patient email
    // ================================
    const safePatientEmail =
      patient_email?.trim() !== "" ? patient_email : "backup@gmail.com";

    // ================================
    // SEND EMAIL TO PATIENT
    // ================================
    const patientMailOptions = {
      from: process.env.EMAIL_USER,
      to: safePatientEmail,
      subject: "Your Appointment is Confirmed - PredCare",
      html: `
        <h2>Appointment Confirmed</h2>
        <p><b>Appointment ID:</b> ${appointment_id}</p>
        <p><b>Date:</b> ${appointment_date}</p>
        <p><b>Time:</b> ${appointment_slot_time}</p>
        <p><b>Consultation:</b> ${consultation_type}</p>
        <p><b>Amount Paid:</b> ₹${fee}</p>
        <p>Thank you for booking with PredCare!</p>
      `,
    };

    transporter.sendMail(patientMailOptions, (err) => {
      if (err) console.log("Patient Email Error:", err);
      else console.log("✔ Patient Email Sent");
    });

    // ================================
    // SEND EMAIL TO DOCTOR
    // ================================
    const doctorMailOptions = {
      from: process.env.EMAIL_USER,
      to: doctorEmail,
      subject: "New Appointment Booked - PredCare",
      html: `
        <h2>New Appointment</h2>
        <p><b>Patient:</b> ${patient_name}</p>
        <p><b>Email:</b> ${patient_email}</p>
        <p><b>Date:</b> ${appointment_date}</p>
        <p><b>Time:</b> ${appointment_slot_time}</p>
        <p><b>Reason:</b> ${reason}</p>
      `,
    };

    transporter.sendMail(doctorMailOptions, (err) => {
      if (err) console.log("Doctor Email Error:", err);
      else console.log("✔ Doctor Email Sent");
    });

    // ================================
    // SUCCESS RESPONSE
    // ================================
    res.json({
      success: true,
      message: "Payment verified, appointment created, emails sent",
      data: {
        appointment_id,
        transaction_id: paymentId,
      },
    });
  } catch (error) {
    console.error("verifyPayment Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
