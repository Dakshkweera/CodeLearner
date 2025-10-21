import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    name: process.env.DB_NAME || 'codelearner',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
  },
  
  repo: {
    tempPath: process.env.TEMP_REPO_PATH || './temp/repos',
  },
  
  ai: {
    perplexityApiKey: process.env.PERPLEXITY_API_KEY || '',
  },
};
