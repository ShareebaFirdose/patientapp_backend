// ===================== appointmentController.js (COMPLETE FIXED VERSION) =====================
import db from "../config/db.js";
import jwt from "jsonwebtoken";

/* -------------------------------------------------------------
    HELPER FUNCTIONS (24-HOUR FORMAT - HH:MM)
------------------------------------------------------------- */

/**
 * Convert AM/PM time to 24-hour format (HH:MM)
 * Examples:
 *   "02:00 PM" → "14:00"
 *   "12:00 AM" → "00:00"
 *   "12:00 PM" → "12:00"
 *   "14:00" → "14:00" (already 24h)
 */
function convertTo24Hour(timeStr) {
  if (!timeStr) return null;
  
  // Remove extra spaces and trim
  const cleaned = timeStr.trim().replace(/\s+/g, ' ');
  
  // Check if it has AM/PM
  const parts = cleaned.split(' ');
  
  if (parts.length === 1) {
    // Already in 24h format (HH:MM)
    const [hh, mm] = parts[0].split(':');
    if (!hh || !mm) return null;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }
  
  // Has AM/PM modifier
  const [time, modifier] = parts;
  let [hours, minutes] = time.split(':').map(Number);
  
  // Convert to 24h
  if (modifier.toUpperCase() === 'PM' && hours !== 12) {
    hours = hours + 12;
  }
  if (modifier.toUpperCase() === 'AM' && hours === 12) {
    hours = 0;
  }
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Expand a booked 30-min appointment into 3x 10-min slots (24-hour format)
 * Example: "02:00 PM" → ["14:00", "14:10", "14:20"]
 */
function expandTo10MinSlots(startTime) {
  // Convert to 24h format first
  const time24 = convertTo24Hour(startTime);
  if (!time24) return [];
  
  const [h, m] = time24.split(':').map(Number);
  const startMins = h * 60 + m;
  const slots = [];
  
  // Generate 3 slots of 10 minutes each (total 30 min)
  for (let i = 0; i < 30; i += 10) {
    const mins = startMins + i;
    const hh = Math.floor(mins / 60);
    const mm = mins % 60;
    slots.push(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
  }
  
  return slots;
}

/**
 * Extract User ID from authenticated request
 */
function getUserId(req) {
  return req.user?.id || req.user?.userId || null;
}

/**
 * Parse raw appointment_slot_time field
 * Handles: JSON array, comma-separated string, or single value
 * Examples:
 *   - '["02:00 PM", "02:30 PM"]' → ["02:00 PM", "02:30 PM"]
 *   - "02:00 PM, 02:30 PM" → ["02:00 PM", "02:30 PM"]
 *   - "02:00 PM" → ["02:00 PM"]
 */
function parseRawSlots(raw) {
  if (!raw) return [];
  
  try {
    if (typeof raw === "string") {
      const s = raw.trim();
      
      // JSON array format
      if (s.startsWith("[")) {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) {
          return parsed.map((x) => String(x).trim());
        }
      }
      
      // Comma separated format
      if (s.includes(",")) {
        return s.split(",").map((x) => String(x).trim()).filter(Boolean);
      }
      
      // Single value
      return [s];
    }
    
    // Fallback for other types
    return [String(raw)];
  } catch (e) {
    console.error("Error parsing raw slots:", e);
    return [String(raw)];
  }
}

/**
 * Get unique values from array
 */
function getUniqueArray(arr) {
  return [...new Set(arr)];
}

/**
 * Convert ISO string to MySQL datetime format
 */
function toMySQLDateTime(isoString) {
  if (!isoString) return null;
  try {
    const date = new Date(isoString);
    return date.toISOString().slice(0, 19).replace("T", " ");
  } catch (error) {
    console.error("Date conversion error:", error);
    return null;
  }
}

/* -------------------------------------------------------------
    UPCOMING APPOINTMENTS
    Get all future appointments for the logged-in patient
------------------------------------------------------------- */
export const getUpcomingAppointments = async (req, res) => {
  try {
    const patientId = getUserId(req);
    
    if (!patientId) {
      return res.json({ success: true, appointments: [] });
    }

    const [rows] = await db.query(
      `
      SELECT 
        a.*,
        u.name as doctor_name,
        d.specialization
      FROM appointments a
      LEFT JOIN users u ON a.doctor_id = u.id
      LEFT JOIN doctors d ON a.doctor_id = d.user_id
      WHERE a.patient_id = ?
        AND a.appointment_date >= CURDATE()
      ORDER BY a.appointment_date ASC, a.start_time ASC
      `,
      [patientId]
    );

    return res.json({ 
      success: true, 
      appointments: rows 
    });
  } catch (err) {
    console.error("❌ getUpcomingAppointments error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Failed to fetch upcoming appointments",
      error: err.message
    });
  }
};

