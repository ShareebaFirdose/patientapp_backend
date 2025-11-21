import db from "../config/db.js";

/* ============================================================
   GET ALL DOCTORS + CLINICS (Combined Search)
============================================================ */
export const getAllDoctors = async (req, res) => {
  try {
    const { query } = req.query;
    const search = query ? `%${query}%` : "%";

    // Search for doctors
    const doctorSql = `
      SELECT 
        d.id AS doctor_id,
        d.user_id AS user_id,
        u.name AS doctor_name,
        u.email,
        u.phone_number,
        d.specialization,
        d.experience_years AS years_of_experience,
        d.bio,
        'doctor' AS result_type
      FROM doctors d
      JOIN users u ON d.user_id = u.id
      WHERE d.status = 'active'
      AND (u.name LIKE ? OR d.specialization LIKE ?)
      ORDER BY u.name ASC
    `;

    // Search for clinics
    const clinicSql = `
      SELECT 
        c.id AS clinic_id,
        c.name AS clinic_name,
        c.email,
        c.about,
        c.line1,
        c.line2,
        c.city,
        c.state,
        c.country,
        c.pincode,
        c.location,
        c.specialities,
        c.contact_numbers,
        'clinic' AS result_type
      FROM clinics c
      WHERE (c.status = 'active' OR c.status IS NULL)
      AND c.name LIKE ?
      ORDER BY c.name ASC
    `;

    const [doctors] = await db.query(doctorSql, [search, search]);
    const [clinics] = await db.query(clinicSql, [search]);

    // Combine results
    const combinedResults = [
      ...doctors.map(d => ({ ...d, result_type: 'doctor' })),
      ...clinics.map(c => ({ ...c, result_type: 'clinic' }))
    ];

    res.status(200).json({
      success: true,
      data: combinedResults,
      counts: {
        doctors: doctors.length,
        clinics: clinics.length
      }
    });
  } catch (error) {
    console.error("❌ getAllDoctors Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch results",
      error: error.message,
    });
  }
};

/* ============================================================
   GET DOCTOR BY ID
============================================================ */
export const getDoctorById = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      `
      SELECT 
        d.id AS doctor_id,
        d.user_id AS user_id,
        u.name AS doctor_name,
        u.email,
        u.phone_number,
        d.specialization,
        d.experience_years,
        d.bio
      FROM doctors d
      JOIN users u ON d.user_id = u.id
      WHERE d.id = ?
      `,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    const [availability] = await db.query(
      `
      SELECT 
        id,
        clinic_id,
        doctor_id,
        time_slots,
        from_time,
        to_time,
        slot_duration,
        consultation_type,
        in_person_fee,
        video_fee,
        require_payment,
        status
      FROM doctor_availability
      WHERE doctor_id = ? AND status = 1
      ORDER BY id DESC
      `,
      [id]
    );

    const safeJSON = (v) => {
      try {
        if (!v) return [];
        if (typeof v === "object") return v;
        return JSON.parse(v.toString().replace(/'/g, '"'));
      } catch {
        return [];
      }
    };

    const generateTimeSlots = (from, to, duration = 30) => {
      const toMinutes = (t) => {
        const [h, m] = t.split(":").map(Number);
        return h * 60 + m;
      };

      let start = toMinutes(from);
      const end = toMinutes(to);
      const slots = [];

      while (start < end) {
        const hh = String(Math.floor(start / 60)).padStart(2, "0");
        const mm = String(start % 60).padStart(2, "0");
        slots.push(`${hh}:${mm}`);
        start += duration;
      }

      return slots;
    };

    const getNextThreeDays = () => {
      const days = [];
      const today = new Date();

      for (let i = 0; i < 3; i++) {
        const d = new Date();
        d.setDate(today.getDate() + i);
        days.push(d.toISOString().split("T")[0]);
      }
      return days;
    };

    const formattedAvailability = availability.map((item) => {
      let timeSlots = safeJSON(item.time_slots);

      if (!timeSlots.length) {
        timeSlots = generateTimeSlots(
          item.from_time,
          item.to_time,
          item.slot_duration || 30
        );
      }

      return {
        ...item,
        selected_dates: getNextThreeDays(),
        time_slots: timeSlots,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        ...rows[0],
        availability: formattedAvailability,
      },
    });
  } catch (error) {
    console.error("❌ getDoctorById Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching doctor details",
      error: error.message,
    });
  }
};

/* ============================================================
   GET CLINIC BY ID
============================================================ */
export const getClinicById = async (req, res) => {
  try {
    const { id } = req.params;

    // Get clinic details
    const [clinicRows] = await db.query(
      `
      SELECT 
        c.id AS clinic_id,
        c.name AS clinic_name,
        c.email,
        c.about,
        c.line1,
        c.line2,
        c.city,
        c.state,
        c.country,
        c.pincode,
        c.location,
        c.specialities,
        c.contact_numbers
      FROM clinics c
      WHERE c.id = ? AND c.status = 'active'
      `,
      [id]
    );

    if (!clinicRows.length) {
      return res.status(404).json({
        success: false,
        message: "Clinic not found",
      });
    }

    // Get doctors working at this clinic
    const [doctors] = await db.query(
      `
      SELECT DISTINCT
        d.id AS doctor_id,
        u.name AS doctor_name,
        d.specialization,
        d.experience_years
      FROM doctor_availability da
      JOIN doctors d ON da.doctor_id = d.id
      JOIN users u ON d.user_id = u.id
      WHERE da.clinic_id = ? AND d.status = 'active'
      ORDER BY u.name ASC
      `,
      [id]
    );

    const safeJSON = (v) => {
      try {
        if (!v) return [];
        if (typeof v === "object") return v;
        return JSON.parse(v);
      } catch {
        return [];
      }
    };

    const clinic = clinicRows[0];
    
    res.status(200).json({
      success: true,
      data: {
        ...clinic,
        specialities: safeJSON(clinic.specialities),
        contact_numbers: safeJSON(clinic.contact_numbers),
        doctors: doctors
      },
    });
  } catch (error) {
    console.error("❌ getClinicById Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching clinic details",
      error: error.message,
    });
  }
};