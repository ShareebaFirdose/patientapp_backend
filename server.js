import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import mysql from "mysql2";
import authRoutes from "./routes/authRoutes.js"; 

dotenv.config(); // load .env

const app = express();
app.use(cors());
app.use(express.json());

// Connect MySQL
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

db.connect((err) => {
  if (err) {
    console.error("Database connection failed:", err.message);
  } else {
    console.log("MySQL connected successfully!");
  }
});

//Simple splash and loading routes
app.get("/api/splash", (req, res) => {
  res.json({ message: "Welcome to PredCare App 💙", status: "success" });
});

app.get("/api/loading", (req, res) => {
  res.json({ message: "App loading successfully...", status: "ok" });
});

//Auth routes (signup, login, verify-otp)
console.log("Auth routes loaded");

app.use("/api/auth", authRoutes);

//404 fallback
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

//Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
