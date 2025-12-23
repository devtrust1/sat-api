import { Request, Response } from 'express';
import { getAuth } from '@clerk/express';
import adminService from './admin.service';
import logger from '../../utils/logger';

/**
 * GET /api/admin/check-role
 * Check current user's role (for debugging)
 * @access Public (for debugging)
 */
export const checkRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const auth = getAuth(req);

    if (!auth || !auth.userId) {
      res.json({
        success: false,
        message: 'Not authenticated',
        data: null,
      });
      return;
    }

    const publicMetadata = auth.sessionClaims?.publicMetadata as any;
    const metadata = auth.sessionClaims?.metadata as any;

    res.json({
      success: true,
      message: 'Role check',
      data: {
        userId: auth.userId,
        role: metadata?.role || publicMetadata?.role || 'No role set',
        publicMetadata: publicMetadata,
        metadata: metadata,
      },
    });
  } catch (error: any) {
    logger.error('Error checking role:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check role',
      error: error.message,
    });
  }
};

/**
 * GET /api/admin/settings
 * Get current admin settings
 * @access Admin only
 */
export const getSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const settings = await adminService.getSettings();

    res.json({
      success: true,
      message: 'Admin settings retrieved successfully',
      data: settings,
    });
  } catch (error: any) {
    logger.error('Error fetching admin settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch admin settings',
      error: error.message,
    });
  }
};

/**
 * PATCH /api/admin/settings
 * Update admin settings (partial update - BEST PRACTICE)
 * @access Admin only
 * @body Partial<AdminSettingsData>
 */
export const updateSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const auth = getAuth(req);
    const userId = auth?.userId || 'unknown';

    const updates = req.body;

    // Validate at least one field is being updated
    if (Object.keys(updates).length === 0) {
      res.status(400).json({
        success: false,
        message: 'No updates provided',
      });
      return;
    }

    const settings = await adminService.updateSettings(userId, updates);

    logger.info(`Admin settings updated by ${userId}`, { updates });

    res.json({
      success: true,
      message: 'Admin settings updated successfully',
      data: settings,
    });
  } catch (error: any) {
    logger.error('Error updating admin settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update admin settings',
      error: error.message,
    });
  }
};

/**
 * POST /api/admin/settings/reset
 * Reset settings to defaults
 * @access Admin only
 */
export const resetSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const auth = getAuth(req);
    const userId = auth?.userId || 'unknown';

    const settings = await adminService.resetToDefaults(userId);

    logger.info(`Admin settings reset to defaults by ${userId}`);

    res.json({
      success: true,
      message: 'Admin settings reset to defaults successfully',
      data: settings,
    });
  } catch (error: any) {
    logger.error('Error resetting admin settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset admin settings',
      error: error.message,
    });
  }
};

/**
 * GET /api/admin/stats
 * Get admin dashboard statistics
 * @access Admin only
 */
export const getStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await adminService.getStats();

    res.json({
      success: true,
      message: 'Admin stats retrieved successfully',
      data: stats,
    });
  } catch (error: any) {
    logger.error('Error fetching admin stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch admin stats',
      error: error.message,
    });
  }
};
