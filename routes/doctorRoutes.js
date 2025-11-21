import express from "express";
import { getAllDoctors, getDoctorById, getClinicById } from "../controllers/doctorController.js";

const router = express.Router();

// ✅ Route to search doctors and clinics
router.get("/search", getAllDoctors);

// ✅ Get single clinic details + doctors
router.get("/clinic/:id", getClinicById);

// ✅ Get single doctor details + availability (MUST be last to avoid conflicts)
router.get("/:id", getDoctorById);

export default router;