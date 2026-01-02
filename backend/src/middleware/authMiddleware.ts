import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-this';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
  };
}

export const authenticateUser = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization token missing.' });
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as {
        userId: string;
        email: string;
      };

      req.user = { userId: decoded.userId, email: decoded.email };
      return next();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token.' });
    }
  } catch (error: any) {
    console.error('[AUTH MIDDLEWARE] Error:', error.message);
    return res.status(500).json({ error: 'Authentication failed.' });
  }
};
