// routes/videoRoutes.js
import express from "express";
import jwt from "jsonwebtoken";

const router = express.Router();

// Generate VideoSDK token
router.get("/get-token", async (req, res) => {
  try {
    const SECRET = process.env.VIDEOSDK_SECRET;

    if (!SECRET) {
      return res.status(500).json({
        success: false,
        message: "VideoSDK secret not found in .env",
      });
    }

    const API_KEY = process.env.VIDEOSDK_API_KEY;

    if (!API_KEY) {
      return res.status(500).json({
        success: false,
        message: "VideoSDK API key not found in .env",
      });
    }

    const payload = {
      apikey: API_KEY,
      permissions: ["allow_join", "allow_mod"], // for doctor + patient
      version: 2,
      roles: ["rtc"], // for client to join the room
    };

    const token = jwt.sign(payload, SECRET, {
      algorithm: "HS256",
      expiresIn: "120m",
    });

    res.json({ success: true, token });
  } catch (error) {
    console.error("Token error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate token",
      error: error.message,
    });
  }
});

// Create a new meeting room
router.post("/create-meeting", async (req, res) => {
  try {
    const SECRET = process.env.VIDEOSDK_SECRET;
    const API_KEY = process.env.VIDEOSDK_API_KEY;

    if (!SECRET || !API_KEY) {
      return res.status(500).json({
        success: false,
        message: "VideoSDK credentials not found",
      });
    }

    // Generate token for API access
    const token = jwt.sign(
      {
        apikey: API_KEY,
        permissions: ["allow_join", "allow_mod"],
        version: 2,
        roles: ["crawler"], // for API access
      },
      SECRET,
      { algorithm: "HS256", expiresIn: "120m" }
    );

    // Create room using VideoSDK API
    const response = await fetch("https://api.videosdk.live/v2/rooms", {
      method: "POST",
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to create meeting");
    }

    res.json({
      success: true,
      roomId: data.roomId,
      message: "Meeting room created successfully",
    });
  } catch (error) {
    console.error("Create meeting error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create meeting",
      error: error.message,
    });
  }
});

// Validate a meeting room
router.post("/validate-meeting/:roomId", async (req, res) => {
  try {
    const { roomId } = req.params;
    const SECRET = process.env.VIDEOSDK_SECRET;
    const API_KEY = process.env.VIDEOSDK_API_KEY;

    if (!SECRET || !API_KEY) {
      return res.status(500).json({
        success: false,
        message: "VideoSDK credentials not found",
      });
    }

    const token = jwt.sign(
      {
        apikey: API_KEY,
        permissions: ["allow_join"],
        version: 2,
        roles: ["crawler"],
      },
      SECRET,
      { algorithm: "HS256", expiresIn: "120m" }
    );

    const response = await fetch(
      `https://api.videosdk.live/v2/rooms/validate/${roomId}`,
      {
        method: "POST",
        headers: {
          Authorization: token,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();

    res.json({
      success: response.ok,
      valid: data.roomId === roomId,
      roomId: data.roomId,
    });
  } catch (error) {
    console.error("Validate meeting error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to validate meeting",
    });
  }
});

export default router;
