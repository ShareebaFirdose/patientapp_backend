// emrRoutes.js - UPDATED VERSION
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

import {
  uploadEMR,
  getMyDocuments,
  deleteEMR,
  downloadEMR,
} from "../controllers/emrController.js";

import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

/* ✅ STORAGE - Organized by document type */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // ✅ Use 'category' field (frontend sends this)
    const category = req.body?.category || req.body?.document_type || "Other Documents";
    
    const sanitizedType = category.replace(/[^a-zA-Z0-9-_]/g, "_");
    
    const dir = `uploads/emr/${sanitizedType}`;
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
    cb(null, `${timestamp}-${sanitizedName}`);
  },
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // ✅ Allow images and PDFs
    const allowedMimes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'image/bmp',
      'image/webp',
      'application/pdf'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only images and PDF files are allowed!'));
    }
  }
});

/* ✅ ROUTES */

// GET all documents (with optional category filter)
router.get("/files", authMiddleware, getMyDocuments);

// Upload new document
router.post(
  "/upload",
  
  (req, res, next) => {
    console.log("\n📥 ==================== UPLOAD REQUEST ====================");
    console.log("📋 Headers:", req.headers);
    console.log("📦 Content-Type:", req.headers['content-type']);
    console.log("🔐 Authorization:", req.headers.authorization ? "Present" : "Missing");
    next();
  },

  upload.any(),

  (req, res, next) => {
    console.log("\n✅ ==================== AFTER MULTER ====================");
    console.log("🔎 FILES RECEIVED:", req.files);
    console.log("📄 BODY:", req.body);

    if (req.files && req.files.length > 0) {
      req.file = req.files[0];
      console.log("✅ File normalized to req.file:", req.file);
    } else {
      console.log("❌ NO FILES RECEIVED");
    }

    req.body = req.body || {};
    
    console.log("📝 Title:", req.body.title);
    console.log("📁 Category:", req.body.category || req.body.document_type);
    console.log("📋 Notes:", req.body.notes);
    console.log("========================================================\n");
    
    next();
  },

  authMiddleware,
  uploadEMR
);

// Download document
router.get("/download/:id", authMiddleware, downloadEMR);

// Delete document
router.delete("/files/:id", authMiddleware, deleteEMR);

// ✅ Legacy route support
router.get("/my-documents", authMiddleware, getMyDocuments);
router.delete("/:id", authMiddleware, deleteEMR);

export default router;