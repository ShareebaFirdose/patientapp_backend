export const createOrUpdateUserProfile = async (req, res) => {
  try {
    const {
      user_id,
      full_name,
      first_name,
      last_name,
      alternate_phone,
      gender,
      date_of_birth,
      profile_picture,
      language_preferences,
      timezone,
    } = req.body;

    if (!user_id) {
      return res
        .status(400)
        .json({ success: false, message: "User ID is required" });
    }

    const profileData = {
      user_id,
      full_name,
      first_name,
      last_name,
      alternate_phone,
      gender,
      date_of_birth,
      profile_picture,
      language_preferences: JSON.stringify(language_preferences || []),
      timezone: timezone || "Asia/Kolkata",
    };

    await db.query(
      `INSERT INTO user_profiles SET ? ON DUPLICATE KEY UPDATE ?`,
      [profileData, profileData]
    );

    res.json({ success: true, message: "Profile saved successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to fill profile details" });
  }
};
