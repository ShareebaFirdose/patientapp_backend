// ===================== doctorAvailabilityRoutes.js - COMPLETE =====================
import express from "express";
import { 
  getDoctorAvailabilityByDoctorId,
  debugDoctorAvailability,
  getDoctorAvailabilityByConsultationType,
} from "../controllers/doctorAvailabilityController.js";

const router = express.Router();

/* ------------------ ROUTE ORDER MATTERS ------------------ */

// 🔥 DEBUG route - MUST BE FIRST (before :doctorId)
router.get("/debug/:doctorId", debugDoctorAvailability);

// Optional: Filter by consultation type
router.get("/by-consultation/:doctorId", getDoctorAvailabilityByConsultationType);

// Main GET route (catch-all for doctorId)
router.get("/:doctorId", getDoctorAvailabilityByDoctorId);

export default router;