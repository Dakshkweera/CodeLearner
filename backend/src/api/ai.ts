import { Router } from 'express';
import { askFileQuestion } from '../controllers/aiController';

const router = Router();

// POST /api/ai/file-chat
router.post('/file-chat', askFileQuestion);

export default router;
