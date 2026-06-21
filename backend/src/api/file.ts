import { Router } from 'express';
import { getFileContent } from '../controllers/fileController';
import { authenticateUser } from '../middleware/authMiddleware';

const router = Router();

// GET /api/file?owner=octocat&name=Hello-World&path=README
router.get('/', authenticateUser, getFileContent);

export default router;
