import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

// ✅ JWT Authentication Middleware
export const authenticateJWT = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "No authorization token provided",
      });
    }

    const token = authHeader.split(" ")[1]; // Extract token from "Bearer <token>"

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Invalid token format",
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (!decoded || !decoded.id) {
      return res.status(401).json({
        success: false,
        message: "Invalid token payload",
      });
    }

    // Attach user ID to request object
    req.user = { id: decoded.id };
    
    next();
  } catch (error) {
    console.error("JWT Authentication Error:", error.message);
    
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token has expired. Please login again.",
      });
    }
    
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token. Please login again.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Authentication failed",
    });
  }
};

// Alternative export for backward compatibility
export const authMiddleware = authenticateJWT;