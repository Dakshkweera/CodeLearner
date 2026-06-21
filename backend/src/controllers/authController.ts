import { Request, Response } from 'express';
import dbService from '../services/dbService';
import authService from '../services/authService';
import jwt from 'jsonwebtoken';

const pool = dbService.getPool();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-this';
const JWT_EXPIRES_IN = '7d';

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
      // If not verified, we'll update and auto-verify
    }

    // Hash password
    const passwordHash = await authService.hashPassword(password);

    // Auto-verify user (no OTP required)
    let userId: string;

    if (existing.rows.length === 0) {
      // Create new user - AUTO-VERIFIED
      const insert = await pool.query(
        `INSERT INTO users (email, password_hash, name, email_verified, otp_code, otp_expires_at)
         VALUES ($1, $2, $3, true, NULL, NULL)
         RETURNING id, ai_questions_used`,
        [trimmedEmail, passwordHash, name || null]
      );
      userId = insert.rows[0].id;
    } else {
      // Update existing unverified user - AUTO-VERIFY
      const update = await pool.query(
        `UPDATE users
         SET password_hash = $1,
             name = $2,
             email_verified = true,
             otp_code = NULL,
             otp_expires_at = NULL,
             updated_at = NOW()
         WHERE email = $3
         RETURNING id, ai_questions_used`,
        [passwordHash, name || null, trimmedEmail]
      );
      userId = update.rows[0].id;
    }

    // Generate JWT and return immediately (auto-login)
    const token = jwt.sign(
      { userId, email: trimmedEmail },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Get user data for response
    const userResult = await pool.query(
      'SELECT id, email, name, ai_questions_used FROM users WHERE id = $1',
      [userId]
    );

    const user = userResult.rows[0];

    return res.status(201).json({
      message: 'Signup successful. You are now logged in.',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        aiQuestionsUsed: user.ai_questions_used,
      },
    });
  } catch (error: any) {
    console.error('[SIGNUP] Error:', error.message);
    return res.status(500).json({ error: 'Failed to sign up user.' });
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

    // Note: email_verified is no longer checked — users are auto-verified at signup

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
