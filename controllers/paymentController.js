// ============================================
// COMPLETE FIX - paymentController.js
// ============================================
import Razorpay from "razorpay";
import crypto from "crypto";
import db from "../config/db.js";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

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

// ✅ FIXED: Properly handle array of slots
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
      appointment_slot_time,  // This comes as array from frontend
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

    console.log("📥 RAW appointment_slot_time:", appointment_slot_time);
    console.log("📥 Type:", typeof appointment_slot_time);
    console.log("📥 Is Array:", Array.isArray(appointment_slot_time));

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

    // ✅ CRITICAL FIX: Convert array to JSON STRING
    let slotTimeForDB;
    if (Array.isArray(appointment_slot_time)) {
      slotTimeForDB = JSON.stringify(appointment_slot_time);
    } else if (typeof appointment_slot_time === 'string') {
      // Already a string, check if it's valid JSON
      try {
        JSON.parse(appointment_slot_time);
        slotTimeForDB = appointment_slot_time;
      } catch (e) {
        // Not JSON, wrap in array
        slotTimeForDB = JSON.stringify([appointment_slot_time]);
      }
    } else {
      slotTimeForDB = JSON.stringify([appointment_slot_time]);
    }

    console.log("💾 Storing in DB as STRING:", slotTimeForDB);

    // Generate appointment ID
    const appointmentId = `APPT-${String(Math.floor(10000 + Math.random() * 90000)).padStart(5, "0")}`;

    // Generate VideoSDK meeting ID and token
    const meetingId = crypto.randomUUID();
    const token = crypto.randomUUID();

    // ✅ IMPORTANT: Your table has 22 columns (NO payment_type column)
    // Based on the error, your INSERT has these 22 columns:
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // ✅ Exactly 22 values matching 22 columns
    const values = [
      appointmentId,              // 1
      patient_id,                 // 2
      patient_name || "",         // 3
      patient_email || "",        // 4
      doctor_id,                  // 5
      clinic_id || null,          // 6
      appointment_date,           // 7
      slotTimeForDB,              // 8 - SINGLE JSON STRING value
      start_time,                 // 9
      end_time,                   // 10
      appointment_fee,            // 11
      fee_type || "video_fee",    // 12
      consultation_type,          // 13
      "follow_up",                // 14
      "pending",                  // 15
      "paid",                     // 16
      razorpay_payment_id,        // 17
      meetingId,                  // 18
      token,                      // 19
      reason || "",               // 20
      symptoms || "",             // 21
      medications || "",          // 22
    ];

    // Debug logging
    console.log("🔢 Column count:", (insertQuery.match(/\?/g) || []).length);
    console.log("🔢 Value count:", values.length);
    console.log("📋 Values being inserted:", values);

    // Execute insert
    const [result] = await db.query(insertQuery, values);

    console.log("✅ Appointment created successfully:", appointmentId);

    // Parse back to array for response
    let slotsArray;
    try {
      slotsArray = JSON.parse(slotTimeForDB);
    } catch (e) {
      slotsArray = [slotTimeForDB];
    }

    res.json({
      success: true,
      message: "Payment verified and appointment created",
      data: {
        appointment_id: appointmentId,
        appointment_date,
        appointment_slot_time: slotsArray,  // Return as array to frontend
        slot_count: Array.isArray(slotsArray) ? slotsArray.length : 1,
        start_time,
        end_time,
        transaction_id: razorpay_payment_id,
        meeting_id: meetingId,
        token,
      },
    });
  } catch (error) {
    console.error("❌ verifyPayment error:", error);
    console.error("❌ Error details:", {
      message: error.message,
      code: error.code,
      sql: error.sql,
    });
    res.status(400).json({
      success: false,
      message: "Failed to verify/save appointment",
      error: error.message,
    });
  }
};


// ============================================
// HELPER: Display slots in frontend
// ============================================
export const formatSlotDisplay = (slots) => {
  if (!slots) return "";
  
  // Parse if string
  if (typeof slots === 'string') {
    try {
      slots = JSON.parse(slots);
    } catch (e) {
      return slots;
    }
  }
  
  // Handle array
  if (Array.isArray(slots)) {
    if (slots.length === 0) return "";
    if (slots.length === 1) return slots[0];
    
    // Show range for multiple slots
    const first = slots[0];
    const last = slots[slots.length - 1];
    return `${first} - ${last} (${slots.length} slots)`;
  }
  
  return slots;
};