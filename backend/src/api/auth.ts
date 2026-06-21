import { Router } from 'express';
import { signup, login } from '../controllers/authController';
import { authenticateUser } from '../middleware/authMiddleware';

const router = Router();

router.post('/signup', signup);
router.post('/login', login);

// Get current user from token
router.get('/me', authenticateUser, (req, res) => {
  const user = (req as any).user;
  return res.json({ user });
});

export default router;