/* -------------------------------------------------------------
    PAST APPOINTMENTS
    Get all past appointments for the logged-in patient
------------------------------------------------------------- */
export const getPastAppointments = async (req, res) => {
  try {
    const patientId = getUserId(req);
    
    if (!patientId) {
      return res.json({ success: true, appointments: [] });
    }

    const [rows] = await db.query(
      `
      SELECT 
        a.*,
        u.name AS doctor_name,
        d.specialization
      FROM appointments a
      LEFT JOIN users u ON a.doctor_id = u.id
      LEFT JOIN doctors d ON a.doctor_id = d.user_id
      WHERE a.patient_id = ?
        AND a.appointment_date < CURDATE()
      ORDER BY a.appointment_date DESC, a.start_time DESC
      `,
      [patientId]
    );

    return res.json({ 
      success: true, 
      appointments: rows 
    });
  } catch (err) {
    console.error("❌ getPastAppointments error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Failed to fetch past appointments",
      error: err.message
    });
  }
};

/* -------------------------------------------------------------
    ALL MY APPOINTMENTS
    Get all appointments (past + future) for the logged-in patient
------------------------------------------------------------- */
export const getAllMyAppointments = async (req, res) => {
  try {
    const patientId = getUserId(req);
    
    if (!patientId) {
      return res.json({ success: true, data: [] });
    }

    const [rows] = await db.query(
      `
      SELECT 
        a.*,
        u.name AS doctor_name,
        d.specialization
      FROM appointments a
      LEFT JOIN users u ON a.doctor_id = u.id
      LEFT JOIN doctors d ON a.doctor_id = d.user_id
      WHERE a.patient_id = ?
      ORDER BY a.appointment_date DESC, a.start_time DESC
      `,
      [patientId]
    );

    return res.json({ 
      success: true, 
      data: rows 
    });
  } catch (err) {
    console.error("❌ getAllMyAppointments error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Failed to fetch appointments",
      error: err.message
    });
  }
};

/* -------------------------------------------------------------
    GET APPOINTMENT BY ID
    Get single appointment details by ID
------------------------------------------------------------- */
export const getAppointmentById = async (req, res) => {
  try {
    const appointmentId = req.params.id;

    if (!appointmentId) {
      return res.status(400).json({ 
        success: false, 
        message: "Appointment ID is required" 
      });
    }

    const [rows] = await db.query(
      `
      SELECT 
        a.*,
        u.name AS doctor_name,
        d.specialization,
        d.doctor_id
      FROM appointments a
      LEFT JOIN users u ON a.doctor_id = u.id
      LEFT JOIN doctors d ON a.doctor_id = d.user_id
      WHERE a.id = ?
      LIMIT 1
      `,
      [appointmentId]
    );

    if (!rows.length) {
      return res.status(404).json({ 
        success: false, 
        message: "Appointment not found" 
      });
    }

    return res.json({ 
      success: true, 
      data: rows[0] 
    });
  } catch (err) {
    console.error("❌ getAppointmentById error:", err);
    return res.status(500).json({ 
      success: false,
      message: "Failed to fetch appointment",
      error: err.message
    });
  }
};

