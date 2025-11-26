// controllers/paymentController.js
// ✅ COMPLETE FIX - Handles array spreading issue

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
      appointment_slot_time, // This might be an array or string
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

    // ✅ CRITICAL FIX: Convert to JSON string IMMEDIATELY
    let slotTimeJSON;
    
    if (Array.isArray(appointment_slot_time)) {
      // Already an array, stringify it
      slotTimeJSON = JSON.stringify(appointment_slot_time);
      console.log("✅ Converted array to JSON:", slotTimeJSON);
    } else if (typeof appointment_slot_time === 'string') {
      // Check if it's already valid JSON
      try {
        const parsed = JSON.parse(appointment_slot_time);
        slotTimeJSON = JSON.stringify(parsed); // Re-stringify to ensure format
        console.log("✅ Valid JSON string:", slotTimeJSON);
      } catch (e) {
        // Not JSON, wrap it in array
        slotTimeJSON = JSON.stringify([appointment_slot_time]);
        console.log("✅ Wrapped string in array:", slotTimeJSON);
      }
    } else {
      // Fallback for any other type
      slotTimeJSON = JSON.stringify([String(appointment_slot_time)]);
      console.log("✅ Fallback conversion:", slotTimeJSON);
    }

    // Generate appointment ID
    const appointmentId = `APPT-${String(Math.floor(10000 + Math.random() * 90000)).padStart(5, "0")}`;

    // Generate VideoSDK meeting ID and token
    const meetingId = crypto.randomUUID();
    const token = crypto.randomUUID();

    // ✅ Build the INSERT query
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

    // ✅ Build values array - 22 parameters
    const values = [
      appointmentId,              // 1
      patient_id,                 // 2
      patient_name || "",         // 3
      patient_email || "",        // 4
      doctor_id,                  // 5
      clinic_id || null,          // 6
      appointment_date,           // 7
      slotTimeJSON,               // 8  ✅ JSON STRING (not array!)
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

    // Verify counts
    const placeholders = (insertQuery.match(/\?/g) || []).length;
    console.log("🔢 SQL placeholders:", placeholders);
    console.log("🔢 Values provided:", values.length);
    console.log("📦 Slot time value (index 7):", values[7]);
    console.log("📦 Type:", typeof values[7]);

    if (placeholders !== values.length) {
      throw new Error(`SQL parameter mismatch: ${placeholders} placeholders vs ${values.length} values`);
    }

    // ✅ Execute the insert
    console.log("💾 Executing INSERT...");
    const [result] = await db.query(insertQuery, values);

    console.log("✅ Appointment created! ID:", appointmentId);
    console.log("✅ Database insert ID:", result.insertId);

    // Parse slot times for response
    let parsedSlots;
    try {
      parsedSlots = JSON.parse(slotTimeJSON);
    } catch (e) {
      parsedSlots = [slotTimeJSON];
    }

    // Return success response
    res.json({
      success: true,
      message: "Payment verified and appointment created",
      data: {
        appointment_id: appointmentId,
        appointment_date,
        appointment_slot_time: parsedSlots,
        slot_count: Array.isArray(parsedSlots) ? parsedSlots.length : 1,
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
      message: "Failed to verify payment and create appointment",
      error: error.message,
    });
  }
};