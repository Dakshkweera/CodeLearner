import { Router } from 'express';
import { testCloneRepo } from '../controllers/repoController';
import { authenticateUser } from '../middleware/authMiddleware';

const router = Router();

console.log('Setting up /clone route...');
router.post('/clone', authenticateUser, testCloneRepo);

export default router;
