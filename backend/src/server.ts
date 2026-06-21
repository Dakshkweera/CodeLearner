import app from './app';
import { config } from './config';
import dbService from './services/dbService';

// Validate required env vars before starting
const REQUIRED_ENV = [
  'DATABASE_URL',
  'JWT_SECRET',
  'GROQ_API_KEY',
  'COHERE_API_KEY',
];

const missing = REQUIRED_ENV.filter(key => !process.env[key]);
if (missing.length > 0) {
  console.error('❌ Missing required environment variables:', missing.join(', '));
  console.error('   Check your .env file and add the missing values.');
  process.exit(1);
}

const PORT = config.port;

const server = app.listen(PORT, async() => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📝 Environment: ${config.nodeEnv}`);
  console.log(`✅ Health check: http://localhost:${PORT}/health`);

  // ✅ Test database connection
  console.log('\n🔌 Testing database connection...');
  await dbService.testConnection();
});

// Handle server errors
server.on('error', (error: any) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
  } else {
    console.error('❌ Server error:', error);
  }
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});
