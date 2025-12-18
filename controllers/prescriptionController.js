// ===================== prescriptionController.js (COMPLETE - UPDATED) =====================
import db from "../config/db.js";
import generatePrescriptionPDF from "../utils/pdfGenerator.js";

/* -------------------------------------------------------------
    Helper: Extract User ID from token
------------------------------------------------------------- */
function getUserId(req) {
  return req.user?.id || req.user?.userId || null;
}

/* -------------------------------------------------------------
    GET ALL PRESCRIPTIONS FOR LOGGED-IN PATIENT
------------------------------------------------------------- */
export const getMyPrescriptions = async (req, res) => {
  try {
    const patientId = getUserId(req);

    if (!patientId) {
      return res.json({ success: true, data: [] });
    }

    const [rows] = await db.query(
      `
      SELECT 
        dp.*,
        COALESCE(u1.name, u2.name) AS doctor_name,
        COALESCE(d1.specialization, d2.specialization) AS specialization,
        a.appointment_date,
        a.start_time AS appointment_time
      FROM doctor_prescriptions dp
      LEFT JOIN users u1 ON dp.doctor_id = u1.id
      LEFT JOIN doctors d1 ON d1.user_id = dp.doctor_id
      LEFT JOIN doctors d2 ON dp.doctor_id = d2.id
      LEFT JOIN users u2 ON d2.user_id = u2.id
      LEFT JOIN appointments a ON dp.appointment_id = a.id
      WHERE dp.patient_id = ?
        AND dp.status = 'completed'
      ORDER BY dp.consultation_date DESC, dp.created_at DESC
      `,
      [patientId]
    );

    console.log(`✅ Found ${rows.length} prescriptions for patient ${patientId}`);
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("❌ getMyPrescriptions error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch prescriptions",
      error: err.message,
    });
  }
};

/* -------------------------------------------------------------
    GET PRESCRIPTION BY ID
------------------------------------------------------------- */
export const getPrescriptionById = async (req, res) => {
  try {
    const prescriptionId = req.params.id;
    const userId = getUserId(req);

    if (!prescriptionId) {
      return res.status(400).json({
        success: false,
        message: "Prescription ID is required",
      });
    }

    const [rows] = await db.query(
      `
      SELECT 
        dp.*,
        COALESCE(u1.name, u2.name) AS doctor_name,
        COALESCE(d1.specialization, d2.specialization) AS specialization,
        a.appointment_date,
        a.start_time AS appointment_time
      FROM doctor_prescriptions dp
      LEFT JOIN users u1 ON dp.doctor_id = u1.id
      LEFT JOIN doctors d1 ON d1.user_id = dp.doctor_id
      LEFT JOIN doctors d2 ON dp.doctor_id = d2.id
      LEFT JOIN users u2 ON d2.user_id = u2.id
      LEFT JOIN appointments a ON dp.appointment_id = a.id
      WHERE dp.id = ?
        AND (dp.patient_id = ? OR dp.doctor_id = ? OR d2.user_id = ?)
      LIMIT 1
      `,
      [prescriptionId, userId, userId, userId]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Prescription not found",
      });
    }

    console.log(`✅ Found prescription:`, rows[0]);
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("❌ getPrescriptionById error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch prescription",
      error: err.message,
    });
  }
};

/* -------------------------------------------------------------
    GET PRESCRIPTIONS FOR AN APPOINTMENT
------------------------------------------------------------- */
export const getPrescriptionsByAppointment = async (req, res) => {
  try {
    const appointmentId = req.params.appointmentId;
    const userId = getUserId(req);

    if (!appointmentId) {
      return res.status(400).json({
        success: false,
        message: "Appointment ID is required",
      });
    }

    const [allow] = await db.query(
      `
      SELECT id FROM appointments
      WHERE id = ?
        AND (patient_id = ? OR doctor_id = ?)
      LIMIT 1
      `,
      [appointmentId, userId, userId]
    );

    if (!allow.length) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this appointment",
      });
    }

    const [rows] = await db.query(
      `
      SELECT 
        dp.*,
        COALESCE(u1.name, u2.name) AS doctor_name,
        COALESCE(d1.specialization, d2.specialization) AS specialization
      FROM doctor_prescriptions dp
      LEFT JOIN users u1 ON dp.doctor_id = u1.id
      LEFT JOIN doctors d1 ON d1.user_id = dp.doctor_id
      LEFT JOIN doctors d2 ON dp.doctor_id = d2.id
      LEFT JOIN users u2 ON d2.user_id = u2.id
      WHERE dp.appointment_id = ?
      ORDER BY dp.created_at DESC
      `,
      [appointmentId]
    );

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("❌ getPrescriptionsByAppointment error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch prescriptions",
      error: err.message,
    });
  }
};

