// ===================== doctorAvailabilityController.js - COMPLETE WITH DEBUG =====================
import db from "../config/db.js";

// Utility: Generate time slots from from_time → to_time using slot_duration
function generateSlots(fromTime, toTime, duration) {
  if (!fromTime || !toTime || !duration) return [];

  const slots = [];
  let start = new Date(`2024-01-01T${fromTime}`);
  const end = new Date(`2024-01-01T${toTime}`);

  while (start < end) {
    slots.push(start.toTimeString().slice(0, 5)); // HH:MM format
    start = new Date(start.getTime() + duration * 60000);
  }

  return slots;
}

// 🔥 DEBUG ENDPOINT: See raw database data
export const debugDoctorAvailability = async (req, res) => {
  try {
    const doctorId = req.params.doctorId;

    console.log("🔍 DEBUG: Fetching availability for doctor:", doctorId);

    // Fetch raw data from database
    const [rows] = await db.query(
      "SELECT * FROM doctor_availability WHERE doctor_id = ? ORDER BY id ASC",
      [doctorId]
    );

    console.log("📦 DEBUG: Raw database rows:", JSON.stringify(rows, null, 2));

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "No availability found for this doctor",
        doctorId,
      });
    }

    // Return detailed debug information
    const debugInfo = rows.map((item) => {
      return {
        id: item.id,
        doctor_id: item.doctor_id,
        clinic_id: item.clinic_id,
        consultation_type: item.consultation_type,
        consultation_type_raw: JSON.stringify(item.consultation_type),
        status: item.status,
        
        // Date fields
        date_selection_mode: item.date_selection_mode,
        selected_dates: {
          raw: item.selected_dates,
          type: typeof item.selected_dates,
          isArray: Array.isArray(item.selected_dates),
          value: item.selected_dates,
          length: Array.isArray(item.selected_dates) ? item.selected_dates.length : 0,
        },
        recurring_days: {
          raw: item.recurring_days,
          type: typeof item.recurring_days,
          value: item.recurring_days,
        },
        recurring_dates: {
          raw: item.recurring_dates,
          type: typeof item.recurring_dates,
          value: item.recurring_dates,
        },
        leave_dates: {
          raw: item.leave_dates,
          type: typeof item.leave_dates,
          value: item.leave_dates,
        },
        
        // Time fields
        from_time: item.from_time,
        to_time: item.to_time,
        slot_duration: item.slot_duration,
        time_slots: {
          raw: item.time_slots,
          type: typeof item.time_slots,
          isArray: Array.isArray(item.time_slots),
          value: item.time_slots,
          length: Array.isArray(item.time_slots) ? item.time_slots.length : 0,
        },
        
        // Fee fields
        in_person_fee: item.in_person_fee,
        video_fee: item.video_fee,
        hide_fee: item.hide_fee,
        require_payment: item.require_payment,
        
        // Timestamps
        created_at: item.created_at,
        updated_at: item.updated_at,
      };
    });

    return res.json({
      success: true,
      message: "Debug information for doctor availability",
      doctorId,
      totalRecords: rows.length,
      debugInfo,
      rawRows: rows, // Include raw rows for comparison
    });

  } catch (error) {
    console.error("❌ Debug Availability Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch debug information",
      error: error.message,
    });
  }
};

