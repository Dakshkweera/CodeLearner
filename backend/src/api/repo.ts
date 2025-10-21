import { Router } from 'express';
import { testCloneRepo } from '../controllers/repoController';

const router = Router();

console.log('Setting up /clone route...');
router.post('/clone', testCloneRepo);

export default router;
