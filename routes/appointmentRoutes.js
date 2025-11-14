import express from "express";
import {
  bookAppointment,
  getAppointmentsByUser,
} from "../controllers/appointmentController.js";
import { authenticateJWT } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/book", authenticateJWT, bookAppointment);
router.get("/my-appointments", authenticateJWT, getAppointmentsByUser);

export default router;
