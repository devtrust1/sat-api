import { Router } from 'express';
import usersRoutes from './users.routes';
import adminRoutes from './admin.routes';
import chatRoutes from '../modules/chat/chat.routes';

const router = Router();

// API root
router.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'SAT API',
    endpoints: {
      health: '/api/health',
      users: '/api/users',
      admin: '/api/admin',
      chat: '/api/chat',
    },
  });
});

// Health check
router.get('/health', (_req, res) => {
  res.json({
    success: true,
    message: 'SAT API is running',
    timestamp: new Date().toISOString(),
  });
});

// Mount routes
router.use('/users', usersRoutes);
router.use('/admin', adminRoutes);
router.use('/chat', chatRoutes);

export default router;
