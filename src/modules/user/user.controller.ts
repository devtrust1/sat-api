import { Response } from 'express';
import { Webhook } from 'svix';
import { userService } from './user.service';
import { AuthRequest } from './user.types';
import logger from '../../utils/logger';
import adminService from '../admin/admin.service';

/**
 * POST /api/users/webhook
 * Clerk webhook handler - with signature verification
 * @access Public (with webhook verification)
 */
export const handleWebhook = async (req: AuthRequest, res: Response) => {
  const startTime = Date.now();

  try {
    const svix_id = req.headers['svix-id'] as string;
    const svix_timestamp = req.headers['svix-timestamp'] as string;
    const svix_signature = req.headers['svix-signature'] as string;

    // Verify webhook signature if secret is configured
    if (process.env.CLERK_WEBHOOK_SECRET) {
      if (!svix_id || !svix_timestamp || !svix_signature) {
        logger.warn('Missing Svix headers for webhook verification');
        return res.status(400).json({
          success: false,
          message: 'Missing webhook signature headers',
        });
      }

      try {
        const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET);

        // Ensure body is correct type for verification
        let bodyForVerification = req.body;
        if (typeof req.body === 'object' && req.body !== null && !Buffer.isBuffer(req.body)) {
          bodyForVerification = JSON.stringify(req.body);
        }

        wh.verify(bodyForVerification, {
          'svix-id': svix_id,
          'svix-timestamp': svix_timestamp,
          'svix-signature': svix_signature,
        });

        logger.info('Webhook signature verified successfully');
      } catch (err: any) {
        logger.error('Webhook signature verification failed:', err.message);
        return res.status(400).json({
          success: false,
          message: 'Webhook signature verification failed',
          error: err.message,
        });
      }
    } else {
      logger.warn('CLERK_WEBHOOK_SECRET not configured - webhook running without verification');
    }

    // Parse the body for processing
    let parsedBody;
    if (Buffer.isBuffer(req.body)) {
      parsedBody = JSON.parse(req.body.toString());
    } else if (typeof req.body === 'string') {
      parsedBody = JSON.parse(req.body);
    } else if (typeof req.body === 'object') {
      parsedBody = req.body;
    } else {
      throw new Error('Unexpected body type: ' + typeof req.body);
    }

    const { type, data } = parsedBody;
    logger.info(`Processing webhook event: ${type}`);

    // Handle user events
    if (type === 'user.created' || type === 'user.updated') {
      try {
        const user = await userService.syncUser(data);
        const processingTime = Date.now() - startTime;

        logger.info(`User synced successfully in ${processingTime}ms:`, {
          userId: user.id,
          email: user.email,
          clerkId: user.clerkId,
        });

        return res.json({
          success: true,
          message: `User ${type.split('.')[1]} successfully`,
          userId: user.id,
          processingTime,
        });
      } catch (syncError: any) {
        logger.error('User sync failed:', syncError.message);
        return res.status(500).json({
          success: false,
          message: 'Failed to sync user to database',
          error: syncError.message,
          clerkId: data?.id,
        });
      }
    }

    // Handle user deletion
    if (type === 'user.deleted' && data.id) {
      try {
        await userService.delete(data.id);
        logger.info(`User deleted successfully: ${data.id}`);
        return res.json({ success: true, message: 'User deleted' });
      } catch (deleteError: any) {
        logger.error('User deletion failed:', deleteError.message);
        return res.status(500).json({
          success: false,
          message: 'Failed to delete user',
          error: deleteError.message,
        });
      }
    }

    // Handle session events
    if (type === 'session.created') {
      try {
        await userService.updateLastLogin(data.user_id);
        logger.info(`Session created and last login updated for user: ${data.user_id}`);
        return res.json({ success: true, message: 'Session created logged' });
      } catch (sessionError: any) {
        logger.error('Session processing failed:', sessionError.message);
        return res.json({ success: true, message: 'Session event received' });
      }
    }

    if (type === 'session.ended' || type === 'session.revoked') {
      logger.info(`Session ${type} for user: ${data.user_id}`);
      return res.json({ success: true, message: `Session ${type} processed` });
    }

    // Log unhandled events but return success to avoid retries
    logger.info(`Unhandled webhook event type: ${type}`);
    return res.json({
      success: true,
      message: 'Event received but not processed',
      eventType: type,
    });
  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    logger.error(`Webhook processing error after ${processingTime}ms:`, error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error processing webhook',
      error: error.message,
      processingTime,
    });
  }
};

