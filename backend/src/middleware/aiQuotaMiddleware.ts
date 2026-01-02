import { Response, NextFunction } from 'express';
import dbService from '../services/dbService';
import { AuthRequest } from './authMiddleware';

const pool = dbService.getPool();
const MAX_AI_QUESTIONS = 10;

export const checkAiQuota = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const userId = req.user.userId;

    const result = await pool.query(
      `SELECT email_verified, ai_questions_used
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found.' });
    }

    const user = result.rows[0];

    if (!user.email_verified) {
      return res.status(403).json({ error: 'Please verify your email to use AI.' });
    }

    if (user.ai_questions_used >= MAX_AI_QUESTIONS) {
      return res.status(429).json({
        error: 'AI quota exhausted.',
        message: `You have used all ${MAX_AI_QUESTIONS} AI questions for this account.`,
      });
    }

    // Attach usage info if needed later
    (req as any).aiUsage = {
      used: user.ai_questions_used,
      remaining: MAX_AI_QUESTIONS - user.ai_questions_used,
    };

    return next();
  } catch (error: any) {
    console.error('[AI QUOTA] Error:', error.message);
    return res.status(500).json({ error: 'Failed to check AI quota.' });
  }
};