/* -------------------------------------------------------------
    GET RECENT PRESCRIPTIONS (Dashboard)
------------------------------------------------------------- */
export const getRecentPrescriptions = async (req, res) => {
  try {
    const patientId = getUserId(req);
    const limit = parseInt(req.query.limit) || 5;

    if (!patientId) {
      return res.json({ success: true, data: [] });
    }

    const [rows] = await db.query(
      `
      SELECT 
        dp.*,
        COALESCE(u1.name, u2.name) AS doctor_name,
        COALESCE(d1.specialization, d2.specialization) AS specialization,
        a.appointment_date
      FROM doctor_prescriptions dp
      LEFT JOIN users u1 ON dp.doctor_id = u1.id
      LEFT JOIN doctors d1 ON d1.user_id = dp.doctor_id
      LEFT JOIN doctors d2 ON dp.doctor_id = d2.id
      LEFT JOIN users u2 ON d2.user_id = u2.id
      LEFT JOIN appointments a ON dp.appointment_id = a.id
      WHERE dp.patient_id = ?
        AND dp.status = 'completed'
      ORDER BY dp.consultation_date DESC, dp.created_at DESC
      LIMIT ?
      `,
      [patientId, limit]
    );

    console.log(`✅ Found ${rows.length} recent prescriptions`);
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("❌ getRecentPrescriptions error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch recent prescriptions",
      error: err.message,
    });
  }
};

