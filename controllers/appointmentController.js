import db from "../config/db.js";
import jwt from "jsonwebtoken";

/* -------------------------------------------------------------
   HELPER FUNCTIONS
------------------------------------------------------------- */

// Extract correct user ID from token (set by authenticateJWT middleware)
const getUserId = (req) => {
  return req.user?.id || req.user?.userId || null;
};

// Convert ISO 8601 to MySQL datetime format
const toMySQLDateTime = (isoString) => {
  if (!isoString) return null;
  try {
    const date = new Date(isoString);
    return date.toISOString().slice(0, 19).replace("T", " ");
  } catch (error) {
    console.error("Date conversion error:", error);
    return null;
  }
};

/* -------------------------------------------------------------
   UPCOMING APPOINTMENTS
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
   PAST APPOINTMENTS
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
   ✅ GET BOOKED SLOTS (FULLY FIXED FOR YOUR DB FORMAT)
------------------------------------------------------------- */
export const getBookedSlots = async (req, res) => {
  try {
    const { doctor_id, appointment_date, consultation_type } = req.query;

    if (!doctor_id || !appointment_date || !consultation_type) {
      return res.status(400).json({
        success: false,
        message:
          "doctor_id, appointment_date and consultation_type are required",
      });
    }

    const currentUserId = getUserId(req);
    console.log("✅ Logged user:", currentUserId);

    const type = String(consultation_type).toLowerCase();
    const types = [type];

    if (type === "video") types.push("video_call");
    if (type === "video_call") types.push("video");
    if (type === "in-person" || type === "in_person") {
      types.push("in_person", "in-person");
    }

    const normalizeTime = (t) => {
      if (!t) return "";
      let s = String(t).trim();
      s = s.replace(/\s?(AM|PM)$/i, "").trim();

      const parts = s.split(":");
      if (parts.length >= 2) {
        const hh = parts[0].padStart(2, "0");
        const mm = parts[1].padStart(2, "0");
        return `${hh}:${mm}`;
      }
      return s;
    };

    const [rows] = await db.query(
      `
      SELECT appointment_slot_time, patient_id
      FROM appointments 
      WHERE doctor_id = ?
      AND appointment_date = ?
      AND LOWER(consultation_type) IN (?)
      `,
      [doctor_id, appointment_date, types]
    );

    let bookedSlots = [];
    let myBookedSlots = [];

    rows.forEach((row) => {
      if (row.appointment_slot_time) {
        let slots = [];

        try {
          if (typeof row.appointment_slot_time === "string") {

            // Case 1: JSON Array
            if (row.appointment_slot_time.trim().startsWith("[")) {
              const parsed = JSON.parse(row.appointment_slot_time);
              if (Array.isArray(parsed)) slots = parsed;
            }

            // ✅ Case 2: "10:30 AM, 11:30 AM"
            else if (row.appointment_slot_time.includes(",")) {
              slots = row.appointment_slot_time
                .split(",")
                .map((s) => s.trim());
            }

            // Case 3: "11:30 AM"
            else {
              slots = [row.appointment_slot_time.trim()];
            }
          }
        } catch {
          slots = [row.appointment_slot_time];
        }

        const normalizedSlots = slots
          .map(normalizeTime)
          .filter((v) => v && v !== "");

        if (String(row.patient_id) === String(currentUserId)) {
          myBookedSlots.push(...normalizedSlots);
        } else {
          bookedSlots.push(...normalizedSlots);
        }
      }
    });

    bookedSlots = [...new Set(bookedSlots)];
    myBookedSlots = [...new Set(myBookedSlots)];

    console.log("✅ Booked by others:", bookedSlots);
    console.log("✅ My booked slots:", myBookedSlots);

    return res.status(200).json({
      success: true,
      bookedSlots,
      myBookedSlots,
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
   VIDEO TOKEN
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
   SAVE CALL DETAILS
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
        message: "Appointment ID required",
      });
    }

    const mysqlStartTime = toMySQLDateTime(startTime);
    const mysqlEndTime = toMySQLDateTime(endTime);

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
