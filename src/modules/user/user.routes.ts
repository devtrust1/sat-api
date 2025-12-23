import { Router } from 'express';
import express from 'express';
import { UserRole } from '@prisma/client';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import * as userController from './user.controller';
import memoryRoutes from '../memory/memory.routes';
import { memoryController } from '../memory/memory.controller';
import bookmarkRoutes from '../bookmark/bookmark.routes';

const router = Router();

/**
 * POST /api/users/webhook
 * Clerk webhook - with signature verification
 * @access Public (with webhook verification)
 */
router.post('/webhook', express.raw({ type: 'application/json' }), userController.handleWebhook);

/**
 * GET /api/users/me
 * Get current user
 * @access Authenticated users
 */
router.get('/me', authenticate, authorize(), userController.getCurrentUser);

/**
 * PUT /api/users/me
 * Update current user profile
 * @access Authenticated users
 */
router.put('/me', authenticate, authorize(), userController.updateCurrentUser);

/**
 * DELETE /api/users/me
 * Delete current user account
 * @access Authenticated users
 */
router.delete('/me', authenticate, authorize(), userController.deleteCurrentUser);

/**
 * GET /api/users/me/activity
 * Get user activity
 * @access Authenticated users
 */
router.get('/me/activity', authenticate, authorize(), userController.getUserActivity);

/**
 * GET /api/users/me/preferences
 * Get user preferences
 * @access Authenticated users
 */
router.get('/me/preferences', authenticate, authorize(), userController.getUserPreferences);

/**
 * PUT /api/users/me/preferences
 * Update user preferences
 * @access Authenticated users
 */
router.put('/me/preferences', authenticate, authorize(), userController.updateUserPreferences);

/**
 * GET /api/users/me/user-settings
 * Get user personal settings
 * @access Authenticated users
 */
router.get('/me/user-settings', authenticate, authorize(), userController.getUserSettings);

/**
 * PATCH /api/users/me/user-settings
 * Update user personal settings
 * @access Authenticated users
 */
router.patch('/me/user-settings', authenticate, authorize(), userController.updateUserSettings);

/**
 * GET /api/users/me/stats
 * Get user personal statistics
 * @access Authenticated users
 */
router.get('/me/stats', authenticate, authorize(), userController.getUserPersonalStats);

/**
 * GET /api/users/me/progress
 * Get user progress records
 * @access Authenticated users
 */
router.get('/me/progress', authenticate, authorize(), userController.getUserProgress);

/**
 * GET /api/users/me/progress/summary
 * Get user progress summary
 * @access Authenticated users
 */
router.get(
  '/me/progress/summary',
  authenticate,
  authorize(),
  userController.getUserProgressSummary
);

/**
 * GET /api/users/me/progress/:subject
 * Get user progress by subject
 * @access Authenticated users
 */
router.get(
  '/me/progress/:subject',
  authenticate,
  authorize(),
  userController.getUserProgressBySubject
);

/**
 * POST /api/users/me/progress
 * Create user progress record
 * @access Authenticated users
 */
router.post('/me/progress', authenticate, authorize(), userController.createUserProgress);

/**
 * GET /api/users/me/sessions
 * Get user sessions
 * @access Authenticated users
 */
router.get('/me/sessions', authenticate, authorize(), userController.getUserSessions);

/**
 * GET /api/users/me/sessions/active
 * Get active session for user
 * @access Authenticated users
 */
router.get('/me/sessions/active', authenticate, authorize(), userController.getActiveSession);

/**
 * GET /api/users/me/sessions/incomplete
 * Get incomplete sessions with lastPoint
 * @access Authenticated users
 */
router.get(
  '/me/sessions/incomplete',
  authenticate,
  authorize(),
  userController.getIncompleteSessions
);

/**
 * GET /api/users/me/sessions/complete
 * Get complete sessions (respecting data retention)
 * @access Authenticated users
 */
router.get('/me/sessions/complete', authenticate, authorize(), userController.getCompleteSessions);

router.post(
  '/me/sessions/:sessionId/rename-session',
  authenticate,
  authorize(),
  userController.renameSession
);

/**
 * GET /api/users/me/sessions/counts
 * Get session counts (complete and incomplete)
 * @access Authenticated users
 */
router.get('/me/sessions/counts', authenticate, authorize(), userController.getSessionCounts);

/**
 * POST /api/users/me/sessions
 * Create new session
 * @access Authenticated users
 */
router.post('/me/sessions', authenticate, authorize(), userController.createSession);

/**
 * GET /api/users/me/sessions/:sessionId
 * Get session by ID
 * @access Authenticated users
 */
router.get('/me/sessions/:sessionId', authenticate, authorize(), userController.getSessionById);

/**
 * PATCH /api/users/me/sessions/:sessionId
 * Update session
 * @access Authenticated users
 */
router.patch('/me/sessions/:sessionId', authenticate, authorize(), userController.updateSession);

/**
 * POST /api/users/me/sessions/:sessionId/resume
 * Resume a session
 * @access Authenticated users
 */
router.post(
  '/me/sessions/:sessionId/resume',
  authenticate,
  authorize(),
  userController.resumeSession
);

