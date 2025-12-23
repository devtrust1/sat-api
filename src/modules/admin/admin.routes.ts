import { Router } from 'express';
import { requireAdmin } from '../../middleware/admin.middleware';
import * as adminController from './admin.controller';

const router = Router();

/**
 * Best Practice: Single endpoint with PATCH for partial updates
 * This reduces API calls and simplifies backend logic
 */

/**
 * GET /api/admin/check-role
 * Check current user's role (for debugging)
 * @access Public (for debugging)
 */
router.get('/check-role', adminController.checkRole);

/**
 * GET /api/admin/settings
 * Get current admin settings
 * @access Admin only
 */
router.get('/settings', requireAdmin, adminController.getSettings);

/**
 * PATCH /api/admin/settings
 * Update admin settings (partial update - BEST PRACTICE)
 * @access Admin only
 * @body Partial<AdminSettingsData>
 */
router.patch('/settings', requireAdmin, adminController.updateSettings);

/**
 * POST /api/admin/settings/reset
 * Reset settings to defaults
 * @access Admin only
 */
router.post('/settings/reset', requireAdmin, adminController.resetSettings);

/**
 * GET /api/admin/stats
 * Get admin dashboard statistics
 * @access Admin only
 */
router.get('/stats', requireAdmin, adminController.getStats);

export default router;
