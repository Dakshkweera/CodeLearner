import { Router } from 'express';
import { testParseFile } from '../controllers/parseController';

const router = Router();

// GET /api/parse/test?owner=&name=&path=
router.get('/test', testParseFile);

export default router;
