// routes/appointmentRoutes.js
import express from "express";
import {
  getUpcomingAppointments,
  getPastAppointments,
  getAppointmentById,
  getAllMyAppointments,
} from "../controllers/appointmentController.js";

import { authenticateJWT } from "../middleware/authMiddleware.js";

const router = express.Router();

// ⭐ IMPORTANT: specific routes first
router.get("/my", authenticateJWT, getAllMyAppointments);
router.get("/upcoming", authenticateJWT, getUpcomingAppointments);
router.get("/past", authenticateJWT, getPastAppointments);

// ⭐ dynamic route last
router.get("/:id", authenticateJWT, getAppointmentById);

export default router;
