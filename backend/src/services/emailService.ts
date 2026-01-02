import nodemailer from 'nodemailer';

const host = process.env.SMTP_HOST;
const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;
const from = process.env.EMAIL_FROM || user;

if (!host || !user || !pass) {
  console.warn('[EMAIL] SMTP config is missing. OTP emails will not be sent.');
}

const transporter = nodemailer.createTransport({
  host,
  port,
  secure: false,
  auth: { user, pass },
});

export async function sendOtpEmail(to: string, otp: string) {
  if (!host || !user || !pass) {
    console.warn(`[EMAIL] Skipping sendOtpEmail, SMTP not configured. OTP: ${otp}`);
    return;
  }

  const mailOptions = {
    from,
    to,
    subject: 'Your CodeLearner verification code',
    text: `Your CodeLearner verification code is: ${otp}\n\nThis code is valid for 10 minutes.`,
    html: `
      <p>Your CodeLearner verification code is:</p>
      <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">${otp}</p>
      <p>This code is valid for 10 minutes.</p>
    `,
  };

  await transporter.sendMail(mailOptions);
}
