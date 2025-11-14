import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Send Email Function
 * @param {*} param0
 */
async function sendEmail({ to, subject, text, html }) {
  try {
    const mailOptions = {
      from: process.env.SMTP_USER,
      to,
      subject,
      text,
      html,
    };

    await transporter.sendMail(mailOptions);
    console.log("📧 Email sent to:", to);
    return true;
  } catch (err) {
    console.error("❌ Email Error:", err.message);
    return false;
  }
}

// ✅ DEFAULT EXPORT
export default sendEmail;
