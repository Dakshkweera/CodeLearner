import { Router } from 'express';
import { getGraph } from '../controllers/graphController';

const router = Router();

// GET /api/graph?owner=octocat&name=Hello-World
router.get('/', getGraph);

export default router;
