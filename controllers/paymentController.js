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
    let {
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

    console.log("🔥 Received slots:", appointment_slot_time);
    console.log("🔥 start_time (frontend):", start_time);
    console.log("🔥 end_time (frontend):", end_time);

    // ✅ Verify Razorpay signature
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

    // ✅ SAFELY convert to array
    let parsedSlots;
    try {
      parsedSlots = Array.isArray(appointment_slot_time)
        ? appointment_slot_time
        : JSON.parse(appointment_slot_time);
    } catch (e) {
      parsedSlots = [appointment_slot_time];
    }

    // ✅ Convert time (AM/PM or 24h) to minutes
    const convertToMinutes = (timeStr) => {
      if (!timeStr) return null;

      const cleaned = String(timeStr).trim().toUpperCase();
      const parts = cleaned.split(" ");

      let hours, minutes;

      if (parts.length === 2) {
        const [time, modifier] = parts;
        const [h, m] = time.split(":");

        hours = parseInt(h, 10);
        minutes = parseInt(m, 10);

        if (modifier === "PM" && hours !== 12) hours += 12;
        if (modifier === "AM" && hours === 12) hours = 0;
      } else {
        const [h, m] = parts[0].split(":");
        hours = parseInt(h, 10);
        minutes = parseInt(m, 10);
      }

      if (isNaN(hours) || isNaN(minutes)) return null;

      return hours * 60 + minutes;
    };

    // ✅ Rebuild times SAFELY ON SERVER
    const minutesList = [];

    for (const slot of parsedSlots) {
      const mins = convertToMinutes(slot);

      if (mins !== null) {
        minutesList.push(mins);
      }
    }

    if (minutesList.length === 0) {
      console.error("❌ Invalid slots, cannot compute time:", parsedSlots);
      return res.status(400).json({
        success: false,
        message: "Invalid appointment slots",
      });
    }

    const minMins = Math.min(...minutesList);
    const maxMins = Math.max(...minutesList);

    const startH = Math.floor(minMins / 60);
    const startM = minMins % 60;

    const endMins = maxMins + parseInt(slot_duration || 15);
    const endH = Math.floor(endMins / 60);
    const endM = endMins % 60;

    const finalStartTime = `${String(startH).padStart(2, "0")}:${String(
      startM
    ).padStart(2, "0")}:00`;

    const finalEndTime = `${String(endH).padStart(2, "0")}:${String(endM).padStart(
      2,
      "0"
    )}:00`;

    // ✅ Force overwrite frontend time
    start_time = finalStartTime;
    end_time = finalEndTime;

    console.log("✅ SERVER COMPUTED TIME:", { start_time, end_time });

    // ✅ Ensure appointment_slot_time saved as JSON
    const slotTimeJSON = JSON.stringify(parsedSlots);

    // ✅ Generate appointment ID
    const appointmentId = `APPT-${String(
      Math.floor(10000 + Math.random() * 90000)
    ).padStart(5, "0")}`;

    const meetingId = crypto.randomUUID();
    const token = crypto.randomUUID();

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

    const values = [
      appointmentId,
      patient_id,
      patient_name || "",
      patient_email || "",
      doctor_id,
      clinic_id || null,
      appointment_date,
      slotTimeJSON,
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
    ];

    const placeholders = (insertQuery.match(/\?/g) || []).length;
    if (placeholders !== values.length) {
      throw new Error(
        `SQL mismatch: ${placeholders} placeholders vs ${values.length} values`
      );
    }

    console.log("💾 INSERTING appointment...");
    await db.query(insertQuery, values);

    res.json({
      success: true,
      message: "Appointment created successfully",
      data: {
        appointment_id: appointmentId,
        appointment_date,
        appointment_slot_time: parsedSlots,
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
      message: "Failed to verify payment and create appointment",
      error: error.message,
    });
  }
};
