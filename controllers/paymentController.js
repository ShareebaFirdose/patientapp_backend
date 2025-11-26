// ============================================
// SOLUTION 1: Store Multiple Slots as JSON
// ============================================
// controllers/paymentController.js - UPDATED verifyPayment function

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
      appointment_slot_time,  // This is an ARRAY of slots
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

    console.log("📋 Received slots:", appointment_slot_time);

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

    // ✅ Store multiple slots as JSON string
    const slotsArray = Array.isArray(appointment_slot_time) 
      ? appointment_slot_time 
      : [appointment_slot_time];
    
    const slotTimeForDB = JSON.stringify(slotsArray);
    
    console.log("💾 Storing slots in DB:", slotTimeForDB);

    // Generate IDs
    const appointmentId = `APPT-${String(Math.floor(10000 + Math.random() * 90000)).padStart(5, "0")}`;
    const meetingId = crypto.randomUUID();
    const token = crypto.randomUUID();

    // ✅ SINGLE appointment with multiple slots stored as JSON
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
      slotTimeForDB,              // ✅ JSON array: ["10:00 AM", "10:15 AM", "10:30 AM"]
      start_time,                 // First slot start time
      end_time,                   // Last slot end time
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
      "online",
    ];

    await db.query(insertQuery, values);

    console.log("✅ Multi-slot appointment created:", appointmentId);

    res.json({
      success: true,
      message: "Payment verified and appointment created",
      data: {
        appointment_id: appointmentId,
        appointment_date,
        appointment_slot_time: slotsArray,  // Return as array
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


// ============================================
// DISPLAYING MULTI-SLOT APPOINTMENTS
// ============================================
// controllers/appointmentController.js - UPDATE to parse slots

export const getAllMyAppointments = async (req, res) => {
  try {
    const patientId = getUserId(req);

    if (!patientId) return res.json({ success: true, data: [] });

    const [rows] = await db.query(
      `SELECT * FROM appointments
       WHERE patient_id = ?
       ORDER BY appointment_date DESC`,
      [patientId]
    );

    // ✅ Parse JSON slots for each appointment
    const appointments = rows.map(apt => {
      try {
        if (apt.appointment_slot_time && typeof apt.appointment_slot_time === 'string') {
          apt.appointment_slot_time = JSON.parse(apt.appointment_slot_time);
        }
      } catch (e) {
        console.warn("Failed to parse slots:", e);
      }
      return apt;
    });

    return res.json({ success: true, data: appointments });
  } catch (err) {
    console.error("getAllMyAppointments error:", err);
    return res.status(500).json({ success: false });
  }
};

// Same for other appointment functions
export const getUpcomingAppointments = async (req, res) => {
  try {
    const patientId = getUserId(req);
    if (!patientId) return res.json({ success: true, appointments: [] });

    const [rows] = await db.query(
      `SELECT * FROM appointments
       WHERE patient_id = ?
       AND appointment_date >= CURDATE()
       ORDER BY appointment_date ASC`,
      [patientId]
    );

    // ✅ Parse JSON slots
    const appointments = rows.map(apt => {
      try {
        if (apt.appointment_slot_time && typeof apt.appointment_slot_time === 'string') {
          apt.appointment_slot_time = JSON.parse(apt.appointment_slot_time);
        }
      } catch (e) {
        console.warn("Failed to parse slots:", e);
      }
      return apt;
    });

    return res.json({ success: true, appointments });
  } catch (err) {
    console.error("getUpcomingAppointments error:", err);
    return res.status(500).json({ success: false });
  }
};


// ============================================
// DATABASE SCHEMA CHECK
// ============================================
/*
Make sure your appointments table has appointment_slot_time as TEXT or JSON:

ALTER TABLE appointments 
MODIFY COLUMN appointment_slot_time TEXT;

OR if your MySQL version supports JSON type:

ALTER TABLE appointments 
MODIFY COLUMN appointment_slot_time JSON;
*/


// ============================================
// FRONTEND DISPLAY HELPER
// ============================================
// Utils to display slots nicely in your React Native app

export const displaySlots = (slots) => {
  if (!slots) return "";
  
  // If it's a string, try to parse it
  if (typeof slots === 'string') {
    try {
      slots = JSON.parse(slots);
    } catch (e) {
      return slots;
    }
  }
  
  // If it's an array, join with commas
  if (Array.isArray(slots)) {
    if (slots.length === 1) {
      return slots[0];
    }
    if (slots.length === 2) {
      return `${slots[0]} - ${slots[slots.length - 1]}`;
    }
    return `${slots[0]} - ${slots[slots.length - 1]} (${slots.length} slots)`;
  }
  
  return slots;
};

// Example usage in React Native:
// <Text>{displaySlots(appointment.appointment_slot_time)}</Text>
// Output: "10:00 AM - 11:00 AM (4 slots)"