/**
 * GET /api/users/me
 * Get current user
 * @access Authenticated users
 */
export const getCurrentUser = async (req: AuthRequest, res: Response) => {
  try {
    const userSettings = await userService.getUserSettings(req.user!.id);
    return res.json({
      success: true,
      data: {
        ...req.user,
        settings: userSettings,
      },
    });
  } catch (error: any) {
    logger.error('Error getting current user:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /api/users/me
 * Update current user profile
 * @access Authenticated users
 */
export const updateCurrentUser = async (req: AuthRequest, res: Response) => {
  try {
    const { firstName, lastName, preferredLang } = req.body;
    const user = await userService.update(req.user!.id, { firstName, lastName, preferredLang });
    return res.json({ success: true, data: user });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/users/me
 * Delete current user account
 * @access Authenticated users
 */
export const deleteCurrentUser = async (req: AuthRequest, res: Response) => {
  try {
    await userService.delete(req.user!.clerkId);
    return res.json({ success: true, message: 'Account deleted' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/users/me/activity
 * Get user activity
 * @access Authenticated users
 */
export const getUserActivity = async (req: AuthRequest, res: Response) => {
  try {
    const activity = await userService.getActivity(req.user!.id);
    return res.json({ success: true, data: activity });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/users/me/preferences
 * Get user preferences
 * @access Authenticated users
 */
export const getUserPreferences = async (req: AuthRequest, res: Response) => {
  try {
    const preferences = await userService.getPreferences(req.user!.id);
    return res.json({ success: true, data: preferences });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /api/users/me/preferences
 * Update user preferences
 * @access Authenticated users
 */
export const updateUserPreferences = async (req: AuthRequest, res: Response) => {
  try {
    const preferences = await userService.updatePreferences(req.user!.id, req.body);
    return res.json({ success: true, data: preferences });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/users
 * Get all users (Admin only)
 * @access Admin
 */
export const getAllUsers = async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await userService.getAll(page, limit);
    return res.json({ success: true, data: result });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/users/search
 * Search users (Admin only)
 * @access Admin
 */
export const searchUsers = async (req: AuthRequest, res: Response) => {
  try {
    const query = req.query.q as string;
    if (!query) {
      return res.status(400).json({ success: false, message: 'Search query required' });
    }
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await userService.search(query, page, limit);
    return res.json({ success: true, data: result });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/users/stats
 * Get user stats (Admin only)
 * @access Admin
 */
export const getUserStats = async (req: AuthRequest, res: Response) => {
  try {
    const stats = await userService.getStats();
    return res.json({ success: true, data: stats });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PATCH /api/users/:userId/role
 * Update user role (Admin only)
 * @access Admin
 */
export const updateUserRole = async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    const user = await userService.updateRole(userId, role);
    return res.json({ success: true, data: user });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/users/:userId
 * Get user by ID (Admin only)
 * @access Admin
 */
export const getUserById = async (req: AuthRequest, res: Response) => {
  try {
    const user = await userService.getById(req.params.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.json({ success: true, data: user });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/users/settings
 * Get admin settings (read-only for all authenticated users)
 * This allows users to see the global settings applied by admin
 * @access Authenticated users
 */
export const getAdminSettings = async (req: AuthRequest, res: Response) => {
  try {
    const settings = await adminService.getSettings();

    res.json({
      success: true,
      message: 'Settings retrieved successfully',
      data: settings,
    });
  } catch (error: any) {
    logger.error('Error fetching settings for user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch settings',
      error: error.message,
    });
  }
};

/**
 * GET /api/users/me/user-settings
 * Get user personal settings
 * @access Authenticated users
 */
export const getUserSettings = async (req: AuthRequest, res: Response) => {
  try {
    const settings = await userService.getUserSettings(req.user!.id);
    return res.json({ success: true, data: settings });
  } catch (error: any) {
    logger.error('Error fetching user settings:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PATCH /api/users/me/user-settings
 * Update user personal settings
 * @access Authenticated users
 */
export const updateUserSettings = async (req: AuthRequest, res: Response) => {
  try {
    const settings = await userService.updateUserSettings(req.user!.id, req.body);
    return res.json({ success: true, data: settings });
  } catch (error: any) {
    logger.error('Error updating user settings:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/users/me/stats
 * Get user personal statistics
 * @access Authenticated users
 */
export const getUserPersonalStats = async (req: AuthRequest, res: Response) => {
  try {
    const stats = await userService.getUserPersonalStats(req.user!.id);
    return res.json({ success: true, data: stats });
  } catch (error: any) {
    logger.error('Error fetching user stats:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/users/me/progress
 * Get user progress records
 * @access Authenticated users
 */
export const getUserProgress = async (req: AuthRequest, res: Response) => {
  try {
    const progress = await userService.getProgress(req.user!.id);
    return res.json({ success: true, data: progress });
  } catch (error: any) {
    logger.error('Error fetching user progress:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/users/me/progress/summary
 * Get user progress summary
 * @access Authenticated users
 */
export const getUserProgressSummary = async (req: AuthRequest, res: Response) => {
  try {
    const summary = await userService.getProgressSummary(req.user!.id);
    return res.json({ success: true, data: summary });
  } catch (error: any) {
    logger.error('Error fetching progress summary:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/users/me/progress/:subject
 * Get user progress by subject
 * @access Authenticated users
 */
export const getUserProgressBySubject = async (req: AuthRequest, res: Response) => {
  try {
    const { subject } = req.params;
    const progress = await userService.getProgressBySubject(req.user!.id, subject);
    return res.json({ success: true, data: progress });
  } catch (error: any) {
    logger.error('Error fetching progress by subject:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/users/me/progress
 * Create user progress record
 * @access Authenticated users
 */
export const createUserProgress = async (req: AuthRequest, res: Response) => {
  try {
    const progress = await userService.createProgress(req.user!.id, req.body);
    return res.json({ success: true, data: progress });
  } catch (error: any) {
    logger.error('Error creating progress:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/users/me/sessions
 * Get user sessions
 * @access Authenticated users
 */
export const getUserSessions = async (req: AuthRequest, res: Response) => {
  try {
    const sessions = await userService.getUserSessions(req.user!.id);
    return res.json({ success: true, data: sessions });
  } catch (error: any) {
    logger.error('Error fetching sessions:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/users/me/sessions/active
 * Get active session for user
 * @access Authenticated users
 */
export const getActiveSession = async (req: AuthRequest, res: Response) => {
  try {
    const session = await userService.getActiveSession(req.user!.id);
    return res.json({ success: true, data: session });
  } catch (error: any) {
    logger.error('Error fetching active session:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/users/me/sessions/incomplete
 * Get incomplete sessions with lastPoint
 * @access Authenticated users
 */
export const getIncompleteSessions = async (req: AuthRequest, res: Response) => {
  try {
    const sessions = await userService.getIncompleteSessions(req.user!.id);
    return res.json({ success: true, data: sessions });
  } catch (error: any) {
    logger.error('Error fetching incomplete sessions:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/users/me/sessions/complete
 * Get complete sessions (respecting data retention)
 * @access Authenticated users
 */
export const getCompleteSessions = async (req: AuthRequest, res: Response) => {
  try {
    const sessions = await userService.getCompleteSessions(req.user!.id);
    return res.json({ success: true, data: sessions });
  } catch (error: any) {
    logger.error('Error fetching complete sessions:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const renameSession = async (req: AuthRequest, res: Response) => {
  try {
    const sessions = await userService.renameSession(req.params.sessionId, req.body.title);
    return res.json({ success: true, data: sessions });
  } catch (error: any) {
    logger.error('Error fetching complete sessions:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/users/me/sessions/counts
 * Get session counts (complete and incomplete)
 * @access Authenticated users
 */
export const getSessionCounts = async (req: AuthRequest, res: Response) => {
  try {
    const counts = await userService.getSessionCounts(req.user!.id);
    return res.json({ success: true, data: counts });
  } catch (error: any) {
    logger.error('Error fetching session counts:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/users/me/sessions/:sessionId/resume
 * Resume a session
 * @access Authenticated users
 */
export const resumeSession = async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId } = req.params;
    const session = await userService.resumeSession(sessionId, req.user!.id);
    return res.json({ success: true, data: session });
  } catch (error: any) {
    logger.error('Error resuming session:', error);
    if (error.message === 'Session not found or unauthorized') {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.message === 'Cannot resume a completed session') {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/users/me/sessions
 * Create new session
 * @access Authenticated users
 */
export const createSession = async (req: AuthRequest, res: Response) => {
  try {
    const session = await userService.createSession(req.user!.id, req.body);
    return res.json({ success: true, data: session });
  } catch (error: any) {
    logger.error('Error creating session:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/users/me/sessions/:sessionId
 * Get session by ID
 * @access Authenticated users
 */
export const getSessionById = async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId } = req.params;
    const session = await userService.getSession(sessionId);

    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    // Verify session belongs to user
    if (session.userId !== req.user!.id) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    return res.json({ success: true, data: session });
  } catch (error: any) {
    logger.error('Error fetching session:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PATCH /api/users/me/sessions/:sessionId
 * Update session
 * @access Authenticated users
 */
export const updateSession = async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId } = req.params;
    const session = await userService.getSession(sessionId);

    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    // Verify session belongs to user
    if (session.userId !== req.user!.id) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const updated = await userService.updateSession(sessionId, req.body);
    return res.json({ success: true, data: updated });
  } catch (error: any) {
    logger.error('Error updating session:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/users/me/sessions/:sessionId
 * Delete session (for empty sessions)
 * @access Authenticated users
 */
export const deleteSession = async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId } = req.params;
    const session = await userService.getSession(sessionId);

    if (!session) {
      // Session already deleted or doesn't exist - return success
      return res.json({ success: true, message: 'Session already deleted' });
    }

    // Verify session belongs to user
    if (session.userId !== req.user!.id) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const result = await userService.deleteSession(sessionId);

    // If result is null, session was already deleted (race condition)
    if (result === null) {
      return res.json({ success: true, message: 'Session already deleted' });
    }

    return res.json({ success: true, message: 'Session deleted successfully' });
  } catch (error: any) {
    logger.error('Error deleting session:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PATCH /api/users/me/sessions/:sessionId/modes
 * Update session audio/text modes
 * @access Authenticated users
 */
export const updateSessionModes = async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { audioModeEnabled, textModeEnabled } = req.body;

    const session = await userService.updateSessionModes(
      sessionId,
      audioModeEnabled,
      textModeEnabled
    );
    return res.json({ success: true, data: session });
  } catch (error: any) {
    logger.error('Error updating session modes:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/users/me/sessions/:sessionId/photo
 * Log photo upload in session
 * @access Authenticated users
 */
export const logPhotoUpload = async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId } = req.params;
    const session = await userService.incrementPhotoUpload(sessionId);
    return res.json({ success: true, data: session });
  } catch (error: any) {
    logger.error('Error logging photo upload:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/users/me/sessions/:sessionId/whiteboard
 * Log whiteboard submission in session
 * @access Authenticated users
 */
export const logWhiteboardSubmission = async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId } = req.params;
    const session = await userService.incrementWhiteboardSubmission(sessionId);
    return res.json({ success: true, data: session });
  } catch (error: any) {
    logger.error('Error logging whiteboard submission:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/users/me/sessions/:sessionId/whiteboard/analyze
 * Analyze whiteboard content with AI
 * @access Authenticated users
 */
export const analyzeWhiteboard = async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { canvasData, textContent } = req.body;

    if (!canvasData && !textContent) {
      return res.status(400).json({
        success: false,
        message: 'Either canvasData or textContent is required',
      });
    }

    // Analyze the whiteboard content with AI
    const analysis = await userService.analyzeWhiteboardWithAI(sessionId, canvasData, textContent);

    return res.json({ success: true, data: analysis });
  } catch (error: any) {
    logger.error('Error analyzing whiteboard:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/users/me/sessions/:sessionId/whiteboard/analyze/stream
 * Stream whiteboard analysis with SSE
 * @access Authenticated users
 */
export const streamWhiteboardAnalysis = async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { canvasData, textContent } = req.body;

    if (!canvasData && !textContent) {
      return res.status(400).json({
        success: false,
        message: 'Either canvasData or textContent is required',
      });
    }

    const { openAIService } = await import('../../services/openai.service');
    const { default: prisma } = await import('../../config/database');

    // Get session to find userId
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { userId: true },
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found',
      });
    }

    // Get user's preferred language
    const userSettings = await prisma.userSettings.findUnique({
      where: { userId: session.userId },
      select: { language: true },
    });

    const userLanguage = userSettings?.language || 'en';

    logger.info('Streaming whiteboard analysis:', {
      sessionId,
      hasCanvasData: !!canvasData,
      hasTextContent: !!textContent,
      language: userLanguage,
    });

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Flush headers immediately to establish SSE connection
    res.flushHeaders();

    // Stream analysis
    try {
      for await (const chunk of openAIService.streamWhiteboardAnalysis(
        canvasData,
        textContent,
        userLanguage
      )) {
        res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
      }

      // Increment counters after successful streaming
      await prisma.session.update({
        where: { id: sessionId },
        data: {
          whiteboardSubmissions: { increment: 1 },
          aiInteractions: { increment: 1 },
        },
      });

      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error: any) {
      logger.error('Error streaming whiteboard analysis:', error);
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  } catch (error: any) {
    logger.error('Error processing streaming whiteboard analysis:', error);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: 'Failed to stream whiteboard analysis',
        error: error.message,
      });
    }
  }
};

/**
 * POST /api/users/me/sessions/:sessionId/ai-interaction
 * Log AI interaction in session
 * @access Authenticated users
 */
export const logAIInteraction = async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId } = req.params;
    const session = await userService.incrementAIInteraction(sessionId);
    return res.json({ success: true, data: session });
  } catch (error: any) {
    logger.error('Error logging AI interaction:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/users/me/sessions/:sessionId/spreading-joy
 * Log spreading joy action in session
 * @access Authenticated users
 */
export const logSpreadingJoy = async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId } = req.params;
    const session = await userService.incrementSpreadingJoy(sessionId);
    return res.json({ success: true, data: session });
  } catch (error: any) {
    logger.error('Error logging spreading joy:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/users/me/metrics
 * Get user progress metrics (streak, say cheese, spreading joy, star)
 * @access Authenticated users
 */
export const getProgressMetrics = async (req: AuthRequest, res: Response) => {
  try {
    const metrics = await userService.getProgressMetrics(req.user!.id);
    return res.json({ success: true, data: metrics });
  } catch (error: any) {
    logger.error('Error fetching progress metrics:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/users/me/metrics/star-progress
 * Get and calculate star progress
 * @access Authenticated users
 */
export const getStarProgress = async (req: AuthRequest, res: Response) => {
  try {
    const progress = await userService.calculateStarProgress(req.user!.id);
    return res.json({ success: true, data: { starProgress: progress } });
  } catch (error: any) {
    logger.error('Error fetching star progress:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/users/me/ai-data
 * Clear all AI companions and interaction data
 * @access Authenticated users
 */
export const clearAIData = async (req: AuthRequest, res: Response) => {
  try {
    const result = await userService.clearAIData(req.user!.id);
    return res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error('Error clearing AI data:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/users/me/sessions/:sessionId/recalculate-metrics
 * Manually recalculate metrics for a session
 * This will analyze messages for spreading joy and count photo uploads
 * @access Authenticated users
 */
export const recalculateSessionMetrics = async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId } = req.params;

    // Verify session belongs to user
    const session = await userService.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    if (session.userId !== req.user!.id) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    // Recalculate metrics
    const updated = await userService.recalculateSessionMetrics(sessionId);

    if (!updated) {
      return res.status(400).json({
        success: false,
        message: 'Could not recalculate metrics. Session may have no messages.',
      });
    }

    logger.info(`Metrics recalculated for session ${sessionId} by user ${req.user!.id}`);
    return res.json({
      success: true,
      data: updated,
      message: 'Metrics recalculated successfully',
    });
  } catch (error: any) {
    logger.error('Error recalculating session metrics:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
