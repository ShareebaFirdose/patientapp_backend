import jwt from "jsonwebtoken";

/**
 * OLD NAME (your routes still use this)
 */
export const authenticateJWT = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader)
      return res.status(401).json({ success: false, message: "No token provided" });

    const token = authHeader.split(" ")[1];

    if (!token)
      return res.status(401).json({ success: false, message: "Invalid token format" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;
    next();
  } catch (err) {
    console.error("JWT error:", err);
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
};

/**
 * NEW NAME (used by some routes)
 * Both names point to the same function
 */
export const authMiddleware = authenticateJWT;