/* -------------------------------------------------------------
    DOWNLOAD PRESCRIPTION PDF (WITH AUTO-GENERATION)
------------------------------------------------------------- */
export const downloadPrescriptionPDF = async (req, res) => {
  try {
    const prescriptionId = req.params.id;
    const userId = getUserId(req);

    if (!prescriptionId) {
      return res.status(400).json({
        success: false,
        message: "Prescription ID is required",
      });
    }

    console.log(`📥 Download request for prescription ${prescriptionId} by user ${userId}`);

    // Fetch prescription with COMPLETE details
    const [rows] = await db.query(
      `
      SELECT 
        dp.*,
        COALESCE(u1.name, u2.name) AS doctor_name,
        COALESCE(u1.email, u2.email) AS doctor_email,
        COALESCE(u1.phone_number, u2.phone_number) AS doctor_phone,
        COALESCE(d1.specialization, d2.specialization) AS specialization,
        p.name AS patient_name,
        p.email AS patient_email,
        p.phone_number AS patient_phone
      FROM doctor_prescriptions dp
      LEFT JOIN users u1 ON dp.doctor_id = u1.id
      LEFT JOIN doctors d1 ON d1.user_id = dp.doctor_id
      LEFT JOIN doctors d2 ON dp.doctor_id = d2.id
      LEFT JOIN users u2 ON d2.user_id = u2.id
      LEFT JOIN users p ON dp.patient_id = p.id
      WHERE dp.id = ?
        AND (dp.patient_id = ? OR dp.doctor_id = ? OR d2.user_id = ?)
      LIMIT 1
      `,
      [prescriptionId, userId, userId, userId]
    );

    if (!rows.length) {
      console.log(`❌ Prescription ${prescriptionId} not found or access denied`);
      return res.status(404).json({
        success: false,
        message: "Prescription not found or you don't have access",
      });
    }

    const prescription = rows[0];

    // 📥 AUTO-GENERATE PDF IF MISSING
    if (!prescription.pdf_path) {
      console.log(`📄 PDF missing for prescription ${prescriptionId}, generating now...`);

      try {
        // Pass COMPLETE prescription data including ALL fields
        const prescriptionData = {
          id: prescription.id,
          diagnosis: prescription.diagnosis,
          symptoms: prescription.symptoms,
          medications: prescription.medications,
          follow_up: prescription.follow_up,
          notes: prescription.notes,
          consultation_date: prescription.consultation_date,
          // Comprehensive fields
          clinic_name: prescription.clinic_name,
          clinic_address: prescription.clinic_address,
          consultation_mode: prescription.consultation_mode,
          patient_name: prescription.patient_name,
          patient_age: prescription.patient_age,
          patient_gender: prescription.patient_gender,
          drug_allergies: prescription.drug_allergies,
          blood_pressure: prescription.blood_pressure,
          pulse: prescription.pulse,
          temperature: prescription.temperature,
          spo2: prescription.spo2,
          weight: prescription.weight,
          height: prescription.height,
          bmi: prescription.bmi,
          custom_vitals: prescription.custom_vitals,
          chief_complaints: prescription.chief_complaints,
          lab_tests: prescription.lab_tests,
          general_advice: prescription.general_advice,
          follow_up_date: prescription.follow_up_date,
          referral_specialist: prescription.referral_specialist,
          referral_doctor_hospital: prescription.referral_doctor_hospital,
          referral_reason: prescription.referral_reason,
          digital_signature: prescription.digital_signature,
        };

        const doctorData = {
          name: prescription.doctor_name || "Unknown",
          specialization: prescription.specialization || "General Practice",
          email: prescription.doctor_email,
          phone_number: prescription.doctor_phone,
        };

        const patientData = {
          name: prescription.patient_name || "Unknown",
          email: prescription.patient_email,
          phone_number: prescription.patient_phone,
        };

        const pdfPath = await generatePrescriptionPDF(
          prescriptionData,
          doctorData,
          patientData
        );

        // Update database with generated PDF path
        await db.query(
          `UPDATE doctor_prescriptions SET pdf_path = ? WHERE id = ?`,
          [pdfPath, prescriptionId]
        );

        console.log(`✅ PDF auto-generated and saved: ${pdfPath}`);

        // Use the newly generated path
        prescription.pdf_path = pdfPath;
      } catch (genErr) {
        console.error(`❌ Failed to auto-generate PDF:`, genErr);
        return res.status(500).json({
          success: false,
          message: "Failed to generate PDF for this prescription",
          error: genErr.message,
        });
      }
    }

    const pdf = prescription.pdf_path;

    const fullURL =
      pdf.startsWith("http")
        ? pdf
        : `${process.env.BASE_URL || "http://localhost:5000"}/${pdf}`;

    console.log(`✅ Returning PDF URL: ${fullURL}`);

    return res.json({
      success: true,
      pdf_path: fullURL,
    });
  } catch (err) {
    console.error("❌ downloadPrescriptionPDF error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to download prescription PDF",
      error: err.message,
    });
  }
};

