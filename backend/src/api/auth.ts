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


// import { Router } from 'express';
// import rateLimit from 'express-rate-limit';
// import { signup, verifyEmail, login } from '../controllers/authController';
// import { authenticateUser } from '../middleware/authMiddleware';

// const router = Router();

// // Rate limiter: max 5 signups per IP per hour
// const signupLimiter = rateLimit({
//   windowMs: 60 * 60 * 1000, // 1 hour
//   max: 5, // max 5 requests per hour
//   message: { error: 'Too many signup attempts. Please try again later.' },
//   standardHeaders: true,
//   legacyHeaders: false,
// });

// // Apply rate limiter only to signup
// router.post('/signup', signupLimiter, signup);
// router.post('/verify-email', verifyEmail);
// router.post('/login', login);

// router.get('/me', authenticateUser, (req, res) => {
//   const user = (req as any).user;
//   return res.json(user);
// });

// export default router;
