import { Router } from 'express';
import { askFileQuestion } from '../controllers/aiController';
import { authenticateUser } from '../middleware/authMiddleware';
import { checkAiQuota } from '../middleware/aiQuotaMiddleware';

const router = Router();

// Now protected: auth + quota
router.post('/file-chat', authenticateUser, checkAiQuota, askFileQuestion);

export default router;
