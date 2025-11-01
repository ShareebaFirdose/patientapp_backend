import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/authRoutes.js";
import db from "./config/db.js";

dotenv.config();

const app = express();

// ✅ Middlewares
app.use(cors());
app.use(express.json());

// ✅ Test endpoint
app.get("/", (req, res) => {
  res.send("PredCare backend running successfully 🚀");
});

// ✅ Mount authentication routes
app.use("/api/auth", authRoutes);

// ✅ Confirm database connectivity
(async () => {
  try {
    await db.query("SELECT 1"); // simple query check
    console.log("MySQL Connected Successfully!");
  } catch (error) {
    console.error(" Database connection failed:", error);
  }
})();

// ✅ Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`✅ Server running on http://localhost:${PORT}`)
);
