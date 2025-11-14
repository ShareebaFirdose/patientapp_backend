import express from "express";
import { getAllDoctors, getDoctorById } from "../controllers/doctorController.js";

const router = express.Router();

// ✅ Route to search or list doctors
router.get("/search", getAllDoctors);

// ✅ Get single doctor details + availability
router.get("/:id", getDoctorById);

export default router;
