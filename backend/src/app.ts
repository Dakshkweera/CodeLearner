import express, { Application } from 'express';
import repoRoutes from './api/repo';
import cors from 'cors';
import fileRoutes from './api/file';
import parseRoutes from './api/parse';
import graphRoutes from './api/graph';
import ragRoutes from './api/rag';
import aiRoutes from './api/ai';
import authRoutes from './api/auth';

const app: Application = express();

// CORS configuration
const allowedOrigins = ['http://localhost:5173'];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Postman, etc.)
      if (!origin) return callback(null, true);

      const isLocal = allowedOrigins.includes(origin);

      // Allow any Vercel deployment whose host contains "code-learner"
      const isVercel =
        origin.startsWith('https://') &&
        origin.endsWith('.vercel.app') &&
        origin.includes('code-learner');

      if (isLocal || isVercel) {
        return callback(null, true);
      }

      console.log('❌ CORS blocked origin:', origin);
      return callback(new Error('Not allowed by CORS'));
    },
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server is running' });
});
console.log('Health check route configured at /health');

// API routes
app.use('/api/repo', repoRoutes);
console.log('Repo routes configured at /api/repo');

app.use('/api/file', fileRoutes);
app.use('/api/parse', parseRoutes);
app.use('/api/graph', graphRoutes);
app.use('/api/rag', ragRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/auth', authRoutes);

export default app;
