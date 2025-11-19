import express from "express";
import { getDoctorAvailabilityByDoctorId } from "../controllers/doctorAvailabilityController.js";

const router = express.Router();

// GET route
router.get("/:doctorId", getDoctorAvailabilityByDoctorId);

export default router;
