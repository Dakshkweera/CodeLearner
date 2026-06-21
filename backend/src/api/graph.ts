import { Router } from 'express';
import { getGraph } from '../controllers/graphController';
import { authenticateUser } from '../middleware/authMiddleware';

const router = Router();

// GET /api/graph?owner=octocat&name=Hello-World
router.get('/', authenticateUser, getGraph);

export default router;