/* -------------------------------------------------------------
   GET BOOKED SLOTS (FIXED VERSION)
   
   Returns all booked time slots for a specific:
   - doctor_id
   - appointment_date
   - consultation_type (in-person or video)
   
   Returns:
   - bookedSlots: All blocked slots (including user's own) in 24h format
   - myBookedSlots: Only current user's slots in 24h format
   - slot_duration: Always 10 minutes
   
   Example response:
   {
     "success": true,
     "slot_duration": 10,
     "bookedSlots": ["14:00", "14:10", "14:20", "14:30", "14:40", "14:50"],
     "myBookedSlots": ["14:00", "14:10", "14:20"]
   }
------------------------------------------------------------- */
export const getBookedSlots = async (req, res) => {
  try {
    const { doctor_id, appointment_date, consultation_type } = req.query;

    console.log(`🔍 getBookedSlots called with query params:`, req.query);

    // Validate required parameters
    if (!doctor_id || !appointment_date || !consultation_type) {
      console.log(`❌ Missing parameters:`, {
        has_doctor_id: !!doctor_id,
        has_appointment_date: !!appointment_date,
        has_consultation_type: !!consultation_type
      });
      return res.status(400).json({
        success: false,
        message: "doctor_id, appointment_date and consultation_type are required",
      });
    }

    const currentUserId = getUserId(req);

    // Normalize consultation type and handle synonyms
    const type = String(consultation_type).toLowerCase();
    const types = [type];
    
    // Add common variations
    if (type === "video") {
      types.push("video_call");
    }
    if (type === "video_call") {
      types.push("video");
    }
    if (type === "in-person" || type === "in_person") {
      types.push("in_person", "in-person");
    }

    console.log(`🔍 Searching with:`, {
      doctor_id,
      appointment_date,
      consultation_types: types,
      currentUserId
    });

    // First, let's check ALL appointments for this doctor on this date
    const [allRows] = await db.query(
      `SELECT 
        a.id,
        a.appointment_slot_time,
        a.patient_id,
        a.consultation_type,
        a.appointment_date,
        a.doctor_id,
        DATE(a.appointment_date) as date_only
      FROM appointments a
      WHERE a.doctor_id = ?
        AND DATE(a.appointment_date) = DATE(?)`,
      [doctor_id, appointment_date]
    );

    console.log(`📊 ALL appointments for doctor ${doctor_id} on ${appointment_date}:`, allRows);

    // Also check recent appointments for debugging
    if (allRows.length === 0) {
      const [recentRows] = await db.query(
        `SELECT 
          a.id,
          a.doctor_id,
          a.patient_id,
          a.appointment_date,
          a.consultation_type,
          a.appointment_slot_time
        FROM appointments a
        WHERE a.appointment_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        ORDER BY a.created_at DESC
        LIMIT 5`
      );
      console.log(`ℹ️  Recent appointments in system (last 5):`, recentRows);
    }

    // Query appointments matching criteria (case-insensitive)
    const [rows] = await db.query(
      `
      SELECT 
        appointment_slot_time,
        patient_id,
        id as appointment_id,
        consultation_type
      FROM appointments
      WHERE doctor_id = ?
        AND DATE(appointment_date) = DATE(?)
        AND (
          LOWER(REPLACE(consultation_type, '_', '-')) IN (?)
          OR LOWER(REPLACE(consultation_type, '-', '_')) IN (?)
        )
      `,
      [doctor_id, appointment_date, types, types]
    );

    console.log(`📋 Found ${rows.length} MATCHING appointments (after consultation_type filter)`);
    
    if (rows.length === 0 && allRows.length > 0) {
      console.log(`⚠️  WARNING: Found ${allRows.length} total appointments, but 0 matched consultation_type filter!`);
      console.log(`   Requested types: ${types}`);
      console.log(`   Actual types in DB:`, allRows.map(r => r.consultation_type));
    }

    const bookedSlots = [];
    const myBookedSlots = [];

    // Process each appointment
    rows.forEach((row) => {
      const rawList = parseRawSlots(row.appointment_slot_time);
      const expandedSlots = [];

      console.log(`  📌 Appointment #${row.appointment_id} slots:`, rawList);

      // Expand each slot time
      rawList.forEach((raw) => {
        if (!raw) return;

        // Expand 30-min booking to 3x 10-min slots in 24h format
        const expanded = expandTo10MinSlots(raw);
        console.log(`    ➜ "${raw}" expanded to:`, expanded);
        expandedSlots.push(...expanded);
      });

      // Separate current user's slots from others
      if (String(row.patient_id) === String(currentUserId)) {
        myBookedSlots.push(...expandedSlots);
        console.log(`    ✅ Added to MY slots`);
      } else {
        bookedSlots.push(...expandedSlots);
        console.log(`    ✅ Added to OTHER slots`);
      }
    });

    // Remove duplicates
    const bookedUnique = getUniqueArray(bookedSlots);
    const myBookedUnique = getUniqueArray(myBookedSlots);

    // Combine all slots to block (both others' and mine)
    const allBlocked = getUniqueArray([...bookedUnique, ...myBookedUnique]);

    console.log(`✅ Returning ${allBlocked.length} blocked slots:`, allBlocked);
    console.log(`   - ${myBookedUnique.length} are mine`);
    console.log(`   - ${bookedUnique.length} are others'`);

    return res.status(200).json({
      success: true,
      slot_duration: 10,
      bookedSlots: allBlocked,        // All blocked slots (24h format)
      myBookedSlots: myBookedUnique,  // Only my slots (24h format)
    });
  } catch (error) {
    console.error("❌ getBookedSlots error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch booked slots",
      error: error.message,
    });
  }
};

