import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendOTPEmail = async (to, otp) => {
  try {
    const mailOptions = {
      from: `"PredCare App" <${process.env.EMAIL_USER}>`,
      to,
      subject: "Your PredCare OTP Verification Code",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background: #f6f9fc; border-radius: 10px;">
          <h2 style="color: #3366cc;">PredCare Login OTP</h2>
          <p>Dear User,</p>
          <p>Your OTP code is:</p>
          <h1 style="background: #3366cc; color: white; display: inline-block; padding: 10px 20px; border-radius: 5px;">${otp}</h1>
          <p>This OTP is valid for <strong>5 minutes</strong>.</p>
          <br/>
          <p style="font-size: 12px; color: #888;">© PredCare 2025. All rights reserved.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(` OTP sent successfully to ${to}`);
  } catch (error) {
    console.error("Error sending OTP email:", error);
  }
};
