import { Router } from 'express';
import {
  processRepository,
  processRepositoryLocal,
  askQuestion,
  getDemoRepositories,
  askQuestionPreembedded,
} from '../controllers/ragController';

const router = Router();

// Cohere (online) processing
router.post('/process', processRepository);

// Local (open‑source) processing – no Cohere
router.post('/process-local', processRepositoryLocal);

// Ask + demo repos
router.post('/ask', askQuestion);
router.get('/demo-repos', getDemoRepositories);
router.post('/ask-preembedded', askQuestionPreembedded);

export default router;