/**
 * PATCH /api/users/me/sessions/:sessionId/modes
 * Update session audio/text modes
 * @access Authenticated users
 */
router.patch(
  '/me/sessions/:sessionId/modes',
  authenticate,
  authorize(),
  userController.updateSessionModes
);

/**
 * DELETE /api/users/me/sessions/:sessionId
 * Delete session (for empty sessions)
 * @access Authenticated users
 */
router.delete('/me/sessions/:sessionId', authenticate, authorize(), userController.deleteSession);

/**
 * POST /api/users/me/sessions/:sessionId/photo
 * Log photo upload (Say Cheese)
 * @access Authenticated users
 */
router.post(
  '/me/sessions/:sessionId/photo',
  authenticate,
  authorize(),
  userController.logPhotoUpload
);

/**
 * POST /api/users/me/sessions/:sessionId/whiteboard
 * Log whiteboard submission
 * @access Authenticated users
 */
router.post(
  '/me/sessions/:sessionId/whiteboard',
  authenticate,
  authorize(),
  userController.logWhiteboardSubmission
);

/**
 * POST /api/users/me/sessions/:sessionId/whiteboard/analyze/stream
 * Stream whiteboard analysis with SSE
 * @access Authenticated users
 */
router.post(
  '/me/sessions/:sessionId/whiteboard/analyze/stream',
  authenticate,
  authorize(),
  userController.streamWhiteboardAnalysis
);

/**
 * POST /api/users/me/sessions/:sessionId/whiteboard/analyze
 * Analyze whiteboard content with AI
 * @access Authenticated users
 */
router.post(
  '/me/sessions/:sessionId/whiteboard/analyze',
  authenticate,
  authorize(),
  userController.analyzeWhiteboard
);

/**
 * POST /api/users/me/sessions/:sessionId/ai-interaction
 * Log AI interaction
 * @access Authenticated users
 */
router.post(
  '/me/sessions/:sessionId/ai-interaction',
  authenticate,
  authorize(),
  userController.logAIInteraction
);

/**
 * POST /api/users/me/sessions/:sessionId/spreading-joy
 * Log spreading joy action
 * @access Authenticated users
 */
router.post(
  '/me/sessions/:sessionId/spreading-joy',
  authenticate,
  authorize(),
  userController.logSpreadingJoy
);

/**
 * POST /api/users/me/sessions/:sessionId/recalculate-metrics
 * Manually recalculate metrics for a session (spreading joy, say cheese)
 * @access Authenticated users
 */
router.post(
  '/me/sessions/:sessionId/recalculate-metrics',
  authenticate,
  authorize(),
  userController.recalculateSessionMetrics
);

/**
 * GET /api/users/me/metrics
 * Get progress metrics (streak, spreading joy, say cheese, star progress)
 * @access Authenticated users
 */
router.get('/me/metrics', authenticate, authorize(), userController.getProgressMetrics);

/**
 * GET /api/users/me/metrics/star-progress
 * Get star progress percentage
 * @access Authenticated users
 */
router.get('/me/metrics/star-progress', authenticate, authorize(), userController.getStarProgress);

/**
 * DELETE /api/users/me/ai-data
 * Clear all AI companions and interaction data
 * @access Authenticated users
 */
router.delete('/me/ai-data', authenticate, authorize(), userController.clearAIData);

/**
 * GET /api/users/me/learning-profile
 * Get user learning profile for AI personalization
 * @access Authenticated users
 */
router.get(
  '/me/learning-profile',
  authenticate,
  authorize(),
  memoryController.getLearningProfile.bind(memoryController)
);

/**
 * Memory Routes
 * Mount all memory-related routes under /api/users/me/memories
 * @access Authenticated users
 */
router.use('/me/memories', memoryRoutes);

/**
 * Bookmark Routes
 * Mount all bookmark-related routes under /api/users/me/bookmarks
 * @access Authenticated users
 */
router.use('/me/bookmarks', bookmarkRoutes);

/**
 * GET /api/users
 * Get all users (Admin only)
 * @access Admin
 */
router.get('/', authenticate, authorize(UserRole.ADMIN), userController.getAllUsers);

/**
 * GET /api/users/search
 * Search users (Admin only)
 * @access Admin
 */
router.get('/search', authenticate, authorize(UserRole.ADMIN), userController.searchUsers);

/**
 * GET /api/users/settings
 * Get admin settings (read-only for all authenticated users)
 * @access Authenticated users
 */
router.get('/settings', authenticate, authorize(), userController.getAdminSettings);

/**
 * GET /api/users/stats
 * Get user stats (Admin only)
 * @access Admin
 */
router.get('/stats', authenticate, authorize(UserRole.ADMIN), userController.getUserStats);

/**
 * PATCH /api/users/:userId/role
 * Update user role (Admin only)
 * @access Admin
 */
router.patch(
  '/:userId/role',
  authenticate,
  authorize(UserRole.ADMIN),
  userController.updateUserRole
);

/**
 * GET /api/users/:userId
 * Get user by ID (Admin only)
 * @access Admin
 */
router.get('/:userId', authenticate, authorize(UserRole.ADMIN), userController.getUserById);

export default router;
