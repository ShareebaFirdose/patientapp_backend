import db from "../config/db.js";
import jwt from "jsonwebtoken";

// Extract correct user ID from token
const getUserId = (req) => {
  return req.user?.id || req.user?.userId || null;
};

// Convert ISO 8601 to MySQL datetime format
const toMySQLDateTime = (isoString) => {
  if (!isoString) return null;
  try {
    const date = new Date(isoString);
    return date.toISOString().slice(0, 19).replace('T', ' ');
  } catch (error) {
    console.error('Date conversion error:', error);
    return null;
  }
};

/* -------------------------------------------------------------
   UPCOMING
------------------------------------------------------------- */
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

    return res.json({ success: true, appointments: rows });
  } catch (err) {
    console.error("getUpcomingAppointments error:", err);
    return res.status(500).json({ success: false });
  }
};

/* -------------------------------------------------------------
   PAST
------------------------------------------------------------- */
export const getPastAppointments = async (req, res) => {
  try {
    const patientId = getUserId(req);

    if (!patientId) return res.json({ success: true, appointments: [] });

    const [rows] = await db.query(
      `SELECT * FROM appointments
       WHERE patient_id = ?
       AND appointment_date < CURDATE()
       ORDER BY appointment_date DESC`,
      [patientId]
    );

    return res.json({ success: true, appointments: rows });
  } catch (err) {
    console.error("getPastAppointments error:", err);
    return res.status(500).json({ success: false });
  }
};

/* -------------------------------------------------------------
   ALL MY APPOINTMENTS
------------------------------------------------------------- */
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

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("getAllMyAppointments error:", err);
    return res.status(500).json({ success: false });
  }
};

/* -------------------------------------------------------------
   GET APPOINTMENT BY ID
------------------------------------------------------------- */
export const getAppointmentById = async (req, res) => {
  try {
    const id = req.params.id;

    const [rows] = await db.query(
      `SELECT * FROM appointments WHERE id = ? LIMIT 1`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("getAppointmentById error:", err);
    return res.status(500).json({ success: false });
  }
};

/* -------------------------------------------------------------
   VIDEO TOKEN (MEETING ID GENERATION)
------------------------------------------------------------- */
export const getVideoToken = async (req, res) => {
  try {
    const appointmentId = req.params.id;
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const [appointments] = await db.query(
      `SELECT * FROM appointments
       WHERE id = ? AND (patient_id = ? OR doctor_id = ?) LIMIT 1`,
      [appointmentId, userId, userId]
    );

    if (!appointments.length) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    let meetingId = appointments[0].meeting_id;

    const SECRET = process.env.VIDEOSDK_SECRET;
    const API_KEY = process.env.VIDEOSDK_API_KEY;

    if (!SECRET || !API_KEY) {
      return res.status(500).json({
        success: false,
        message: "VideoSDK credentials missing",
      });
    }

    // Create new meeting if none
    if (!meetingId) {
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

      if (!response.ok)
        throw new Error(data.message || "Failed to create room");

      meetingId = data.roomId;

      await db.query(
        "UPDATE appointments SET meeting_id = ? WHERE id = ?",
        [meetingId, appointmentId]
      );
    }

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
    console.error("Video token error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate video token",
    });
  }
};

/* -------------------------------------------------------------
   ✅ SAVE CALL DETAILS (FIXED DATE FORMAT)
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

    console.log('📝 Received call details:', {
      appointmentId,
      duration,
      startTime,
      endTime,
      reason,
      participants
    });

    if (!appointmentId) {
      return res.status(400).json({
        success: false,
        message: "Appointment ID required",
      });
    }

    // Convert ISO timestamps to MySQL datetime format
    const mysqlStartTime = toMySQLDateTime(startTime);
    const mysqlEndTime = toMySQLDateTime(endTime);

    console.log('🔄 Converted timestamps:', {
      original: { startTime, endTime },
      converted: { mysqlStartTime, mysqlEndTime }
    });

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
        mysqlStartTime,
        mysqlEndTime,
        duration || 0,
        reason || "completed",
        JSON.stringify(participants || {}),
        appointmentId,
      ]
    );

    console.log('✅ Call details saved successfully for appointment:', appointmentId);

    return res.json({
      success: true,
      message: "Call details saved",
    });

  } catch (error) {
    console.error("saveCallDetails error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to save call details",
      error: error.message,
    });
  }
};