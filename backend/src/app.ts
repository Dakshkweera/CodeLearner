import express, { Application } from 'express';
import repoRoutes from './api/repo';
import cors from 'cors';
import fileRoutes from './api/file';
import parseRoutes from './api/parse';
import graphRoutes from './api/graph';

const app: Application = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server is running' });
});
console.log('Health check route configured at /health');
// Test routes
app.use('/api/repo', repoRoutes);
console.log('Repo routes configured at /api/repo');

app.use('/api/file', fileRoutes);
app.use('/api/parse', parseRoutes);
app.use('/api/graph', graphRoutes);

export default app;
