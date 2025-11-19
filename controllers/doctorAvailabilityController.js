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

// GET /api/doctor_availability/:doctorId
export const getDoctorAvailabilityByDoctorId = async (req, res) => {
  try {
    const doctorId = req.params.doctorId;

    // Fetch all availability rows for the doctor
    const [rows] = await db.query(
      "SELECT * FROM doctor_availability WHERE doctor_id = ? ORDER BY id ASC",
      [doctorId]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "No availability found for this doctor",
      });
    }

    const data = rows.map((item) => {
      // Use DB time_slots if available, otherwise auto–generate
      const slots =
        Array.isArray(item.time_slots) && item.time_slots.length > 0
          ? item.time_slots
          : generateSlots(item.from_time, item.to_time, item.slot_duration);

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

    return res.json({
      success: true,
      data,
    });

  } catch (error) {
    console.error("Availability Fetch Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load availability",
      error: error.message,
    });
  }
};
