// controllers/paymentController.js
import Razorpay from "razorpay";
import crypto from "crypto";
import db from "../config/db.js";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ✅ CREATE ORDER
export const createOrder = async (req, res) => {
  try {
    const { amount, currency } = req.body;

    const options = {
      amount: amount,
      currency: currency || "INR",
      receipt: `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);

    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("createOrder error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create order",
      error: error.message,
    });
  }
};

// ✅ VERIFY PAYMENT & CREATE APPOINTMENT
export const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      doctor_id,
      patient_id,
      patient_name,
      patient_email,
      patient_phone,
      appointment_date,
      appointment_slot_time,
      start_time,
      end_time,
      appointment_fee,
      clinic_id,
      fee_type,
      consultation_type,
      reason,
      symptoms,
      medications,
      slot_duration,
    } = req.body;

    console.log("✅ Received appointment_slot_time:", appointment_slot_time);
    console.log("✅ Type:", Array.isArray(appointment_slot_time) ? "Array" : typeof appointment_slot_time);

    // Verify Razorpay signature
    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature",
      });
    }

    // ✅ Convert array to JSON string for database storage
    const slotTimeForDB = Array.isArray(appointment_slot_time)
      ? JSON.stringify(appointment_slot_time)
      : appointment_slot_time;

    console.log("✅ Storing in DB as:", slotTimeForDB);

    // Generate appointment ID
    const appointmentId = `APPT-${String(Math.floor(10000 + Math.random() * 90000)).padStart(5, "0")}`;

    // Generate VideoSDK meeting ID and token
    const meetingId = crypto.randomUUID();
    const token = crypto.randomUUID();

    // ✅ FIXED: Insert with correct column count
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
        medications,
        payment_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      appointmentId,
      patient_id,
      patient_name || "",
      patient_email || "",
      doctor_id,
      clinic_id || null,
      appointment_date,
      slotTimeForDB, // ✅ JSON string of array
      start_time,
      end_time,
      appointment_fee,
      fee_type || "video_fee",
      consultation_type,
      "follow_up",
      "pending",
      "paid",
      razorpay_payment_id,
      meetingId,
      token,
      reason || "",
      symptoms || "",
      medications || "",
      "online", // payment_type
    ];

    console.log("✅ Executing INSERT with values:", values);

    await db.query(insertQuery, values);

    console.log("✅ Appointment created successfully:", appointmentId);

    res.json({
      success: true,
      message: "Payment verified and appointment created",
      data: {
        appointment_id: appointmentId,
        appointment_date,
        appointment_slot_time, // ✅ Return original array to frontend
        start_time,
        end_time,
        transaction_id: razorpay_payment_id,
        meeting_id: meetingId,
        token,
      },
    });
  } catch (error) {
    console.error("❌ verifyPayment error:", error);
    res.status(400).json({
      success: false,
      message: "Failed to verify/save appointment",
      error: error.message,
    });
  }
};