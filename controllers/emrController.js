// emrController.js - UPDATED VERSION
import db from "../config/db.js";
import fs from "fs";
import path from "path";

/* =====================================
   ✅ UPLOAD EMR – UPDATED FOR FRONTEND
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
    const category = req.body?.category || req.body?.document_type || "Other Documents";
    const notes = req.body?.notes?.trim() || "";
    const user_id = req.user?.id;

    if (!user_id) {
      console.log("❌ No user id in token");
      
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
      
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      return res.status(400).json({
        success: false,
        message: "Title is required",
      });
    }

    const file_path = req.file.path.replace(/\\/g, "/");
    
    // ✅ Determine file type from mimetype
    let fileType = "document";
    if (req.file.mimetype.startsWith("image/")) {
      fileType = "image";
    } else if (req.file.mimetype === "application/pdf") {
      fileType = "pdf";
    }
    
    // ✅ Calculate file size
    const fileSizeKB = (req.file.size / 1024).toFixed(2);
    const fileSize = fileSizeKB < 1024 
      ? `${fileSizeKB} KB` 
      : `${(fileSizeKB / 1024).toFixed(2)} MB`;

    console.log("USER ID:", user_id);
    console.log("TITLE:", title);
    console.log("FILE:", req.file.originalname);
    console.log("PATH:", file_path);
    console.log("CATEGORY:", category);
    console.log("FILE TYPE:", fileType);
    console.log("FILE SIZE:", fileSize);

    const doctor_id = null;
    const patient_id = user_id;
    const appointment_id = null;
    
    const now = new Date();

    const sql = `
      INSERT INTO doctor_emr_documents
      (doctor_id, patient_id, appointment_id, title, document_type, document_path, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [doctor_id, patient_id, appointment_id, title, category, file_path, now, now];

    console.log("📝 Inserting into DB...");

    const [rows] = await db.query(sql, values);
    
    console.log("✅ EMR INSERTED SUCCESSFULLY → ID:", rows.insertId);

    // ✅ Return format expected by frontend
    return res.status(201).json({
      success: true,
      message: "Document uploaded successfully",
      data: {
        id: rows.insertId,
        name: req.file.originalname, // Frontend expects 'name'
        type: fileType, // Frontend expects 'type'
        url: `/${file_path}`, // Frontend expects 'url' with leading slash
        size: fileSize, // Frontend expects 'size'
        category: category, // Frontend expects 'category'
        uploadedAt: now, // Frontend expects 'uploadedAt'
        patient_id: patient_id,
        title: title,
        notes: notes,
      },
    });

  } catch (error) {
    console.error("❌ UPLOAD ERROR:", error.message);

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
   ✅ GET MY DOCUMENTS - UPDATED
===================================== */
export const getMyDocuments = async (req, res) => {
  const user_id = req.user?.id;
  const { category } = req.query; // ✅ Get category filter from query

  if (!user_id) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }

  console.log(`📥 Fetching documents for user: ${user_id}`);
  if (category) {
    console.log(`📁 Filtering by category: ${category}`);
  }

  try {
    let sql = `
      SELECT 
        id,
        doctor_id,
        patient_id,
        appointment_id,
        title,
        document_type as category,
        document_path,
        created_at,
        updated_at
      FROM doctor_emr_documents 
      WHERE patient_id = ?
    `;

    const params = [user_id];

    // ✅ Add category filter if provided
    if (category) {
      sql += " AND document_type = ?";
      params.push(category);
    }

    sql += " ORDER BY created_at DESC";

    const [rows] = await db.query(sql, params);

    console.log(`✅ Found ${rows.length} document(s)`);

    // ✅ Transform data to match frontend expectations
    const transformedData = rows.map(row => {
      // Determine file type from path
      let fileType = "document";
      const ext = path.extname(row.document_path).toLowerCase();
      
      if ([".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"].includes(ext)) {
        fileType = "image";
      } else if (ext === ".pdf") {
        fileType = "pdf";
      }

      // Get file size
      let fileSize = "Unknown";
      try {
        const fullPath = path.resolve(row.document_path);
        if (fs.existsSync(fullPath)) {
          const stats = fs.statSync(fullPath);
          const sizeKB = (stats.size / 1024).toFixed(2);
          fileSize = sizeKB < 1024 
            ? `${sizeKB} KB` 
            : `${(sizeKB / 1024).toFixed(2)} MB`;
        }
      } catch (err) {
        console.error("Error getting file size:", err);
      }

      return {
        id: row.id,
        name: row.title || path.basename(row.document_path),
        type: fileType,
        url: `/${row.document_path}`, // Add leading slash for static serving
        size: fileSize,
        category: row.category,
        uploadedAt: row.created_at,
        patient_id: row.patient_id,
      };
    });

    return res.json({
      success: true,
      count: transformedData.length,
      data: transformedData,
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
   ✅ DOWNLOAD EMR - UNCHANGED
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
   ✅ DELETE EMR - UNCHANGED
===================================== */
export const deleteEMR = async (req, res) => {
  const { id } = req.params;
  const user_id = req.user?.id;

  console.log(`🗑️ Delete request - Doc ID: ${id}, User: ${user_id}`);

  let connection;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

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

    if (document.patient_id !== user_id) {
      await connection.rollback();
      return res.status(403).json({
        success: false,
        message: "You can only delete your own documents",
      });
    }

    const deleteSql = "DELETE FROM doctor_emr_documents WHERE id = ?";
    await connection.query(deleteSql, [id]);

    await connection.commit();

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
    if (connection) {
      connection.release();
    }
  }
};