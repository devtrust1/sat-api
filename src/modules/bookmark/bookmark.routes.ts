import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import { bookmarkController } from './bookmark.controller';

const router = Router();

/**
 * Bookmark Routes
 * Base path: /api/users/me/bookmarks
 */

// Create a new bookmark
router.post(
  '/',
  authenticate,
  authorize(),
  bookmarkController.createBookmark.bind(bookmarkController)
);

// Get all bookmarks (with optional filtering)
router.get(
  '/',
  authenticate,
  authorize(),
  bookmarkController.getBookmarks.bind(bookmarkController)
);

// Get bookmark count
router.get(
  '/count',
  authenticate,
  authorize(),
  bookmarkController.getBookmarkCount.bind(bookmarkController)
);

// Check if a resource is bookmarked
router.get(
  '/check/:resourceId',
  authenticate,
  authorize(),
  bookmarkController.checkIfBookmarked.bind(bookmarkController)
);

// Get a specific bookmark by ID
router.get(
  '/:id',
  authenticate,
  authorize(),
  bookmarkController.getBookmarkById.bind(bookmarkController)
);

// Delete a bookmark
router.delete(
  '/:id',
  authenticate,
  authorize(),
  bookmarkController.deleteBookmark.bind(bookmarkController)
);

export default router;
