import { Router } from 'express';
import adminRoutes from './admin/admin.routes';
import userRoutes from './user/user.routes';
import chatRoutes from './chat/chat.routes';
import uploadRoutes from './upload/upload.routes';

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
      upload: '/api/upload',
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

// Mount module routes
router.use('/admin', adminRoutes);
router.use('/users', userRoutes);
router.use('/chat', chatRoutes);
router.use('/upload', uploadRoutes);

export default router;
