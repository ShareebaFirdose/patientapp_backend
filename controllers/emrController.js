import db from "../config/db.js";
import fs from "fs";
import path from "path";

/* =====================================
   ✅ UPLOAD EMR – WITH TITLE FIELD
===================================== */
export const uploadEMR = async (req, res) => {
  try {
    console.log("\n📤 Upload EMR called");

    if (!req.file) {
      console.log("❌ NO FILE RECEIVED");
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const title = req.body?.title?.trim() || "";
    const document_type = req.body?.document_type || "Other";
    const notes = req.body?.notes?.trim() || "";
    const user_id = req.user?.id;

    if (!user_id) {
      console.log("❌ No user id in token");
      
      // Delete uploaded file
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      return res.status(401).json({
        success: false,
        message: "Unauthorized user",
      });
    }

    if (!title) {
      console.log("❌ Title is required");
      
      // Delete uploaded file
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      return res.status(400).json({
        success: false,
        message: "Title is required",
      });
    }

    const file_path = req.file.path.replace(/\\/g, "/");

    console.log("✅ USER ID:", user_id);
    console.log("✅ TITLE:", title);
    console.log("✅ FILE:", req.file.originalname);
    console.log("✅ PATH:", file_path);
    console.log("✅ TYPE:", document_type);
    console.log("✅ NOTES:", notes || "(none)");

    const doctor_id = null;
    const patient_id = user_id;
    const appointment_id = null;
    
    // ✅ Get current timestamp
    const now = new Date();

    // ✅ INSERT with title field
    const sql = `
      INSERT INTO doctor_emr_documents
      (doctor_id, patient_id, appointment_id, title, document_type, document_path, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [doctor_id, patient_id, appointment_id, title, document_type, file_path, now, now];

    console.log("📝 Inserting into DB...");
    console.log("📋 Values:", values);

    // ✅ Use your db.query method (returns promise)
    const [rows] = await db.query(sql, values);
    
    console.log("✅ Query result:", rows);
    console.log("✅ EMR INSERTED SUCCESSFULLY → ID:", rows.insertId);
    console.log("✅ Upload complete!\n");

    return res.status(201).json({
      success: true,
      message: "Document uploaded successfully",
      data: {
        id: rows.insertId,
        title: title,
        document_type: document_type,
        document_path: file_path,
        patient_id: patient_id,
        notes: notes,
        created_at: now,
        updated_at: now,
      },
    });

  } catch (error) {
    console.error("❌ UPLOAD ERROR:", error.message);
    console.error("❌ Error code:", error.code);
    console.error("❌ Stack:", error.stack);

    // Delete uploaded file on error
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
        console.log("🗑️ Deleted file after error");
      } catch (delErr) {
        console.error("⚠️ Could not delete file:", delErr.message);
      }
    }

    return res.status(500).json({
      success: false,
      message: "Upload failed",
      error: error.message,
    });
  }
};


/* =====================================
   ✅ GET MY DOCUMENTS
===================================== */
export const getMyDocuments = async (req, res) => {
  const user_id = req.user?.id;

  if (!user_id) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }

  console.log(`📥 Fetching documents for user: ${user_id}`);

  try {
    const sql = `
      SELECT 
        id,
        doctor_id,
        patient_id,
        appointment_id,
        title,
        document_type,
        document_path,
        created_at,
        updated_at
      FROM doctor_emr_documents 
      WHERE patient_id = ? 
      ORDER BY created_at DESC
    `;

    const [rows] = await db.query(sql, [user_id]);

    console.log(`✅ Found ${rows.length} document(s)`);

    return res.json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (err) {
    console.error("❌ FETCH ERROR:", err.message);

    return res.status(500).json({
      success: false,
      message: "Error loading documents",
      error: err.message,
    });
  }
};


/* =====================================
   ✅ DOWNLOAD EMR
===================================== */
export const downloadEMR = async (req, res) => {
  const { id } = req.params;
  const user_id = req.user?.id;

  console.log(`📥 Download request - Doc ID: ${id}, User: ${user_id}`);

  try {
    const sql = `
      SELECT document_path, patient_id, document_type, title 
      FROM doctor_emr_documents 
      WHERE id = ?
    `;

    const [rows] = await db.query(sql, [id]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    const document = rows[0];

    // ✅ Security check
    if (document.patient_id !== user_id) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const filePath = path.resolve(document.document_path);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: "File not found on server",
      });
    }

    console.log(`✅ Downloading: ${filePath}`);
    res.download(filePath);
  } catch (err) {
    console.error("❌ DOWNLOAD ERROR:", err.message);
    return res.status(500).json({
      success: false,
      message: "Download error",
      error: err.message,
    });
  }
};


/* =====================================
   ✅ DELETE EMR
===================================== */
export const deleteEMR = async (req, res) => {
  const { id } = req.params;
  const user_id = req.user?.id;

  console.log(`🗑️ Delete request - Doc ID: ${id}, User: ${user_id}`);

  let connection;

  try {
    // ✅ Get connection for transaction
    connection = await db.getConnection();
    await connection.beginTransaction();

    // ✅ Verify ownership
    const selectSql = `
      SELECT document_path, patient_id 
      FROM doctor_emr_documents 
      WHERE id = ?
    `;

    const [rows] = await connection.query(selectSql, [id]);

    if (!rows || rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    const document = rows[0];

    // ✅ Security check
    if (document.patient_id !== user_id) {
      await connection.rollback();
      return res.status(403).json({
        success: false,
        message: "You can only delete your own documents",
      });
    }

    // ✅ Delete from database
    const deleteSql = "DELETE FROM doctor_emr_documents WHERE id = ?";
    await connection.query(deleteSql, [id]);

    // ✅ Commit transaction
    await connection.commit();

    // ✅ Delete file from filesystem (after DB success)
    const filePath = path.resolve(document.document_path);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log("✅ File deleted from disk:", filePath);
      } catch (fileErr) {
        console.error("⚠️ Warning: Could not delete file:", fileErr.message);
      }
    }

    console.log("✅ Document deleted successfully\n");

    return res.json({
      success: true,
      message: "Document deleted successfully",
    });
  } catch (err) {
    // ✅ Rollback on error
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackErr) {
        console.error("❌ Rollback error:", rollbackErr.message);
      }
    }

    console.error("❌ DELETE ERROR:", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to delete document",
      error: err.message,
    });
  } finally {
    // ✅ Release connection
    if (connection) {
      connection.release();
    }
  }
};