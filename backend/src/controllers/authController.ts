import { Request, Response } from 'express';
import dbService from '../services/dbService';
import authService from '../services/authService';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { sendOtpEmail } from '../services/emailService'; // Gmail SMTP
import { sendOtpEmailResend } from '../services/resendService'; // Resend

const pool = dbService.getPool();

// Helper: generate 6-digit OTP
function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export const signup = async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body as {
      email?: string;
      password?: string;
      name?: string;
    };

    // Basic validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail.includes('@') || trimmedEmail.length < 5) {
      return res.status(400).json({ error: 'Invalid email format.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    // Check if user already exists
    const existing = await pool.query(
      'SELECT id, email_verified FROM users WHERE email = $1',
      [trimmedEmail]
    );

    if (existing.rows.length > 0) {
      // If already verified, block duplicate signup
      if (existing.rows[0].email_verified) {
        return res.status(409).json({ error: 'User with this email already exists.' });
      }
      // If not verified, we'll overwrite OTP and allow re-onboarding
    }

    // Hash password
    const passwordHash = await authService.hashPassword(password);

    // Generate OTP & expiry (30 minutes) ✅ EXTENDED FROM 10 TO 30 MINUTES
    const otp = generateOtp();
    const otpExpiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min

    let userId: string;

    if (existing.rows.length === 0) {
      // Create new user
      const insert = await pool.query(
        `INSERT INTO users (email, password_hash, name, email_verified, otp_code, otp_expires_at)
         VALUES ($1, $2, $3, false, $4, $5)
         RETURNING id`,
        [trimmedEmail, passwordHash, name || null, otp, otpExpiresAt]
      );
      userId = insert.rows[0].id;
    } else {
      // Update existing unverified user
      const update = await pool.query(
        `UPDATE users
         SET password_hash = $1,
             name = $2,
             otp_code = $3,
             otp_expires_at = $4,
             updated_at = NOW()
         WHERE email = $5
         RETURNING id`,
        [passwordHash, name || null, otp, otpExpiresAt, trimmedEmail]
      );
      userId = update.rows[0].id;
    }

    // ✅ SEND OTP EMAIL - TRY RESEND FIRST, FALLBACK TO GMAIL
    try {
      // Check if Resend is configured
      if (process.env.RESEND_API_KEY) {
        console.log('📧 [SIGNUP] Sending OTP via Resend...');
        await sendOtpEmailResend(trimmedEmail, otp);
        console.log('✅ [SIGNUP] OTP sent via Resend successfully');
      } else {
        console.log('📧 [SIGNUP] Sending OTP via Gmail SMTP (Resend not configured)...');
        await sendOtpEmail(trimmedEmail, otp);
        console.log('✅ [SIGNUP] OTP sent via Gmail successfully');
      }
    } catch (emailErr: any) {
      console.error('❌ [SIGNUP] Failed to send OTP email:', emailErr.message);
      
      // If Resend failed, try Gmail as backup
      if (process.env.RESEND_API_KEY) {
        console.log('⚠️ [SIGNUP] Resend failed, trying Gmail SMTP as fallback...');
        try {
          await sendOtpEmail(trimmedEmail, otp);
          console.log('✅ [SIGNUP] OTP sent via Gmail fallback successfully');
        } catch (gmailErr: any) {
          console.error('❌ [SIGNUP] Gmail fallback also failed:', gmailErr.message);
        }
      }
      // Do not fail signup just because email failed; client still has devOtp if needed
    }

    return res.status(201).json({
      message: 'Signup successful. Please verify the OTP sent to your email.',
      userId,
      email: trimmedEmail,
      // dev-only: you can temporarily return otp to test easily
      devOtp: otp,
    });
  } catch (error: any) {
    console.error('[SIGNUP] Error:', error.message);
    return res.status(500).json({ error: 'Failed to sign up user.' });
  }
};

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-this';
const JWT_EXPIRES_IN = '7d';

export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body as { email?: string; otp?: string };

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required.' });
    }

    const trimmedEmail = email.trim().toLowerCase();

    const result = await pool.query(
      `SELECT id, otp_code, otp_expires_at, email_verified, ai_questions_used
       FROM users
       WHERE email = $1`,
      [trimmedEmail]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const user = result.rows[0];

    if (user.email_verified) {
      return res.status(400).json({ error: 'Email is already verified. Please log in.' });
    }

    if (!user.otp_code || !user.otp_expires_at) {
      return res.status(400).json({ error: 'No active OTP found. Please sign up again.' });
    }

    const now = new Date();
    const expiresAt = new Date(user.otp_expires_at);

    if (now > expiresAt) {
      return res.status(400).json({ error: 'OTP has expired. Please sign up again.' });
    }

    if (user.otp_code !== otp) {
      return res.status(400).json({ error: 'Invalid OTP.' });
    }

    // Mark email as verified, clear OTP
    const update = await pool.query(
      `UPDATE users
       SET email_verified = true,
           otp_code = NULL,
           otp_expires_at = NULL,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, email, name, ai_questions_used`,
      [user.id]
    );

    const updatedUser = update.rows[0];

    // Issue JWT so user is logged in immediately after verification
    const token = jwt.sign(
      { userId: updatedUser.id, email: updatedUser.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.status(200).json({
      message: 'Email verified successfully.',
      token,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        aiQuestionsUsed: updatedUser.ai_questions_used,
      },
    });
  } catch (error: any) {
    console.error('[VERIFY EMAIL] Error:', error.message);
    return res.status(500).json({ error: 'Failed to verify email.' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const trimmedEmail = email.trim().toLowerCase();

    const result = await pool.query(
      `SELECT id, email, password_hash, name, email_verified, ai_questions_used
       FROM users
       WHERE email = $1`,
      [trimmedEmail]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = result.rows[0];

    // Check email verified
    if (!user.email_verified) {
      return res.status(403).json({ error: 'Please verify your email before logging in.' });
    }

    // Check password
    const match = await authService.comparePassword(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.status(200).json({
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        aiQuestionsUsed: user.ai_questions_used,
      },
    });
  } catch (error: any) {
    console.error('[LOGIN] Error:', error.message);
    return res.status(500).json({ error: 'Failed to log in user.' });
  }
};
