// routes/patientRoutes.js
import express from "express";
import { getPatientByUser, registerPatient } from "../controllers/patientController.js";

const router = express.Router();

router.get("/by-user/:user_id", getPatientByUser);
router.post("/register", registerPatient);

export default router;