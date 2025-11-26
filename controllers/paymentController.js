import crypto from "crypto";
import Razorpay from "razorpay";
import { v4 as uuidv4 } from "uuid";
import db from "../config/db.js";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/* =========================================
   ✅ SAFE UTILITY: Convert AM/PM to 24 hour
========================================= */
const convertTo24Hour = (timeStr) => {
  if (!timeStr) return null;

  const trimmed = timeStr.trim();
  const parts = trimmed.split(" ");

  // Format: "10:30 AM"
  if (parts.length === 2) {
    const [time, modifier] = parts;
    const [hourStr, minuteStr] = time.split(":");

    let hours = parseInt(hourStr, 10);
    let minutes = parseInt(minuteStr, 10);

    if (isNaN(hours) || isNaN(minutes)) return null;

    if (modifier.toUpperCase() === "PM" && hours !== 12) hours += 12;
    if (modifier.toUpperCase() === "AM" && hours === 12) hours = 0;

    return {
      hours,
      minutes,
      time24: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
        2,
        "0"
      )}`,
    };
  }

  // Already 24-hour: "10:30"
  if (parts.length === 1 && trimmed.includes(":")) {
    const [hourStr, minuteStr] = trimmed.split(":");

    let hours = parseInt(hourStr, 10);
    let minutes = parseInt(minuteStr, 10);

    if (isNaN(hours) || isNaN(minutes)) return null;

    return {
      hours,
      minutes,
      time24: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
        2,
        "0"
      )}`,
    };
  }

  return null;
};

const computeStartEndFromSlots = (slots, slotDuration = 15) => {
  if (!Array.isArray(slots) || slots.length === 0) {
    console.error("❌ Slot array empty or invalid:", slots);
    return { start: null, end: null };
  }

  const minutesList = [];

  for (const slot of slots) {
    const timeObj = convertTo24Hour(slot);

    if (!timeObj) {
      console.error("❌ Failed converting slot:", slot);
      continue;
    }

    const totalMinutes = timeObj.hours * 60 + timeObj.minutes;
    minutesList.push(totalMinutes);

    console.log("✅ Slot converted:", slot, "→", totalMinutes, "minutes");
  }

  if (minutesList.length === 0) {
    console.error("❌ No valid slots after conversion");
    return { start: null, end: null };
  }

  const minMins = Math.min(...minutesList);
  const maxMins = Math.max(...minutesList);

  const startH = Math.floor(minMins / 60);
  const startM = minMins % 60;
  const start = `${String(startH).padStart(2, "0")}:${String(startM).padStart(
    2,
    "0"
  )}:00`;

  const endTotal = maxMins + (slotDuration || 15);
  const endH = Math.floor(endTotal / 60);
  const endM = endTotal % 60;
  const end = `${String(endH).padStart(2, "0")}:${String(endM).padStart(
    2,
    "0"
  )}:00`;

  console.log("✅ FINAL TIMES:", { start, end });

  return { start, end };
};

/* =========================================
   ✅ CREATE ORDER
========================================= */
export const createOrder = async (req, res) => {
  try {
    const { amount, currency } = req.body;

    const options = {
      amount: amount,
      currency: currency || "INR",
      receipt: `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);

    res.status(200).json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("❌ createOrder Error:", error);
    res.status(500).json({ success: false, message: "Order creation failed" });
  }
};

/* =========================================
   ✅ VERIFY PAYMENT & CREATE APPOINTMENT
========================================= */
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

      appointment_fee,
      clinic_id,
      fee_type,
      consultation_type,
      reason,
      symptoms,
      medications,
      slot_duration,
    } = req.body;

    // ✅ Signature validation
    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign)
      .digest("hex");

    let isValid = expectedSign === razorpay_signature;

    /* ========================================================
       ⚠️ TEMPORARY BYPASS FOR POSTMAN TESTING ONLY
       Uncomment this block ONLY for local testing
    ========================================================= */

    // console.log("⚠️ Signature BYPASS ENABLED FOR TEST");
    // isValid = true;

    /* ======================================================== */

    if (!isValid) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid signature" });
    }

    let slots = [];

    try {
      if (typeof appointment_slot_time === "string") {
        slots = JSON.parse(appointment_slot_time);
      } else if (Array.isArray(appointment_slot_time)) {
        slots = appointment_slot_time;
      }
    } catch (e) {
      console.error("❌ Invalid slot JSON");
      return res.status(400).json({ success: false, message: "Invalid slots" });
    }

    const { start, end } = computeStartEndFromSlots(
      slots,
      Number(slot_duration || 15)
    );

    if (!start || !end) {
      console.error("❌ Time compute failed");
      return res.status(400).json({ success: false, message: "Invalid slot time" });
    }

    const appointment_id = `APPT-${Math.floor(Math.random() * 100000)}`;

    const query = `
      INSERT INTO appointments
      (
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
      )
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `;

    const values = [
      appointment_id,
      patient_id,
      patient_name,
      patient_email,
      doctor_id,
      clinic_id,
      appointment_date,
      JSON.stringify(slots),
      start,
      end,
      appointment_fee,
      fee_type,
      consultation_type,
      "follow_up",
      "pending",
      "paid",
      razorpay_payment_id,
      uuidv4(),
      uuidv4(),
      reason,
      symptoms,
      medications,
    ];

    await db.query(query, values);

    return res.status(200).json({
      success: true,
      message: "Appointment created successfully",
      data: {
        appointment_id,
        start_time: start,
        end_time: end,
      },
    });
  } catch (error) {
    console.error("❌ verifyPayment error:", error);
    res.status(500).json({
      success: false,
      message: "Payment verification failed",
    });
  }
};
