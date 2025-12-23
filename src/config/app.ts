export const appConfig = {
  port: parseInt(process.env.PORT || '5000'),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'https://sat-ui.devtrust.biz',

  // Session settings
  session: {
    timeoutMinutes: parseInt(process.env.SESSION_TIMEOUT_MINUTES || '30'),
    maxConcurrentSessions: parseInt(process.env.MAX_CONCURRENT_SESSIONS || '5'),
  },

  // Rate limiting (increased for development and normal usage)
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // 1000 requests per 15 minutes (much more generous)
  },

  // Pagination
  pagination: {
    defaultLimit: 20,
    maxLimit: 100,
  },

  // AI Service
  ai: {
    provider: process.env.AI_PROVIDER || 'openai',
    apiKey: process.env.AI_API_KEY || '',
    model: process.env.AI_MODEL || 'gpt-4o',
    apiUrl: process.env.AI_API_URL || 'https://api.openai.com/v1/chat/completions',
  },

  // Whiteboard
  whiteboard: {
    maxCanvasSize: 5000,
    maxSteps: 100,
  },

  // Clerk
  clerk: {
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY || '',
    secretKey: process.env.CLERK_SECRET_KEY || '',
  },
};