/* -------------------------------------------------------------
   VIDEO TOKEN GENERATION
   
   Generates or retrieves a VideoSDK token and meeting ID
   for video consultations
------------------------------------------------------------- */
export const getVideoToken = async (req, res) => {
  try {
    const appointmentId = req.params.id;
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - User not authenticated",
      });
    }

    console.log(`🎥 Generating video token for appointment #${appointmentId}, user #${userId}`);

    // Verify user is part of this appointment
    const [appointments] = await db.query(
      `SELECT * FROM appointments
       WHERE id = ? AND (patient_id = ? OR doctor_id = ?)
       LIMIT 1`,
      [appointmentId, userId, userId]
    );

    if (!appointments.length) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found or you don't have access",
      });
    }

    let meetingId = appointments[0].meeting_id;

    const SECRET = process.env.VIDEOSDK_SECRET;
    const API_KEY = process.env.VIDEOSDK_API_KEY;

    if (!SECRET || !API_KEY) {
      console.error("❌ VideoSDK credentials missing in environment variables");
      return res.status(500).json({
        success: false,
        message: "VideoSDK credentials not configured",
      });
    }

    // Create new meeting room if doesn't exist
    if (!meetingId) {
      console.log(`📝 Creating new VideoSDK room...`);
      
      const adminToken = jwt.sign(
        {
          apikey: API_KEY,
          permissions: ["allow_join", "allow_mod"],
          version: 2,
          roles: ["crawler"],
        },
        SECRET,
        { algorithm: "HS256", expiresIn: "120m" }
      );

      const response = await fetch("https://api.videosdk.live/v2/rooms", {
        method: "POST",
        headers: {
          Authorization: adminToken,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to create VideoSDK room");
      }

      meetingId = data.roomId;
      console.log(`✅ Created new room: ${meetingId}`);

      // Save meeting ID to appointment
      await db.query(
        "UPDATE appointments SET meeting_id = ? WHERE id = ?",
        [meetingId, appointmentId]
      );
    } else {
      console.log(`✅ Using existing room: ${meetingId}`);
    }

    // Generate user token for joining
    const userToken = jwt.sign(
      {
        apikey: API_KEY,
        permissions: ["allow_join", "allow_mod"],
        version: 2,
        roles: ["rtc"],
      },
      SECRET,
      { algorithm: "HS256", expiresIn: "120m" }
    );

    return res.json({
      success: true,
      token: userToken,
      meeting_id: meetingId,
    });
  } catch (error) {
    console.error("❌ Video token generation error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate video token",
      error: error.message,
    });
  }
};

/* -------------------------------------------------------------
   SAVE CALL DETAILS
   
   Save video call metadata after call ends:
   - Start time, end time, duration
   - Participant join times
   - End reason
------------------------------------------------------------- */
export const saveCallDetails = async (req, res) => {
  try {
    const {
      appointmentId,
      duration,
      startTime,
      endTime,
      reason,
      participants,
    } = req.body;

    if (!appointmentId) {
      return res.status(400).json({
        success: false,
        message: "Appointment ID is required",
      });
    }

    console.log(`💾 Saving call details for appointment #${appointmentId}`);

    // Update appointment with call details
    await db.query(
      `UPDATE appointments 
       SET 
         call_start_time = ?,
         call_end_time = ?,
         call_duration_seconds = ?,
         call_end_reason = ?,
         participant_join_times = ?
       WHERE id = ?`,
      [
        toMySQLDateTime(startTime),
        toMySQLDateTime(endTime),
        duration || 0,
        reason || "completed",
        JSON.stringify(participants || {}),
        appointmentId,
      ]
    );

    console.log(`✅ Call details saved successfully`);

    return res.json({
      success: true,
      message: "Call details saved successfully",
    });
  } catch (error) {
    console.error("❌ saveCallDetails error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to save call details",
      error: error.message,
    });
  }
};

/* -------------------------------------------------------------
   EXPORTS
------------------------------------------------------------- */
export default {
  getUpcomingAppointments,
  getPastAppointments,
  getAllMyAppointments,
  getAppointmentById,
  getBookedSlots,
  getVideoToken,
  saveCallDetails,
};

// ===================== End of appointmentController.js =====================