// config/db.js
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

let pool;

try {
  pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  console.log("✅ MySQL Connection Pool Initialized Successfully!");
} catch (error) {
  console.error("❌ MySQL Connection Pool Failed:", error);
}

// ✅ Export query & getConnection for compatibility
const db = {
  query: async (sql, params) => {
    const [rows] = await pool.query(sql, params);
    return [rows];
  },
  getConnection: async () => {
    return await pool.getConnection();
  },
};

export default db;
