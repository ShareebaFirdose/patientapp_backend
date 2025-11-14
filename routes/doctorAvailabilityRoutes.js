import express from "express";
import db from "../config/db.js";

const router = express.Router();

/* -------------------------------------------
   ✅ Add Doctor Availability
------------------------------------------- */
router.post("/add", async (req, res) => {
  try {
    const {
      doctor_id,
      clinic_id,
      consultation_type,
      selected_dates,
      time_slots,
      from_time,
      to_time,
      in_person_fee,
      video_fee,
      require_payment,
    } = req.body;

    await db.query(
      `
      INSERT INTO doctor_availability (
        clinic_id,
        doctor_id,
        consultation_type,
        selected_dates,
        time_slots,
        from_time,
        to_time,
        in_person_fee,
        video_fee,
        require_payment,
        status,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
      `,
      [
        clinic_id || 1,
        doctor_id,
        consultation_type,
        JSON.stringify(selected_dates),
        JSON.stringify(time_slots),
        from_time,
        to_time,
        in_person_fee || 600.0,
        video_fee || 400.0,
        require_payment || 1,
      ]
    );

    res
      .status(201)
      .json({ success: true, message: "Availability added successfully ✅" });
  } catch (error) {
    console.error("❌ Add availability error:", error);
    res
      .status(500)
      .json({ success: false, message: error.message });
  }
});

/* -------------------------------------------
   ✅ Get Doctor Availability (Safe JSON Parsing)
------------------------------------------- */
router.get("/:doctorId", async (req, res) => {
  const { doctorId } = req.params;
  try {
    const [rows] = await db.query(
      `
      SELECT 
        id,
        doctor_id,
        clinic_id,
        consultation_type,
        selected_dates,
        time_slots,
        from_time,
        to_time,
        in_person_fee,
        video_fee,
        require_payment,
        status
      FROM doctor_availability
      WHERE doctor_id = ? AND status = 1
      ORDER BY id DESC
      `,
      [doctorId]
    );

    // ✅ Improved safe parser for bad JSON (handles single quotes)
    const safeParse = (value) => {
      try {
        if (!value) return [];
        const str = Buffer.isBuffer(value) ? value.toString("utf8") : value;
        // Fix bad JSON with single quotes -> double quotes
        const cleaned = str.replace(/'/g, '"');
        return JSON.parse(cleaned);
      } catch (err) {
        console.warn("⚠️ Invalid JSON found, returning []:", value);
        return [];
      }
    };

    const formatted = rows.map((item) => ({
      id: item.id,
      doctor_id: item.doctor_id,
      clinic_id: item.clinic_id,
      consultation_type: item.consultation_type,
      selected_dates: safeParse(item.selected_dates),
      time_slots: safeParse(item.time_slots),
      from_time: item.from_time,
      to_time: item.to_time,
      in_person_fee: item.in_person_fee,
      video_fee: item.video_fee,
      require_payment: item.require_payment,
      status: item.status,
    }));

    res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    console.error("❌ Fetch availability error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
