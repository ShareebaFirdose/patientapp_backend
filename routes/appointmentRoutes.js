import express from "express";
import { bookAppointment, getAppointmentsByPatient } from "../controllers/appointmentController.js";

const router = express.Router();

// ✅ Book new appointment
router.post("/book", bookAppointment);

// ✅ Fetch appointments by patient
router.get("/patient/:patient_id", getAppointmentsByPatient);

export default router;
