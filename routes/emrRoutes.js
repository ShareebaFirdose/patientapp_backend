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

/* ✅ STORAGE */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads/emr";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname),
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

/* ✅ UPLOAD — FIRST MULTER, THEN AUTH */
router.post(
  "/upload",
  
  // ✅ Debug middleware - logs raw request
  (req, res, next) => {
    console.log("\n🔍 ==================== UPLOAD REQUEST ====================");
    console.log("📋 Headers:", req.headers);
    console.log("📦 Content-Type:", req.headers['content-type']);
    console.log("🔐 Authorization:", req.headers.authorization ? "Present" : "Missing");
    next();
  },

  // ✅ Multer processes the file
  upload.any(), // DO NOT CHANGE - accepts files with any field name

  // ✅ Debug middleware - logs after multer
  (req, res, next) => {
    console.log("\n✅ ==================== AFTER MULTER ====================");
    console.log("📎 FILES RECEIVED:", req.files);
    console.log("📝 BODY:", req.body);

    // ✅ Normalize file to req.file if files exist
    if (req.files && req.files.length > 0) {
      req.file = req.files[0];
      console.log("✅ File normalized to req.file:", req.file);
    } else {
      console.log("❌ NO FILES RECEIVED");
    }

    // ✅ Ensure body exists
    req.body = req.body || {};
    
    console.log("🎯 Document Type:", req.body.document_type);
    console.log("========================================================\n");
    
    next();
  },

  // ✅ Authentication middleware
  authMiddleware,
  
  // ✅ Controller
  uploadEMR
);

/* ✅ OTHER ROUTES */
router.get("/my-documents", authMiddleware, getMyDocuments);
router.delete("/:id", authMiddleware, deleteEMR);
router.get("/download/:id", authMiddleware, downloadEMR);

export default router;