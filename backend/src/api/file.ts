import { Router } from 'express';
import { getFileContent } from '../controllers/fileController';

const router = Router();

// GET /api/file?owner=octocat&name=Hello-World&path=README
router.get('/', getFileContent);

export default router;
