import express from "express";
import {
  getUpcomingAppointments,
  getPastAppointments,
  getAllMyAppointments,
  getAppointmentById,
  getBookedSlots,
  getVideoToken,
  saveCallDetails,
} from "../controllers/appointmentController.js";
import { authenticateJWT } from "../middleware/authMiddleware.js";

const router = express.Router();

/* ------------------ FIX: ORDER MATTERS ------------------ */

// ✅ This must be FIRST
router.get("/booked-slots", authenticateJWT, getBookedSlots);

router.get("/upcoming", authenticateJWT, getUpcomingAppointments);
router.get("/past", authenticateJWT, getPastAppointments);
router.get("/my-appointments", authenticateJWT, getAllMyAppointments);

/* ❗ KEEP THIS BELOW booked-slots, otherwise it overrides everything */
router.get("/:id/video-token", authenticateJWT, getVideoToken);
router.get("/:id", authenticateJWT, getAppointmentById);

/* Save call details */
router.post("/save-call", authenticateJWT, saveCallDetails);

export default router;
