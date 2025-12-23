import { Response } from 'express';
import { bookmarkService } from './bookmark.service';
import { CreateBookmarkData } from './bookmark.types';
import { AuthRequest } from '../user/user.types';

export class BookmarkController {
  /**
   * Create a new bookmark
   * POST /api/users/me/bookmarks
   */
  async createBookmark(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      console.log('Request body for creating bookmark:', req.body);

      const data: CreateBookmarkData = req.body;

      // Validate required fields
      if (!data.type || !data.resourceId || !data.title) {
        return res.status(400).json({ error: 'Missing required fields: type, resourceId, title' });
      }

      const bookmark = await bookmarkService.createBookmark(userId, data);
      return res.status(201).json(bookmark);
    } catch (error: any) {
      console.error('Error creating bookmark:', error);
      if (error.message === 'Bookmark already exists for this resource in this session') {
        return res.status(409).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Failed to create bookmark' });
    }
  }

  /**
   * Get all bookmarks for the authenticated user
   * GET /api/users/me/bookmarks?type=lesson&limit=10&offset=0
   */
  async getBookmarks(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { type, limit, offset } = req.query;

      const bookmarks = await bookmarkService.getBookmarks(userId, {
        type: type as string,
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
      });

      return res.json(bookmarks);
    } catch (error) {
      console.error('Error getting bookmarks:', error);
      return res.status(500).json({ error: 'Failed to get bookmarks' });
    }
  }

  /**
   * Get a specific bookmark by ID
   * GET /api/users/me/bookmarks/:id
   */
  async getBookmarkById(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      const bookmark = await bookmarkService.getBookmarkById(id, userId);

      if (!bookmark) {
        return res.status(404).json({ error: 'Bookmark not found' });
      }

      return res.json(bookmark);
    } catch (error) {
      console.error('Error getting bookmark:', error);
      return res.status(500).json({ error: 'Failed to get bookmark' });
    }
  }

  /**
   * Delete a bookmark
   * DELETE /api/users/me/bookmarks/:id
   */
  async deleteBookmark(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      await bookmarkService.deleteBookmark(id, userId);

      return res.status(204).send();
    } catch (error: any) {
      console.error('Error deleting bookmark:', error);
      if (error.message === 'Bookmark not found or unauthorized') {
        return res.status(404).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Failed to delete bookmark' });
    }
  }

  /**
   * Check if a resource is bookmarked in a specific session
   * GET /api/users/me/bookmarks/check/:resourceId?sessionId=xxx
   */
  async checkIfBookmarked(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { resourceId } = req.params;
      const { sessionId } = req.query;

      if (!sessionId) {
        return res.status(400).json({ error: 'sessionId is required' });
      }

      const isBookmarked = await bookmarkService.checkIfBookmarked(
        userId,
        resourceId,
        sessionId as string
      );

      return res.json({ isBookmarked });
    } catch (error) {
      console.error('Error checking bookmark:', error);
      return res.status(500).json({ error: 'Failed to check bookmark' });
    }
  }

  /**
   * Get bookmark count by type
   * GET /api/users/me/bookmarks/count?type=lesson
   */
  async getBookmarkCount(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { type } = req.query;
      const count = await bookmarkService.getBookmarkCount(userId, type as string);

      return res.json({ count });
    } catch (error) {
      console.error('Error getting bookmark count:', error);
      return res.status(500).json({ error: 'Failed to get bookmark count' });
    }
  }
}

export const bookmarkController = new BookmarkController();
