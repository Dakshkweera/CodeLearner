import { Router } from 'express';
import { signup, verifyEmail, login } from '../controllers/authController';
import { authenticateUser } from '../middleware/authMiddleware';

const router = Router();

router.post('/signup', signup);
router.post('/verify-email', verifyEmail);
router.post('/login', login);

// Test route: get current user from token
router.get('/me', authenticateUser, (req, res) => {
  // req.user is added by middleware
  // Type cast because Express Request doesn't know about user by default
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = (req as any).user;
  return res.json({ user });
});

export default router;
