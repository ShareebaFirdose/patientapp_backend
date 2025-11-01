export const getUserProfile = async (req, res) => {
  try {
    res.status(200).json({
      message: "Welcome to your profile!",
      user: req.user, // comes from the JWT token payload
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
