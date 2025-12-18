// ===================== prescriptionRoutes.js (UPDATED) =====================
import express from "express";
import {
  getMyPrescriptions,
  getPrescriptionById,
  getPrescriptionsByAppointment,
  getRecentPrescriptions,
  downloadPrescriptionPDF,
  generatePDF,  // ✅ NEW
  generateAllMissingPDFs,  // ✅ NEW
} from "../controllers/prescriptionController.js";
import { authenticateJWT } from "../middleware/authMiddleware.js";

const router = express.Router();

/* ------------------ PRESCRIPTION ROUTES ORDER MATTERS ------------------ */

// ✅ NEW: Generate all missing PDFs (bulk operation - admin/doctor only)
router.post("/generate-all", authenticateJWT, generateAllMissingPDFs);

// Get recent prescriptions (must be before /:id to avoid route conflict)
router.get("/recent", authenticateJWT, getRecentPrescriptions);

// Get all prescriptions for logged-in patient
router.get("/my-prescriptions", authenticateJWT, getMyPrescriptions);

// Get prescriptions by appointment ID
router.get("/appointment/:appointmentId", authenticateJWT, getPrescriptionsByAppointment);

// ✅ NEW: Generate PDF for specific prescription
router.post("/:id/generate-pdf", authenticateJWT, generatePDF);

// Download prescription PDF
router.get("/:id/download", authenticateJWT, downloadPrescriptionPDF);

// Get prescription by ID (keep this last to avoid conflicts)
router.get("/:id", authenticateJWT, getPrescriptionById);

export default router;

// ===================== End of prescriptionRoutes.js =====================