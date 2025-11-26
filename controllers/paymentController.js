// controllers/paymentController.js - FINAL FIX
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
      appointment_slot_time, // JSON string from frontend
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

    console.log("🔥 Received appointment_slot_time:", appointment_slot_time);
    console.log("🔥 Type:", typeof appointment_slot_time);
    console.log("🔥 start_time:", start_time);
    console.log("🔥 end_time:", end_time);

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

    // ✅ Ensure appointment_slot_time is JSON string
    let slotTimeJSON;
    if (typeof appointment_slot_time === 'string') {
      try {
        // Validate it's proper JSON
        JSON.parse(appointment_slot_time);
        slotTimeJSON = appointment_slot_time;
      } catch (e) {
        // Not JSON, wrap it
        slotTimeJSON = JSON.stringify([appointment_slot_time]);
      }
    } else if (Array.isArray(appointment_slot_time)) {
      slotTimeJSON = JSON.stringify(appointment_slot_time);
    } else {
      slotTimeJSON = JSON.stringify([String(appointment_slot_time)]);
    }

    console.log("✅ Final slotTimeJSON:", slotTimeJSON);

    // Validate time format
    if (!start_time || start_time === "null" || start_time.includes("NaN")) {
      console.error("❌ Invalid start_time:", start_time);
      return res.status(400).json({
        success: false,
        message: "Invalid start_time format",
      });
    }

    if (!end_time || end_time === "null" || end_time.includes("NaN")) {
      console.error("❌ Invalid end_time:", end_time);
      return res.status(400).json({
        success: false,
        message: "Invalid end_time format",
      });
    }

    // Generate appointment ID
    const appointmentId = `APPT-${String(Math.floor(10000 + Math.random() * 90000)).padStart(5, "0")}`;

    // Generate meeting credentials
    const meetingId = crypto.randomUUID();
    const token = crypto.randomUUID();

    // ✅ Build INSERT query with correct parameter count
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
      slotTimeJSON,               // 8  ✅ JSON STRING
      start_time,                 // 9  ✅ "HH:MM:SS"
      end_time,                   // 10 ✅ "HH:MM:SS"
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
    console.log("📊 SQL placeholders:", placeholders);
    console.log("📊 Values provided:", values.length);
    console.log("📦 Values:", values);

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