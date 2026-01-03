import { Resend } from 'resend';
import { config } from '../config';

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send OTP email using Resend
 * Falls back to error if Resend is not configured
 */
export async function sendOtpEmailResend(to: string, otp: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY not configured');
  }

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM || 'CodeLearner <onboarding@resend.dev>',
      to: [to],
      subject: 'Verify your email - CodeLearner',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
              .otp-box { background: white; border: 2px solid #4F46E5; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 20px 0; border-radius: 8px; }
              .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>CodeLearner</h1>
              </div>
              <div class="content">
                <h2>Email Verification</h2>
                <p>Thank you for signing up! Please use the following OTP code to verify your email address:</p>
                <div class="otp-box">${otp}</div>
                <p><strong>This code will expire in 30 minutes.</strong></p>
                <p>If you didn't request this code, please ignore this email.</p>
              </div>
              <div class="footer">
                <p>© ${new Date().getFullYear()} CodeLearner. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('❌ Resend API error:', error);
      throw new Error(`Resend error: ${error.message}`);
    }

    console.log('✅ OTP email sent via Resend:', data?.id);
  } catch (error: any) {
    console.error('❌ Failed to send email via Resend:', error.message);
    throw error;
  }
}

/**
 * Send welcome email (optional - can be used after verification)
 */
export async function sendWelcomeEmailResend(to: string, name?: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('⚠️ RESEND_API_KEY not configured, skipping welcome email');
    return;
  }

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM || 'CodeLearner <onboarding@resend.dev>',
      to: [to],
      subject: 'Welcome to CodeLearner! 🎉',
      html: `
        <!DOCTYPE html>
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <h1>Welcome${name ? ` ${name}` : ''} to CodeLearner! 🚀</h1>
              <p>Your account has been successfully verified.</p>
              <p>You can now:</p>
              <ul>
                <li>Clone and analyze GitHub repositories</li>
                <li>Explore file structures and dependencies</li>
                <li>Ask AI questions about your codebase</li>
              </ul>
              <p>Happy coding!</p>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('❌ Resend welcome email error:', error);
    } else {
      console.log('✅ Welcome email sent via Resend:', data?.id);
    }
  } catch (error: any) {
    console.error('❌ Failed to send welcome email:', error.message);
    // Don't throw - welcome email failure shouldn't break signup
  }
}
