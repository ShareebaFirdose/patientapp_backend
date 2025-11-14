import express from "express";
import jwt from "jsonwebtoken";

const router = express.Router();

router.get("/get-token", async (req, res) => {
  try {
    const API_KEY = "64487a4e-ace6-41b2-b4db-246990cd9476";
    const SECRET = process.env.VIDEOSDK_SECRET;

    if (!SECRET) {
      return res.status(500).json({
        success: false,
        message: "VideoSDK secret not found in .env",
      });
    }

    const payload = {
      apikey: API_KEY,
      permissions: ["allow_join", "allow_mod"],
    };

    const token = jwt.sign(payload, SECRET, {
      algorithm: "HS256",
      expiresIn: "24h",
    });

    res.json({ success: true, token });
  } catch (error) {
    console.error("Token error:", error);
    res.status(500).json({ success: false });
  }
});

export default router;
