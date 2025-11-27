import express from "express";
import {
  getUpcomingAppointments,
  getPastAppointments,
  getAppointmentById,
  getAllMyAppointments,
  getVideoToken,
  saveCallDetails,
  getBookedSlots,
} from "../controllers/appointmentController.js";

import { authenticateJWT } from "../middleware/authMiddleware.js";

const router = express.Router();

/* My appointments */
router.get("/my", authenticateJWT, getAllMyAppointments);
router.get("/my-appointments", authenticateJWT, getAllMyAppointments);

/* Upcoming & Past */
router.get("/upcoming", authenticateJWT, getUpcomingAppointments);
router.get("/past", authenticateJWT, getPastAppointments);

/* ✅ Get booked slots (NO AUTH needed) */
router.get("/booked-slots", getBookedSlots);

/* ✅ Save call details */
router.post("/save-call-details", authenticateJWT, saveCallDetails);

/* Video token */
router.get("/:id/video-token", authenticateJWT, getVideoToken);

/* By ID */
router.get("/:id", authenticateJWT, getAppointmentById);

export default router;
