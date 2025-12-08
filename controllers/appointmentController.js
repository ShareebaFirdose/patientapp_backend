// ===================== appointmentController.js - COMPLETE WITH CALL TRACKING =====================
import db from "../config/db.js";
import jwt from "jsonwebtoken";

/* -------------------------------------------------------------
    HELPER FUNCTIONS
------------------------------------------------------------- */

function toVideoSDKFormat(uuid) {
  if (!uuid) return null;
  
  const str = String(uuid);
  
  if (/^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/i.test(str)) {
    return str.toLowerCase();
  }
  
  let cleaned = str.replace(/[^a-z0-9]/gi, '');
  cleaned = cleaned.substring(0, 12);
  
  if (cleaned.length < 12) {
    console.error("❌ Invalid meeting ID - too short:", uuid);
    return null;
  }
  
  const formatted = `${cleaned.substring(0, 4)}-${cleaned.substring(4, 8)}-${cleaned.substring(8, 12)}`.toLowerCase();
  
  console.log(`🔄 Converted "${uuid}" → "${formatted}"`);
  return formatted;
}

function convertTo24Hour(timeStr) {
  if (!timeStr) return null;
  
  const cleaned = timeStr.trim().replace(/\s+/g, ' ');
  const parts = cleaned.split(' ');
  
  if (parts.length === 1) {
    const [hh, mm] = parts[0].split(':');
    if (!hh || !mm) return null;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }
  
  const [time, modifier] = parts;
  let [hours, minutes] = time.split(':').map(Number);
  
  if (modifier.toUpperCase() === 'PM' && hours !== 12) {
    hours = hours + 12;
  }
  if (modifier.toUpperCase() === 'AM' && hours === 12) {
    hours = 0;
  }
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function expandTo10MinSlots(startTime) {
  const time24 = convertTo24Hour(startTime);
  if (!time24) return [];
  
  const [h, m] = time24.split(':').map(Number);
  const startMins = h * 60 + m;
  const slots = [];
  
  for (let i = 0; i < 30; i += 10) {
    const mins = startMins + i;
    const hh = Math.floor(mins / 60);
    const mm = mins % 60;
    slots.push(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
  }
  
  return slots;
}

function getUserId(req) {
  return req.user?.id || req.user?.userId || null;
}

function parseRawSlots(raw) {
  if (!raw) return [];
  
  try {
    if (typeof raw === "string") {
      const s = raw.trim();
      
      if (s.startsWith("[")) {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) {
          return parsed.map((x) => String(x).trim());
        }
      }
      
      if (s.includes(",")) {
        return s.split(",").map((x) => String(x).trim()).filter(Boolean);
      }
      
      return [s];
    }
    
    return [String(raw)];
  } catch (e) {
    console.error("Error parsing raw slots:", e);
    return [String(raw)];
  }
}

function getUniqueArray(arr) {
  return [...new Set(arr)];
}

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

function toMySQLTime(isoString) {
  if (!isoString) return null;
  try {
    const date = new Date(isoString);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  } catch (error) {
    console.error("Time conversion error:", error);
    return null;
  }
}

async function validateMeetingRoom(roomId, adminToken) {
  try {
    console.log(`🔍 Validating room: ${roomId}`);
    
    const response = await fetch(`https://api.videosdk.live/v2/rooms/validate/${roomId}`, {
      method: "GET",
      headers: {
        Authorization: adminToken,
        "Content-Type": "application/json",
      },
    });

    if (response.ok) {
      console.log(`✅ Room ${roomId} is valid`);
      return true;
    }
    
    if (response.status === 404) {
      console.log(`❌ Room ${roomId} not found`);
      return false;
    }
    
    const data = await response.text();
    console.log(`⚠️ Validation returned ${response.status}:`, data);
    
    return false;
  } catch (error) {
    console.error(`❌ Validation error for room ${roomId}:`, error.message);
    return false;
  }
}

function generateAdminToken(apiKey, secret) {
  return jwt.sign(
    {
      apikey: apiKey,
      permissions: ["allow_join", "allow_mod"],
      version: 2,
      roles: ["CRAWLER"],
    },
    secret,
    { algorithm: "HS256", expiresIn: "120m" }
  );
}

function generateUserToken(apiKey, secret) {
  return jwt.sign(
    {
      apikey: apiKey,
      permissions: ["allow_join", "allow_mod"],
    },
    secret,
    { algorithm: "HS256", expiresIn: "24h" }
  );
}

/* -------------------------------------------------------------
    API ENDPOINTS
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

export const getBookedSlots = async (req, res) => {
  try {
    const { doctor_id, appointment_date, consultation_type } = req.query;

    if (!doctor_id || !appointment_date || !consultation_type) {
      return res.status(400).json({
        success: false,
        message: "doctor_id, appointment_date and consultation_type are required",
      });
    }

    const currentUserId = getUserId(req);
    const type = String(consultation_type).toLowerCase();
    const types = [type];
    
    if (type === "video") {
      types.push("video_call");
    }
    if (type === "video_call") {
      types.push("video");
    }
    if (type === "in-person" || type === "in_person") {
      types.push("in_person", "in-person");
    }

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

    const bookedSlots = [];
    const myBookedSlots = [];

    rows.forEach((row) => {
      const rawList = parseRawSlots(row.appointment_slot_time);
      const expandedSlots = [];

      rawList.forEach((raw) => {
        if (!raw) return;
        const expanded = expandTo10MinSlots(raw);
        expandedSlots.push(...expanded);
      });

      if (String(row.patient_id) === String(currentUserId)) {
        myBookedSlots.push(...expandedSlots);
      } else {
        bookedSlots.push(...expandedSlots);
      }
    });

    const bookedUnique = getUniqueArray(bookedSlots);
    const myBookedUnique = getUniqueArray(myBookedSlots);
    const allBlocked = getUniqueArray([...bookedUnique, ...myBookedUnique]);

    return res.status(200).json({
      success: true,
      slot_duration: 10,
      bookedSlots: allBlocked,
      myBookedSlots: myBookedUnique,
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
      console.error("❌ VideoSDK credentials missing");
      return res.status(500).json({
        success: false,
        message: "VideoSDK credentials not configured",
      });
    }

    const adminToken = generateAdminToken(API_KEY, SECRET);
    const userToken = generateUserToken(API_KEY, SECRET);

    if (meetingId) {
      console.log(`📋 Found existing meeting_id: ${meetingId}`);
      
      const normalized = toVideoSDKFormat(meetingId);
      
      if (!normalized) {
        console.log(`⚠️ Invalid format, will create new room`);
        meetingId = null;
      } else if (normalized !== meetingId) {
        console.log(`🔄 Normalizing: ${meetingId} → ${normalized}`);
        meetingId = normalized;
      }
      
      if (meetingId) {
        const isValid = await validateMeetingRoom(meetingId, adminToken);
        
        if (!isValid) {
          console.log(`❌ Room ${meetingId} no longer exists, creating new one`);
          meetingId = null;
        } else {
          console.log(`✅ Room ${meetingId} is valid and active`);
        }
      }
    }

    if (!meetingId) {
      console.log(`🆕 Creating new VideoSDK room...`);
      
      const createResponse = await fetch("https://api.videosdk.live/v2/rooms", {
        method: "POST",
        headers: {
          Authorization: adminToken,
          "Content-Type": "application/json",
        },
      });

      const createData = await createResponse.json();

      if (!createResponse.ok) {
        console.error("❌ Failed to create room:", createData);
        throw new Error(createData.message || "Failed to create VideoSDK room");
      }

      const fullRoomId = createData.roomId;
      console.log(`✅ VideoSDK created room: ${fullRoomId}`);
      
      const shortRoomId = toVideoSDKFormat(fullRoomId);
      
      if (!shortRoomId) {
        throw new Error("Failed to convert meeting ID to VideoSDK format");
      }
      
      console.log(`✅ Converted to SHORT format: ${shortRoomId}`);

      await db.query(
        "UPDATE appointments SET meeting_id = ? WHERE id = ?",
        [shortRoomId, appointmentId]
      );
      
      meetingId = shortRoomId;
    }

    console.log(`📤 Returning meeting_id: ${meetingId}`);

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
   🔥🔥🔥 SAVE CALL DETAILS - FIXED FOR TIMESTAMP COLUMNS
------------------------------------------------------------- */
export const saveCallDetails = async (req, res) => {
  try {
    const {
      appointmentId,
      duration,
      startTime,
      endTime,
      reason,
    } = req.body;

    if (!appointmentId) {
      return res.status(400).json({
        success: false,
        message: "Appointment ID is required",
      });
    }

    console.log(`💾 Saving call details for appointment #${appointmentId}`);
    console.log(`⏱️  Duration: ${duration} seconds`);
    console.log(`🕐 Start: ${startTime}`);
    console.log(`🕐 End: ${endTime}`);

    // 🔥 FIX: Convert ISO strings to MySQL DATETIME format for TIMESTAMP columns
    const startTimeMySQL = toMySQLDateTime(startTime);
    const endTimeMySQL = toMySQLDateTime(endTime);

    console.log(`📅 MySQL Start Time: ${startTimeMySQL}`);
    console.log(`📅 MySQL End Time: ${endTimeMySQL}`);

    // 🔥 FIX: Properly update all fields including TIMESTAMP columns
    const [result] = await db.query(
      `UPDATE appointments 
       SET 
         call_start_time = ?,
         call_end_time = ?,
         call_duration_seconds = ?,
         call_end_reason = ?,
         appointment_status = 'completed'
       WHERE id = ?`,
      [
        startTimeMySQL,    // TIMESTAMP column
        endTimeMySQL,      // TIMESTAMP column
        duration || 0,
        reason || "completed",
        appointmentId,
      ]
    );

    console.log(`✅ Database update result:`, result);
    console.log(`✅ Rows affected: ${result.affectedRows}`);

    if (result.affectedRows === 0) {
      console.error(`❌ No rows updated for appointment #${appointmentId}`);
      return res.status(404).json({
        success: false,
        message: "Appointment not found or not updated",
      });
    }

    console.log(`✅ Call details saved successfully!`);
    console.log(`✅ Appointment status updated to: COMPLETED`);

    // 🔥 Verify the update by fetching the appointment
    const [verify] = await db.query(
      `SELECT id, appointment_status, call_start_time, call_end_time, call_duration_seconds 
       FROM appointments 
       WHERE id = ?`,
      [appointmentId]
    );

    console.log(`🔍 Verification - Updated appointment:`, verify[0]);

    return res.json({
      success: true,
      message: "Call details saved and appointment marked as completed",
      data: verify[0], // Return updated data for confirmation
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
   🔥 DEBUG ENDPOINT: Check appointment status in database
------------------------------------------------------------- */
export const debugAppointment = async (req, res) => {
  try {
    const appointmentId = req.params.id;

    const [rows] = await db.query(
      `SELECT 
        id,
        appointment_status,
        call_start_time,
        call_end_time,
        call_duration_seconds,
        call_end_reason,
        payment_status,
        appointment_date,
        appointment_slot_time,
        consultation_type
       FROM appointments 
       WHERE id = ?`,
      [appointmentId]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    return res.json({
      success: true,
      data: rows[0],
    });
  } catch (error) {
    console.error("❌ debugAppointment error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch appointment",
      error: error.message,
    });
  }
};

export const resetMeetingId = async (req, res) => {
  try {
    const appointmentId = req.params.id;
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    console.log(`🔄 Resetting meeting ID for appointment #${appointmentId}`);

    const [appointments] = await db.query(
      `SELECT * FROM appointments
       WHERE id = ? AND (patient_id = ? OR doctor_id = ?)
       LIMIT 1`,
      [appointmentId, userId, userId]
    );

    if (!appointments.length) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    await db.query(
      "UPDATE appointments SET meeting_id = NULL WHERE id = ?",
      [appointmentId]
    );

    console.log(`✅ Meeting ID reset - next call will create fresh room`);

    return res.json({
      success: true,
      message: "Meeting ID reset successfully",
    });
  } catch (error) {
    console.error("❌ Reset meeting ID error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to reset meeting ID",
      error: error.message,
    });
  }
};

export const cleanupOldMeetings = async (req, res) => {
  try {
    console.log("🧹 Cleaning up old meeting rooms...");

    const [result] = await db.query(
      `UPDATE appointments 
       SET meeting_id = NULL 
       WHERE appointment_date < DATE_SUB(CURDATE(), INTERVAL 7 DAY)
         AND meeting_id IS NOT NULL`
    );

    const cleanedCount = result.affectedRows || 0;
    console.log(`✅ Cleaned up ${cleanedCount} old meeting rooms`);

    return res.json({
      success: true,
      message: `Cleaned up ${cleanedCount} old meeting rooms`,
      count: cleanedCount,
    });
  } catch (error) {
    console.error("❌ Cleanup error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to cleanup old meetings",
      error: error.message,
    });
  }
};

export default {
  getUpcomingAppointments,
  getPastAppointments,
  getAllMyAppointments,
  getAppointmentById,
  getBookedSlots,
  getVideoToken,
  saveCallDetails,
  debugAppointment,
  resetMeetingId,
  cleanupOldMeetings,
};