/* -------------------------------------------------------------
    GENERATE PDF FOR EXISTING PRESCRIPTION
------------------------------------------------------------- */
export const generatePDF = async (req, res) => {
  try {
    const prescriptionId = req.params.id;
    const userId = getUserId(req);

    if (!prescriptionId) {
      return res.status(400).json({
        success: false,
        message: "Prescription ID is required",
      });
    }

    console.log(`📄 Generating PDF for prescription ${prescriptionId}`);

    const [prescriptions] = await db.query(
      `
      SELECT 
        dp.*,
        COALESCE(u1.name, u2.name) AS doctor_name,
        COALESCE(u1.email, u2.email) AS doctor_email,
        COALESCE(u1.phone_number, u2.phone_number) AS doctor_phone,
        COALESCE(d1.specialization, d2.specialization) AS specialization,
        p.name AS patient_name,
        p.email AS patient_email,
        p.phone_number AS patient_phone
      FROM doctor_prescriptions dp
      LEFT JOIN users u1 ON dp.doctor_id = u1.id
      LEFT JOIN doctors d1 ON d1.user_id = dp.doctor_id
      LEFT JOIN doctors d2 ON dp.doctor_id = d2.id
      LEFT JOIN users u2 ON d2.user_id = u2.id
      LEFT JOIN users p ON dp.patient_id = p.id
      WHERE dp.id = ?
        AND (dp.patient_id = ? OR dp.doctor_id = ? OR d2.user_id = ?)
      LIMIT 1
      `,
      [prescriptionId, userId, userId, userId]
    );

    if (!prescriptions.length) {
      return res.status(404).json({
        success: false,
        message: "Prescription not found or access denied",
      });
    }

    const prescription = prescriptions[0];

    if (prescription.pdf_path) {
      console.log(`⚠️ PDF already exists: ${prescription.pdf_path}`);
      return res.json({
        success: true,
        message: "PDF already exists",
        pdf_path: prescription.pdf_path.startsWith("http")
          ? prescription.pdf_path
          : `${process.env.BASE_URL || "http://localhost:5000"}/${prescription.pdf_path}`,
      });
    }

    // Pass COMPLETE prescription data including ALL fields
    const prescriptionData = {
      id: prescription.id,
      diagnosis: prescription.diagnosis,
      symptoms: prescription.symptoms,
      medications: prescription.medications,
      follow_up: prescription.follow_up,
      notes: prescription.notes,
      consultation_date: prescription.consultation_date,
      // Comprehensive fields
      clinic_name: prescription.clinic_name,
      clinic_address: prescription.clinic_address,
      consultation_mode: prescription.consultation_mode,
      patient_name: prescription.patient_name,
      patient_age: prescription.patient_age,
      patient_gender: prescription.patient_gender,
      drug_allergies: prescription.drug_allergies,
      blood_pressure: prescription.blood_pressure,
      pulse: prescription.pulse,
      temperature: prescription.temperature,
      spo2: prescription.spo2,
      weight: prescription.weight,
      height: prescription.height,
      bmi: prescription.bmi,
      custom_vitals: prescription.custom_vitals,
      chief_complaints: prescription.chief_complaints,
      lab_tests: prescription.lab_tests,
      general_advice: prescription.general_advice,
      follow_up_date: prescription.follow_up_date,
      referral_specialist: prescription.referral_specialist,
      referral_doctor_hospital: prescription.referral_doctor_hospital,
      referral_reason: prescription.referral_reason,
      digital_signature: prescription.digital_signature,
    };

    const doctorData = {
      name: prescription.doctor_name || "Unknown",
      specialization: prescription.specialization || "General Practice",
      email: prescription.doctor_email,
      phone_number: prescription.doctor_phone,
    };

    const patientData = {
      name: prescription.patient_name || "Unknown",
      email: prescription.patient_email,
      phone_number: prescription.patient_phone,
    };

    const pdfPath = await generatePrescriptionPDF(
      prescriptionData,
      doctorData,
      patientData
    );

    await db.query(
      `UPDATE doctor_prescriptions SET pdf_path = ? WHERE id = ?`,
      [pdfPath, prescriptionId]
    );

    console.log(`✅ PDF generated and saved: ${pdfPath}`);

    const fullURL = pdfPath.startsWith("http")
      ? pdfPath
      : `${process.env.BASE_URL || "http://localhost:5000"}/${pdfPath}`;

    return res.json({
      success: true,
      message: "PDF generated successfully",
      pdf_path: fullURL,
    });
  } catch (err) {
    console.error("❌ generatePDF error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to generate PDF",
      error: err.message,
    });
  }
};

