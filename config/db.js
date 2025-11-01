import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

let db;

(async () => {
  try {
    db = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
    });
    console.log("✅ MySQL Connected Successfully!");
  } catch (error) {
    console.error("❌ Database connection failed:", error);
  }
})();

export default {
  query: async (sql, params) => {
    if (!db) throw new Error("Database not initialized");
    const [rows] = await db.query(sql, params);
    return [rows];
  },
};
