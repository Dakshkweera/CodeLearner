// Single source of truth for all configuration
const config = {
  // Backend API base URL
  api: {
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5002',
    timeout: 30000, // 30 seconds
  },

  // Feature flags
  features: {
    aiChat: false, // Enable when RAG is ready
    authentication: false, // Enable before public launch
  },

  // UI constants
  ui: {
    maxGraphNodes: 500, // Limit for large repos
    maxFileSize: 1024 * 1024, // 1MB file warning
    defaultTheme: 'dark',
  },
} as const;

export default config;