/* -------------------------------------------------------------
    BULK GENERATE PDFs
------------------------------------------------------------- */
export const generateAllMissingPDFs = async (req, res) => {
  try {
    const userId = getUserId(req);
    
    const [user] = await db.query(
      `SELECT role FROM users WHERE id = ? LIMIT 1`,
      [userId]
    );

    if (!user.length || (user[0].role !== 'doctor' && user[0].role !== 'admin')) {
      return res.status(403).json({
        success: false,
        message: "Only doctors and admins can generate bulk PDFs",
      });
    }

    const [prescriptions] = await db.query(
      `
      SELECT 
        dp.*,
        COALESCE(u1.name, u2.name) AS doctor_name,
        COALESCE(u1.email, u2.email) AS doctor_email,
        COALESCE(u1.phone_number, u2.phone_number) AS doctor_phone,
        COALESCE(d1.specialization, d2.specialization) AS specialization,
        p.name AS patient_name,
        p.email AS patient_email,
        p.phone_number AS patient_phone
      FROM doctor_prescriptions dp
      LEFT JOIN users u1 ON dp.doctor_id = u1.id
      LEFT JOIN doctors d1 ON d1.user_id = dp.doctor_id
      LEFT JOIN doctors d2 ON dp.doctor_id = d2.id
      LEFT JOIN users u2 ON d2.user_id = u2.id
      LEFT JOIN users p ON dp.patient_id = p.id
      WHERE dp.pdf_path IS NULL
        AND dp.status = 'completed'
      `
    );

    console.log(`📄 Generating PDFs for ${prescriptions.length} prescriptions`);

    const results = {
      total: prescriptions.length,
      success: 0,
      failed: 0,
      errors: [],
    };

    for (const prescription of prescriptions) {
      try {
        // Pass COMPLETE prescription data including ALL fields
        const prescriptionData = {
          id: prescription.id,
          diagnosis: prescription.diagnosis,
          symptoms: prescription.symptoms,
          medications: prescription.medications,
          follow_up: prescription.follow_up,
          notes: prescription.notes,
          consultation_date: prescription.consultation_date,
          // Comprehensive fields
          clinic_name: prescription.clinic_name,
          clinic_address: prescription.clinic_address,
          consultation_mode: prescription.consultation_mode,
          patient_name: prescription.patient_name,
          patient_age: prescription.patient_age,
          patient_gender: prescription.patient_gender,
          drug_allergies: prescription.drug_allergies,
          blood_pressure: prescription.blood_pressure,
          pulse: prescription.pulse,
          temperature: prescription.temperature,
          spo2: prescription.spo2,
          weight: prescription.weight,
          height: prescription.height,
          bmi: prescription.bmi,
          custom_vitals: prescription.custom_vitals,
          chief_complaints: prescription.chief_complaints,
          lab_tests: prescription.lab_tests,
          general_advice: prescription.general_advice,
          follow_up_date: prescription.follow_up_date,
          referral_specialist: prescription.referral_specialist,
          referral_doctor_hospital: prescription.referral_doctor_hospital,
          referral_reason: prescription.referral_reason,
          digital_signature: prescription.digital_signature,
        };

        const doctorData = {
          name: prescription.doctor_name || "Unknown",
          specialization: prescription.specialization || "General Practice",
          email: prescription.doctor_email,
          phone_number: prescription.doctor_phone,
        };

        const patientData = {
          name: prescription.patient_name || "Unknown",
          email: prescription.patient_email,
          phone_number: prescription.patient_phone,
        };

        const pdfPath = await generatePrescriptionPDF(
          prescriptionData,
          doctorData,
          patientData
        );

        await db.query(
          `UPDATE doctor_prescriptions SET pdf_path = ? WHERE id = ?`,
          [pdfPath, prescription.id]
        );

        results.success++;
        console.log(`✅ Generated PDF for prescription ${prescription.id}`);
      } catch (err) {
        results.failed++;
        results.errors.push({
          prescription_id: prescription.id,
          error: err.message,
        });
        console.error(`❌ Failed to generate PDF for prescription ${prescription.id}:`, err);
      }
    }

    return res.json({
      success: true,
      message: `Generated ${results.success} PDFs, ${results.failed} failed`,
      results,
    });
  } catch (err) {
    console.error("❌ generateAllMissingPDFs error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to generate PDFs",
      error: err.message,
    });
  }
};

// ===================== END OF FILE =====================