// GET /api/doctor_availability/:doctorId
export const getDoctorAvailabilityByDoctorId = async (req, res) => {
  try {
    const doctorId = req.params.doctorId;

    console.log("📋 Fetching availability for doctor:", doctorId);

    // Fetch all availability rows for the doctor
    const [rows] = await db.query(
      "SELECT * FROM doctor_availability WHERE doctor_id = ? ORDER BY id ASC",
      [doctorId]
    );

    if (!rows.length) {
      console.log("⚠️ No availability found for doctor:", doctorId);
      return res.status(404).json({
        success: false,
        message: "No availability found for this doctor",
      });
    }

    console.log(`✅ Found ${rows.length} availability record(s)`);

    const data = rows.map((item, index) => {
      console.log(`\n📝 Processing availability record #${index + 1}:`, {
        id: item.id,
        consultation_type: item.consultation_type,
        status: item.status,
        selected_dates: item.selected_dates,
        from_time: item.from_time,
        to_time: item.to_time,
      });

      // Use DB time_slots if available, otherwise auto-generate
      let slots = [];
      
      if (Array.isArray(item.time_slots) && item.time_slots.length > 0) {
        console.log(`  ✅ Using predefined time_slots (${item.time_slots.length} slots)`);
        slots = item.time_slots;
      } else {
        console.log(`  🔨 Generating slots from ${item.from_time} to ${item.to_time}`);
        slots = generateSlots(item.from_time, item.to_time, item.slot_duration);
        console.log(`  ✅ Generated ${slots.length} slots`);
      }

      return {
        id: item.id,
        clinic_id: item.clinic_id,
        doctor_id: item.doctor_id,

        date_selection_mode: item.date_selection_mode,

        // JSON fields (already arrays → DO NOT JSON.parse)
        selected_dates: item.selected_dates || [],
        recurring_days: item.recurring_days || [],
        recurring_dates: item.recurring_dates || [],
        leave_dates: item.leave_dates || [],
        time_slots: slots,
        booked_slots: item.booked_slots || [],

        // Other fields
        slot_duration: item.slot_duration,
        consultation_type: item.consultation_type,
        from_time: item.from_time,
        to_time: item.to_time,
        in_person_fee: item.in_person_fee,
        video_fee: item.video_fee,
        hide_fee: item.hide_fee,
        require_payment: item.require_payment,
        status: item.status,
        created_at: item.created_at,
        updated_at: item.updated_at,
      };
    });

    console.log("\n✅ Returning availability data:", {
      totalRecords: data.length,
      consultationTypes: data.map(d => d.consultation_type),
      statuses: data.map(d => d.status),
    });

    return res.json({
      success: true,
      data,
    });

  } catch (error) {
    console.error("❌ Availability Fetch Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load availability",
      error: error.message,
    });
  }
};

// GET /api/doctor_availability/by-consultation/:doctorId
// Optional: Filter by consultation type
export const getDoctorAvailabilityByConsultationType = async (req, res) => {
  try {
    const doctorId = req.params.doctorId;
    const { consultation_type } = req.query;

    console.log("🔍 Fetching availability with filters:", {
      doctorId,
      consultation_type,
    });

    let query = "SELECT * FROM doctor_availability WHERE doctor_id = ?";
    const params = [doctorId];

    if (consultation_type) {
      // Normalize consultation type for comparison
      const normalizedType = String(consultation_type)
        .toLowerCase()
        .replace(/_/g, "-")
        .replace(/\s+/g, "-");

      console.log(`🔄 Normalized consultation type: ${normalizedType}`);

      // Add flexible matching for consultation_type
      query += ` AND (
        LOWER(REPLACE(REPLACE(consultation_type, '_', '-'), ' ', '-')) = ?
      )`;
      params.push(normalizedType);
    }

    query += " ORDER BY id ASC";

    const [rows] = await db.query(query, params);

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "No availability found matching the criteria",
      });
    }

    const data = rows.map((item) => {
      const slots =
        Array.isArray(item.time_slots) && item.time_slots.length > 0
          ? item.time_slots
          : generateSlots(item.from_time, item.to_time, item.slot_duration);

      return {
        id: item.id,
        clinic_id: item.clinic_id,
        doctor_id: item.doctor_id,
        date_selection_mode: item.date_selection_mode,
        selected_dates: item.selected_dates || [],
        recurring_days: item.recurring_days || [],
        recurring_dates: item.recurring_dates || [],
        leave_dates: item.leave_dates || [],
        time_slots: slots,
        booked_slots: item.booked_slots || [],
        slot_duration: item.slot_duration,
        consultation_type: item.consultation_type,
        from_time: item.from_time,
        to_time: item.to_time,
        in_person_fee: item.in_person_fee,
        video_fee: item.video_fee,
        hide_fee: item.hide_fee,
        require_payment: item.require_payment,
        status: item.status,
        created_at: item.created_at,
        updated_at: item.updated_at,
      };
    });

    return res.json({
      success: true,
      data,
    });

  } catch (error) {
    console.error("❌ Filter Availability Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load availability",
      error: error.message,
    });
  }
};

// Export all functions
export default {
  getDoctorAvailabilityByDoctorId,
  debugDoctorAvailability,
  getDoctorAvailabilityByConsultationType,
};