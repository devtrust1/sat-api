import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import * as chatController from './chat.controller';

const router = Router();

/**
 * POST /api/chat
 * Send message to AI chatbot
 * @access Authenticated users
 */
router.post('/', authenticate, authorize(), chatController.sendMessage);

/**
 * POST /api/chat/stream
 * Stream message response from AI chatbot with SSE
 * @access Authenticated users
 */
router.post('/stream', authenticate, authorize(), chatController.streamMessage);

export default router;
