import db from "../config/db.js"; // adjust this import to your DB connection file

// ✅ Doctor Search API
export const searchDoctors = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.trim() === "") {
      return res.status(400).json({ success: false, message: "Search query is required" });
    }

    const searchTerm = `%${query}%`;

    const sql = `
      SELECT 
        d.id AS doctor_id,
        d.specialization,
        d.qualifications,
        d.experience_years,
        d.bio,
        d.profile_image,
        dc.in_person_fee,
        dc.video_fee,
        dc.home_visit_fee,
        c.id AS clinic_id,
        c.clinic_name
      FROM doctors d
      LEFT JOIN doctor_clinic dc ON dc.doctor_id = d.id
      LEFT JOIN clinics c ON c.id = dc.clinic_id
      WHERE 
        d.specialization LIKE ? 
        OR d.bio LIKE ?
        OR c.clinic_name LIKE ?
      GROUP BY d.id
    `;

    const [rows] = await db.execute(sql, [searchTerm, searchTerm, searchTerm]);

    if (rows.length === 0) {
      return res.json({ success: true, data: [], message: "No matching doctors found." });
    }

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("❌ Doctor search error:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};
